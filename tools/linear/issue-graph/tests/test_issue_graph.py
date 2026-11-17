import copy
import contextlib
import importlib.machinery
import importlib.util
import io
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
    def checkpoint_sample(self, status="historical", kind="merge", target="review"):
        sample = evidence()
        sample["checkpoints"] = [{
            "node_id": target, "manifest_digest": provenance()["manifest_digest"],
            "status": status, "summary": "Merged; independent review not verified",
            "observed_at": NOW, "event_at": NOW,
            "evidence": [{"kind": kind, "url": "https://github.com/example/repo/pull/7",
                          "summary": "Merge commit reached main", "sha": "a" * 40}],
        }]
        return sample

    def test_checkpoint_has_explicit_display_metadata_without_fake_assignee(self):
        items, _ = graph.project_snapshot(record(), provenance(), "alpha", evidence())
        review = next(i for i in items if i["identifier"] == "GATE-review")
        self.assertEqual(review["raw"]["checkpoint"]["kind"], "human")
        self.assertEqual(review["raw"]["checkpoint"]["status"], "unknown")
        self.assertEqual(review["raw"]["checkpoint"]["linked_identifier"], "EXAMPLE-1")
        self.assertIsNone(review["assignee"])

    def test_observed_merge_is_historical_without_certifying_review(self):
        source = record()
        source["edges"][1].update(from_event="build", to_event="approve")
        source["edges"][2].update(from_event="approve", to_event="merge")
        items, _ = graph.project_snapshot(source, provenance(), "alpha", self.checkpoint_sample())
        by_key = {i["identifier"]: i for i in items}
        review = by_key["GATE-review"]
        self.assertEqual(review["state"]["type"], "completed")
        self.assertEqual(review["completedAt"], NOW)
        self.assertEqual(review["raw"]["checkpoint"]["status"], "historical")
        self.assertEqual(review["raw"]["checkpoint"]["evidence"][0]["sha"], "a" * 40)
        self.assertEqual(by_key["GATE-evidence"]["state"]["type"], "triage")
        self.assertIn("independent review not verified", review["raw"]["snapshotDescription"])

    def test_stale_duplicate_or_unrelated_checkpoint_observation_is_rejected(self):
        for change in [dict(manifest_digest="sha256:stale"), dict(node_id="missing"),
                       dict(status="invented"), dict(evidence=[])]:
            sample = self.checkpoint_sample()
            sample["checkpoints"][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                graph.project_snapshot(record(), provenance(), "alpha", sample)
        sample = self.checkpoint_sample()
        sample["checkpoints"] *= 2
        with self.assertRaises(ValueError):
            graph.project_snapshot(record(), provenance(), "alpha", sample)

    def test_merge_cannot_close_evaluation_or_release_checkpoint(self):
        for target in ["evidence", "release"]:
            with self.subTest(target=target), self.assertRaises(ValueError):
                graph.project_snapshot(record(), provenance(), "alpha",
                                       self.checkpoint_sample(target=target))

    def test_verified_evaluation_requires_evaluation_evidence(self):
        sample = self.checkpoint_sample(status="verified", kind="evaluation", target="evidence")
        sample["checkpoints"][0]["summary"] = "Independent evaluation passed at recorded SHA"
        items, _ = graph.project_snapshot(record(), provenance(), "alpha", sample)
        item = next(i for i in items if i["identifier"] == "GATE-evidence")
        self.assertEqual(item["state"]["type"], "completed")
        self.assertEqual(item["raw"]["checkpoint"]["status"], "verified")
        sample["checkpoints"][0]["evidence"][0]["kind"] = "merge"
        with self.assertRaises(ValueError):
            graph.project_snapshot(record(), provenance(), "alpha", sample)

    def test_verified_review_requires_matching_head_and_human_authorization(self):
        source = record()
        source["edges"][1].update(from_event="build", to_event="approve")
        source["edges"][2].update(from_event="approve", to_event="merge")
        sample = self.checkpoint_sample(status="verified")
        proofs = sample["checkpoints"][0]["evidence"]
        proofs[0]["head_sha"] = "b" * 40
        proofs += [{"kind": "review", "url": "https://github.com/example/repo/pull/7#review",
                    "summary": "No findings at the merged head", "sha": "b" * 40},
                   {"kind": "human_decision", "url": "https://github.com/example/repo/pull/7",
                    "summary": "Authorized owner merged the reviewed head"}]
        items, _ = graph.project_snapshot(source, provenance(), "alpha", sample)
        self.assertEqual(next(i for i in items if i["identifier"] == "GATE-review")
                         ["raw"]["checkpoint"]["status"], "verified")
        proofs[1]["sha"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "head"):
            graph.project_snapshot(source, provenance(), "alpha", sample)
        proofs[1]["sha"] = "b" * 40
        proofs.pop()
        with self.assertRaises(ValueError):
            graph.project_snapshot(source, provenance(), "alpha", sample)

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

    def test_unlinked_draft_units_keep_their_kind_and_project(self):
        source = json.loads((graph.STACK_ROOT / "project-template/orchestration.json").read_text())
        sample = {"complete": True, "observed_at": NOW, "issues": []}
        items, _ = graph.project_snapshot(source, provenance(), "example", sample)
        units = [i for i in items if i["raw"]["manifestNode"]["kind"] == "unit"]
        self.assertEqual({i["raw"]["manifestNode"]["id"] for i in units}, {"contract", "api", "ui"})
        for item in units:
            self.assertTrue(item["identifier"].startswith("PROPOSED-"))
            self.assertEqual(item["state"], {"name": "Proposed unit — unverified", "type": "triage"})
            self.assertEqual(item["labels"][0]["id"], "proposed-unit")
            self.assertEqual(item["project"]["name"], source["projects"][0]["title"])
            self.assertIsNone(item["raw"]["linkedIssue"])
        for item in items:
            if item["raw"]["manifestNode"]["kind"] in {"human", "evidence", "release"}:
                self.assertTrue(item["identifier"].startswith("GATE-"))
                self.assertEqual(item["labels"][0]["id"], "checkpoint")

    def test_unmapped_live_project_ticket_is_visible_but_unknown(self):
        source = record()
        project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        source['projects'][0]['linear_id'] = project_id
        sample = evidence()
        extra = issue('33333333-3333-4333-8333-333333333333', 'EXAMPLE-3')
        extra['project'] = {'id': project_id, 'name': 'Alpha'}
        sample['issues'].append(extra)
        items, meta = graph.project_snapshot(source, provenance(), 'alpha', sample)
        live = next(i for i in items if i['identifier'] == 'EXAMPLE-3')
        self.assertEqual(live['raw']['graphAdmission']['state'], 'UNKNOWN')
        self.assertIn('unverified', live['raw']['snapshotDescription'])
        self.assertEqual(live['relations'], [])
        self.assertEqual(meta['unmapped'], ['EXAMPLE-3'])

    def test_live_delta_projection_is_labelled_and_does_not_mutate_baseline(self):
        base = json.loads((graph.STACK_ROOT / 'tools/linear/linear-roadmap/tests/fixtures/reporting.json').read_text())
        original = copy.deepcopy(base)
        live_iid = '33333333-3333-4333-8333-333333333333'
        unit = {**copy.deepcopy(base['nodes'][2]), 'id': 'live_new', 'issue_ref': live_iid,
                'title': 'New issue', 'unit_of': None}
        merged = copy.deepcopy(base)
        merged['nodes'].append(unit)
        canonical = lambda obj: graph.digest(json.dumps(obj, sort_keys=True, separators=(',', ':')).encode())
        report = {'schema_version': 1, 'state': 'ELIGIBLE', 'base_digest': canonical(base),
                  'graph_digest': canonical(merged), 'main_sha': 'a' * 40, 'checked_at': NOW,
                  'delta': {'kind': 'LIVE_RECONCILIATION', 'added_projects': [], 'added_nodes': [unit],
                            'added_edges': [], 'changed_edges': []},
                  'evidence': {'live_input': {'issues': {'complete': True}}},
                  'candidates': [{'node_id': 'live_new', 'state': 'ELIGIBLE'}]}
        projected, meta = graph.live_projection(base, provenance(), report)
        ids = sorted({n['issue_ref'] for n in projected['nodes'] if n['issue_ref']})
        sample = {'complete': True, 'observed_at': NOW,
                  'issues': [issue(i, 'EXAMPLE-' + str(j + 1)) for j, i in enumerate(ids)]}
        for item in sample['issues']:
            item['project'] = {'id': base['projects'][0]['linear_id'], 'name': 'Reporting'}
        items, _ = graph.project_snapshot(projected, meta, 'reporting', sample)
        new = next(i for i in items if i['id'] == live_iid)
        self.assertEqual(new['raw']['graphAdmission']['state'], 'ELIGIBLE')
        self.assertIn('not published', new['raw']['origin'])
        self.assertIn('not execution', new['raw']['snapshotDescription'])
        self.assertEqual(base, original)
        bad = copy.deepcopy(report)
        bad['base_digest'] = 'sha256:' + 'f' * 64
        with self.assertRaisesRegex(ValueError, 'unchanged indexed roadmap'):
            graph.live_projection(base, provenance(), bad)
        bad = copy.deepcopy(report)
        bad['delta']['added_nodes'][0]['acceptance'] = ['Changed after admission']
        with self.assertRaisesRegex(ValueError, 'recorded graph digest'):
            graph.live_projection(base, provenance(), bad)


    def test_independent_live_reports_combine_and_mark_existing_affected_nodes(self):
        base = json.loads((graph.STACK_ROOT / 'tools/linear/linear-roadmap/tests/fixtures/reporting.json').read_text())
        canonical = lambda obj: graph.digest(json.dumps(obj, sort_keys=True, separators=(',', ':')).encode())
        def report(node=None, edge=None, candidate=None):
            amended = copy.deepcopy(base)
            if node:
                amended['nodes'].append(copy.deepcopy(node))
            if edge:
                amended['edges'].append(copy.deepcopy(edge))
            return {'schema_version': 1, 'state': 'ELIGIBLE', 'base_digest': canonical(base),
                    'graph_digest': canonical(amended), 'main_sha': 'a' * 40, 'checked_at': NOW,
                    'delta': {'kind': 'LIVE_RECONCILIATION', 'added_projects': [],
                              'added_nodes': [node] if node else [], 'added_edges': [edge] if edge else [], 'changed_edges': []},
                    'evidence': {'live_input': {'issues': {'complete': True}}},
                    'candidates': [candidate] if candidate else []}
        first = {**copy.deepcopy(base['nodes'][2]), 'id': 'live_first', 'issue_ref': '33333333-3333-4333-8333-333333333333', 'unit_of': None}
        second = {**copy.deepcopy(base['nodes'][2]), 'id': 'live_second', 'issue_ref': '44444444-4444-4444-8444-444444444444', 'unit_of': None}
        gate = {'from': 'contract', 'from_event': 'merge', 'to': 'api', 'to_event': 'plan',
                'type': 'start_after', 'source': 'https://linear.example/issue'}
        rows = [report(first,candidate={'node_id': 'live_first','mode': 'LIVE_RECONCILIATION','state': 'ELIGIBLE'}),
                report(second,candidate={'node_id': 'live_second','mode': 'LIVE_RECONCILIATION','state': 'ELIGIBLE'}),
                report(edge=gate,candidate={'node_id': 'api','mode': 'LIVE_RECONCILIATION','state': 'BLOCKED'})]
        merged, meta = graph.live_projection(base, provenance(), rows)
        self.assertEqual({n['id'] for n in merged['nodes']} - {n['id'] for n in base['nodes']}, {'live_first', 'live_second'})
        self.assertEqual(meta['live_projection']['nodes']['api'], 'BLOCKED')
        self.assertEqual(len(meta['live_projection']['report_digests']), 3)
        conflicting = copy.deepcopy(second)
        conflicting['id'] = first['id']
        conflicting['acceptance'] = ['Different criteria']
        with self.assertRaisesRegex(ValueError, 'conflicting live projection records'):
            graph.live_projection(base, provenance(), [rows[0], report(conflicting)])


    def test_moved_ticket_and_empty_project_remain_visible_as_unmapped(self):
        source = record()
        project_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        source['projects'][1]['linear_id'] = project_id
        sample = evidence()
        sample['issues'][0]['project'] = {'id': project_id, 'name': 'Beta'}
        items, meta = graph.project_snapshot(source, provenance(), 'beta', sample)
        moved = next(i for i in items if i['identifier'] == 'EXAMPLE-1')
        self.assertEqual(moved['raw']['graphAdmission']['state'], 'UNKNOWN')
        self.assertEqual(meta['unmapped'], ['EXAMPLE-1'])

        empty = {'projects': [{'key': 'alpha', 'title': 'Alpha', 'authorization': 'recorded',
                               'linear_id': project_id}],
                 'nodes': [node('container', 'group')], 'edges': []}
        sample = {'complete': True, 'observed_at': NOW, 'issues': [sample['issues'][0]]}
        items, meta = graph.project_snapshot(empty, provenance(), 'alpha', sample)
        self.assertEqual([i['identifier'] for i in items], ['EXAMPLE-1'])
        self.assertEqual(meta['unmapped'], ['EXAMPLE-1'])


    def test_unlinked_external_is_a_prerequisite_in_its_own_project(self):
        source = record()
        source["nodes"].append(node("unknown_external", "external", "beta"))
        items, _ = graph.project_snapshot(source, provenance(), "beta", evidence())
        item = next(i for i in items if i["raw"]["manifestNode"]["id"] == "unknown_external")
        self.assertEqual(item["identifier"], "EXTERNAL-unknown_external")
        self.assertEqual(item["labels"][0]["id"], "external-prerequisite")
        self.assertEqual(item["project"]["name"], "Beta")
        self.assertEqual(item["state"], {"name": "External prerequisite — unverified", "type": "triage"})

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
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
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
        with contextlib.closing(sqlite3.connect(first)) as db, db:
            self.assertEqual(db.execute("SELECT identifier FROM issue_cache").fetchall(), [("REMOVED",)])
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM issue_cache").fetchone()[0], len(items))
            self.assertEqual(db.execute("SELECT * FROM saved_view").fetchall(), [("My custom view",)])
            self.assertEqual(db.execute("SELECT * FROM annotation").fetchall(), [("Keep this note",)])
            self.assertEqual(db.execute("SELECT value FROM cache_meta WHERE key='viewer'").fetchone()[0],
                             "original identity")
        self.assertEqual(other.read_bytes(), b"other workspace untouched")

    def test_write_error_rolls_back_issue_and_label_caches(self):
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
            db.execute("CREATE TRIGGER refuse_import BEFORE INSERT ON issue_cache BEGIN SELECT RAISE(ABORT,'failed import'); END")
        items, meta = graph.project_snapshot(record(), provenance(), "alpha", evidence())
        with self.assertRaises(sqlite3.IntegrityError):
            graph.replace_cache(self.cfg, items, meta)
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
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

    def test_viewer_database_is_closed_after_context_exit(self):
        with graph.connect(self.database, readonly=True) as db:
            self.assertEqual(db.execute("SELECT identifier FROM issue_cache").fetchall(), [("REMOVED",)])
        with self.assertRaises(sqlite3.ProgrammingError):
            db.execute("SELECT identifier FROM issue_cache")

    def test_binding_rejects_unknown_workspace_and_remote_url(self):
        with contextlib.closing(sqlite3.connect(self.root / "data/workspaces.db")) as db, db:
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

    def test_shared_workspace_does_not_report_other_project_as_current(self):
        with contextlib.closing(sqlite3.connect(self.root / "data/workspaces.db")) as db, db:
            db.execute("CREATE TABLE workspace(id TEXT, api_key TEXT, webhook_secret TEXT)")
            db.execute("INSERT INTO workspace VALUES('alpha',NULL,NULL)")
        binding = dict(schema_version=1, viewer_root=str(self.root),
                       url="http://127.0.0.1:31415", service=None,
                       projects={"alpha": {"workspace": "alpha"}, "beta": {"workspace": "alpha"}})
        path = self.root / "binding.json"
        path.write_text(json.dumps(binding))
        meta = dict(provenance(), project="alpha")
        with contextlib.closing(sqlite3.connect(self.database)) as db, db:
            db.execute("INSERT INTO cache_meta VALUES(?,?)", (graph.META_KEY, json.dumps(meta)))
        health = {"running": True, "identifiers": ["REMOVED"]}
        for action in ["status", "open"]:
            for project in ["alpha", "beta"]:
                with self.subTest(action=action, project=project):
                    argv = ["issue-graph", action, "--config", str(path),
                            "--project", project, "--repo", str(self.root)]
                    output = io.StringIO()
                    with patch.object(graph, "api_status", return_value=health), \
                         patch.object(graph, "load_roadmap", return_value=(record(), provenance())), \
                         patch.object(graph.sys, "argv", argv), contextlib.redirect_stdout(output):
                        self.assertEqual(graph.main(), 0)
                    result = json.loads(output.getvalue())
                    self.assertEqual(result["provenance"]["project"], "alpha")
                    self.assertEqual(result["state"], "CURRENT" if project == "alpha" else "STALE")


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
