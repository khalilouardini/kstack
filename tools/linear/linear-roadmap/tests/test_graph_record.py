import copy
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BIN = ROOT / 'bin/graph-record'
API = runpy.run_path(str(BIN))


def fixture(name='reporting'):
    return json.loads((ROOT / 'tests/fixtures' / (name + '.json')).read_text())


def edge(a, ae, b, be, kind):
    return {'from': a, 'from_event': ae, 'to': b, 'to_event': be,
            'type': kind, 'source': 'Synthetic condition'}


class RoadmapTests(unittest.TestCase):
    def invalid(self, record, message):
        with self.assertRaisesRegex(ValueError, message):
            API['validate'](record)

    def test_two_unrelated_domains_and_effort_policies(self):
        for domain in ('reporting', 'onboarding'):
            r = fixture(domain)
            API['validate'](r)
            rendered = API['render'](r)
            self.assertIn(r['projects'][0]['title'], rendered)
            self.assertIn('HUMAN:', rendered)
            self.assertNotIn('READY', rendered)

    def test_project_union_with_external_dependency(self):
        a, b = fixture(), fixture('onboarding')
        for n in b['nodes']:
            n['id'] = 'b_' + n['id']
            if n['unit_of']:
                n['unit_of'] = 'b_' + n['unit_of']
        for e in b['edges']:
            e['from'], e['to'] = 'b_' + e['from'], 'b_' + e['to']
        a['projects'] += b['projects']
        a['nodes'] += b['nodes']
        a['edges'] += b['edges'] + [edge('api', 'merge', 'b_contract', 'plan', 'start_after')]
        API['validate'](a)
        rendered = API['render'](a)
        self.assertIn('Reporting project', rendered)
        self.assertIn('Onboarding project', rendered)

    def test_groups_render_as_subgraphs_without_sessions(self):
        r = fixture()
        API['validate'](r)
        self.assertIn('subgraph group_feature', API['render'](r))
        r['edges'].append(edge('feature', 'build', 'api', 'build', 'start_after'))
        self.invalid(r, 'non-executable group')

    def test_parallel_builds_with_merge_order_are_valid(self):
        API['validate'](fixture())

    def test_mixed_start_merge_cycle_is_rejected(self):
        r = fixture()
        r['edges'].append(edge('ui', 'merge', 'api', 'build', 'start_after'))
        self.invalid(r, 'event dependency cycle')

    def test_phase_projection_cycle_can_be_valid(self):
        r = fixture()
        r['edges'] = [edge('api','build','ui','build','start_after'),
                      edge('ui','merge','api','merge','merge_after')]
        API['validate'](r)

    def test_dangling_node_is_rejected(self):
        r = fixture()
        r['edges'][0]['from'] = 'absent'
        self.invalid(r, 'unknown node')

    def test_duplicate_ticket_session_mapping_is_rejected(self):
        r = fixture()
        r['nodes'][3]['issue_ref'] = r['nodes'][2]['issue_ref']
        self.invalid(r, 'multiple executable units')

    def test_unknown_project_is_rejected(self):
        r = fixture()
        r['nodes'][0]['project'] = 'absent'
        self.invalid(r, 'unknown project')

    def test_same_linear_project_cannot_be_aliased(self):
        r = fixture()
        p = copy.deepcopy(r['projects'][0])
        p['key'] = 'alias'
        r['projects'].append(p)
        self.invalid(r, 'multiple project keys')

    def test_recorded_units_need_real_issue_refs(self):
        r = fixture()
        r['nodes'][2]['issue_ref'] = None
        self.invalid(r, 'without a real issue_ref')

    def test_draft_without_tracker_ids_is_valid_but_not_ready(self):
        r = fixture()
        r['projects'][0].update(authorization='draft',linear_id=None)
        for n in r['nodes']:
            n['issue_ref'] = None
        API['validate'](r)
        self.assertNotIn('READY', API['render'](r))

    def test_human_decision_cannot_be_implemented_by_a_work_unit(self):
        r = fixture()
        r['edges'].append(edge('api','build','ui','merge','human_decision'))
        self.invalid(r, 'human approve')

    def test_evidence_source_must_be_evidence(self):
        r = fixture()
        r['edges'].append(edge('api','build','ui','merge','evidence_required'))
        self.invalid(r, 'evidence pass')

    def test_evidence_cannot_precede_its_required_build(self):
        r = fixture()
        r['edges'].append(edge('eval','pass','api','build','evidence_required'))
        self.invalid(r, 'event dependency cycle')

    def test_bad_event_is_rejected(self):
        r = fixture()
        r['edges'][0]['from_event'] = 'merged_typo'
        self.invalid(r, 'unsupported event')

    def test_containment_cycle_is_rejected(self):
        r = fixture()
        group = copy.deepcopy(r['nodes'][1])
        group.update(id='nested',unit_of='feature')
        r['nodes'][1]['unit_of'] = 'nested'
        r['nodes'].append(group)
        self.invalid(r, 'containment cycle')

    def test_unknown_schema_and_policy_fields_are_rejected(self):
        for key, value in [('schema_version', 2), ('model_typo', 'opus')]:
            r = fixture()
            r[key] = value
            self.invalid(r, 'expected|unknown')

    def test_model_policy_is_data_not_hardcoded(self):
        r = fixture()
        r['policy']['implementation_model'] = 'another-explicit-model'
        API['validate'](r)

    def test_duplicate_edges_are_rejected(self):
        r = fixture()
        r['edges'].append(copy.deepcopy(r['edges'][0]))
        self.invalid(r, 'duplicate dependency')

    def test_titles_cannot_inject_mermaid_markup(self):
        r = fixture()
        r['nodes'][0]['title'] = 'Review "] --> injected["<script>'
        API['validate'](r)
        rendered = API['render'](r)
        self.assertNotIn('<script>', rendered)
        self.assertNotIn('"] --> injected["', rendered)
        self.assertIn('&lt;script&gt;', rendered)

    def test_alias_issue_refs_cannot_bypass_duplicate_mapping(self):
        r = fixture()
        r['nodes'][3]['issue_ref'] = 'https://linear.example/issue/ALIAS-1'
        self.invalid(r, 'invalid identifier')

    def test_reserved_ids_and_subgraph_names_do_not_collide(self):
        r = fixture()
        r['nodes'][0]['id'] = 'end'
        r['edges'][0]['from'] = 'end'
        r['nodes'][1]['id'] = 'project_reporting'
        for n in r['nodes']:
            if n['unit_of'] == 'feature':
                n['unit_of'] = 'project_reporting'
        API['validate'](r)
        rendered = API['render'](r)
        self.assertIn('node_end{', rendered)
        self.assertIn('subgraph group_project_reporting', rendered)
        self.assertIn('subgraph project_reporting', rendered)
        self.assertNotIn('\n    end{', rendered)

    def test_cli_is_read_only_and_reports_scope_of_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = Path(temp) / 'plan.json'
            manifest.write_text(json.dumps(fixture()))
            before = manifest.read_bytes()
            result = subprocess.run([sys.executable,str(BIN),'validate',str(manifest)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('Live readiness not checked',result.stdout)
            self.assertEqual(manifest.read_bytes(),before)
            self.assertEqual([p.name for p in Path(temp).iterdir()],['plan.json'])
            manifest.write_text('{malformed')
            result = subprocess.run([sys.executable,str(BIN),'validate',str(manifest)],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertIn('INVALID',result.stderr)


if __name__ == '__main__':
    unittest.main()
