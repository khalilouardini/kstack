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
    lifecycle:{state:'STARTABLE',source:'tracker:status-and-contract',detail:'Active unstarted issue'},
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
function multiProject() {
  const s=observations();
  s.candidates.forEach((c,i)=>c.project=String(i+1).repeat(8)+'-'+String(i+1).repeat(4)+'-'+
    String(i+1).repeat(4)+'-'+String(i+1).repeat(4)+'-'+String(i+1).repeat(12));
  s.graph_reports=s.graph_reports.flatMap(entry=>s.candidates.map((c,i)=>{
    const copy=structuredClone(entry);
    copy.report.candidates=[copy.report.candidates[i]];
    copy.report.candidates[0].project_id=c.project;
    return copy;
  }));
  s.graph_sources=Object.fromEntries(s.candidates.map(c=>[c.project,{mode:'PUBLISHED',graph_sha:s.main_sha}]));
  delete s.graph_source;
  s.accepted_graph_updates=[];
  return s;
}
function accept(s,index,number,head) {
  const project=s.candidates[index].project;
  s.command.push('--accept-graph-update',String(number));
  s.accepted_graph_updates.push({number,url:'https://github.example/repo/pull/'+number,state:'OPEN',base:'main',head_sha:head,reviewed_head_sha:head,
    review_source:'review-at-head',validation_exit:0,coverage_exit:1,coverage_state:'UPDATE_REQUIRED',project_ids:[project]});
  s.graph_sources[project]={mode:'ACCEPTED_UPDATE',pr_number:number,graph_sha:head};
  for (const e of s.graph_reports) if (e.report.candidates[0].project_id===project) e.report.graph_sha=head;
}
test('mixed published and accepted graph reports use each project source', () => {
  const s=multiProject(); accept(s,1,123,'b'.repeat(40));
  assert.deepEqual(compile(s).output.selected_ids,['T-0','T-1','T-2']);
  const b=s.graph_reports.find(e=>e.report.transition==='build' && e.report.candidates[0].identifier==='T-1');
  b.report.graph_sha=s.main_sha;
  assert.deepEqual(compile(s).output.selected_ids,['T-0','T-2']);
  assert.deepEqual(compile(s).output.planning_ids,['T-1']);
});
test('two accepted graph heads must each match the invoked reviewed PR and project', () => {
  const s=multiProject(); accept(s,0,123,'b'.repeat(40)); accept(s,1,124,'c'.repeat(40));
  assert.deepEqual(compile(s).output.selected_ids,['T-0','T-1','T-2']);
  const changes=[
    x=>x.graph_sources[x.candidates[0].project].pr_number=999,
    x=>x.accepted_graph_updates[0].reviewed_head_sha='d'.repeat(40),
    x=>x.accepted_graph_updates[0].head_sha='d'.repeat(40),
    x=>delete x.accepted_graph_updates[0].url,
    x=>x.accepted_graph_updates[0].project_ids=[x.candidates[1].project],
    x=>x.accepted_graph_updates[0].state='CLOSED',
    x=>x.command.splice(x.command.indexOf('--accept-graph-update'),2),
    x=>x.command.push('--accept-graph-update','0'),
  ];
  for (const change of changes) {const copy=structuredClone(s); change(copy); assert.throws(()=>compile(copy),/assessment:/);}
});
test('accepted project cannot silently use main or choose between overlapping heads', () => {
  const s=multiProject(); accept(s,0,123,'b'.repeat(40));
  const stale=structuredClone(s);
  stale.graph_sources[stale.candidates[0].project]={mode:'PUBLISHED',graph_sha:stale.main_sha};
  assert.throws(()=>compile(stale),/must use its accepted graph update/);
  const overlap=structuredClone(s); accept(overlap,1,124,'c'.repeat(40));
  overlap.accepted_graph_updates[1].project_ids.push(overlap.candidates[0].project);
  assert.throws(()=>compile(overlap),/multiple accepted graph updates/);
  const unrelated=structuredClone(s);
  unrelated.accepted_graph_updates[0].project_ids=['ffffffff-ffff-ffff-ffff-ffffffffffff'];
  assert.throws(()=>compile(unrelated),/does not affect an assessed project/);
});
test('an accepted graph can cover an assessed project with no candidate issues', () => {
  const s=multiProject(); accept(s,0,123,'b'.repeat(40));
  const empty='ffffffff-ffff-ffff-ffff-ffffffffffff';
  s.assessed_project_ids=[...s.candidates.map(c=>c.project),empty];
  s.command.push('--accept-graph-update','124');
  s.accepted_graph_updates.push({number:124,url:'https://github.example/repo/pull/124',state:'OPEN',base:'main',
    head_sha:'c'.repeat(40),reviewed_head_sha:'c'.repeat(40),review_source:'review-at-head',
    validation_exit:0,coverage_exit:0,coverage_state:'CURRENT',project_ids:[empty]});
  assert.deepEqual(compile(s).output.selected_ids,['T-0','T-1','T-2']);
  s.assessed_project_ids.pop();assert.throws(()=>compile(s),/does not affect an assessed project/);
});
test('local graph sources cannot vary across projects', () => {
  const s=multiProject(); s.command.push('--local-graph');
  const pins={index_path:'/owner/orchestration/index.json',manifest_path:'orchestration/project.json',
    index_digest:'sha256:'+'b'.repeat(64),manifest_digest:'sha256:'+'c'.repeat(64),source_revision:'f'.repeat(40)};
  for (const c of s.candidates) s.graph_sources[c.project]={mode:'APPROVED_LOCAL',local_graph:structuredClone(pins)};
  for (const e of s.graph_reports) {e.report.graph_sha=null;e.report.local_graph=structuredClone(pins);e.report.candidates[0].mode='APPROVED_LOCAL';}
  assert.equal(compile(s).output.selected_ids.length,3);
  s.graph_sources[s.candidates[1].project].local_graph.index_digest='sha256:'+'d'.repeat(64);
  assert.throws(()=>compile(s),/same approved local graph/);
});
test('future read-only authorization remains visible without dispatch or status promotion', () => {
  const s=observations();
  for (const [i,id] of [[0,'OGUR-656'],[1,'OGUR-658']]) {
    const c=s.candidates[i]; const old=c.issue_id; c.issue_id=id; c.active_release=false;
    c.lifecycle={state:'READ_ONLY_ONLY',source:'live:Backlog + owner planning decision',
      detail:'Future Backlog work; only read-only planning is authorized'};
    c.scope.plan=ok('Owner explicitly authorizes future read-only planning');
    c.scope.build={state:'UNSATISFIED',source:'original:future-scope',detail:'Implementation not admitted'};
    for (const e of s.graph_reports) e.report.candidates.find(x=>x.identifier===old).identifier=id;
    for (const pair of s.pairs) {if(pair.a===old)pair.a=id;if(pair.b===old)pair.b=id;}
  }
  const result=compile(s); assert.equal(result.input.lifecycle_contract,1);
  assert.deepEqual(result.output.selected_ids,['T-2']);assert.deepEqual(result.output.planning_ids,[]);
  assert.deepEqual(result.output.read_only_planning_ids,['OGUR-656','OGUR-658']);
  for (const c of result.output.outcomes.filter(x=>x.issue_id.startsWith('OGUR-'))) {
    assert.equal(c.plan.state,'ELIGIBLE');assert.equal(c.dispatch.state,'BLOCKED');
    assert.equal(c.disposition,'READ_ONLY_PLANNING');assert.equal(c.build.state,'BLOCKED');
  }
  delete s.candidates[0].lifecycle;assert.throws(()=>compile(s),/lifecycle startability/);
});
console.log(count+' assessment tests passed');
module.exports={observations};
