const assert = require('node:assert/strict');
const compile = require('../lib/assessment.cjs');
const ok = detail => ({state:'SATISFIED', source:'original-source:owner-or-live-observation', detail});
function observations() {
  const candidates=Array.from({length:3},(_,i)=>({issue_id:'T-'+i,milestone:'M1',priority:i,
    active_release:true,ownership:{state:'INACTIVE',source:'live:ownership'},file_scope:['shared.py'],external_overlaps:[]}));
  const s={schema_version:2,complete:true,snapshot_id:'test-observation',source_revision:'a'.repeat(40),
    command:['--parallel','3'],requested:3,candidates,pairs:candidates.flatMap((a,i)=>candidates.slice(i+1)
      .map(b=>({a:a.issue_id,b:b.issue_id,relation:'INDEPENDENT',source:'live:pairs',detail:'No dependency'})))};
  Object.assign(s, {main_sha:'a'.repeat(40), checked_at:'2026-10-27T16:00:00Z',
    graph_source:{mode:'PUBLISHED', graph_sha:'a'.repeat(40)}});
  s.candidates = s.candidates.map((c,i) => ({...c, issue_uuid:'00000000-0000-0000-0000-00000000000'+i,
    project:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    scope:{admission:ok('Owner admits followups within existing acceptance'), plan:ok('Bounded plan'),
      build:ok('Exact acceptance is authorized'), decisions:[]},
    native:{complete:true, source:'live:both-directions', blockers:[]}, foundation:ok('No unmerged foundation')}));
  s.graph_reports = ['plan','build'].map(transition => ({source:'admission-'+transition+'.json', report:{
    schema_version:1,main_sha:s.main_sha, graph_sha:s.main_sha, checked_at:s.checked_at, transition,
    evidence:{issues:{complete:true},request:{transition,selected:s.candidates.map(c=>c.issue_uuid)}},
    state:'BLOCKED', coverage:{state:'UPDATE_REQUIRED',missing_manifest:['unrelated']},
    candidates:s.candidates.map(c => ({issue_id:c.issue_uuid, identifier:c.issue_id, project_id:c.project,
      state:'ELIGIBLE', mode:'PUBLISHED', unmet:[], closure_graph_digest:'sha256:'+'c'.repeat(64),
      closure_evidence_digest:'sha256:'+'d'.repeat(64)}))}}));
  return s;
}
let count=0;
function test(name,fn) {fn(); count++; console.log('PASS assessment: '+name);}
test('candidate eligibility wins over group state and unrelated coverage gaps', () => {
  const r=compile(observations()); assert.equal(r.output.selected_ids.length,3);
  assert.equal(r.output.capacity.unfilled,0);
});
test('generic owner admission does not resolve specific build choices; merge holds do not block start', () => {
  const s=observations();
  s.candidates[0].scope.decisions.push({id:'specific-product-choice',stages:['build'],
    state:'UNKNOWN',source:'original:pending-choice',detail:'Owner has not chosen behavior'});
  s.candidates[1].scope.decisions.push({id:'deployed-sha',stages:['merge'],
    state:'UNSATISFIED',source:'original:deployment-hold',detail:'Merge waits for deployed SHA'});
  const r=compile(s); assert.deepEqual(r.output.selected_ids,['T-1','T-2']);
  assert.deepEqual(r.output.planning_ids,['T-0']);
  assert.match(r.input.candidates[0].checks.scope_build.source,/pending-choice/);
});
test('native blockers remain planning prerequisites even if graph allows build', () => {
  const s=observations(); s.candidates[0].native.blockers.push({state:'UNSATISFIED',
    source:'linear:blocks-relation',detail:'Predecessor has not met completion evidence'});
  const r=compile(s).output; assert.ok(!r.selected_ids.includes('T-0')); assert.ok(!r.planning_ids.includes('T-0'));
});
test('stage reports never substitute for one another or default all candidates to blocked', () => {
  const s=observations(); s.graph_reports[1].report.candidates.shift();
  const r=compile(s).output; assert.deepEqual(r.selected_ids,['T-1','T-2']); assert.deepEqual(r.planning_ids,['T-0']);
  assert.equal(r.outcomes[0].build.reasons[0].state,'UNKNOWN');
});
test('explicit local source binds exact owner pins, including when main graph is stale', () => {
  const s=observations(); s.command.push('--local-graph');
  s.graph_source={mode:'APPROVED_LOCAL',local_graph:{index_path:'/owner/orchestration/index.json',
    manifest_path:'orchestration/project.json',index_digest:'sha256:'+'b'.repeat(64),
    manifest_digest:'sha256:'+'c'.repeat(64),source_revision:'f'.repeat(40)}};
  for(const e of s.graph_reports) {
    e.report.graph_sha=null; e.report.local_graph=structuredClone(s.graph_source.local_graph);
    e.report.candidates.forEach(c=>c.mode='APPROVED_LOCAL');
  }
  assert.equal(compile(s).output.selected_ids.length,3);
  s.graph_reports[1].report.local_graph.index_path='/older-worktree/orchestration/index.json';
  assert.equal(compile(s).output.selected_ids.length,0);
  assert.equal(compile(s).output.planning_ids.length,3);
  s.command.pop(); assert.throws(()=>compile(s),/graph source/);
});
test('unknown admission and partial native reads never silently become ready', () => {
  const s=observations(); s.candidates[0].scope.admission.state='UNKNOWN'; s.candidates[1].native.complete=false;
  const r=compile(s).output; assert.deepEqual(r.selected_ids,['T-2']); assert.deepEqual(r.planning_ids,[]);
});
test('a sibling report cannot certify the requested issue, and duplicate reports fail that candidate', () => {
  const s=observations(); s.graph_reports[1].report.candidates[0].project_id='other-project';
  assert.deepEqual(compile(s).output.selected_ids,['T-1','T-2']);
  s.graph_reports.push(structuredClone(s.graph_reports[0]));
  assert.equal(compile(s).output.planning_ids.length,0);
});
test('bounded main maintenance admission stays available without a source bypass', () => {
  const s=observations();
  for(const e of s.graph_reports) {
    e.report.candidates[0].mode='LOCAL_RECONCILIATION';
    e.report.delta={added_nodes:[{id:'repair'}],repairs:[{node_id:'repair',origin:'approved-unit'}]};
  }
  assert.equal(compile(s).output.selected_ids.length,3);
});
console.log(count+' assessment tests passed');
module.exports={observations};
