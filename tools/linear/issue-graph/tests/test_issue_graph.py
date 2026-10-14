import copy
import importlib.machinery
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


HELPER = Path(__file__).resolve().parents[1] / "bin/issue-graph"
loader = importlib.machinery.SourceFileLoader("issue_graph", str(HELPER))
spec = importlib.util.spec_from_loader(loader.name, loader)
graph = importlib.util.module_from_spec(spec)
loader.exec_module(graph)

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
NOW = "2026-10-14T12:00:00Z"


def issue(uuid, key):
    return dict(id=uuid, identifier=key, title=key + " current title",
                url="https://linear.app/example/issue/" + key, description="Full description",
                state={"name": "Done", "type": "completed"}, priority=2,
                assignee=None, labels=[], project=None, createdAt=NOW, updatedAt=NOW,
                completedAt=NOW)


def node(key, kind, project="alpha", issue_ref=None):
    return dict(id=key, kind=kind, project=project, issue_ref=issue_ref,
                title=key, unit_of=None, acceptance=["Accept this"], source="source", owner="human")


def edge(source, target, kind="start_after"):
    return dict(**{"from": source, "to": target}, type=kind, from_event="merge",
                to_event="build", source="original condition")


def record():
    return {
        "projects": [{"key": "alpha", "title": "Alpha", "authorization": "recorded"},
                     {"key": "beta", "title": "Beta", "authorization": "draft"}],
        "nodes": [node("container", "group"), node("unit", "unit", issue_ref=A),
                  node("review", "human", issue_ref=A), node("evidence", "evidence", issue_ref=A),
                  node("release", "release"), node("upstream", "external", "beta", B),
                  node("other", "unit", "beta")],
        "edges": [edge("upstream", "unit"), edge("unit", "review", "review_after"),
                  edge("review", "unit", "human_decision"),
                  edge("unit", "evidence", "verify_after"),
                  edge("evidence", "release", "evidence_required")],
    }


def evidence():
    return {"complete": True, "observed_at": NOW,
            "issues": [issue(A, "EXAMPLE-1"), issue(B, "EXAMPLE-2")]}


def provenance():
    return {"manifest_digest": "sha256:abc", "index_digest": "sha256:def",
            "source_pin_checked": False}


class ProjectionTests(unittest.TestCase):
    def test_preserves_conditions_and_keeps_completed_ticket_separate_from_checkpoint(self):
        source = record()
        before = copy.deepcopy(source)
        items, meta = graph.project_snapshot(source, provenance(), "alpha", evidence())
        by_key = {i["identifier"]: i for i in items}
        self.assertEqual(source, before)
        self.assertEqual(set(by_key), {"EXAMPLE-1", "EXAMPLE-2", "GATE-review",
                                      "GATE-evidence", "GATE-release"})
        self.assertEqual(meta["conditions"], 5)
        self.assertEqual(by_key["EXAMPLE-1"]["state"]["type"], "completed")
        for key in ["GATE-review", "GATE-evidence", "GATE-release"]:
            self.assertEqual(by_key[key]["state"]["type"], "triage")
            self.assertIsNone(by_key[key]["completedAt"])
        relation = by_key["GATE-review"]["relations"][0]
        self.assertEqual(relation["orchestrationType"], "human_decision")
        self.assertEqual(relation["fromEvent"], "merge")
        self.assertEqual(relation["source"], "original condition")
        detail = by_key["GATE-review"]["raw"]["snapshotDescription"]
        self.assertIn("EXAMPLE-1", detail)
        self.assertIn("Full description", detail)
        self.assertIn(NOW, detail)
        self.assertEqual(by_key["EXAMPLE-2"]["raw"]["projectAuthorization"], "draft")

    def test_transitive_upstream_closure_without_unrelated_project(self):
        source = record()
        source["nodes"].append(node("root", "human", "beta"))
        source["edges"].append(edge("root", "upstream", "human_decision"))
        nodes, _ = graph.select_nodes(source, "alpha")
        self.assertIn("root", {n["id"] for n in nodes})
        self.assertNotIn("other", {n["id"] for n in nodes})

    def test_multiple_representations_do_not_collapse_same_issue(self):
        source = record()
        source["nodes"].append(node("second_unit", "unit", issue_ref=A))
        items, _ = graph.project_snapshot(source, provenance(), "alpha", evidence())
        self.assertIn("VIEW-unit", {i["identifier"] for i in items})
        self.assertIn("VIEW-second_unit", {i["identifier"] for i in items})

    def test_missing_or_incomplete_evidence_is_refused(self):
        for sample in [{"complete": False}, dict(evidence(), issues=[issue(A, "EXAMPLE-1")])]:
            with self.subTest(sample=sample), self.assertRaises(ValueError):
                graph.project_snapshot(record(), provenance(), "alpha", sample)

    def test_workflow_type_is_required_even_for_done_status_name(self):
        sample = evidence()
        sample["issues"][0]["state"]["type"] = "guessed-done"
        with self.assertRaisesRegex(ValueError, "workflow"):
            graph.validate_evidence(sample)

    def test_duplicate_uuid_and_identifier_are_refused(self):
        sample = evidence()
        sample["issues"].append(issue(A, "EXAMPLE-3"))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            graph.validate_evidence(sample)
        sample = evidence()
        sample["issues"][1]["identifier"] = "EXAMPLE-1"
        with self.assertRaisesRegex(ValueError, "duplicate"):
            graph.validate_evidence(sample)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.database = self.root / "data/workspaces/alpha/graph.db"
        self.database.parent.mkdir(parents=True)
        self.cfg = {"viewer_root": self.root, "workspace": "alpha",
                    "database": self.database, "credential_backed": False}
        routes = self.root / "build/backend/routes"
        routes.mkdir(parents=True)
        (routes / "graph.js").write_text("MVP_SNAPSHOT_MODE")
        (routes / "issue.js").write_text("snapshotDescription")
        with sqlite3.connect(self.database) as db:
            db.executescript("""
                CREATE TABLE issue_cache(identifier TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
                CREATE TABLE label_cache(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                CREATE TABLE cache_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE saved_view(name TEXT);
                CREATE TABLE annotation(note TEXT);
                INSERT INTO issue_cache VALUES('REMOVED','{}',0);
                INSERT INTO saved_view VALUES('My custom view');
                INSERT INTO annotation VALUES('Keep this note');
                INSERT INTO cache_meta VALUES('viewer','original identity');
            """)

    def test_repeat_refresh_removes_old_nodes_preserves_user_data_and_backs_up(self):
        items, meta = graph.project_snapshot(record(), provenance(), "alpha", evidence())
        other = self.root / "data/workspaces/beta/graph.db"
        other.parent.mkdir(parents=True)
        other.write_bytes(b"other workspace untouched")
        first = graph.replace_cache(self.cfg, items, meta)
        second = graph.replace_cache(self.cfg, items, meta)
        self.assertNotEqual(first, second)
        with sqlite3.connect(first) as db:
            self.assertEqual(db.execute("SELECT identifier FROM issue_cache").fetchall(), [("REMOVED",)])
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM issue_cache").fetchone()[0], len(items))
            self.assertEqual(db.execute("SELECT * FROM saved_view").fetchall(), [("My custom view",)])
            self.assertEqual(db.execute("SELECT * FROM annotation").fetchall(), [("Keep this note",)])
            self.assertEqual(db.execute("SELECT value FROM cache_meta WHERE key='viewer'").fetchone()[0],
                             "original identity")
        self.assertEqual(other.read_bytes(), b"other workspace untouched")

    def test_write_error_rolls_back_issue_and_label_caches(self):
        with sqlite3.connect(self.database) as db:
            db.execute("CREATE TRIGGER refuse_import BEFORE INSERT ON issue_cache BEGIN SELECT RAISE(ABORT,'failed import'); END")
        items, meta = graph.project_snapshot(record(), provenance(), "alpha", evidence())
        with self.assertRaises(sqlite3.IntegrityError):
            graph.replace_cache(self.cfg, items, meta)
        with sqlite3.connect(self.database) as db:
            self.assertEqual(db.execute("SELECT identifier FROM issue_cache").fetchall(), [("REMOVED",)])
            self.assertEqual(db.execute("SELECT COUNT(*) FROM cache_meta WHERE key=?",
                                        (graph.META_KEY,)).fetchone()[0], 0)

    def test_live_workspace_or_missing_adapter_cannot_replace_cache(self):
        items, meta = graph.project_snapshot(record(), provenance(), "alpha", evidence())
        with self.assertRaisesRegex(ValueError, "backed"):
            graph.replace_cache(dict(self.cfg, credential_backed=True), items, meta)
        (self.root / "build/backend/routes/graph.js").write_text("no adapter")
        with self.assertRaisesRegex(ValueError, "adapter"):
            graph.replace_cache(self.cfg, items, meta)
        self.assertEqual(graph.cached(self.cfg)[0], {"REMOVED"})

    def test_binding_rejects_unknown_workspace_and_remote_url(self):
        with sqlite3.connect(self.root / "data/workspaces.db") as db:
            db.execute("CREATE TABLE workspace(id TEXT, api_key TEXT, webhook_secret TEXT)")
            db.execute("INSERT INTO workspace VALUES('alpha',NULL,NULL)")
        binding = dict(schema_version=1, viewer_root=str(self.root),
                       url="http://127.0.0.1:31415", service=None,
                       projects={"alpha": {"workspace": "missing"}})
        path = self.root / "binding.json"
        path.write_text(json.dumps(binding))
        with self.assertRaisesRegex(ValueError, "does not exist"):
            graph.load_binding(path, "alpha")
        binding["url"] = "https://example.com"
        path.write_text(json.dumps(binding))
        with self.assertRaisesRegex(ValueError, "loopback"):
            graph.load_binding(path, "alpha")

    def test_open_healthy_service_does_not_restart_it(self):
        argv = ["issue-graph", "open", "--config", "/binding", "--project", "alpha",
                "--repo", str(self.root)]
        cfg = dict(self.cfg, view_url="http://127.0.0.1:31415/?w=alpha")
        with patch.object(graph, "load_binding", return_value=cfg), \
             patch.object(graph, "api_status", return_value={"running": True, "identifiers": ["REMOVED"]}), \
             patch.object(graph, "start_service") as start, \
             patch.object(graph.sys, "argv", argv), patch("builtins.print"):
            self.assertEqual(graph.main(), 0)
            start.assert_not_called()


class ManifestTests(unittest.TestCase):
    def test_reads_one_indexed_manifest_without_execution_source_repin(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "orchestration").mkdir()
            data = json.loads((graph.STACK_ROOT / "project-template/orchestration.json").read_text())
            manifest = root / "orchestration/project.json"
            manifest.write_text(json.dumps(data))
            original = {"schema_version": 1, "source_revision": "a" * 40,
                        "manifest": "orchestration/project.json"}
            index = root / "orchestration/index.json"
            index.write_text(json.dumps(original))
            loaded, meta = graph.load_roadmap(root)
            self.assertEqual(loaded, data)
            self.assertFalse(meta["source_pin_checked"])
            self.assertEqual(meta["manifest_digest"], graph.digest(manifest.read_bytes()))
            self.assertEqual(json.loads(index.read_text()), original)

    def test_index_cannot_select_manifest_outside_orchestration(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "orchestration").mkdir()
            (root / "orchestration/index.json").write_text(json.dumps({
                "schema_version": 1, "source_revision": "a" * 40,
                "manifest": "orchestration/../outside.json"}))
            with self.assertRaises(ValueError):
                graph.load_roadmap(root)


if __name__ == "__main__":
    unittest.main()
