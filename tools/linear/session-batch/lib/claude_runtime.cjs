'use strict';
// File-mailbox transport to one persistent SDK worker per issue. A reservation
// is never removed or reused automatically: a lost response may still land.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const hash=x=>'sha256:'+crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function atomic(file,obj) {
  const tmp=file+'.'+crypto.randomUUID()+'.tmp';
  const fd=fs.openSync(tmp,'wx',0o600);
  try {fs.writeFileSync(fd,JSON.stringify(obj));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  fs.renameSync(tmp,file);
}
function mkdir(dir){fs.mkdirSync(dir,{recursive:true,mode:0o700});}
function createClaudeRuntime({stateRoot,python='python3',claude='claude',worker=path.join(__dirname,'claude_worker.py'),
  spawnProcess=spawn,env=process.env,requestTimeout=5000,startTimeout=30000}={}) {
  if(!path.isAbsolute(stateRoot||'')) throw Error('absolute shared state root required');
  const base=path.join(stateRoot,'claude-sessions');
  function dir(sessionId) {
    if(!UUID.test(sessionId||'')) throw Error('full session UUID required');
    return path.join(base,sessionId.toLowerCase());
  }
  function load(sessionId) {
    const p=path.join(dir(sessionId),'config.json');
    return JSON.parse(fs.readFileSync(p,'utf8'));
  }
  async function request(sessionId,command,extra={},timeout=requestTimeout) {
    let config;
    try {config=load(sessionId);} catch {return {state:'UNKNOWN',reason:'missing or incomplete session reservation'};}
    if(config.session_id!==sessionId) return {state:'UNKNOWN',reason:'reservation session mismatch'};
    const id=crypto.randomUUID()+'.json';
    const requestPath=path.join(config.ipc_dir,'requests',id), responsePath=path.join(config.ipc_dir,'responses',id);
    try {atomic(requestPath,{token:config.token,command,...extra});}
    catch {return {state:'UNKNOWN',reason:'session mailbox unavailable'};}
    const until=Date.now()+timeout;
    while(Date.now()<until) {
      try {
        const result=JSON.parse(fs.readFileSync(responsePath,'utf8'));
        fs.unlinkSync(responsePath);
        return result;
      } catch(e) {
        if(e.code!=='ENOENT') return {state:'UNKNOWN',reason:'invalid or unreadable worker response'};
      }
      await pause(50);
    }
    // The worker can still consume the request after a timeout. No retry is safe.
    return {state:'UNKNOWN',reason:'worker response timed out; outcome may still be in flight'};
  }
  async function start(spec) {
    if(!spec || !UUID.test(spec.session_id||'') || typeof spec.issue_id!=='string' || !spec.issue_id.trim() ||
      !path.isAbsolute(spec.worktree||'') || !path.isAbsolute(spec.repo||'') || typeof spec.branch!=='string' || !spec.branch.trim() ||
      !['plan_only','implement'].includes(spec.mode) || typeof spec.plan_prompt!=='string' || !spec.plan_prompt.trim() || !spec.admission)
      throw Error('complete, absolute session specification required');
    mkdir(base);
    const sessionDir=dir(spec.session_id);
    let created=false;
    try {fs.mkdirSync(sessionDir,{mode:0o700});created=true;} catch(e){if(e.code!=='EEXIST')throw e;}
    if(created) {
      const ipc=path.join(sessionDir,'ipc');mkdir(path.join(ipc,'requests'));mkdir(path.join(ipc,'responses'));
      const config={...spec,token:crypto.randomBytes(32).toString('hex'),ipc_dir:ipc,claude_path:claude};
      atomic(path.join(sessionDir,'config.json'),config);
      const childEnv={...env};
      for(const k of ['CODEX_SESSION_ID','CODEX_THREAD_ID','CLAUDE_CODE_CHILD_SESSION','CLAUDECODE','GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']) delete childEnv[k];
      let child;
      try {child=spawnProcess(python,[worker,path.join(sessionDir,'config.json')],{cwd:spec.worktree,env:childEnv,detached:true,stdio:'ignore'});}
      catch {return {state:'UNKNOWN',reason:'worker spawn failed; reservation remains for reconciliation'};}
      child.on('error',()=>{});child.unref();
      atomic(path.join(sessionDir,'launch.json'),{pid:child.pid || null,created_at:new Date().toISOString()});
    } else {
      let existing;
      try {existing=load(spec.session_id);} catch {return {state:'UNKNOWN',reason:'incomplete reservation; reconcile without relaunching'};}
      const fields=['session_id','issue_id','repo','worktree','branch','mode','plan_prompt','admission'];
      if(fields.some(k=>JSON.stringify(existing[k])!==JSON.stringify(spec[k])))
        return {state:'UNKNOWN',reason:'existing session reservation has different bindings'};
    }
    const deadline=Date.now()+startTimeout;
    while(Date.now()<deadline) {
      const status=await request(spec.session_id,'status',{},Math.min(1000,Math.max(100,deadline-Date.now())));
      if(status.issue_id!==spec.issue_id || status.session_id!==spec.session_id || status.worktree!==spec.worktree) {
        if(status.state!=='UNKNOWN') return {state:'UNKNOWN',reason:'worker session binding mismatch'};
      } else if(['PLAN_RUNNING','PLAN_READY'].includes(status.state) && status.phase==='PLAN' && status.verified_init===true) {
        return {state:'READY',session_id:spec.session_id,issue_id:spec.issue_id,permission_mode:'plan',
          branch:spec.branch,worktree:spec.worktree,source:'persistent Claude SDK initialization',created};
      } else if(status.state==='ERROR') return {state:'UNKNOWN',reason:'worker initialization failed'};
      await pause(100);
    }
    return {state:'UNKNOWN',reason:'worker initialization not verified; do not relaunch'};
  }
  async function plan(sessionId){return request(sessionId,'plan');}
  async function idle(sessionId){return request(sessionId,'idle');}
  async function revisePlan(sessionId,plan,prompt){return request(sessionId,'revise_plan',{plan,prompt});}
  async function build(sessionId,plan,planDigest,prompt) {
    if(hash(plan)!==planDigest) return {state:'UNKNOWN',reason:'exact plan digest mismatch'};
    return request(sessionId,'build',{plan,plan_digest:planDigest,prompt});
  }
  async function buildStatus(sessionId){return request(sessionId,'build_status');}
  async function review(sessionId,prompt){return request(sessionId,'review',{prompt});}
  async function reviewStatus(sessionId){return request(sessionId,'review_status');}
  async function close(sessionId){
    const response=await request(sessionId,'close');
    if(response?.state!=='CLOSING' || response.session_id!==sessionId) return response;
    const config=load(sessionId), deadline=Date.now()+requestTimeout;
    while(Date.now()<deadline) {
      try {const done=JSON.parse(fs.readFileSync(path.join(config.ipc_dir,'terminated.json'),'utf8'));
        if(done.session_id===sessionId && done.state==='STOPPED') return done;
      } catch(e){if(e.code!=='ENOENT')return {state:'UNKNOWN',reason:'worker stop evidence unreadable'};}
      await pause(50);
    }
    return {state:'UNKNOWN',reason:'worker termination not verified'};
  }
  return {start,request,plan,idle,revisePlan,build,buildStatus,review,reviewStatus,close,load};
}
module.exports={createClaudeRuntime,hash};
