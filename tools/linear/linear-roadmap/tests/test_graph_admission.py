import copy
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
API = runpy.run_path(str(ROOT / 'bin/graph-admission'))
PID = 'aaa488dc-e10c-5dd3-b7e9-45e238dbad3b'
REPAIR_ID = '6140b6b2-2241-47ba-9ad6-a79e04f2c7cf'
NOW = datetime(2026, 10, 14, 12, tzinfo=timezone.utc)
QUOTE = 'Approved report questions and maintenance. Release and human gates remain fixed.'


class AdmissionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.test')
        self.base = json.loads((ROOT / 'tests/fixtures/reporting.json').read_text())
        (self.repo / 'orchestration').mkdir()
        (self.repo / 'docs').mkdir()
        (self.repo / 'docs/scope.md').write_text(QUOTE + '\n')
        (self.repo / 'docs/project.md').write_text('```mermaid\n' + API['GRAPH']['render'](self.base) + '```\n')
        (self.repo / 'orchestration/graph.json').write_text(json.dumps(self.base))
        (self.repo / 'orchestration/index.json').write_text(json.dumps({
            'schema_version': 1, 'source_revision': 'a' * 40, 'manifest': 'orchestration/graph.json'}))
        self.git('add', '.')
        self.git('commit', '-m', 'published approved fixture')
        self.sha = self.git('rev-parse', 'main')
        self.snapshot = {'complete': True, 'main_sha': self.sha, 'checked_at': NOW.isoformat().replace('+00:00', 'Z'),
                         'projects': [{'project_id': PID, 'project_name': 'Reporting', 'view_path': 'docs/project.md', 'issues': []}]}
        self.request = {'selected': [self.base['nodes'][3]['issue_ref']], 'transition': 'build', 'nodes': [], 'events': []}
        for n in self.base['nodes']:
            self.prove(n, self.base)
        self.addCleanup(patch.stopall)
        patch.dict(API['GRAPH'], installed_revision=lambda: 'a' * 40).start()

    def git(self, *args):
        r = subprocess.run(['git', '-C', str(self.repo), *args], text=True, capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout.strip()

    def prove(self, node, graph):
        incoming = [e for e in graph['edges'] if e['to'] == node['id']]
        self.request['nodes'].append({'node_id': node['id'], 'owner': node['owner'],
                                     'acceptance': node['acceptance'], 'source': 'Live issue body and approved scope',
                                     'scope': {'path': 'docs/scope.md', 'line': 1, 'quote': QUOTE,
                                               'rationale': 'Repairs the existing approved reporting behavior'},
                                     'prerequisites': copy.deepcopy(incoming)})
        for event in API['GRAPH']['EVENTS'][node['kind']]:
            self.request['events'].append({'node_id': node['id'], 'event': event, 'state': 'SATISFIED',
                                           'source': 'Verified fixture event evidence at ' + self.sha})
        issues = self.snapshot['projects'][0]['issues']
        if node['issue_ref'] and all(i['id'] != node['issue_ref'] for i in issues):
            # One live issue carries the edges into every node that maps to it.
            shared = {n['id'] for n in graph['nodes'] if n['issue_ref'] == node['issue_ref']}
            issues.append({
                'id': node['issue_ref'], 'identifier': 'T-' + str(len(issues) + 1),
                'description': 'Full live issue body: acceptance and prerequisites read',
                'url': 'https://linear.example/issue/' + node['issue_ref'], 'updated_at': self.snapshot['checked_at'],
                'relations_complete': True,
                'prerequisites': copy.deepcopy([e for e in graph['edges'] if e['to'] in shared])})

    def audit(self, proposed=None):
        return API['audit'](self.repo, 'main', self.snapshot, self.request, proposed, now=NOW)

    def repair(self):
        graph = copy.deepcopy(self.base)
        node = copy.deepcopy(graph['nodes'][2])
        node.update(id='fixture_repair', issue_ref=REPAIR_ID, title='Repair answered fixture',
                    acceptance=['Fixture reproduces the approved server behavior'], source='Live maintenance ticket')
        graph['nodes'].append(node)
        self.prove(node, graph)
        self.request['selected'] = [REPAIR_ID]
        self.request['repairs'] = [{'node_id': node['id'], 'origin': 'contract', 'kind': 'maintenance',
                                   'rationale': 'Existing fixture contradicts the accepted behavior; no product boundary changes'}]
        return graph

    def test_unrelated_addition_warns_without_blocking_mapped_work(self):
        self.snapshot['projects'][0]['issues'].append({'id': REPAIR_ID, 'identifier': 'T-474'})
        r = self.audit()
        self.assertEqual(r['coverage']['state'], 'UPDATE_REQUIRED')
        self.assertEqual(r['coverage']['projects'][0]['missing_manifest'], ['T-474'])
        self.assertEqual(r['state'], 'ELIGIBLE')
        self.assertEqual(r['candidates'][0]['mode'], 'PUBLISHED')
        self.snapshot['projects'][0]['issues'][0]['updated_at'] = '2026-10-14T12:01:00Z'
        fresh = self.audit()
        self.assertEqual(r['candidates'][0]['closure_evidence_digest'], fresh['candidates'][0]['closure_evidence_digest'])
        self.snapshot['projects'][0]['issues'][0]['description'] += ' Changed acceptance boundary.'
        changed = self.audit()
        self.assertNotEqual(r['candidates'][0]['closure_evidence_digest'], changed['candidates'][0]['closure_evidence_digest'])

    def test_reworded_proof_prose_preserves_factual_digest_and_full_record(self):
        before = copy.deepcopy(self.audit())
        for proof in self.request['nodes']:
            proof['scope']['rationale'] = 'Same approved behavior, freshly explained'
            proof['source'] = 'Fresh explanation of the same authoritative evidence'
        for event in self.request['events']:
            event['source'] = 'Same satisfied prerequisite, freshly explained'
        after = self.audit()
        self.assertEqual(before['candidates'][0]['closure_evidence_digest'],
                         after['candidates'][0]['closure_evidence_digest'])
        self.assertNotEqual(before['evidence']['request'], after['evidence']['request'])
        self.assertEqual(after['evidence']['request'], self.request)
        self.request['events'].reverse()
        self.assertEqual(after['candidates'][0]['closure_evidence_digest'],
                         self.audit()['candidates'][0]['closure_evidence_digest'])
        next(e for e in self.request['events'] if e['node_id'] == 'scope')['state'] = 'UNKNOWN'
        changed = self.audit()
        self.assertEqual(changed['state'], 'BLOCKED')
        self.assertNotEqual(after['candidates'][0]['closure_evidence_digest'],
                            changed['candidates'][0]['closure_evidence_digest'])
        complete_request = copy.deepcopy(self.request)
        for field in ('rationale', 'proof_source', 'event_source'):
            with self.subTest(required_prose=field):
                self.request = copy.deepcopy(complete_request)
                if field == 'rationale':
                    self.request['nodes'][0]['scope']['rationale'] = ''
                elif field == 'proof_source':
                    self.request['nodes'][0]['source'] = ''
                else:
                    next(e for e in self.request['events'] if e['node_id'] == 'scope')['source'] = ''
                with self.assertRaisesRegex(ValueError, 'complete cited evidence required'):
                    self.audit()

    def test_selected_unmapped_requires_reconciliation(self):
        self.repair()
        with self.assertRaisesRegex(ValueError, 'repair evidence has no exact graph delta'):
            self.audit()
        self.request.pop('repairs')
        with self.assertRaisesRegex(ValueError, 'UNMAPPED'):
            self.audit()

    def test_selected_local_repair_records_exact_delta_and_live_evidence(self):
        graph = self.repair()
        r = self.audit(graph)
        self.assertEqual(r['state'], 'ELIGIBLE')
        self.assertEqual(r['main_sha'], self.sha)
        self.assertEqual(r['delta']['added_nodes'], [graph['nodes'][-1]])
        self.assertEqual(r['delta']['changed_edges'], [])
        self.assertEqual(r['evidence']['issues'], self.snapshot)
        self.assertEqual(r['candidates'][0]['mode'], 'LOCAL_RECONCILIATION')
        self.assertIn('scope', r['candidates'][0]['closure'])
        self.assertNotEqual(r['base_digest'], r['graph_digest'])
        self.assertEqual(r, self.audit(graph))

    def test_scope_expansion_dependency_release_and_human_changes_require_publication(self):
        for kind in ('scope', 'edge', 'release', 'human', 'feature', 'ownership'):
            with self.subTest(kind=kind):
                self.setUp()
                graph = self.repair()
                if kind == 'scope':
                    graph['projects'][0]['scope_source'] = 'A new approved-looking boundary'
                elif kind == 'edge':
                    graph['edges'].append({**graph['edges'][0], 'to': 'fixture_repair'})
                elif kind in ('release', 'human'):
                    node = next(n for n in graph['nodes'] if n['kind'] == kind)
                    node['acceptance'] = ['Weaker condition']
                elif kind == 'feature':
                    self.request['repairs'][0]['kind'] = 'feature'
                else:
                    graph['nodes'][-1]['owner'] = 'new owner'
                with self.assertRaisesRegex(ValueError, 'REVIEWED_PUBLICATION_REQUIRED'):
                    self.audit(graph)

    def test_live_dependency_change_requires_review_even_at_complete_coverage(self):
        self.snapshot['projects'][0]['issues'][1]['prerequisites'].append({
            'from': 'ui', 'from_event': 'merge', 'to': 'api', 'to_event': 'merge',
            'type': 'merge_after', 'source': 'New live dependency'})
        with self.assertRaisesRegex(ValueError, 'live dependencies differ'):
            self.audit()

    def test_unit_and_human_review_node_sharing_issue_ref_compare_issue_level_prerequisites(self):
        api = self.base['nodes'][3]
        self.base['nodes'].append({**self.base['nodes'][0], 'id': 'review_api', 'title': 'Review Report API',
                                   'issue_ref': api['issue_ref']})
        self.base['edges'] += [
            {'from': 'api', 'from_event': 'build', 'to': 'review_api', 'to_event': 'approve',
             'type': 'review_after', 'source': 'Cited prerequisite'},
            {'from': 'review_api', 'from_event': 'approve', 'to': 'api', 'to_event': 'merge',
             'type': 'human_decision', 'source': 'Cited prerequisite'}]
        (self.repo / 'orchestration/graph.json').write_text(json.dumps(self.base))
        (self.repo / 'docs/project.md').write_text('```mermaid\n' + API['GRAPH']['render'](self.base) + '```\n')
        self.git('add', '.')
        self.git('commit', '-m', 'approved review gate on the api issue')
        self.sha = self.git('rev-parse', 'main')
        self.snapshot.update(main_sha=self.sha)
        self.snapshot['projects'][0]['issues'], self.request['nodes'], self.request['events'] = [], [], []
        for n in self.base['nodes']:
            self.prove(n, self.base)
        r = self.audit()
        self.assertEqual(r['state'], 'ELIGIBLE')
        self.assertIn('review_api', r['candidates'][0]['closure'])
        issue = next(i for i in self.snapshot['projects'][0]['issues'] if i['id'] == api['issue_ref'])
        union = [e for e in self.base['edges'] if e['to'] in ('api', 'review_api')]
        self.assertEqual(issue['prerequisites'], union)
        drift = {'from': 'ui', 'from_event': 'merge', 'to': 'api', 'to_event': 'merge',
                 'type': 'merge_after', 'source': 'New live dependency'}
        for label, value in (('unit edges only', [e for e in union if e['to'] == 'api']),
                             ('review edges only', [e for e in union if e['to'] == 'review_api']),
                             ('not manifest order', union[::-1]), ('live drift', union + [drift])):
            with self.subTest(prerequisites=label):
                issue['prerequisites'] = copy.deepcopy(value)
                with self.assertRaisesRegex(ValueError, 'REVIEWED_PUBLICATION_REQUIRED: live dependencies differ'):
                    self.audit()

    def test_partial_missing_or_stale_evidence_refuses(self):
        for change in ('pagination', 'relations', 'body', 'owner', 'acceptance', 'quote', 'event', 'sha', 'stale', 'pin'):
            with self.subTest(change=change):
                self.setUp()
                if change == 'pagination':
                    self.snapshot['complete'] = False
                elif change == 'relations':
                    self.snapshot['projects'][0]['issues'][0]['relations_complete'] = False
                elif change == 'body':
                    self.snapshot['projects'][0]['issues'][0]['description'] = ''
                elif change == 'owner':
                    self.request['nodes'][2]['owner'] = 'unknown'
                elif change == 'acceptance':
                    self.request['nodes'][2]['acceptance'] = []
                elif change == 'quote':
                    self.request['nodes'][2]['scope']['quote'] = 'Invented scope approval'
                elif change == 'event':
                    self.request['events'] = []
                elif change == 'sha':
                    self.snapshot['main_sha'] = 'b' * 40
                elif change == 'stale':
                    self.snapshot['checked_at'] = (NOW - timedelta(hours=2)).isoformat().replace('+00:00', 'Z')
                else:
                    API['GRAPH']['installed_revision'] = lambda: 'b' * 40
                with self.assertRaises(ValueError):
                    self.audit()

    def test_unmet_start_blocks_but_future_human_gate_does_not_block_build(self):
        for e in self.request['events']:
            if e['node_id'] == 'merge':
                e['state'] = 'UNKNOWN'
        self.assertEqual(self.audit()['state'], 'ELIGIBLE')
        self.request['transition'] = 'merge'
        self.assertEqual(self.audit()['state'], 'BLOCKED')
        self.request['transition'] = 'build'
        for e in self.request['events']:
            if e['node_id'] == 'contract' and e['event'] == 'merge':
                e['state'] = 'UNSATISFIED'
        self.assertEqual(self.audit()['state'], 'BLOCKED')

    def test_cross_project_dependency_requires_its_live_membership_and_scope(self):
        other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        self.base['projects'].append({**self.base['projects'][0], 'key': 'upstream', 'linear_id': other})
        contract = self.base['nodes'][2]
        contract.update(project='upstream', unit_of=None)
        upstream_issue = self.snapshot['projects'][0]['issues'].pop(0)
        self.snapshot['projects'].append({'project_id': other, 'project_name': 'Upstream',
                                         'view_path': 'docs/upstream.md', 'issues': [upstream_issue]})
        rendered = '```mermaid\n' + API['GRAPH']['render'](self.base) + '```\n'
        (self.repo / 'orchestration/graph.json').write_text(json.dumps(self.base))
        (self.repo / 'docs/project.md').write_text(rendered)
        (self.repo / 'docs/upstream.md').write_text(rendered)
        self.git('add', '.')
        self.git('commit', '-m', 'approved cross-project dependency')
        self.sha = self.git('rev-parse', 'main')
        self.snapshot['main_sha'] = self.sha
        self.assertEqual(self.audit()['state'], 'ELIGIBLE')
        self.snapshot['projects'].pop()
        with self.assertRaisesRegex(ValueError, 'live issue/project membership'):
            self.audit()

    def test_reconciliation_bound_and_no_unused_additions(self):
        graph = self.repair()
        graph['nodes'][-1]['issue_ref'] = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        with self.assertRaisesRegex(ValueError, 'REVIEWED_PUBLICATION_REQUIRED'):
            self.audit(graph)
        graph['nodes'][-1]['issue_ref'] = REPAIR_ID
        added = graph['nodes'][-1]
        for i in range(3):
            extra = {**added, 'id': 'extra_' + str(i), 'issue_ref': f'00000000-0000-0000-0000-{i:012d}'}
            graph['nodes'].append(extra)
            self.request['selected'].append(extra['issue_ref'])
            self.request['repairs'].append({**self.request['repairs'][0], 'node_id': extra['id']})
        with self.assertRaisesRegex(ValueError, 'one to three'):
            self.audit(graph)
        with self.assertRaisesRegex(ValueError, 'one to three'):
            API['reconcile'](self.base, self.base, [], self.request['selected'])


if __name__ == '__main__':
    unittest.main()
