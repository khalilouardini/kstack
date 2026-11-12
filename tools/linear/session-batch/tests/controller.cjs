'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync,spawn,spawnSync}=require('node:child_process');
const {Controller,digest}=require('../lib/controller.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'session-batch-test-'));
let fixtureRepo;
function controller(label,a) {
  fixtureRepo=path.join(tmp,label);fs.mkdirSync(fixtureRepo);
  execFileSync('git',['init','-q',fixtureRepo]);
  return new Controller(path.join(fixtureRepo,'.git','kstack-session-batch'),a);
}
const hash='sha256:'+'d'.repeat(64), main='a'.repeat(40), head='b'.repeat(40);
const check=()=>({state:'SATISFIED',source:'fixture',detail:'observed'});
function snapshot(ids=['T-1','T-2','T-3']) {
  const candidates=ids.map((id,i)=>({issue_id:id,project:null,milestone:'M1',priority:i,active_release:true,
    ownership:{state:'INACTIVE',source:'fixture'}, lifecycle:{state:'STARTABLE',source:'status',detail:'active unstarted'},
    file_scope:['x'+i],external_overlaps:[],checks:Object.fromEntries(['scope_plan','scope_build','native','plan_graph','build_graph','foundation'].map(k=>[k,check()]))}));
  return {schema_version:2,complete:true,snapshot_id:'live-read',source_revision:'c'.repeat(40),command:['--parallel','3'],
    requested:3,main_sha:main,checked_at:new Date().toISOString(),candidates,
    pairs:candidates.flatMap((c,i)=>candidates.slice(i+1).map(d=>({a:c.issue_id,b:d.issue_id,relation:'INDEPENDENT',source:'fixture',detail:'observed'})))};
}
function makeAdapter() {
  const a={idempotentSessionCreation:true,sessions:new Map(),heads:new Map(),calls:[],verdict:'PASS',scope:hash,
    graph:hash, batch:hash, currentMain:main, reviewEdges:null, graphIssues:{}, graphReads:0, closures:{}, planEvidence:hash, buildEvidence:hash, impact:'UNAFFECTED', badOverlap:false,
    verifyRunAuthorization:async x=>({state:'APPROVED',mode:x.authorization.mode,source:'owner request',authorization_digest:digest(x.authorization)}),
    captureBatch:async x=>({complete:true,source:'full batch audit',issues:Object.fromEntries(x.selected_ids.map(id=>[id,hash])),admissions:Object.fromEntries(x.selected_ids.map(id=>[id,Object.fromEntries(['plan','build'].map(stage=>[stage,{scope_digest:a.scope,criteria_digest:hash,closure_graph_digest:a.closures[id] || hash,closure_evidence_digest:stage==='plan'?a.planEvidence:a.buildEvidence}]))]))}),
    verifyBatch:async x=>({state:'SATISFIED',issue_id:x.issue_id,stage:x.stage,digest:a.batch,source:'fresh closure and pairs',checked_at:new Date().toISOString()}),
    verifyReviewGraph:async x=>{a.graphReads++;return {complete:true,source:'graph audit',digest:a.graph,checked_at:new Date().toISOString(),edges:a.reviewEdges ?? x.review_edges,issues:Object.fromEntries(x.selection_snapshot.candidates.map(c=>[c.issue_id,Object.hasOwn(a.graphIssues,c.issue_id)?a.graphIssues[c.issue_id]:hash]))};},
    sessionIdle:async x=>({state:'IDLE',session_id:x.session_id,source:'host readback'}),
    admit:async({issue,stage})=>({state:'ALLOW',issue_id:issue,stage,source:'fresh tracker and graph',checked_at:new Date().toISOString(),main_sha:a.currentMain,scope_digest:a.scope,criteria_digest:hash,closure_graph_digest:a.closures[issue] || hash,closure_evidence_digest:stage==='plan'?a.planEvidence:a.buildEvidence}),
    verifyMainChange:async x=>({state:a.impact,issue_id:x.issue_id,stage:x.stage,from_main:x.from_main,to_main:x.to_main,changed_paths_digest:x.changed_paths_digest,overlapping_paths_digest:a.badOverlap?hash:x.overlapping_paths_digest,plan_digest:x.plan_digest,independent:true,assessor_id:'independent-supervisor',source:'independent code and plan impact check',checked_at:new Date().toISOString()}),
    ensureSession:async x=>{a.calls.push(['ensure',x.issue_id,x.session_id]);if(!a.sessions.has(x.session_id)) a.sessions.set(x.session_id,{state:'READY',session_id:x.session_id,issue_id:x.issue_id,permission_mode:'plan',branch:'branch-'+x.issue_id,worktree:'/tmp/'+x.issue_id,workspace_verified:true,status_verified:true,source:'host readback'});return a.sessions.get(x.session_id);},
    pollPlan:async x=>({state:'READY',session_id:x.session_id,plan:plan({issue_id:x.issue_id,session_id:x.session_id})}),
    validatePlan:async x=>({verdict:a.verdict,plan_digest:x.plan_digest,validator_id:'independent-validator',independent:true,evidence:'criteria, scope, tests and dependencies reviewed'}),
    verifyPlanApproval:async x=>({state:'APPROVED',issue_id:x.issue_id,plan_digest:x.plan_digest,actor:'owner',source:'original approval'}),
    build:async x=>{a.heads.set(x.issue_id,head);return {state:'PR_OPEN',session_id:x.session_id,pr_url:'https://example.test/'+x.issue_id,head_sha:head,session_idle:true,evidence:'host PR readback'};},
    head:async x=>a.heads.get(x.issue_id),dependency:async()=>({state:'SATISFIED',source:'verified external evidence'}),
    reviewCurrent:true,
    verifyReview:async x=>a.reviewCurrent ? {state:'CLEAN',head_sha:x.review.head_sha,review_id:x.review.review_id,reviewer_id:x.review.reviewer_id,ci:'GREEN',source:'fresh review and CI'} : {state:'UNKNOWN',source:'dismissed review or red CI'},
    review:async x=>({verdict:'CLEAN',head_sha:a.heads.get(x.issue_id),review_id:'review-'+x.issue_id,reviewer_id:'independent-reviewer',independent:true,review_process_stopped:true,ci:'GREEN',evidence:'review ID and CI at head'})};return a;
}
function input(id,ids=['T-1','T-2','T-3'],edges=[],auto=true) {return {run_id:id,repo:fixtureRepo,authorization:{mode:'implement',source:'owner request',issue_ids:ids,max_tracks:3},policy:{mode:'implement',auto_plan_validation:auto,max_plan_revisions:1,operation_timeout_ms:1000,worker_concurrency:3,review_concurrency:1},selection_snapshot:snapshot(ids),review_edges:edges};}
function plan(t) {return {issue_id:t.issue_id,session_id:t.session_id,text:'Plan with acceptance evidence',main_sha:main,scope_digest:hash,criteria_digest:hash,files:['file'],tests:['run focused regression']};}
let tests=[];
function test(name,f){tests.push({name,f});}
test('same issue is durably claimed once across concurrent runs',async()=>{
  const a=makeAdapter(), c=controller('claims',a);
  execFileSync('git',['-C',fixtureRepo,'-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','initial']);
  const sibling=path.join(tmp,'claims-sibling');
  execFileSync('git',['-C',fixtureRepo,'worktree','add','-qb','sibling',sibling]);
  await c.create(input('run1',['T-1'])); const second=input('run2',['T-1']);second.repo=sibling;await c.create(second);
  const bad=new Controller(path.join(sibling,'.git','other-root'),a);
  await assert.rejects(()=>bad.create({...second,run_id:'bad-root'}));
  const results=await Promise.allSettled([c.start('run1','T-1'),c.start('run2','T-1')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(a.sessions.size,1); assert.equal(a.calls.length,1);
});
test('failed creation recovers same host session ID without creating another',async()=>{
  const a=makeAdapter(),original=a.ensureSession;let first=true;
  a.ensureSession=async x=>{const result=await original(x);if(first){first=false;throw Error('response lost');}return result;};
  const c=controller('recover',a);await c.create(input('run',['T-1']));
  await assert.rejects(()=>c.start('run','T-1'),/response lost/);const t=await c.start('run','T-1');
  assert.equal(a.sessions.size,1);assert.equal(a.calls[0][2],a.calls[1][2]);assert.equal(t.state,'READY');
});
test('cross-process controllers for sibling worktrees cannot claim one issue twice',async()=>{
  const a=makeAdapter(), c=controller('process-claims',a);
  execFileSync('git',['-C',fixtureRepo,'-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','initial']);
  const sibling=path.join(tmp,'process-sibling');execFileSync('git',['-C',fixtureRepo,'worktree','add','-qb','sibling',sibling]);
  await c.create(input('run1',['T-1']));const second=input('run2',['T-1']);second.repo=sibling;await c.create(second);
  const helper=path.join(tmp,'claim-child.cjs'), counter=path.join(tmp,'claim-create-count');
  const modulePath=path.join(__dirname,'../lib/controller.cjs');
  fs.writeFileSync(helper,`
    const fs=require('node:fs'),{Controller}=require(${JSON.stringify(modulePath)});
    const hash='sha256:'+'d'.repeat(64),main='a'.repeat(40), root=process.argv[2], id=process.argv[3];
    const adapter={idempotentSessionCreation:true,
      verifyBatch:async x=>({state:'SATISFIED',issue_id:x.issue_id,digest:hash,source:'fresh',checked_at:new Date().toISOString()}),
      admit:async x=>({state:'ALLOW',issue_id:x.issue,stage:x.stage,source:'fresh',checked_at:new Date().toISOString(),main_sha:main,scope_digest:hash,criteria_digest:hash,closure_graph_digest:hash,closure_evidence_digest:hash}),
      ensureSession:async x=>{fs.appendFileSync(${JSON.stringify(counter)},'created\\n');return {state:'READY',session_id:x.session_id,issue_id:x.issue_id,permission_mode:'plan',branch:'b',worktree:'/tmp/w',workspace_verified:true,status_verified:true,source:'readback'};}};
    new Controller(root,adapter).start(id,'T-1').then(()=>process.exit(0),()=>process.exit(2));
  `);
  const child=id=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[helper,c.root,id]);p.on('error',reject);p.on('exit',resolve);});
  const codes=await Promise.all([child('run1'),child('run2')]);
  assert.deepEqual(codes.sort(),[0,2]);assert.equal(fs.readFileSync(counter,'utf8').trim().split('\n').length,1);
});
test('fresh admissions and independent exact-plan validation gate build',async()=>{
  const a=makeAdapter(), c=controller('validation',a);await c.create(input('run',['T-1']));
  let t=await c.start('run','T-1'); t=await c.plan('run','T-1',plan(t));assert.equal(t.phase,'BUILD');
  a.scope='sha256:'+'e'.repeat(64);await assert.rejects(()=>c.beginBuild('run','T-1'),/conditions changed/);
  assert.equal(c.snapshot('run').tracks['T-1'].state,'READY');
  const b=makeAdapter(), d=controller('validator',b);await d.create(input('run',['T-1']));t=await d.start('run','T-1');
  b.validatePlan=async x=>({verdict:'PASS',plan_digest:x.plan_digest,validator_id:x.plan.session_id,independent:true,evidence:'self'});
  await assert.rejects(()=>d.plan('run','T-1',plan(t)),/independent exact-plan/);
});
test('phase-specific graph evidence uses the matching captured phase baseline',async()=>{
  const a=makeAdapter();a.buildEvidence='sha256:'+'e'.repeat(64);
  const c=controller('phase-specific',a);await c.create(input('run',['T-1','T-2']));
  for(const id of ['T-1','T-2']) {let t=await c.start('run',id);await c.plan('run',id,plan(t));}
  assert.equal((await c.beginBuild('run','T-1')).phase,'REVIEW');
  assert.equal((await c.review('run','T-1')).state,'COMPLETED');
  a.buildEvidence='sha256:'+'f'.repeat(64);
  await assert.rejects(()=>c.beginBuild('run','T-2'),/build conditions changed/);
});
test('manual policy cannot build until independently verified human approval',async()=>{
  const a=makeAdapter(), c=controller('human',a);await c.create(input('run',['T-1'],[],false));
  let t=await c.start('run','T-1');t=await c.plan('run','T-1',plan(t));assert.equal(t.state,'HUMAN_REQUIRED');
  t=await c.approvePlan('run','T-1',{locator:'approval'});assert.equal(t.approval_kind,'HUMAN');
  t=await c.beginBuild('run','T-1');assert.equal(t.phase,'REVIEW');
});
test('review_after holds only dependent review and checks upstream head',async()=>{
  const a=makeAdapter(), c=controller('review',a);
  const edge={from:'T-1',from_event:'review',to:'T-2',to_event:'review',source:'graph'};
  await c.create(input('run',['T-1','T-2','T-3'],[edge]));
  for(const id of ['T-1','T-2','T-3']) {let t=await c.start('run',id);t=await c.plan('run',id,plan(t));await c.beginBuild('run',id);}
  const reads=a.graphReads;let q=await c.reviewQueue('run');assert.equal(a.graphReads-reads,1);assert.deepEqual(q.ready,['T-1','T-3']);assert.equal(q.blocked[0].issue_id,'T-2');
  assert.equal((await c.review('run','T-2')).state,'BLOCKED');await c.review('run','T-3');await c.review('run','T-1');
  q=await c.reviewQueue('run');assert.deepEqual(q.ready,['T-2']);
  a.heads.set('T-1','c'.repeat(40));q=await c.reviewQueue('run');assert.ok(q.blocked.some(x=>x.issue_id==='T-2'));
});
test('shared worker and reviewer limits block excess without disturbing siblings',async()=>{
  const a=makeAdapter(), c=controller('limits',a), x=input('run',['T-1','T-2','T-3']);
  x.policy.worker_concurrency=1;await c.create(x);
  let t=await c.start('run','T-1');assert.equal((await c.start('run','T-2')).reason,'worker capacity unavailable');
  t=await c.plan('run','T-1',plan(t));await c.beginBuild('run','T-1');
  t=await c.start('run','T-2');t=await c.plan('run','T-2',plan(t));await c.beginBuild('run','T-2');
  let release;const barrier=new Promise(r=>release=r), original=a.review;
  a.review=async args=>{await barrier;return original(args);};
  const pending=c.review('run','T-1');
  while(c.snapshot('run').tracks['T-1'].state!=='RUNNING') await new Promise(r=>setImmediate(r));
  assert.equal((await c.review('run','T-2')).reason,'review capacity unavailable');release();await pending;
  assert.equal((await c.review('run','T-2')).state,'COMPLETED');
});
test('supervisor tick advances independent tracks in parallel and survives sibling failure',async()=>{
  const a=makeAdapter(), c=controller('tick',a);await c.create(input('run',['T-1','T-2','T-3']));
  let result=await c.tick('run');assert.equal(result.results.length,3);assert.equal(a.sessions.size,3);
  await c.tick('run');await c.tick('run');
  a.review=async x=>x.issue_id==='T-2' ? {verdict:'BLOCKED',head_sha:a.heads.get(x.issue_id),review_id:'review-'+x.issue_id,reviewer_id:'separate',independent:true,review_process_stopped:true,evidence:'finding'} :
    {verdict:'CLEAN',head_sha:a.heads.get(x.issue_id),review_id:'review-'+x.issue_id,reviewer_id:'separate',independent:true,review_process_stopped:true,ci:'GREEN',evidence:'review + CI'};
  await c.tick('run');await c.tick('run');await c.tick('run');
  const tracks=c.snapshot('run').tracks;assert.equal(tracks['T-1'].state,'COMPLETED');
  assert.equal(tracks['T-2'].state,'BLOCKED');assert.equal(tracks['T-3'].state,'COMPLETED');
});
test('timed-out host operation remains reserved while independent work continues',async()=>{
  const a=makeAdapter(), c=controller('timeout',a), x=input('run',['T-1','T-2']);x.policy.operation_timeout_ms=1000;
  const original=a.ensureSession;a.ensureSession=async args=>args.issue_id==='T-1' ? new Promise(()=>{}) : original(args);
  await c.create(x);const first=await c.tick('run');
  assert.ok(first.results.some(r=>r.issue_id==='T-1' && r.state==='UNKNOWN_IN_FLIGHT'));
  let track=c.snapshot('run').tracks['T-1'];assert.equal(track.state,'ERROR');assert.equal(track.uncertain_operation,true);
  assert.ok(track.worker_slot && fs.existsSync(track.worker_slot));
  await c.tick('run');track=c.snapshot('run').tracks['T-2'];assert.equal(track.phase,'BUILD');
  assert.equal(c.snapshot('run').tracks['T-1'].state,'ERROR');
});
test('direct CLI timeout preserves uncertain state and does not release the worker slot',async()=>{
  const a=makeAdapter(),c=controller('cli-timeout',a),x=input('run',['T-1']);x.policy.operation_timeout_ms=100;await c.create(x);
  const adapterPath=path.join(tmp,'hung-adapter.cjs');
  fs.writeFileSync(adapterPath,`module.exports={idempotentSessionCreation:true,
    verifyBatch:async x=>({state:'SATISFIED',issue_id:x.issue_id,digest:'sha256:'+'d'.repeat(64),source:'fresh',checked_at:new Date().toISOString()}),
    admit:async x=>({state:'ALLOW',issue_id:x.issue,stage:x.stage,source:'fresh',checked_at:new Date().toISOString(),main_sha:'a'.repeat(40),scope_digest:'sha256:'+'d'.repeat(64),criteria_digest:'sha256:'+'d'.repeat(64),closure_graph_digest:'sha256:'+'d'.repeat(64),closure_evidence_digest:'sha256:'+'d'.repeat(64)}),
    ensureSession:async()=>new Promise(()=>{})};`);
  const r=spawnSync(process.execPath,[path.join(__dirname,'../bin/session-batch'),'--state-root',c.root,'--adapter',adapterPath,'start','run','T-1'],{encoding:'utf8',timeout:5000});
  assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).state,'UNKNOWN_IN_FLIGHT');
  const t=c.snapshot('run').tracks['T-1'];assert.equal(t.uncertain_operation,true);assert.ok(fs.existsSync(t.worker_slot));
});
test('plan-only run respects worker capacity and cannot build or review, including CLI',async()=>{
  const a=makeAdapter(), c=controller('plan-only',a), x=input('run',['T-1','T-2']);
  x.policy.mode=x.authorization.mode='plan_only';x.policy.worker_concurrency=1;
  let idle=false;a.sessionIdle=async z=>({state:idle?'IDLE':'RUNNING',session_id:z.session_id,source:'host'});
  await c.create(x);await c.tick('run');let result=await c.tick('run');
  assert.equal(c.snapshot('run').tracks['T-1'].state,'WAITING');
  assert.equal((await c.start('run','T-2')).reason,'worker capacity unavailable');
  idle=true;await c.tick('run');assert.equal(c.snapshot('run').tracks['T-1'].state,'COMPLETED');
  await c.tick('run');await c.tick('run');assert.equal(c.snapshot('run').tracks['T-2'].state,'COMPLETED');
  await assert.rejects(()=>c.beginBuild('run','T-1'),/plan-only/);
  await assert.rejects(()=>c.review('run','T-1'),/plan-only/);
  await assert.rejects(()=>c.approvePlan('run','T-1',{}),/plan-only/);
  const cli=path.join(__dirname,'../bin/session-batch');
  for(const op of ['build','review']) {
    const r=spawnSync(process.execPath,[cli,'--state-root',c.root,op,'run','T-1'],{encoding:'utf8'});
    assert.equal(r.status,2);assert.match(r.stderr,/plan-only/);
  }
});
test('plan-only includes startable planning IDs while holding Backlog advice and respecting capacity',async()=>{
  const a=makeAdapter(),c=controller('planning-lanes',a),x=input('run',['T-1','T-2','T-3']);
  x.policy.mode=x.authorization.mode='plan_only';
  for (const candidate of x.selection_snapshot.candidates) candidate.checks.scope_build.state='UNSATISFIED';
  x.selection_snapshot.candidates[1].lifecycle={state:'READ_ONLY_ONLY',source:'backlog',detail:'advisory only'};
  const run=await c.create(x);
  assert.deepEqual(Object.keys(run.tracks),['T-1','T-3']);assert.deepEqual(run.held_lifecycle_ids,['T-2']);
  await c.tick('run');assert.equal(a.sessions.size,2);
});
test('run authorization binds exact mode, issues and requested capacity',async()=>{
  const a=makeAdapter(), c=controller('auth',a), x=input('bad',['T-1']);
  x.authorization.issue_ids=[];await assert.rejects(()=>c.create(x),/authorization/);
  x.authorization.issue_ids=['T-1'];x.authorization.mode='plan_only';await assert.rejects(()=>c.create(x),/authorization/);
  x.authorization.mode='implement';x.authorization.max_tracks=2;await assert.rejects(()=>c.create(x),/capacity/);
});
test('dependency and graph changes block affected tracks and completed review becomes stale',async()=>{
  const a=makeAdapter(), c=controller('freshness',a), edges=[{from:'T-1',from_event:'review',to:'T-2',to_event:'review',source:'graph'}];
  await c.create(input('run',['T-1','T-2'],edges));
  for(const id of ['T-1','T-2']){let t=await c.start('run',id);t=await c.plan('run',id,plan(t));await c.beginBuild('run',id);}
  await c.review('run','T-1');await c.review('run','T-2');
  let q=await c.reviewQueue('run');assert.deepEqual(q.completed,['T-1','T-2']);
  a.heads.set('T-1','c'.repeat(40));q=await c.reviewQueue('run');assert.equal(q.completed.length,0);assert.equal(q.blocked.length,2);
  a.heads.set('T-1',head);a.graph='sha256:'+'e'.repeat(64);q=await c.reviewQueue('run');assert.deepEqual(q.completed,['T-1','T-2']);
  a.reviewEdges=[...edges,{from:'external',from_event:'merge',to:'T-2',to_event:'review',source:'new dependency'}];q=await c.reviewQueue('run');assert.deepEqual(q.completed,['T-1']);assert.deepEqual(q.blocked.map(x=>x.issue_id),['T-2']);
  a.reviewEdges=null;a.reviewCurrent=false;q=await c.reviewQueue('run');assert.equal(q.completed.length,0);assert.equal(q.blocked.length,2);
  const b=makeAdapter(),d=controller('pair-change',b);await d.create(input('run',['T-1']));b.batch='sha256:'+'f'.repeat(64);
  await assert.rejects(()=>d.start('run','T-1'),/batch dependency evidence/);assert.equal(b.sessions.size,0);
});
test('missing review evidence and new unselected edges hold only affected tracks',async()=>{
  const a=makeAdapter(),c=controller('review-partial',a);await c.create(input('run',['T-1','T-2']));
  for(const id of ['T-1','T-2']) {let t=await c.start('run',id);t=await c.plan('run',id,plan(t));await c.beginBuild('run',id);await c.review('run',id);}
  a.graphIssues['T-2']=null;
  a.reviewEdges=[{from:'future',from_event:'review',to:'T-99',to_event:'review',source:'unrelated new ticket'}];
  const q=await c.reviewQueue('run');assert.deepEqual(q.completed,['T-1']);
  assert.deepEqual(q.blocked.map(x=>x.issue_id),['T-2']);assert.match(q.blocked[0].reason,/evidence unavailable/);
});
test('a new review cycle blocks its own tracks but not independent completed reviews',async()=>{
  const a=makeAdapter(),c=controller('review-cycle',a);await c.create(input('run',['T-1','T-2','T-3']));
  for(const id of ['T-1','T-2','T-3']) {let t=await c.start('run',id);t=await c.plan('run',id,plan(t));await c.beginBuild('run',id);await c.review('run',id);}
  a.reviewEdges=[{from:'T-2',from_event:'review',to:'T-3',to_event:'review',source:'new'},
                 {from:'T-3',from_event:'review',to:'T-2',to_event:'review',source:'new'}];
  const q=await c.reviewQueue('run');assert.deepEqual(q.completed,['T-1']);
  assert.deepEqual(q.blocked.map(x=>x.issue_id),['T-2','T-3']);assert.ok(q.blocked.every(x=>/cycl/.test(x.reason)));
  a.reviewEdges=[{from:'external',from_event:'merge',to:'T-2',to_event:'review',source:'a'},
                 {from:'external',from_event:'merge',to:'T-2',to_event:'review',source:'b'}];
  const duplicate=await c.reviewQueue('run');assert.ok(duplicate.completed.includes('T-1'));
  assert.ok(duplicate.blocked.some(x=>x.issue_id==='T-2' && x.reason.includes('duplicate')));
});
test('a changed candidate closure holds only that ticket',async()=>{
  const a=makeAdapter(),c=controller('closure-isolation',a);await c.create(input('run',['T-1','T-2']));
  for(const id of ['T-1','T-2']) {let t=await c.start('run',id);await c.plan('run',id,plan(t));}
  a.closures['T-1']='sha256:'+'f'.repeat(64);
  await assert.rejects(()=>c.beginBuild('run','T-1'),/conditions changed/);
  assert.equal((await c.beginBuild('run','T-2')).phase,'REVIEW');
});
test('a new main between selection and start is revalidated rather than forcing reselection',async()=>{
  const a=makeAdapter(),c=controller('start-new-main',a),repo=fixtureRepo;
  const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  git('-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','base');
  const base=git('rev-parse','HEAD');a.currentMain=base;const x=input('run',['T-1']);x.selection_snapshot.main_sha=base;await c.create(x);
  fs.writeFileSync(path.join(repo,'other.txt'),'independent');git('add','other.txt');git('-c','user.name=Test','-c','user.email=test@example.test','commit','-qm','other');
  a.currentMain=git('rev-parse','HEAD');const t=await c.start('run','T-1');
  assert.equal(t.state,'READY');assert.deepEqual(t.selection_main_check.changed_paths,['other.txt']);
});
test('main advancement continues only after real ancestry and per-plan impact verification',async()=>{
  const a=makeAdapter(), c=controller('main-movement',a), repo=fixtureRepo;
  const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  git('-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','base');
  const base=git('rev-parse','HEAD'); a.currentMain=base;
  const x=input('run',['T-1']);x.selection_snapshot.main_sha=base;await c.create(x);
  let t=await c.start('run','T-1');const proposal={...plan(t),main_sha:base};await c.plan('run','T-1',proposal);
  fs.writeFileSync(path.join(repo,'unrelated.txt'),'not part of the plan');git('add','unrelated.txt');
  git('-c','user.name=Test','-c','user.email=test@example.test','commit','-qm','unrelated');
  const next=git('rev-parse','HEAD');a.currentMain=next;
  t=await c.beginBuild('run','T-1');assert.equal(t.phase,'REVIEW');
  assert.deepEqual(t.build_main_check.changed_paths,['unrelated.txt']);
  assert.equal(t.build_main_check.from_main,base);assert.equal(t.build_main_check.to_main,next);
  assert.equal((await c.review('run','T-1')).state,'COMPLETED');
});
test('changed main is held when code impact is relevant or ancestry is unavailable',async()=>{
  const a=makeAdapter(), c=controller('main-impact',a), repo=fixtureRepo;
  const git=(...args)=>execFileSync('git',['-C',repo,...args],{encoding:'utf8'}).trim();
  git('-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','base');
  const base=git('rev-parse','HEAD');a.currentMain=base;const x=input('run',['T-1']);x.selection_snapshot.main_sha=base;await c.create(x);
  let t=await c.start('run','T-1');await c.plan('run','T-1',{...plan(t),main_sha:base});
  fs.writeFileSync(path.join(repo,'file'),'changed planned file');git('add','file');git('-c','user.name=Test','-c','user.email=test@example.test','commit','-qm','affect plan');
  a.currentMain=git('rev-parse','HEAD');a.impact='AFFECTED';await assert.rejects(()=>c.beginBuild('run','T-1'),/impact unverified or relevant/);
  a.impact='UNAFFECTED';a.badOverlap=true;await assert.rejects(()=>c.beginBuild('run','T-1'),/impact unverified or relevant/);
  a.badOverlap=false;const realMain=a.currentMain;a.currentMain='f'.repeat(40);await assert.rejects(()=>c.beginBuild('run','T-1'),/ancestry or changed files unavailable/);
  a.currentMain=realMain;const continued=await c.beginBuild('run','T-1');assert.deepEqual(continued.build_main_check.overlapping_paths,['file']);
});
test('copied run ledger cannot be operated from an independent state root',async()=>{
  const a=makeAdapter(),c=controller('copied-ledger',a);await c.create(input('run',['T-1']));
  const outside=path.join(tmp,'wrong-root');fs.mkdirSync(path.join(outside,'runs'),{recursive:true});
  fs.copyFileSync(path.join(c.root,'runs','run.json'),path.join(outside,'runs','run.json'));
  const other=new Controller(outside,a);assert.throws(()=>other.snapshot('run'),/canonical state root/);
  await assert.rejects(()=>other.start('run','T-1'),/canonical state root/);assert.equal(a.sessions.size,0);
});
test('unknown host guarantees, invalid lifecycle, cyclic or incomplete graph refuse safely',async()=>{
  const a=makeAdapter(), c=controller('refusal',a);
  const x=input('future',['T-1']);x.selection_snapshot.candidates[0].lifecycle.state='READ_ONLY_ONLY';
  const held=await c.create(x);assert.deepEqual(held.held_lifecycle_ids,['T-1']);assert.equal(Object.keys(held.tracks).length,0);
  const edges=[{from:'T-1',to:'T-2',from_event:'review',to_event:'review',source:'g'}, {from:'T-2',to:'T-1',from_event:'review',to_event:'review',source:'g'}];
  await assert.rejects(()=>c.create(input('cycle',['T-1','T-2'],edges)),/cyclic/);
  a.verifyReviewGraph=async()=>({complete:false});await assert.rejects(()=>c.create(input('missing',['T-1'])),/graph evidence/);
  a.verifyReviewGraph=async x=>({complete:true,source:'verified',digest:hash,checked_at:new Date().toISOString(),edges:x.review_edges,issues:Object.fromEntries(x.selection_snapshot.candidates.map(c=>[c.issue_id,hash]))});a.idempotentSessionCreation=false;
  await c.create(input('no-host',['T-1']));await assert.rejects(()=>c.start('no-host','T-1'),/cannot guarantee/);assert.equal(a.sessions.size,0);
  assert.equal(fs.readdirSync(path.join(fixtureRepo,'.git','kstack-session-batch','claims')).length,0,'unsupported host cannot claim issue');
});
test('a requested revision is sent to the same session and independently revalidated',async()=>{
  const a=makeAdapter(),c=controller('plan-revision',a);await c.create(input('run',['T-1']));
  const started=await c.start('run','T-1');a.verdict='REVISE';
  assert.equal((await c.plan('run','T-1',plan(started))).state,'REVISE');
  let sent;
  a.revisePlan=async x=>{sent=x;return {state:'WAIT',session_id:x.session_id};};
  a.pollPlan=async x=>({state:'READY',session_id:x.session_id,plan:{...plan(x),text:'Revised plan cites the feedback'}});
  await c.tick('run');assert.equal(sent.session_id,started.session_id);
  assert.equal(c.snapshot('run').tracks['T-1'].operation,'AWAIT_REVISION');
  a.verdict='PASS';await c.tick('run');
  const t=c.snapshot('run').tracks['T-1'];assert.equal(t.phase,'BUILD');assert.equal(t.plan_revisions,1);
  assert.equal(t.plan.text,'Revised plan cites the feedback');
});
test('asynchronous workers retain slots and dependency-order reviews without a global barrier',async()=>{
  const a=makeAdapter(),c=controller('async-worker',a);
  const edges=[{from:'T-1',to:'T-2',from_event:'review',to_event:'review',source:'graph'}];
  await c.create(input('run',['T-1','T-2'],edges));
  for(const id of ['T-1','T-2']) {const t=await c.start('run',id);await c.plan('run',id,plan(t));}
  let buildsDone=false,reviewsDone=false;
  a.build=async x=>({state:'WAIT',session_id:x.session_id});
  a.pollBuild=async x=>{if(!buildsDone)return {state:'WAIT',session_id:x.session_id};a.heads.set(x.issue_id,head);return {state:'PR_OPEN',session_id:x.session_id,pr_url:'https://example.test/'+x.issue_id,head_sha:head,session_idle:true,evidence:'verified PR'};};
  a.review=async x=>({state:'WAIT',session_id:x.session_id});
  a.pollReview=async x=>reviewsDone ? {verdict:'CLEAN',head_sha:head,review_id:'review-'+x.issue_id,reviewer_id:'independent',independent:true,review_process_stopped:true,ci:'GREEN',evidence:'verified review'} : {state:'WAIT',session_id:x.session_id};
  for(const id of ['T-1','T-2']) {assert.equal((await c.beginBuild('run',id)).state,'WAITING');assert.equal((await c.finishBuild('run',id)).state,'WAITING');}
  assert.ok(c.snapshot('run').tracks['T-1'].worker_slot);
  buildsDone=true;for(const id of ['T-1','T-2']) assert.equal((await c.finishBuild('run',id)).phase,'REVIEW');
  assert.equal((await c.review('run','T-2')).state,'BLOCKED');
  assert.equal((await c.review('run','T-1')).state,'WAITING');
  assert.deepEqual((await c.reviewQueue('run')).running,['T-1']);
  assert.equal((await c.finishReview('run','T-1')).state,'WAITING');
  assert.equal((await c.review('run','T-2')).state,'BLOCKED');
  reviewsDone=true;assert.equal((await c.finishReview('run','T-1')).state,'COMPLETED');
  assert.equal((await c.review('run','T-2')).state,'WAITING');
  assert.equal((await c.finishReview('run','T-2')).state,'COMPLETED');
});
test('blocked reviews do not need a fabricated submitted review and unknown builds retain claims',async()=>{
  const a=makeAdapter(),c=controller('async-blocked',a);await c.create(input('run',['T-1','T-2']));
  for(const id of ['T-1','T-2']) {const t=await c.start('run',id);await c.plan('run',id,plan(t));}
  const syncBuild=a.build;
  a.build=async x=>x.issue_id==='T-1' ? syncBuild(x) : {state:'WAIT',session_id:x.session_id};
  assert.equal((await c.beginBuild('run','T-1')).phase,'REVIEW');
  assert.equal((await c.beginBuild('run','T-2')).state,'WAITING');
  a.pollBuild=async()=>({state:'UNKNOWN',reason:'worker disappeared'});
  const uncertain=await c.finishBuild('run','T-2');assert.equal(uncertain.state,'ERROR');
  assert.equal(uncertain.uncertain_operation,true);assert.ok(fs.existsSync(uncertain.worker_slot));
  a.review=async x=>({state:'WAIT',session_id:x.session_id});
  a.pollReview=async()=>({verdict:'BLOCKED',reason:'Bash permission denied',review_process_stopped:true,evidence:'process exit'});
  assert.equal((await c.review('run','T-1')).state,'WAITING');
  const blocked=await c.finishReview('run','T-1');assert.equal(blocked.state,'BLOCKED');
  assert.equal(blocked.review.review_id,undefined);assert.equal(blocked.review_slot,null);
  assert.match((await c.reviewQueue('run')).blocked[0].reason,/Bash permission denied/);
});
test('invalid run IDs cause no lock writes, including direct library calls',async()=>{
  const a=makeAdapter(),c=controller('invalid-run-lock',a);await c.create(input('run',['T-1']));
  const original=fs.mkdirSync,calls=[];
  fs.mkdirSync=function(p,...args){calls.push(String(p));return original.call(this,p,...args);};
  try {
    await assert.rejects(()=>c.tick('../../escape'),/invalid run ID/);
    await assert.rejects(()=>c.start('../../escape','T-1'),/invalid run ID/);
  } finally {fs.mkdirSync=original;}
  assert.deepEqual(calls,[],'invalid identifiers must not touch any filesystem path');
});
test('unselected review targets are ignored without losing incoming prerequisites',async()=>{
  const a=makeAdapter(),c=controller('irrelevant-review-targets',a);
  const edges=[{from:'T-1',to:'T-2',from_event:'review',to_event:'review',source:'graph'},
    {from:'outside',to:'T-1',from_event:'merge',to_event:'review',source:'graph'}];
  const x=input('run',['T-1','T-2'],edges);x.selection_snapshot.candidates[1].lifecycle.state='READ_ONLY_ONLY';
  const run=await c.create(x);
  assert.deepEqual(Object.keys(run.tracks),['T-1']);
  assert.deepEqual(run.review_edges,[edges[1]]);
});
(async()=>{let failed=0;for(const t of tests)try{await t.f();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+' '+e.stack);}console.log((tests.length-failed)+'/'+tests.length+' passed');if(failed)process.exitCode=1;})();
