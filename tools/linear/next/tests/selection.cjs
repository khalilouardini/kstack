const assert=require('node:assert/strict');
const select=require('../lib/selection.cjs');
const checks=()=>Object.fromEntries(['scope_plan','scope_build','native','plan_graph','build_graph','foundation']
  .map(k=>[k,{state:'SATISFIED',source:'fixture:'+k,detail:'Verified '+k}]));
function snapshot(n=3) {
  const candidates=Array.from({length:n},(_,i)=>({issue_id:'T-'+i,project:null,milestone:'M1',priority:i,
    active_release:true,ownership:{state:'INACTIVE',source:'fixture:owners'},checks:checks(),
    file_scope:['shared.py'],external_overlaps:[]}));
  const pairs=candidates.flatMap((a,i)=>candidates.slice(i+1).map(b=>({a:a.issue_id,b:b.issue_id,
    relation:'INDEPENDENT',source:'fixture:pair',detail:'No semantic or foundation dependency'})));
  return {schema_version:2,complete:true,snapshot_id:'fixture@main',source_revision:'a'.repeat(40),
    command:['next','--parallel','3'],requested:3,candidates,pairs};
}
let count=0;
function test(name,f) { f(); count++; console.log('PASS selection: '+name); }
test('shared files warn without reducing capacity, including active peers',()=>{
  const s=snapshot(); let r=select(s);
  assert.equal(r.selected_ids.length,3);assert.equal(r.outcomes[0].warnings.length,2);
  s.candidates[0].ownership.state='ACTIVE';r=select(s);
  assert.deepEqual(r.selected_ids,['T-1','T-2']);assert.equal(r.outcomes[0].disposition,'ACTIVE');
});
test('greedy trap chooses maximum first',()=>{
  const s=snapshot();s.pairs[0].relation=s.pairs[1].relation='INCOMPATIBLE';
  const r=select(s);assert.deepEqual(r.selected_ids,['T-1','T-2']);assert.equal(r.capacity.optimal,true);
  assert.equal(r.outcomes[0].reason,'PAIR_CONSTRAINT');
});
test('graph eligible does not waive semantic scope, native or foundations',()=>{
  for(const key of ['scope_plan','scope_build','native','foundation']) {
    const s=snapshot();s.candidates[0].checks[key].state='UNSATISFIED';
    assert.ok(!select(s).selected_ids.includes('T-0'));
  }
});
test('plan-only and unknown files remain separately discoverable',()=>{
  const s=snapshot();s.candidates[0].checks.build_graph.state='UNSATISFIED';
  s.candidates[1].file_scope=null;
  const r=select(s);assert.deepEqual(r.selected_ids,['T-2']);assert.deepEqual(r.planning_ids,['T-0','T-1']);
  assert.equal(r.capacity.unfilled,2);
});
test('unknown ownership and blocked planning never dispatch',()=>{
  const s=snapshot();s.candidates[0].ownership.state='UNKNOWN';s.candidates[1].checks.native.state='UNSATISFIED';
  assert.deepEqual(select(s).planning_ids,[]);assert.deepEqual(select(s).selected_ids,['T-2']);
});
test('above-five request, bound and bad input',()=>{
  const s=snapshot(8);s.requested=8;assert.equal(select(s).selected_ids.length,8);
  for(const n of [0,-1,1.5,13]) assert.throws(()=>select({...s,requested:n}));
  for(const change of [x=>x.complete=false,x=>x.pairs.pop(),x=>x.candidates.push(x.candidates[0]),
    x=>delete x.candidates[0].checks.native.source]) {
    const x=structuredClone(s);change(x);assert.throws(()=>select(x));
  }
});
test('bounded search reports uncertainty truthfully',()=>{
  const s=snapshot(6);s.search_budget=1;s.pairs[0].relation='DEPENDENCY';
  const r=select(s);assert.equal(r.capacity.optimal,false);
  assert.ok(r.capacity.upper_bound>=r.selected_ids.length);
});
test('same candidate stage assessment for named dispatch and pool selection',()=>{
  const s=snapshot();s.candidates[0].checks.build_graph.state='UNKNOWN';
  const whole=select(s).outcomes[0];s.candidates=s.candidates.slice(0,1);s.pairs=[];
  const single=select(s).outcomes[0];assert.deepEqual(single.plan,whole.plan);assert.deepEqual(single.build,whole.build);
});
test('exhaustive oracle and input order invariance for small pools',()=>{
  let seed=17;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(let trial=0;trial<120;trial++) {
    const s=snapshot(7);s.requested=1+Math.floor(random()*6);
    for(const c of s.candidates)c.active_release=random()>.5;
    for(const p of s.pairs)if(random()<.35)p.relation='INCOMPATIBLE';
    const rank=[...s.candidates].sort((a,b)=>Number(b.active_release)-Number(a.active_release)||a.priority-b.priority);
    let best=[];
    const score=a=>[a.length,a.filter(i=>rank[i].active_release).length,...a.map(i=>-i)];
    const better=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]>y[i];return false;};
    for(let mask=0;mask<128;mask++) {
      const a=rank.map((_c,i)=>i).filter(i=>mask&(1<<i));if(a.length>s.requested)continue;
      const ids=a.map(i=>rank[i].issue_id);
      if(s.pairs.some(p=>p.relation!=='INDEPENDENT'&&ids.includes(p.a)&&ids.includes(p.b)))continue;
      if(better(a,best))best=a;
    }
    const r=select(s);assert.equal(r.capacity.optimal,true);assert.deepEqual(r.selected_ids,best.map(i=>rank[i].issue_id));
    s.candidates.reverse();s.pairs.reverse();assert.deepEqual(select(s).selected_ids,r.selected_ids);
  }
});
test('lifecycle limits dispatch and preserves read-only planning while legacy snapshots replay',()=>{
  const s=snapshot();s.candidates[0].checks.scope_build.state='UNSATISFIED';
  const legacy=select(s);
  s.candidates.forEach((c,i)=>c.lifecycle={state:['READ_ONLY_ONLY','UNKNOWN','STARTABLE'][i],
    source:'tracker and scope observation',detail:['Backlog: advisory planning only','Status unverified','Active and startable'][i]});
  assert.deepEqual(select(s),legacy,'legacy checkpoint ignores new fields');
  s.lifecycle_contract=1;
  const r=select(s);assert.deepEqual(r.selected_ids,['T-2']);assert.deepEqual(r.planning_ids,[]);
  assert.deepEqual(r.read_only_planning_ids,['T-0']);assert.equal(r.capacity.read_only_planning,1);
  assert.equal(r.outcomes[0].plan.state,'ELIGIBLE');assert.equal(r.outcomes[0].dispatch.state,'BLOCKED');
  assert.equal(r.outcomes[1].dispatch.state,'UNKNOWN');assert.equal(r.outcomes[1].build.state,'UNKNOWN');
  s.candidates[2].checks.scope_build.state='UNSATISFIED';
  assert.deepEqual(select(s).planning_ids,['T-2']);
  s.candidates[2].lifecycle.state='MAYBE';assert.throws(()=>select(s),/startability/);
  s.lifecycle_contract=2;assert.throws(()=>select(s),/unsupported lifecycle/);
});
console.log(count+' selection tests passed');
module.exports={snapshot};
