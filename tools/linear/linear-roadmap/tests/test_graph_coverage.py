import copy
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = runpy.run_path(str(ROOT / 'bin/graph-coverage'))
PID = 'aaa488dc-e10c-5dd3-b7e9-45e238dbad3b'
ISSUES = [
    {'id': 'a962aa98-585b-5ea4-813b-da10739ec283', 'identifier': 'T-1'},
    {'id': 'c1e93840-9153-5bb2-a717-430d63bf03ce', 'identifier': 'T-2'},
    {'id': 'fe6fab62-ebed-5bc0-b547-6526382212fb', 'identifier': 'T-3'},
]


class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.email', 'fixture@example.test')
        self.git('config', 'user.name', 'Fixture')
        (self.repo / 'README.md').write_text('Fixture\n')
        self.commit()
        self.snapshot = {'complete': True, 'projects': [{
            'project_id': PID, 'project_name': 'Reporting',
            'view_path': 'docs/MVP.md', 'issues': copy.deepcopy(ISSUES),
        }]}

    def git(self, *args):
        result = subprocess.run(['git', '-C', str(self.repo), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-m', 'fixture')

    def view(self, tickets=ISSUES):
        path = self.repo / 'docs/MVP.md'
        path.parent.mkdir(exist_ok=True)
        path.write_text('```mermaid\nflowchart LR\n' + ''.join(
            f'  n{i}["{t["identifier"]}: Ticket"]\n' for i, t in enumerate(tickets)) + '```\n')

    def check(self, ref='main'):
        return API['check'](self.repo, ref, self.snapshot)

    def publish_record(self, record):
        orchestration = self.repo / 'orchestration'
        orchestration.mkdir(exist_ok=True)
        manifest = orchestration / 'reporting.json'
        manifest.write_text(json.dumps(record))
        (orchestration / 'index.json').write_text(json.dumps({
            'schema_version': 1, 'source_revision': 'a' * 40,
            'manifest': 'orchestration/reporting.json',
        }))
        rendered = subprocess.run(
            ['python3', str(ROOT / 'bin/graph-record'), 'render', str(manifest)],
            capture_output=True, text=True, check=True).stdout
        path = self.repo / 'docs/MVP.md'
        path.parent.mkdir(exist_ok=True)
        path.write_text('```mermaid\n' + rendered + '```\n')

    def test_render_cli_output_satisfies_uuid_and_view_coverage(self):
        record = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        self.publish_record(record)
        self.commit()
        self.assertEqual(self.check()['state'], 'CURRENT')

    def test_manifest_membership_requires_its_rendered_node_in_view(self):
        record = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        self.publish_record(record)
        path = self.repo / 'docs/MVP.md'
        path.write_text(path.read_text().replace('    node_api["Report API"]\n', ''))
        self.commit()
        self.assertEqual(self.check()['projects'][0]['missing_view'], ['T-2'])

    def test_parent_ticket_can_be_a_non_executable_rendered_group(self):
        record = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        parent = {'id': 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'identifier': 'T-4'}
        record['nodes'][1]['issue_ref'] = parent['id']
        self.snapshot['projects'][0]['issues'].append(parent)
        self.publish_record(record)
        self.commit()
        self.assertEqual(self.check()['state'], 'CURRENT')
        self.assertEqual(API['API']['EVENTS']['group'], ())

    def test_mentions_inside_other_node_labels_do_not_count(self):
        self.view([{'identifier': 'T-1: blocked by T-2'}, ISSUES[2]])
        self.commit()
        self.assertEqual(self.check()['projects'][0]['missing_view'], ['T-2'])

    def test_mermaid_directives_frontmatter_and_inline_nodes(self):
        path = self.repo / 'docs/MVP.md'
        path.parent.mkdir(exist_ok=True)
        for prefix in ('%%{init: {"theme": "dark"}}%%\n', '---\ntitle: Tickets\n---\n'):
            with self.subTest(prefix=prefix):
                path.write_text('```mermaid\n' + prefix + 'flowchart LR\n'
                                'n1["T-1"] --> n2["T-2"]; n3["T-3"]\n```\n')
                self.commit()
                self.assertEqual(self.check()['state'], 'CURRENT')

    def test_missing_main_view_blocks(self):
        report = self.check()
        self.assertEqual(report['state'], 'UPDATE_REQUIRED')
        self.assertFalse(report['projects'][0]['view_exists'])
        self.assertEqual(report['projects'][0]['missing_view'], ['T-1', 'T-2', 'T-3'])

    def test_local_complete_view_cannot_mask_incomplete_main(self):
        self.view(ISSUES[:1])
        self.commit()
        self.view()
        self.assertEqual(self.check()['projects'][0]['missing_view'], ['T-2', 'T-3'])
        self.git('checkout', '-b', 'graph-update')
        self.commit()
        self.assertEqual(self.check('graph-update')['state'], 'CURRENT')
        self.assertEqual(self.check()['state'], 'UPDATE_REQUIRED')

    def test_all_ticket_states_are_compared_and_contextual_container_counts(self):
        self.view(ISSUES[:2])
        with (self.repo / 'docs/MVP.md').open('a') as f:
            f.write('```mermaid\nflowchart LR\n  subgraph parent["T-3: Completed parent"]\n  end\n```\n')
        self.snapshot['projects'][0]['issues'][2]['status'] = 'archived'
        self.commit()
        self.assertEqual(self.check()['state'], 'CURRENT')

    def test_prose_and_edge_mentions_do_not_count_as_ticket_nodes(self):
        self.view(ISSUES[:1])
        with (self.repo / 'docs/MVP.md').open('a') as f:
            f.write('T-2 is complete.\n```mermaid\nflowchart LR\n  a -->|"T-3"| b\n```\n')
        self.commit()
        self.assertEqual(self.check()['projects'][0]['missing_view'], ['T-2', 'T-3'])

    def test_identifier_substring_does_not_count(self):
        self.view([{'identifier': 'T-10'}, ISSUES[1], ISSUES[2]])
        self.commit()
        self.assertEqual(self.check()['projects'][0]['missing_view'], ['T-1'])

    def test_partial_linear_evidence_and_unsafe_paths_refuse(self):
        self.snapshot['complete'] = False
        with self.assertRaisesRegex(ValueError, 'complete paginated'):
            self.check()
        self.snapshot['complete'] = True
        for path in ('../other.md', '/tmp/other.md'):
            self.snapshot['projects'][0]['view_path'] = path
            with self.assertRaisesRegex(ValueError, 'inside the repository'):
                self.check()

    def test_duplicate_project_or_issue_evidence_refuses(self):
        self.snapshot['projects'].append(copy.deepcopy(self.snapshot['projects'][0]))
        with self.assertRaisesRegex(ValueError, 'unique canonical Linear UUID'):
            self.check()
        self.snapshot['projects'].pop()
        self.snapshot['projects'][0]['issues'].append(copy.deepcopy(ISSUES[0]))
        with self.assertRaisesRegex(ValueError, 'unique canonical Linear UUID'):
            self.check()

    def test_two_uuids_cannot_claim_one_ticket_identifier(self):
        self.snapshot['projects'][0]['issues'][1]['identifier'] = 'T-1'
        with self.assertRaisesRegex(ValueError, 'identifier must be valid and unique'):
            self.check()

    def test_main_manifest_uuid_membership_required_even_when_view_complete(self):
        self.view()
        record = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        record['nodes'][3]['issue_ref'] = '11111111-1111-1111-1111-111111111111'
        orchestration = self.repo / 'orchestration'
        orchestration.mkdir()
        (orchestration / 'reporting.json').write_text(json.dumps(record))
        (orchestration / 'index.json').write_text(json.dumps({
            'schema_version': 1, 'source_revision': 'a' * 40,
            'manifest': 'orchestration/reporting.json',
        }))
        self.commit()
        report = self.check()['projects'][0]
        self.assertEqual(report['state'], 'UPDATE_REQUIRED')
        self.assertEqual(report['missing_view'], [])
        self.assertEqual(report['missing_manifest'], ['T-2'])

    def test_empty_project_must_still_belong_to_the_published_manifest(self):
        self.view()
        record = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        orchestration = self.repo / 'orchestration'
        orchestration.mkdir()
        (orchestration / 'reporting.json').write_text(json.dumps(record))
        (orchestration / 'index.json').write_text(json.dumps({
            'schema_version': 1, 'source_revision': 'a' * 40,
            'manifest': 'orchestration/reporting.json',
        }))
        self.snapshot['projects'][0].update(
            project_id='ffffffff-ffff-ffff-ffff-ffffffffffff', issues=[])
        self.commit()
        self.assertEqual(self.check()['state'], 'UPDATE_REQUIRED')

    def test_symlink_view_and_missing_ref_refuse(self):
        (self.repo / 'docs').mkdir()
        (self.repo / 'docs/MVP.md').symlink_to('../README.md')
        self.commit()
        with self.assertRaisesRegex(ValueError, 'regular file'):
            self.check()
        with self.assertRaises(ValueError):
            self.check('absent-ref')


if __name__ == '__main__':
    unittest.main()
