"""Generate complete offline admission reports from actual pinned Git fixtures."""
import copy
import json
from pathlib import Path
import runpy

tests = runpy.run_path(str(Path(__file__).resolve().parents[3] / 'linear-roadmap/tests/test_graph_admission.py'))
fixture = tests['AdmissionTests']()
fixture.setUp()
try:
    graph = fixture.repair()
    local = copy.deepcopy(fixture.audit(graph))
    event = next(e for e in fixture.request['events'] if e['node_id'] == 'scope')
    event['state'] = 'UNKNOWN'
    blocked = copy.deepcopy(fixture.audit(graph))
    event['state'] = 'SATISFIED'

    def publish(manifest):
        (fixture.repo / 'orchestration/graph.json').write_text(json.dumps(manifest))
        (fixture.repo / 'docs/project.md').write_text('```mermaid\n' + tests['API']['GRAPH']['render'](manifest) + '```\n')
        fixture.git('add', '.')
        fixture.git('commit', '-m', 'publish fixture graph')
        fixture.snapshot['main_sha'] = fixture.git('rev-parse', 'main')
        return copy.deepcopy(fixture.audit())

    fixture.request.pop('repairs')
    published = publish(graph)
    graph['nodes'].append({**copy.deepcopy(graph['nodes'][1]), 'id': 'unrelated_group', 'title': 'Unrelated group'})
    unrelated = publish(graph)
    print(json.dumps({'local': local, 'blocked': blocked, 'published': published, 'unrelated': unrelated}))
finally:
    fixture.doCleanups()
