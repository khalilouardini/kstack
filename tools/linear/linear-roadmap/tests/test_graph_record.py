import copy
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

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
            self.assertTrue(rendered.startswith('flowchart LR'))

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
        self.assertIsNone(r['projects'][0]['linear_id'])

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
        for key, value in [('schema_version', 2), ('unknown_field', 'opus')]:
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
        self.assertIn('#lt;script#gt;', rendered)

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

    def test_implicit_unit_phases_are_required_for_cycle_detection(self):
        r = fixture()
        r['nodes'] = [n for n in r['nodes'] if n['id'] in ('api', 'ui')]
        for n in r['nodes']:
            n['unit_of'] = None
        r['edges'] = [edge('api','merge','ui','merge','merge_after'),
                      edge('ui','merge','api','plan','start_after')]
        self.invalid(r, 'event dependency cycle')

    def test_cycle_error_names_only_a_cycle_path(self):
        r = fixture()
        r['edges'].append(edge('ui','merge','api','plan','start_after'))
        with self.assertRaises(ValueError) as result:
            API['validate'](r)
        message = str(result.exception)
        self.assertIn(' -> ',message)
        self.assertNotIn("('release', 'release')",message)
        self.assertNotIn("('eval', 'pass')",message)

    def test_wrong_schema_type_is_rejected(self):
        r = fixture()
        r['nodes'] = {}
        self.invalid(r, 'expected')

    def test_unknown_enum_is_rejected(self):
        r = fixture()
        r['nodes'][0]['kind'] = 'robot'
        self.invalid(r, 'invalid value')

    def test_empty_required_arrays_are_rejected(self):
        for path in ('projects','nodes','acceptance'):
            with self.subTest(path=path):
                r = fixture()
                if path == 'acceptance':
                    r['nodes'][0][path] = []
                else:
                    r[path] = []
                self.invalid(r, 'too few items')

    def test_empty_and_whitespace_strings_are_rejected(self):
        for title in ('', '  \n\t '):
            r = fixture()
            r['title'] = title
            self.invalid(r, 'empty string')

    def test_concurrency_bounds_and_boolean_are_rejected(self):
        for limit in (0,-1,6,True):
            with self.subTest(limit=limit):
                r = fixture()
                r['policy']['max_sessions'] = limit
                self.invalid(r, 'out of bounds|expected')

    def test_policy_unknown_fields_are_rejected(self):
        r = fixture()
        r['policy']['model_typo'] = 'opus'
        self.invalid(r, 'unknown')

    def test_duplicate_project_key_is_rejected(self):
        r = fixture()
        r['projects'].append(copy.deepcopy(r['projects'][0]))
        self.invalid(r, 'duplicate project key')

    def test_duplicate_node_id_is_rejected(self):
        r = fixture()
        r['nodes'].append(copy.deepcopy(r['nodes'][0]))
        self.invalid(r, 'duplicate node id')

    def test_parent_must_be_a_group_in_the_same_project(self):
        for parent in ('missing','api'):
            r = fixture()
            r['nodes'][2]['unit_of'] = parent
            self.invalid(r, 'unit_of must name a group')
        r = fixture()
        r['projects'] += fixture('onboarding')['projects']
        r['nodes'][1]['project'] = 'onboarding'
        self.invalid(r, 'unit_of must name a group')

    def test_recorded_project_requires_project_uuid(self):
        r = fixture()
        r['projects'][0]['linear_id'] = None
        self.invalid(r, 'lacks linear_id')

    def test_self_dependency_is_rejected(self):
        r = fixture()
        r['edges'].append(edge('api','plan','api','plan','start_after'))
        self.invalid(r, 'self dependency')

    def test_each_edge_type_rejects_wrong_target_kind_or_phase(self):
        for kind, event in [('start_after','merge'),('merge_after','build'),
                            ('release_after','merge'),('verify_after','build'),
                            ('review_after','build')]:
            with self.subTest(kind=kind):
                r = fixture()
                r['edges'].append(edge('api','merge','ui',event,kind))
                self.invalid(r, kind + ' must target')

    def test_human_and_evidence_sources_keep_their_semantic_type(self):
        r = fixture()
        r['edges'][0]['type'] = 'start_after'
        self.invalid(r, 'human approve edges must be human_decision')
        r = fixture()
        e = next(e for e in r['edges'] if e['from']=='eval')
        e['type'] = 'review_after'
        self.invalid(r, 'evidence pass edges must be evidence_required')

    def test_release_cannot_depend_on_unbuilt_plan(self):
        r = fixture()
        r['edges'].append(edge('api','plan','release','release','release_after'))
        self.invalid(r, 'release_after source must be')

    def test_groups_cannot_alias_executable_issues(self):
        r = fixture()
        r['nodes'][1]['issue_ref'] = r['nodes'][2]['issue_ref']
        self.invalid(r, 'groups cannot carry issue_ref')

    def test_recorded_sources_and_checks_reject_template_placeholders(self):
        for location in ('scope','node','edge','acceptance'):
            with self.subTest(location=location):
                r = fixture()
                if location=='scope': r['projects'][0]['scope_source']='TODO: scope'
                if location=='node': r['nodes'][0]['source']='TODO: source'
                if location=='edge': r['edges'][0]['source']='TODO: condition'
                if location=='acceptance': r['nodes'][0]['acceptance']=['TODO: check']
                self.invalid(r, 'TODO citation/check')

    def test_draft_template_stays_draft_and_generated_view_matches(self):
        stack = ROOT.parents[2]
        r = json.loads((stack/'project-template/orchestration.json').read_text(encoding='utf-8'))
        API['validate'](r)
        page = (stack/'project-template/ORCHESTRATION.md').read_text(encoding='utf-8')
        diagram = page.split('```mermaid\n',1)[1].split('```',1)[0]
        self.assertEqual(API['render'](r),diagram)
        self.assertEqual(r['projects'][0]['authorization'],'draft')

    def test_fixtures_exercise_distinct_topologies_and_external_event(self):
        a,b = fixture(),fixture('onboarding')
        topology=lambda r: [(e['from'],e['from_event'],e['to'],e['to_event']) for e in r['edges']]
        self.assertNotEqual(topology(a),topology(b))
        self.assertTrue(any(n['kind']=='external' for n in b['nodes']))
        API['validate'](b)
        bad=copy.deepcopy(b)
        next(e for e in bad['edges'] if e['from']=='provider')['from_event']='merge'
        self.invalid(bad, 'unsupported event')

    def test_mermaid_labels_preserve_literals_instead_of_html_entities(self):
        cases = [
            ("Owner's contract", "Owner's contract"),
            ('Fix #123; then #quot; deploy','Fix #35;123; then #35;quot; deploy'),
            ('`**bold** md`','#96;**bold** md#96;'),
            ('Wrap %%{init: {"theme":"dark"}}%% done',
             'Wrap #37;#37;{init: {#quot;theme#quot;:#quot;dark#quot;}}#37;#37; done'),
            ('API "v2" & <legacy>','API #quot;v2#quot; #amp; #lt;legacy#gt;'),
        ]
        for raw, escaped in cases:
            with self.subTest(raw=raw):
                r=fixture()
                r['nodes'][2]['title']=raw
                rendered=API['render'](API['validate'](r))
                self.assertIn(escaped,rendered)
                self.assertNotIn('&#',rendered)

    def test_render_cli_is_utf8_read_only_from_consuming_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = Path(temp)/'manifest.json'
            r = fixture()
            r['nodes'][2]['title'] = 'Voilà report'
            manifest.write_text(json.dumps(r,ensure_ascii=False),encoding='utf-8')
            before=manifest.read_bytes()
            env=dict(os.environ,LC_ALL='C',PYTHONUTF8='0',PYTHONIOENCODING='ascii')
            result=subprocess.run([sys.executable,str(BIN),'render',str(manifest)],
                                  cwd=temp,env=env,capture_output=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('Voilà report',result.stdout.decode('utf-8'))
            self.assertEqual(before,manifest.read_bytes())

    def test_cli_reports_recursion_and_encoding_errors_without_traceback(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest=Path(temp)/'bad.json'
            for data in (b'['*5000,b'{"title":"\xff"}'):
                manifest.write_bytes(data)
                result=subprocess.run([sys.executable,str(BIN),'render',str(manifest)],capture_output=True,text=True)
                self.assertEqual(result.returncode,1)
                self.assertIn('INVALID',result.stderr)
                self.assertNotIn('Traceback',result.stderr)

    def test_index_pin_and_manifest_revision_are_checked(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp)/'orchestration'
            directory.mkdir()
            manifest=directory/'project.json'
            manifest.write_text(json.dumps(fixture()),encoding='utf-8')
            index=directory/'index.json'
            index.write_text(json.dumps({'schema_version':1,'source_revision':'a'*40,
                                         'manifest':'orchestration/project.json'}),encoding='utf-8')
            with mock.patch.dict(API['load_index'].__globals__,{'installed_revision':lambda:'a'*40}):
                record,revision=API['load_index'](index)
                self.assertEqual(record,fixture())
                self.assertRegex(revision,r'^sha256:[0-9a-f]{64}$')
                manifest.write_text(json.dumps(fixture(),indent=2),encoding='utf-8')
                self.assertNotEqual(API['load_index'](index)[1],revision)
            with mock.patch.dict(API['load_index'].__globals__,{'installed_revision':lambda:'b'*40}):
                with self.assertRaisesRegex(ValueError,'source revision mismatch'):
                    API['load_index'](index)

    def test_index_rejects_overlay_arrays_and_escape_paths(self):
        schema=json.loads((ROOT/'references/index.schema.json').read_text(encoding='utf-8'))
        for manifest in (['orchestration/a.json','orchestration/b.json'],'../elsewhere.json'):
            value={'schema_version':1,'source_revision':'a'*40,'manifest':manifest}
            with self.assertRaises(ValueError):
                API['check_schema'](value,schema)

    def test_index_rejects_symlinks_outside_graph_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp)/'orchestration'
            directory.mkdir()
            outside=Path(temp)/'outside.json'
            outside.write_text(json.dumps(fixture()),encoding='utf-8')
            (directory/'project.json').symlink_to(outside)
            index=directory/'index.json'
            index.write_text(json.dumps({'schema_version':1,'source_revision':'a'*40,
                                         'manifest':'orchestration/project.json'}),encoding='utf-8')
            with mock.patch.dict(API['load_index'].__globals__,{'installed_revision':lambda:'a'*40}):
                with self.assertRaisesRegex(ValueError,'escapes consuming'):
                    API['load_index'](index)

    def test_index_reads_one_authoritative_manifest_not_an_overlay(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp)/'orchestration'
            directory.mkdir()
            (directory/'project.json').write_text(json.dumps(fixture()),encoding='utf-8')
            (directory/'inactive.json').write_text(json.dumps(fixture()),encoding='utf-8')
            index=directory/'index.json'
            index.write_text(json.dumps({'schema_version':1,'source_revision':'a'*40,
                                         'manifest':'orchestration/project.json'}),encoding='utf-8')
            with mock.patch.dict(API['load_index'].__globals__,{'installed_revision':lambda:'a'*40}):
                record,_=API['load_index'](index)
                self.assertEqual(len(record['nodes']),len(fixture()['nodes']))

    def test_installed_revision_rejects_dirty_source(self):
        revision=subprocess.CompletedProcess([],0,stdout='a'*40,stderr='')
        dirty=subprocess.CompletedProcess([],0,stdout='ORCHESTRATION.md',stderr='')
        with mock.patch.object(API['installed_revision'].__globals__['subprocess'],'run',side_effect=[revision,dirty]):
            with self.assertRaisesRegex(ValueError,'uncommitted'):
                API['installed_revision']()

    def test_gate_rejects_zero_discovered_roadmap_tests(self):
        with tempfile.TemporaryDirectory() as temp:
            repo=Path(temp)
            (repo/'bin').mkdir()
            (repo/'tools/linear/linear-roadmap/tests').mkdir(parents=True)
            checker=repo/'bin/check-stack'
            checker.write_text((ROOT.parents[2]/'bin/check-stack').read_text(encoding='utf-8'),encoding='utf-8')
            checker.chmod(0o755)
            result=subprocess.run([sys.executable,str(checker)],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            self.assertIn('none discovered',result.stdout)

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
