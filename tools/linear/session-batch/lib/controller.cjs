'use strict';
// Host-neutral controller. Adapters perform the real host/tracker/forge operations;
// this library never treats prompt text as proof that those operations succeeded.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync}=require('node:child_process');
const select = require('../../next/lib/selection.cjs');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const digest = x => 'sha256:' + sha(JSON.stringify(x));
const isHash = x => /^sha256:[0-9a-f]{64}$/.test(x || '');
const isCommit = x => /^[0-9a-f]{40}$/.test(x || '');
const text = x => typeof x === 'string' && !!x.trim();
const assert = (ok, msg) => { if (!ok) throw new Error('session-batch: ' + msg); };
const now = () => new Date().toISOString();
function mkdir(p) { fs.mkdirSync(p, {recursive:true, mode:0o700}); }
function atomic(file, data) {
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
async function lock(dir, fn) {
  const deadline=Date.now()+3000;
  for (;;) {
    try { fs.mkdirSync(dir, {mode:0o700}); break; }
    catch (e) {
      if (e.code!=='EEXIST') throw e;
      if (Date.now()>=deadline) throw new Error('session-batch: concurrent or abandoned lock; reconcile '+dir);
      await new Promise(resolve=>setTimeout(resolve,20));
    }
  }
  try { return await fn(); } finally { fs.rmdirSync(dir); }
}

function receipt(r, expected, stage) {
  assert(r && r.state === 'ALLOW' && r.issue_id === expected && r.stage === stage &&
    text(r.source) && /^\d{4}-\d\d-\d\dT.*Z$/.test(r.checked_at || '') &&
    Number.isFinite(Date.parse(r.checked_at)) && Date.now()-Date.parse(r.checked_at)>=0 &&
    Date.now()-Date.parse(r.checked_at)<=3600000 && isCommit(r.main_sha) &&
    isHash(r.scope_digest) && isHash(r.criteria_digest) &&
    isHash(r.closure_graph_digest) && isHash(r.closure_evidence_digest), 'fresh ' + stage + ' admission required for ' + expected);
  return r;
}
function hostMethod(adapter,name) {
  assert(typeof adapter[name]==='function', 'host adapter lacks '+name);
  return adapter[name].bind(adapter);
}
// These are candidate-specific semantic digests, never the complete graph or
// whole scope-document hash. A new main is checked separately against real Git
// ancestry and a source-backed assessment of the changed code.
const factFields=['scope_digest','criteria_digest','closure_graph_digest','closure_evidence_digest'];
function validFacts(facts) { return facts && factFields.every(k=>isHash(facts[k])); }
function freshEqual(a,b) { return validFacts(a) && validFacts(b) && factFields.every(k=>a[k]===b[k]); }
function validateEdges(edges, ids, checkCycles=true) {
  assert(Array.isArray(edges), 'review edges required');
  const seen = new Set();
  for (const e of edges) {
    assert(e && text(e.from) && ids.has(e.to) && e.from !== e.to &&
      e.to_event === 'review' && ['review','merge','build'].includes(e.from_event) && text(e.source), 'invalid review dependency');
    const key = JSON.stringify([e.from,e.from_event,e.to]);
    if (checkCycles) assert(!seen.has(key), 'duplicate review dependency');
    seen.add(key);
  }
  if (!checkCycles) return;
  // Explicit review dependencies must be acyclic even when their conditions differ.
  const visiting=new Set(), done=new Set();
  function visit(id) {
    assert(!visiting.has(id), 'cyclic review dependencies');
    if (done.has(id)) return;
    visiting.add(id); edges.filter(e=>e.from===id).forEach(e=>visit(e.to));
    visiting.delete(id); done.add(id);
  }
  for (const id of ids) visit(id);
}
function relevantReviewEdges(edges, issue) {
  const pending=[issue], seen=new Set(), relevant=[];
  while (pending.length) {
    const target=pending.pop();
    if (seen.has(target)) continue;
    seen.add(target);
    for (const e of edges.filter(e=>e.to===target)) {
      relevant.push(e);
      if (e.from_event==='review') pending.push(e.from);
    }
  }
  return relevant;
}
function reviewFingerprint(edges, issue) {
  const relevant=relevantReviewEdges(edges,issue).map(e=>({from:e.from,from_event:e.from_event,to:e.to,to_event:e.to_event,...(Object.hasOwn(e,'type')?{type:e.type}:{})}));
  relevant.sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;});
  return digest(relevant);
}
function reviewedGraph(proof, ids, requireAll=false) {
  assert(proof?.complete===true && text(proof.source) && isHash(proof.digest) &&
    /^\d{4}-\d\d-\d\dT.*Z$/.test(proof.checked_at || '') && Number.isFinite(Date.parse(proof.checked_at)) &&
    Date.now()-Date.parse(proof.checked_at)>=0 && Date.now()-Date.parse(proof.checked_at)<=3600000 &&
    proof.issues && typeof proof.issues==='object' && Array.isArray(proof.edges) &&
    proof.edges.every(e=>e && text(e.to)) && (!requireAll || [...ids].every(id=>isHash(proof.issues[id]))),
    'fresh per-ticket review graph evidence required');
  // Structural ambiguity is global, but a newly introduced cycle is checked
  // separately for each track so it cannot freeze unrelated reviews. An edge
  // targeting an unselected ticket cannot be an incoming edge of this batch.
  const edges=proof.edges.filter(e=>ids.has(e.to));
  validateEdges(edges,ids,false);
  return {...proof,edges};
}
class Controller {
  // stateRoot must be shared by all coordinators for this repository. No stale
  // claim or lock is automatically stolen; ambiguous recovery is a human decision.
  constructor(stateRoot, adapter) {
    assert(path.isAbsolute(stateRoot), 'absolute shared state root required');
    this.root=path.join(fs.realpathSync(path.dirname(stateRoot)),path.basename(stateRoot)); this.adapter=adapter || {};
  }
  runFile(id) { assert(/^[a-zA-Z0-9_-]{1,100}$/.test(id || ''), 'invalid run ID'); return path.join(this.root,'runs',id+'.json'); }
  runLock(id) { return this.runFile(id)+'.lock'; }
  claimDir(repo,issue) { return path.join(this.root,'claims',sha(repo+'\0'+issue)); }
  trackLock(id,issue) { this.runFile(id); return path.join(this.root,'runs',id+'-'+sha(issue)+'.lock'); }
  async update(id, fn) { return lock(this.runLock(id), async()=>{ const p=this.runFile(id), data=read(p); const value=await fn(data); atomic(p,data); return value; }); }
  snapshot(id) {
    const run=read(this.runFile(id));
    let common;
    try { common=fs.realpathSync(execFileSync('git',['-C',run.repo,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim()); }
    catch { throw new Error('session-batch: repository identity unavailable'); }
    assert(common===run.repository_common_dir && this.root===path.join(common,'kstack-session-batch'),
      'ledger is outside the repository canonical state root');
    return run;
  }
  async create(input) {
    assert(input && path.isAbsolute(input.repo || '') && fs.existsSync(input.repo), 'existing repository root required');
    const repo=fs.realpathSync(input.repo);
    let common;
    try { common=fs.realpathSync(execFileSync('git',['-C',repo,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim()); }
    catch { throw new Error('session-batch: verified Git common directory required'); }
    assert(this.root===path.join(common,'kstack-session-batch'), 'state root must be the canonical Git common-directory kstack-session-batch');
    const f=this.runFile(input.run_id);
    assert(input.policy && ['plan_only','implement'].includes(input.policy.mode) && typeof input.policy.auto_plan_validation === 'boolean' &&
      Number.isSafeInteger(input.policy.max_plan_revisions) && input.policy.max_plan_revisions>=0 &&
      Number.isSafeInteger(input.policy.operation_timeout_ms) && input.policy.operation_timeout_ms>=100 && input.policy.operation_timeout_ms<=300000 &&
      ['worker_concurrency','review_concurrency'].every(k=>Number.isSafeInteger(input.policy[k]) && input.policy[k]>0 && input.policy[k]<=32),
      'explicit validation policy, revision cap, timeout and concurrency limits required');
    const s=input.selection_snapshot, output=select(s);
    assert(s && isCommit(s.main_sha) && text(s.checked_at) && isCommit(s.source_revision) && text(s.snapshot_id), 'pinned complete selection required');
    const proposed=[...output.selected_ids,...(input.policy.mode==='plan_only' ? output.planning_ids : [])];
    const held=proposed.filter(id=>{
      const c=s.candidates.find(x=>x.issue_id===id);
      return c.lifecycle?.state!=='STARTABLE' || !text(c.lifecycle.source) || !text(c.lifecycle.detail);
    });
    const startable=proposed.filter(id=>!held.includes(id));
    const ids=new Set(startable.slice(0,s.requested)), auth=input.authorization;
    assert(auth && auth.mode===input.policy.mode && text(auth.source) && Array.isArray(auth.issue_ids) &&
      new Set(auth.issue_ids).size===auth.issue_ids.length && auth.issue_ids.every(text) &&
      Number.isSafeInteger(auth.max_tracks) && auth.max_tracks>0 && s.requested<=auth.max_tracks &&
      input.policy.worker_concurrency<=auth.max_tracks && [...ids].every(id=>auth.issue_ids.includes(id)),
      'explicit authorization must cover run mode, selected issues and requested capacity');
    const grant=await hostMethod(this.adapter,'verifyRunAuthorization')({run_id:input.run_id,repo,authorization:auth,policy:input.policy,selection_snapshot:s});
    assert(grant?.state==='APPROVED' && grant.mode===auth.mode && text(grant.source) &&
      grant.authorization_digest===digest(auth), 'verified exact run authorization required');
    assert(Array.isArray(input.review_edges) && input.review_edges.every(e=>e && text(e.to)), 'explicit review graph required');
    // Edges to unselected targets cannot constrain this batch. Keep edges
    // from external prerequisites into selected targets.
    const reviewEdges=input.review_edges.filter(e=>ids.has(e.to));
    validateEdges(reviewEdges,ids);
    // Legacy selector may propose Backlog advisory planning. Hold it rather
    // than dispatching it, and keep all held/capacity decisions visible.
    const batchProof=await hostMethod(this.adapter,'captureBatch')({run_id:input.run_id,repo,selection_snapshot:s,selected_ids:[...ids]});
    assert(batchProof?.complete===true && text(batchProof.source) && batchProof.issues &&
      [...ids].every(id=>isHash(batchProof.issues[id])) && batchProof.admissions &&
      [...ids].every(id=>validFacts(batchProof.admissions[id]?.plan) &&
        (input.policy.mode==='plan_only' || validFacts(batchProof.admissions[id]?.build))),
      'complete selected-batch dependency and phase evidence required');
    const graphProof=reviewedGraph(await hostMethod(this.adapter,'verifyReviewGraph')({run_id:input.run_id,repo,selection_snapshot:s,review_edges:reviewEdges,fresh:true}),ids,true);
    for (const id of ids) assert(reviewFingerprint(graphProof.edges,id)===reviewFingerprint(reviewEdges,id),
      'selection review dependencies differ from fresh graph: '+id);
    graphProof.fingerprints=Object.fromEntries([...ids].map(id=>[id,reviewFingerprint(graphProof.edges,id)]));
    const tracks=Object.fromEntries([...ids].map(id=>[id,{issue_id:id,state:'READY',phase:'PLAN',
      session_id:crypto.randomUUID(),plan_revisions:0,plan:null,validation:null,pr:null,review:null,history:[]} ]));
    mkdir(path.join(this.root,'runs')); mkdir(path.join(this.root,'claims')); mkdir(path.join(this.root,'slots'));
    await lock(path.join(this.root,'slots','policy.lock'), async()=>{
      const p=path.join(this.root,'slots','policy.json');
      const limits={workers:input.policy.worker_concurrency,reviews:input.policy.review_concurrency};
      if (fs.existsSync(p)) assert(JSON.stringify(read(p))===JSON.stringify(limits), 'shared capacity policy mismatch; reconcile other runs');
      else atomic(p,limits);
    });
    return lock(this.runLock(input.run_id), async()=>{
      assert(!fs.existsSync(f), 'run already exists; resume it');
      const run={schema_version:1,run_id:input.run_id,repo,repository_common_dir:common,created_at:now(),policy:input.policy,authorization:auth,authorization_evidence:grant,
        selection_snapshot:s,selection_output:output,held_lifecycle_ids:held,
        deferred_capacity_ids:startable.slice(s.requested),review_edges:reviewEdges,
        review_graph_evidence:graphProof,batch_evidence:batchProof,tracks};
      atomic(f,run); return run;
    });
  }
  async claim(run, t) {
    const dir=this.claimDir(run.repository_common_dir,t.issue_id), file=path.join(dir,'owner.json');
    try { fs.mkdirSync(dir,{mode:0o700}); atomic(file,{repo:run.repository_common_dir,issue_id:t.issue_id,run_id:run.run_id,session_id:t.session_id}); }
    catch (e) {
      if (e.code!=='EEXIST') throw e;
      assert(fs.existsSync(file), 'incomplete ownership claim requires reconciliation');
      const owner=read(file);
      assert(owner.repo===run.repository_common_dir && owner.issue_id===t.issue_id && owner.run_id===run.run_id &&
        owner.session_id===t.session_id, 'issue already claimed by another run/session');
    }
  }
  slot(group,run,track,limit) {
    const base=path.join(this.root,'slots',group); mkdir(base);
    const owner={run_id:run.run_id,issue_id:track.issue_id,session_id:track.session_id};
    for (let i=0;i<limit;i++) {
      const dir=path.join(base,String(i)), file=path.join(dir,'owner.json');
      try { fs.mkdirSync(dir,{mode:0o700}); atomic(file,owner); return dir; }
      catch(e) {
        if(e.code!=='EEXIST') throw e;
        if(fs.existsSync(file) && JSON.stringify(read(file))===JSON.stringify(owner)) return dir;
      }
    }
    return null;
  }
  releaseSlot(dir,run,track) {
    assert(typeof dir==='string' && path.dirname(path.dirname(dir))===path.join(this.root,'slots'), 'invalid slot path');
    const file=path.join(dir,'owner.json'), owner=read(file);
    assert(owner.run_id===run.run_id && owner.issue_id===track.issue_id && owner.session_id===track.session_id, 'slot ownership mismatch');
    fs.unlinkSync(file); fs.rmdirSync(dir);
  }
  async track(runId, issue, fn) {
    assert(text(issue), 'issue ID required');
    return lock(this.trackLock(runId,issue),async()=>{
      let run=this.snapshot(runId), t=run.tracks[issue]; assert(t, 'issue is not selected');
      const save=async (change,event)=>this.update(runId, data=>{
        const track=data.tracks[issue];
        assert(!track.uncertain_operation, 'uncertain operation requires explicit reconciliation');
        Object.assign(track,change);
        if(event) track.history.push({at:now(),event}); return track;
      });
      try { return await fn(run,t,save); }
      catch (err) {
        const current=this.snapshot(runId).tracks[issue];
        if (current.state==='RUNNING') await save({state:'ERROR',error:String(err.message)},'ERROR');
        throw err;
      }
    });
  }
  async verifyBatch(run,issue,stage) {
    const p=await hostMethod(this.adapter,'verifyBatch')({run,issue_id:issue,stage});
    assert(p?.state==='SATISFIED' && p.issue_id===issue && p.digest===run.batch_evidence.issues[issue] &&
      text(p.source) && /^\d{4}-\d\d-\d\dT.*Z$/.test(p.checked_at || '') &&
      Number.isFinite(Date.parse(p.checked_at)) && Date.now()-Date.parse(p.checked_at)>=0 &&
      Date.now()-Date.parse(p.checked_at)<=3600000, 'fresh selected-batch dependency evidence changed or unavailable: '+issue);
    return p;
  }
  async verifyMainChange(run,issue,fromMain,fresh,stage,plan=null) {
    if (fromMain===fresh.main_sha) return null;
    assert(isCommit(fromMain) && isCommit(fresh.main_sha), 'main revisions must be exact commits');
    let files;
    try {
      execFileSync('git',['-C',run.repo,'merge-base','--is-ancestor',fromMain,fresh.main_sha],{stdio:'ignore'});
      files=execFileSync('git',['-C',run.repo,'diff','--name-only','--no-renames','-z',fromMain,fresh.main_sha],{encoding:'utf8'}).split('\0').filter(Boolean).sort();
    } catch { throw new Error('session-batch: main ancestry or changed files unavailable; refresh before '+stage); }
    const overlaps=plan ? files.filter(file=>plan.files.some(p=>file===p || file.startsWith(p.replace(/\/$/,'')+'/'))) : [];
    const changesDigest=digest(files), overlapDigest=digest(overlaps), planDigest=plan ? digest(plan) : null;
    const proof=await hostMethod(this.adapter,'verifyMainChange')({run,issue_id:issue,stage,from_main:fromMain,to_main:fresh.main_sha,
      changed_paths:files,changed_paths_digest:changesDigest,overlapping_paths:overlaps,overlapping_paths_digest:overlapDigest,
      plan,plan_digest:planDigest});
    assert(proof?.state==='UNAFFECTED' && proof.issue_id===issue && proof.stage===stage &&
      proof.from_main===fromMain && proof.to_main===fresh.main_sha && proof.changed_paths_digest===changesDigest &&
      proof.overlapping_paths_digest===overlapDigest && proof.plan_digest===planDigest && proof.independent===true &&
      text(proof.assessor_id) && proof.assessor_id!==run.tracks[issue].session_id && text(proof.source) &&
      /^\d{4}-\d\d-\d\dT.*Z$/.test(proof.checked_at || '') && Number.isFinite(Date.parse(proof.checked_at)) &&
      Date.now()-Date.parse(proof.checked_at)>=0 && Date.now()-Date.parse(proof.checked_at)<=3600000,
      'main change impact unverified or relevant: '+issue);
    return {...proof,changed_paths:files,overlapping_paths:overlaps};
  }
  async start(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert((['READY','ERROR'].includes(t.state) || (t.state==='RUNNING' && t.operation==='ENSURE_SESSION')) &&
        t.phase==='PLAN' && !t.session, 'session start not allowed in current state');
      assert(this.adapter.idempotentSessionCreation===true, 'host cannot guarantee idempotent session creation');
      const batch=await this.verifyBatch(run,issue,'plan');
      await this.claim(run,t);
      const admission=receipt(await hostMethod(this.adapter,'admit')({run,issue,stage:'plan'}),issue,'plan');
      assert(freshEqual(run.batch_evidence.admissions[issue].plan,admission), 'selected plan conditions changed');
      const baseCheck=await this.verifyMainChange(run,issue,run.selection_snapshot.main_sha,admission,'plan');
      const workerSlot=this.slot('workers',run,t,run.policy.worker_concurrency);
      if (!workerSlot) return {state:'BLOCKED',issue_id:issue,reason:'worker capacity unavailable'};
      await save({state:'RUNNING',operation:'ENSURE_SESSION',worker_slot:workerSlot,batch_admission:batch,admission,selection_main_check:baseCheck,error:null},'SESSION_ENSURE');
      // ensureSession MUST recover this exact deterministic ID on retries or fail;
      // adapters without that guarantee must return UNKNOWN and must not create.
      const session=await hostMethod(this.adapter,'ensureSession')({run_id:runId,issue_id:issue,session_id:t.session_id,repo:run.repo,admission,mode:run.policy.mode});
      assert(session && session.state==='READY' && session.session_id===t.session_id && session.issue_id===issue &&
        session.permission_mode==='plan' && text(session.branch) && path.isAbsolute(session.worktree || '') &&
        session.workspace_verified===true && session.status_verified===true && text(session.source), 'session identity, plan mode, workspace and status read-back required');
      return save({state:'READY',operation:null,session,admission},'PLAN_READY');
    });
  }
  async plan(runId,issue,plan) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(t.phase==='PLAN' && ['READY','REVISE'].includes(t.state) && t.session, 'planning session not ready');
      assert(plan && text(plan.text) && plan.session_id===t.session_id && plan.issue_id===issue &&
        plan.main_sha===t.admission.main_sha && plan.scope_digest===t.admission.scope_digest &&
        plan.criteria_digest===t.admission.criteria_digest && Array.isArray(plan.files) && plan.files.every(text) &&
        Array.isArray(plan.tests) && plan.tests.length && plan.tests.every(text), 'plan binding, files and tests required');
      const fresh=receipt(await hostMethod(this.adapter,'admit')({run,issue,stage:'plan'}),issue,'plan');
      assert(freshEqual(t.admission,fresh), 'plan conditions changed; new selection/plan required');
      const baseCheck=await this.verifyMainChange(run,issue,plan.main_sha,fresh,'plan',plan);
      const revision=t.plan ? t.plan_revisions+1 : 0;
      assert(revision<=run.policy.max_plan_revisions, 'plan revision cap exhausted');
      const plan_digest=digest(plan);
      await save({state:'RUNNING',operation:'VALIDATE_PLAN',plan,plan_digest,plan_revisions:revision,admission:fresh,plan_main_check:baseCheck},'PLAN_VALIDATION_STARTED');
      const verdict=await hostMethod(this.adapter,'validatePlan')({run_id:runId,issue_id:issue,plan,plan_digest,admission:fresh});
      assert(verdict && ['PASS','REVISE','HUMAN_REQUIRED'].includes(verdict.verdict) &&
        verdict.plan_digest===plan_digest && text(verdict.validator_id) && verdict.validator_id!==t.session_id &&
        verdict.independent===true && text(verdict.evidence), 'independent exact-plan validation evidence required');
      if (verdict.verdict==='PASS' && run.policy.mode==='plan_only') {
        const waiting=await save({state:'WAITING',phase:'PLAN',operation:'AWAIT_SESSION_IDLE',validation:verdict},'PLAN_VALIDATED_WAIT_IDLE');
        return this.finishPlanOnlyInside(run,waiting,save);
      }
      const state=verdict.verdict==='PASS' ? (run.policy.auto_plan_validation ? 'READY' : 'HUMAN_REQUIRED') :
        verdict.verdict==='REVISE' && revision<run.policy.max_plan_revisions ? 'REVISE' : 'HUMAN_REQUIRED';
      return save({state,phase:verdict.verdict==='PASS' && run.policy.auto_plan_validation ? 'BUILD' : 'PLAN',
        operation:null,validation:verdict,approval_kind:state==='READY' && verdict.verdict==='PASS' ? 'AUTO' : null},'PLAN_'+verdict.verdict);
    });
  }
  async finishPlanOnlyInside(run,t,save) {
    const idle=await hostMethod(this.adapter,'sessionIdle')({run_id:run.run_id,issue_id:t.issue_id,session_id:t.session_id,session:t.session});
    if (!(idle?.state==='IDLE' && idle.session_id===t.session_id && text(idle.source)))
      return {state:'WAITING',issue_id:t.issue_id,reason:'plan session idle not verified'};
    this.releaseSlot(t.worker_slot,run,t);
    const done=await save({state:'COMPLETED',phase:'PLAN',operation:null,worker_slot:null,idle_evidence:idle},'PLAN_ONLY_COMPLETED');
    return this.finishSessionInside(run,done,save);
  }
  async finishPlanOnly(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(run.policy.mode==='plan_only' && t.phase==='PLAN' && t.state==='WAITING' &&
        t.validation?.verdict==='PASS' && t.validation.plan_digest===digest(t.plan), 'plan-only completion not awaiting idle');
      return this.finishPlanOnlyInside(run,t,save);
    });
  }
  async startRevision(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(t.state==='REVISE' && t.phase==='PLAN' && t.operation!=='AWAIT_REVISION' &&
        t.validation?.verdict==='REVISE' && t.validation.plan_digest===digest(t.plan), 'no exact plan revision requested');
      const result=await hostMethod(this.adapter,'revisePlan')({run_id:runId,issue_id:issue,session_id:t.session_id,session:t.session,plan:t.plan,validation:t.validation});
      assert(result?.state==='WAIT' && result.session_id===t.session_id, 'same-session plan revision could not be started');
      return save({state:'REVISE',operation:'AWAIT_REVISION'},'PLAN_REVISION_IN_FLIGHT');
    });
  }
  async holdUnknownPlan(runId,issue,sessionId,reason) {
    return this.track(runId,issue,async(_run,t,save)=>{
      assert(t.phase==='PLAN' && t.session_id===sessionId, 'plan session changed');
      return save({state:'ERROR',uncertain_operation:true,error:reason},'PLAN_UNCERTAIN');
    });
  }
  async approvePlan(runId,issue,approval) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(run.policy.mode==='implement', 'plan-only run cannot approve implementation');
      assert(t.state==='HUMAN_REQUIRED' && t.phase==='PLAN' && t.validation?.verdict==='PASS' &&
        t.validation.plan_digest===digest(t.plan), 'no exact passing plan awaiting approval');
      const proof=await hostMethod(this.adapter,'verifyPlanApproval')({run_id:runId,issue_id:issue,plan_digest:t.plan_digest,approval});
      assert(proof?.state==='APPROVED' && proof.issue_id===issue && proof.plan_digest===t.plan_digest &&
        text(proof.actor) && text(proof.source), 'original human plan approval required');
      return save({state:'READY',phase:'BUILD',approval_kind:'HUMAN',approval:proof},'PLAN_HUMAN_APPROVED');
    });
  }
  async beginBuild(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(run.policy.mode==='implement', 'plan-only run cannot build');
      assert(t.state==='READY' && t.phase==='BUILD' && t.validation?.verdict==='PASS' &&
        ['AUTO','HUMAN'].includes(t.approval_kind) &&
        (t.approval_kind!=='AUTO' || run.policy.auto_plan_validation===true) && t.validation.plan_digest===digest(t.plan), 'validated exact plan required');
      const batch=await this.verifyBatch(run,issue,'build');
      const fresh=receipt(await hostMethod(this.adapter,'admit')({run,issue,stage:'build'}),issue,'build');
      // The build transition can legitimately have more required events than
      // plan. Compare with its own selection-time baseline, never plan's hash.
      assert(freshEqual(run.batch_evidence.admissions[issue].build,fresh), 'approved build conditions changed');
      const baseCheck=await this.verifyMainChange(run,issue,t.plan.main_sha,fresh,'build',t.plan);
      await save({state:'RUNNING',operation:'BUILD',build_batch_admission:batch,build_admission:fresh,build_main_check:baseCheck},'BUILD_STARTED');
      // The worker starts asynchronously, retaining its slot while it runs.
      const result=await hostMethod(this.adapter,'build')({run_id:runId,issue_id:issue,session_id:t.session_id,session:t.session,plan:t.plan,plan_digest:t.plan_digest});
      if(result?.state==='WAIT' && result.session_id===t.session_id)
        return save({state:'WAITING',phase:'BUILD',operation:'AWAIT_BUILD'},'BUILD_IN_FLIGHT');
      return this.completeBuildInside(run,t,save,result);
    });
  }
  async completeBuildInside(run,t,save,result) {
    assert(result && result.state==='PR_OPEN' && result.session_id===t.session_id && text(result.pr_url) &&
      isCommit(result.head_sha) && result.session_idle===true && text(result.evidence), 'same session, stopped worker and PR head evidence required');
    this.releaseSlot(t.worker_slot,run,t);
    return save({state:'READY',phase:'REVIEW',operation:null,worker_slot:null,pr:{url:result.pr_url,head_sha:result.head_sha,evidence:result.evidence},review:null},'REVIEW_READY');
  }
  async finishBuild(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(t.phase==='BUILD' && t.state==='WAITING' && t.operation==='AWAIT_BUILD', 'build is not awaiting completion');
      const result=await hostMethod(this.adapter,'pollBuild')({run_id:runId,issue_id:issue,session_id:t.session_id,session:t.session,plan:t.plan,plan_digest:t.plan_digest});
      if(result?.state==='WAIT' && result.session_id===t.session_id) return {state:'WAITING',issue_id:issue,reason:'implementation still running'};
      if(result?.state==='UNKNOWN') return save({state:'ERROR',uncertain_operation:true,error:result.reason||'implementation status unavailable'},'BUILD_UNCERTAIN');
      return this.completeBuildInside(run,t,save,result);
    });
  }

  async review(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(run.policy.mode==='implement', 'plan-only run cannot review or open a PR');
      assert(t.phase==='REVIEW' && t.state==='READY' && t.pr, 'review not ready');
      const reason=await this.reviewBlock(run,t);
      if (reason) return {state:'BLOCKED',issue_id:issue,reason};
      const fresh=receipt(await hostMethod(this.adapter,'admit')({run,issue,stage:'review'}),issue,'review');
      // Review revalidates the build-transition closure; ordered review/merge
      // prerequisites are checked independently by reviewBlock.
      assert(freshEqual(t.build_admission,fresh), 'review conditions changed');
      const baseCheck=await this.verifyMainChange(run,issue,t.plan.main_sha,fresh,'review',t.plan);
      const head=await hostMethod(this.adapter,'head')({run_id:runId,pr:t.pr,issue_id:issue});
      assert(head===t.pr.head_sha, 'PR head moved before review');
      const reviewSlot=this.slot('reviews',run,t,run.policy.review_concurrency);
      if (!reviewSlot) return {state:'BLOCKED',issue_id:issue,reason:'review capacity unavailable'};
      await save({state:'RUNNING',operation:'REVIEW',review_slot:reviewSlot,review_main_check:baseCheck},'REVIEW_STARTED');
      const result=await hostMethod(this.adapter,'review')({run_id:runId,issue_id:issue,session_id:t.session_id,session:t.session,pr:t.pr});
      if(result?.state==='WAIT' && result.session_id===t.session_id)
        return save({state:'WAITING',phase:'REVIEW',operation:'AWAIT_REVIEW'},'REVIEW_IN_FLIGHT');
      return this.completeReviewInside(run,{...t,review_slot:reviewSlot},save,result);
    });
  }
  async completeReviewInside(run,t,save,result) {
    // A blocked loop may have no submitted review. Report the actual stop
    // reason, but only release the slot after the reviewer is verified stopped.
    if(result?.verdict==='BLOCKED' && result.review_process_stopped===true && text(result.evidence) && text(result.reason) && !result.review_id) {
      this.releaseSlot(t.review_slot,run,t);
      return save({state:'BLOCKED',operation:null,review_slot:null,review:result,error:result.reason},'REVIEW_BLOCKED');
    }
    assert(result && ['CLEAN','BLOCKED','ROUNDS_EXHAUSTED'].includes(result.verdict) && isCommit(result.head_sha) &&
      text(result.reviewer_id) && text(result.review_id) && result.reviewer_id!==t.session_id && result.independent===true && result.review_process_stopped===true && text(result.evidence), 'independent stopped exact-head review evidence required');
    assert(await hostMethod(this.adapter,'head')({run_id:run.run_id,pr:t.pr,issue_id:t.issue_id})===result.head_sha, 'PR head moved after reviewed head');
    assert(!(await this.reviewBlock(this.snapshot(run.run_id),t)), 'review prerequisite changed during review');
    if(result.verdict==='CLEAN') assert(result.ci==='GREEN' || result.ci==='NONE_CONFIGURED', 'reviewed-head CI evidence required');
    this.releaseSlot(t.review_slot,run,t);
    const done=await save({state:result.verdict==='CLEAN'?'COMPLETED':'BLOCKED',operation:null,review_slot:null,
      pr:{...t.pr,head_sha:result.head_sha},review:result},'REVIEW_'+result.verdict);
    return result.verdict==='CLEAN' ? this.finishSessionInside(run,done,save) : done;
  }
  async finishReview(runId,issue) {
    return this.track(runId,issue,async(run,t,save)=>{
      assert(t.phase==='REVIEW' && t.state==='WAITING' && t.operation==='AWAIT_REVIEW', 'review is not awaiting completion');
      const result=await hostMethod(this.adapter,'pollReview')({run_id:runId,issue_id:issue,session_id:t.session_id,session:t.session,pr:t.pr});
      if(result?.state==='WAIT' && result.session_id===t.session_id) return {state:'WAITING',issue_id:issue,reason:'review still running'};
      if(result?.state==='UNKNOWN') return save({state:'ERROR',uncertain_operation:true,error:result.reason||'review status unavailable'},'REVIEW_UNCERTAIN');
      return this.completeReviewInside(run,t,save,result);
    });
  }

  async finishSessionInside(run,t,save) {
    if(typeof this.adapter.finishSession!=='function') return t;
    try {
      const result=await this.adapter.finishSession({run_id:run.run_id,issue_id:t.issue_id,session_id:t.session_id,session:t.session});
      if(result?.state==='STOPPED' && result.session_id===t.session_id)
        return save({cleanup_pending:false,cleanup_evidence:result},'SESSION_STOPPED');
    } catch { /* Completion remains valid; surface the cleanup separately. */ }
    return save({cleanup_pending:true},'SESSION_CLEANUP_PENDING');
  }
  async deadline(runId,timeoutMs,promise,issue=null) {
    assert(Number.isSafeInteger(timeoutMs) && timeoutMs>=100 && timeoutMs<=300000, 'invalid operation timeout');
    let timer;
    let result;
    try { result=await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve({timeout:true}),timeoutMs);})]); }
    finally { clearTimeout(timer); }
    if (!result?.timeout) return result;
    if(issue) await this.update(runId,data=>{
      const track=data.tracks[issue];
      if(track && track.state!=='COMPLETED') {
        track.state='ERROR';track.uncertain_operation=true;
        track.error='adapter operation timed out; process may still be running; reconcile before retry';
        track.history.push({at:now(),event:'OPERATION_TIMEOUT'});
      }
    });
    return {issue_id:issue,state:'UNKNOWN_IN_FLIGHT',reason:'adapter deadline elapsed; no retry or slot release'};
  }
  async boundedOperation(runId,issue,fn) {
    const run=this.snapshot(runId);
    return this.deadline(runId,run.policy.operation_timeout_ms,Promise.resolve().then(fn),issue);
  }
  // One bounded supervisor pass: independent tracks advance concurrently.
  // Host wait/queue behavior stays in the adapter; no retry or merge is invented.
  async tick(runId) {
    this.runFile(runId); // validate before forming or creating the tick lock
    return lock(path.join(this.root,'runs',runId+'.tick.lock'),async()=>{
      const run=this.snapshot(runId);
      const actionable=Object.values(run.tracks).filter(t=>
        (t.phase==='PLAN' && ['READY','REVISE','WAITING'].includes(t.state)) ||
        (t.phase==='BUILD' && ['READY','WAITING'].includes(t.state)) ||
        (t.phase==='REVIEW' && t.state==='WAITING' && t.operation==='AWAIT_REVIEW'));
      const bounded=(promise,issue)=>this.deadline(runId,run.policy.operation_timeout_ms,promise,issue);
      const queue=await bounded(this.reviewQueue(runId),null);
      if(queue.state==='UNKNOWN_IN_FLIGHT') return {run_id:runId,results:[queue],review_queue:null};
      const actions=[...actionable.map(async t=>{
        if(t.phase==='PLAN' && t.state==='WAITING') return {issue_id:t.issue_id,stage:'PLAN_IDLE',result:await this.finishPlanOnly(runId,t.issue_id)};
        if(t.phase==='BUILD') return {issue_id:t.issue_id,stage:'BUILD',result:await (t.state==='WAITING' ? this.finishBuild(runId,t.issue_id) : this.beginBuild(runId,t.issue_id))};
        if(t.phase==='REVIEW') return {issue_id:t.issue_id,stage:'REVIEW',result:await this.finishReview(runId,t.issue_id)};
        if(!t.session) return {issue_id:t.issue_id,stage:'START',result:await this.start(runId,t.issue_id)};
        if(t.state==='REVISE' && t.operation!=='AWAIT_REVISION')
          return {issue_id:t.issue_id,stage:'PLAN_REVISION',result:await this.startRevision(runId,t.issue_id)};
        const observation=await hostMethod(this.adapter,'pollPlan')({run_id:runId,issue_id:t.issue_id,session:t.session,session_id:t.session_id});
        if(observation?.state==='WAIT') return {issue_id:t.issue_id,stage:'PLAN',result:observation};
        if(observation?.state==='UNKNOWN') return {issue_id:t.issue_id,stage:'PLAN',result:await this.holdUnknownPlan(runId,t.issue_id,t.session_id,observation.reason||observation.status?.error||'plan session unavailable')};
        if(t.state==='REVISE' && observation?.state==='READY' && digest(observation.plan)===t.plan_digest)
          return {issue_id:t.issue_id,stage:'PLAN',result:await this.holdUnknownPlan(runId,t.issue_id,t.session_id,'revised plan did not change')};
        assert(observation?.state==='READY' && observation.session_id===t.session_id && observation.plan,
          t.issue_id+': host plan status unavailable or wrong session');
        return {issue_id:t.issue_id,stage:'PLAN',result:await this.plan(runId,t.issue_id,observation.plan)};
      }).map((p,i)=>bounded(p.catch(e=>({issue_id:actionable[i].issue_id,state:'ERROR',reason:String(e.message)})),actionable[i].issue_id)),
        ...queue.ready.map(async id=>{try{return {issue_id:id,stage:'REVIEW',result:await this.review(runId,id)};}
          catch(e){return {issue_id:id,state:'ERROR',reason:String(e.message)};}}).map((p,i)=>bounded(p,queue.ready[i]))];
      const settled=await Promise.allSettled(actions);
      return {run_id:runId,results:settled.map(x=>x.status==='fulfilled' ? x.value : {state:'ERROR',reason:String(x.reason?.message || x.reason)}),
        review_queue:await bounded(this.reviewQueue(runId),null)};
    });
  }
  // A dependency waiting on a sibling is a scheduler hold, not a permanent
  // track error. Live head/dependency checks are repeated immediately in review.
  async reviewBlock(run,t,observed=null) {
    const ids=new Set(Object.keys(run.tracks));
    const graph=observed || reviewedGraph(await hostMethod(this.adapter,'verifyReviewGraph')({run_id:run.run_id,repo:run.repo,selection_snapshot:run.selection_snapshot,review_edges:run.review_edges,fresh:true}),ids);
    try { validateEdges(relevantReviewEdges(graph.edges,t.issue_id),ids); }
    catch (e) { return 'ticket review dependency invalid: '+e.message; }
    if (!isHash(graph.issues[t.issue_id])) return 'ticket review evidence unavailable';
    if (graph.issues[t.issue_id]!==run.review_graph_evidence.issues[t.issue_id] ||
        reviewFingerprint(graph.edges,t.issue_id)!==run.review_graph_evidence.fingerprints[t.issue_id])
      return 'ticket review dependencies changed or unavailable';
    for (const edge of graph.edges.filter(e=>e.to===t.issue_id)) {
      const dep=run.tracks[edge.from];
      if (edge.from_event==='review' && dep) {
        if (!(dep?.state==='COMPLETED' && dep.review?.verdict==='CLEAN' && dep.review.head_sha===dep.pr?.head_sha))
          return 'review dependency not complete: '+edge.from;
        if (await hostMethod(this.adapter,'head')({run_id:run.run_id,pr:dep.pr,issue_id:edge.from})!==dep.review.head_sha)
          return 'review dependency head moved: '+edge.from;
        if (!(await this.reviewCurrent(run,dep))) return 'review dependency evidence or CI is stale: '+edge.from;
        const upstream=await this.reviewBlock(run,dep,graph);
        if (upstream) return 'review dependency '+edge.from+': '+upstream;
      } else {
        const proof=await hostMethod(this.adapter,'dependency')({edge,run});
        if (!(proof?.state==='SATISFIED' && text(proof.source))) return 'review dependency not satisfied: '+edge.from;
      }
    }
    return null;
  }
  async reviewCurrent(run,t) {
    const observed=await hostMethod(this.adapter,'verifyReview')({run,issue_id:t.issue_id,pr:t.pr,review:t.review});
    return observed?.state==='CLEAN' && observed.head_sha===t.review?.head_sha &&
      observed.review_id===t.review?.review_id && observed.reviewer_id===t.review?.reviewer_id &&
      ['GREEN','NONE_CONFIGURED'].includes(observed.ci) && text(observed.source);
  }
  async reviewQueue(runId) {
    const run=this.snapshot(runId), result={ready:[],blocked:[],running:[],completed:[],error:[]};
    let graph=null, graphError=null;
    if (Object.values(run.tracks).some(t=>t.phase==='REVIEW' && ['READY','COMPLETED'].includes(t.state))) {
      try {
        graph=reviewedGraph(await hostMethod(this.adapter,'verifyReviewGraph')({run_id:run.run_id,repo:run.repo,
          selection_snapshot:run.selection_snapshot,review_edges:run.review_edges,fresh:true}),new Set(Object.keys(run.tracks)));
      } catch(e) { graphError='dependency evidence unavailable: '+e.message; }
    }
    for (const t of Object.values(run.tracks)) {
      if (t.phase!=='REVIEW') continue;
      if (t.state==='READY') {
        let reason;
        try { reason=graphError || await this.reviewBlock(run,t,graph); } catch(e) { reason='dependency evidence unavailable: '+e.message; }
        (reason ? result.blocked : result.ready).push(reason ? {issue_id:t.issue_id,reason} : t.issue_id);
      } else if (t.state==='RUNNING' || (t.state==='WAITING' && t.operation==='AWAIT_REVIEW')) result.running.push(t.issue_id);
      else if (t.state==='COMPLETED') {
        let reason;
        try {
          reason=graphError || await this.reviewBlock(run,t,graph);
          if (!reason && await hostMethod(this.adapter,'head')({run_id:run.run_id,pr:t.pr,issue_id:t.issue_id})!==t.review?.head_sha) reason='reviewed PR head moved';
          if (!reason && !(await this.reviewCurrent(run,t))) reason='same-head review or CI evidence is stale';
        } catch(e) { reason='final evidence unavailable: '+e.message; }
        if(reason) result.blocked.push({issue_id:t.issue_id,reason}); else result.completed.push(t.issue_id);
      }
      else if (t.state==='BLOCKED') result.blocked.push({issue_id:t.issue_id,reason:t.review?.reason || t.error || t.review?.verdict || 'blocked'});
      else if (t.state==='ERROR') result.error.push({issue_id:t.issue_id,reason:t.error});
    }
    return result;
  }
}
module.exports={Controller,digest};
