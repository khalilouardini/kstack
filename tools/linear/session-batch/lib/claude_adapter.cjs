'use strict';
// Production adapter: the supervisor obtains original tracker/forge facts over
// its connected tools; the persistent SDK worker performs ticket work. Local
// Git and worker observations are checked here rather than inferred from text.
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {execFile,execFileSync}=require('node:child_process');
const {promisify}=require('node:util');
const execFileAsync=promisify(execFile);
const {createClaudeRuntime}=require('./claude_runtime.cjs');
const {createEvidenceBridge}=require('./supervisor_evidence.cjs');
const SHA=/^[0-9a-f]{40}$/;
const text=x=>typeof x==='string' && !!x.trim();
function protectedBranch(branch,patterns) {
  return patterns.some(p=>{
    if(typeof p!=='string' || !p || p.includes('[') || p.includes(']')) throw Error('unsupported protected branch pattern');
    const pattern=p.split('').map(ch=>ch==='*'?'.*':ch==='?'?'.':/[\\^$+?.()|{}]/.test(ch)?'\\'+ch:ch).join('');
    return new RegExp('^'+pattern+'$').test(branch);
  });
}
function fresh(s){return /^\d{4}-\d\d-\d\dT.*Z$/.test(s||'') && Number.isFinite(Date.parse(s)) && Date.now()-Date.parse(s)>=0 && Date.now()-Date.parse(s)<=3600000;}
function createAdapter({stateRoot,evidence,runtime,python,claude,worker,env,checkCapabilities=true}={}) {
  if(!path.isAbsolute(stateRoot||'')) throw Error('absolute shared state root required');
  const source=evidence||createEvidenceBridge({stateRoot});
  const installed=path.join(process.env.KSTACK_STATE||path.join(os.homedir(),'.kstack'),'runtimes','claude-session-batch-0.2.180','bin','python');
  const executable=python||process.env.KSTACK_CLAUDE_PYTHON||(fs.existsSync(installed)?installed:'python3');
  const host=runtime||createClaudeRuntime({stateRoot,python:executable,
    claude:claude||process.env.KSTACK_CLAUDE_BIN||'claude',worker,env:env||process.env});
  function git(cwd,...args){return execFileSync('git',['-C',cwd,...args],{encoding:'utf8',timeout:10000}).trim();}
  let capabilityCheck=null;
  function capability(repo) {
    if(!checkCapabilities) return Promise.resolve();
    if(capabilityCheck) return capabilityCheck;
    capabilityCheck=(async()=>{
      try {
        const cli=claude||process.env.KSTACK_CLAUDE_BIN||'claude';
        const opts={encoding:'utf8',timeout:10000,env:env||process.env};
        const version=(await execFileAsync(executable,['-c','import importlib.metadata; print(importlib.metadata.version("claude-agent-sdk"))'],opts)).stdout.trim();
        if(version!=='0.2.180') throw Error('unsupported SDK version');
        const auth=JSON.parse((await execFileAsync(cli,['auth','status'],opts)).stdout);
        if(auth.loggedIn!==true) throw Error('Claude is not signed in');
        const help=(await execFileAsync(cli,['--help'],opts)).stdout;
        if(!['--session-id','--restricted','--permission-mode','--permission-prompts'].every(x=>help.includes(x))) throw Error('required Claude CLI capability missing');
        // Control initialization only: no prompt, tracker contents or model call.
        await execFileAsync(executable,[path.join(__dirname,'check_claude_runtime.py'),cli,repo],{...opts,timeout:30000});
      } catch {throw Error('Claude SDK 0.2.180 and signed-in compatible Claude CLI with fail-closed hooks are required before preparation');}
    })();
    capabilityCheck.catch(()=>{capabilityCheck=null;});
    return capabilityCheck;
  }
  function workspace(prepared,request) {
    if(prepared?.state!=='PREPARED' || prepared.issue_id!==request.issue_id || prepared.session_id!==request.session_id ||
       !path.isAbsolute(prepared.worktree||'') || !text(prepared.branch) || !text(prepared.default_branch) ||
       prepared.branch===prepared.default_branch || !Array.isArray(prepared.protected_branches) ||
       !text(prepared.source) || !text(prepared.status_source) || prepared.tracker_status?.issue_id!==request.issue_id ||
       !['started','unstarted'].includes(prepared.tracker_status?.type) ||
       (request.mode==='implement' && prepared.tracker_status.type!=='started') || !text(prepared.tracker_status.id) ||
       prepared.status_verified!==true || !fresh(prepared.checked_at) || !text(prepared.plan_prompt) ||
       (request.mode==='implement' && (!text(prepared.build_prompt) || !text(prepared.review_prompt))))
      throw Error('fresh tracker status, scoped prompts and worktree preparation required');
    const repo=fs.realpathSync(request.repo), worktree=fs.realpathSync(prepared.worktree);
    if(protectedBranch(prepared.branch,prepared.protected_branches)) throw Error('prepared branch is protected');
    git(worktree,'check-ref-format','--branch',prepared.branch);
    if(git(worktree,'rev-parse','--show-toplevel')!==worktree ||
       fs.realpathSync(git(worktree,'rev-parse','--path-format=absolute','--git-common-dir'))!==
         fs.realpathSync(git(repo,'rev-parse','--path-format=absolute','--git-common-dir')) ||
       git(worktree,'branch','--show-current')!==prepared.branch ||
       git(worktree,'rev-parse','HEAD')!==request.admission.main_sha ||
       git(worktree,'status','--porcelain','--untracked-files=all'))
      throw Error('prepared worktree, branch, clean state or base revision could not be verified');
    return worktree;
  }
  function cleanAt(session,head) {
    try {return SHA.test(head||'') && git(session.worktree,'branch','--show-current')===session.branch &&
      git(session.worktree,'rev-parse','HEAD')===head && !git(session.worktree,'status','--porcelain','--untracked-files=all');}
    catch {return false;}
  }
  const adapter={...source,idempotentSessionCreation:true};
  adapter.ensureSession=async x=>{
    await capability(x.repo); // no workspace or tracker changes before dependency/auth checks
    const prepared=await source.prepareSession(x);
    let worktree;
    try {worktree=workspace(prepared,x);} catch(e){return {state:'UNKNOWN',reason:e.message};}
    const spec={repo:fs.realpathSync(x.repo),worktree,branch:prepared.branch,issue_id:x.issue_id,session_id:x.session_id,
      mode:x.mode,plan_prompt:prepared.plan_prompt,admission:x.admission,run_id:x.run_id};
    const result=await host.start(spec);
    if(result?.state!=='READY') return result;
    return {...result,mode:x.mode,workspace_verified:true,status_verified:true,source:prepared.source+'; '+result.source,
      build_prompt:prepared.build_prompt||null,review_prompt:prepared.review_prompt||null};
  };
  adapter.pollPlan=async x=>host.plan(x.session_id);
  adapter.revisePlan=async x=>host.revisePlan(x.session_id,x.plan,
    'Revise the exact prior plan to address this independent validation. Stay read-only and return JSON with text, files and tests.\n'+JSON.stringify({plan:x.plan,validation:x.validation}));
  adapter.sessionIdle=async x=>host.idle(x.session_id);
  adapter.finishSession=async x=>host.close(x.session_id);
  adapter.build=async x=>{
    if(!cleanAt(x.session,x.plan?.main_sha)) return {state:'UNKNOWN',reason:'implementation workspace or base changed'};
    const prompt=x.session.build_prompt+'\n\nImplement only this independently validated plan and acceptance; do not merge, deploy, or close the issue. Open only the authorized draft PR. Return a JSON object with pr_url and head_sha.\n'+JSON.stringify(x.plan);
    return host.build(x.session_id,x.plan,x.plan_digest,prompt);
  };
  adapter.pollBuild=async x=>{
    const observed=await host.buildStatus(x.session_id);
    if(observed?.state!=='READY') return observed;
    const proof=await source.verifyPullRequest({...x,worker_result:observed.result});
    const idle=await host.idle(x.session_id);
    if(proof?.state!=='PR_OPEN' || proof.session_id!==x.session_id || proof.issue_id!==x.issue_id ||
       !text(proof.pr_url) || !SHA.test(proof.head_sha||'') || !text(proof.evidence) ||
       idle?.state!=='IDLE' || idle.session_id!==x.session_id)
      return {state:'UNKNOWN',reason:'same-session PR, current head and idle evidence required'};
    try {
      if(git(x.session.worktree,'branch','--show-current')!==x.session.branch ||
         git(x.session.worktree,'rev-parse','HEAD')!==proof.head_sha ||
         git(x.session.worktree,'status','--porcelain','--untracked-files=all'))
        return {state:'UNKNOWN',reason:'PR head or worktree state changed'};
    } catch {return {state:'UNKNOWN',reason:'PR worktree unavailable'};}
    return {...proof,session_idle:true};
  };
  adapter.review=async x=>{
    if(!cleanAt(x.session,x.pr?.head_sha)) return {state:'UNKNOWN',reason:'review workspace or PR head changed'};
    const prompt=x.session.review_prompt+'\n\nRun the canonical independent pr-loop for this PR using this same implementation session. Never merge or deploy. Return JSON with verdict, head_sha, reviewer_id, review_id, ci and evidence.\n'+JSON.stringify(x.pr);
    return host.review(x.session_id,prompt);
  };
  adapter.pollReview=async x=>{
    const observed=await host.reviewStatus(x.session_id);
    if(observed?.state!=='READY') return observed;
    const proof=await source.verifyReviewResult({...x,worker_result:observed.result});
    const idle=await host.idle(x.session_id);
    if(idle?.state!=='IDLE' || idle.session_id!==x.session_id || proof?.review_process_stopped!==true)
      return {state:'UNKNOWN',reason:'review worker or independent reviewer completion not verified'};
    if(proof.verdict==='CLEAN' && !cleanAt(x.session,proof.head_sha))
      return {state:'UNKNOWN',reason:'reviewed head or worktree state changed'};
    return proof;
  };
  return adapter;
}
module.exports={createAdapter};
