'use strict';
// The supervising agent answers these requests after consulting original Linear,
// GitHub and scope sources. The bridge transports observations; it does not
// turn an unsupported model assertion into source evidence.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=x=>'sha256:'+crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function atomic(file,obj){const tmp=file+'.'+crypto.randomUUID()+'.tmp';const fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(obj));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
function createEvidenceBridge({stateRoot,interval=100,timeout=0}={}) {
  if(!path.isAbsolute(stateRoot||'')) throw Error('absolute shared state root required');
  const root=path.join(stateRoot,'supervisor-evidence'),requests=path.join(root,'requests'),responses=path.join(root,'responses');
  function setup(){fs.mkdirSync(requests,{recursive:true,mode:0o700});fs.mkdirSync(responses,{recursive:true,mode:0o700});}
  const validRun=id=>typeof id==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  const runOf=args=>args?.run_id || args?.run?.run_id;
  async function call(method,args) {
    if(!validRun(runOf(args))) throw Error('valid run ID required for source evidence');
    setup();
    // Preparation can perform worktree/status writes. A repeated request for
    // the same session reuses its original receipt instead of redoing it.
    const fixed=method==='prepareSession';
    const raw=fixed ? crypto.createHash('sha256').update(JSON.stringify([method,args.run_id,args.issue_id,args.session_id])).digest('hex') : null;
    const id=fixed ? `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20,32)}` : crypto.randomUUID();
    let value={id,method,args,created_at:new Date().toISOString()};
    const request=path.join(requests,id+'.json'), response=path.join(responses,id+'.json');
    if(fixed) {
      const tmp=request+'.'+crypto.randomUUID()+'.tmp';
      const fd=fs.openSync(tmp,'wx',0o600);
      try {fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
      try {fs.linkSync(tmp,request);}
      catch(e){if(e.code!=='EEXIST')throw e;value=JSON.parse(fs.readFileSync(request,'utf8'));if(value.method!==method || JSON.stringify(value.args)!==JSON.stringify(args))throw Error('existing preparation request has different bindings');}
      finally {fs.unlinkSync(tmp);}
    } else atomic(request,value);
    const deadline=timeout>0?Date.now()+timeout:Infinity;
    while(Date.now()<deadline) {
      try {
        const reply=JSON.parse(fs.readFileSync(response,'utf8'));
        if(reply.id!==id || reply.request_digest!==digest(value) || !reply.result || typeof reply.result!=='object')
          throw Error('supervisor evidence response does not match request');
        return reply.result;
      } catch(e){if(e.code!=='ENOENT')throw e;}
      await sleep(interval);
    }
    throw Error('supervisor evidence unavailable; request may still be in flight');
  }
  function pending(runId) {
    if(!validRun(runId)) throw Error('valid run ID required');
    setup();return fs.readdirSync(requests).filter(x=>/^[0-9a-f-]{36}\.json$/.test(x) && !fs.existsSync(path.join(responses,x)))
      .map(x=>JSON.parse(fs.readFileSync(path.join(requests,x),'utf8'))).filter(x=>runOf(x.args)===runId);
  }
  function respond(runId,id,result) {
    if(!validRun(runId)) throw Error('valid run ID required');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id||'')) throw Error('full evidence request UUID required');
    if(!result || typeof result!=='object' || Array.isArray(result)) throw Error('evidence object required');
    setup();const request=JSON.parse(fs.readFileSync(path.join(requests,id+'.json'),'utf8'));
    if(runOf(request.args)!==runId) throw Error('evidence request belongs to a different run');
    const out=path.join(responses,id+'.json');
    // One answer per exact request. Recheck the actual source before answering.
    const tmp=out+'.'+crypto.randomUUID()+'.tmp';
    const fd=fs.openSync(tmp,'wx',0o600);
    try {fs.writeFileSync(fd,JSON.stringify({id,request_digest:digest(request),result}));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    try {fs.linkSync(tmp,out);} finally {fs.unlinkSync(tmp);}
    return {state:'RECORDED',id};
  }
  const bridge={call,pending,respond};
  for(const method of ['verifyRunAuthorization','captureBatch','verifyBatch','verifyReviewGraph','admit',
      'verifyMainChange','validatePlan','verifyPlanApproval','dependency','verifyReview','prepareSession','verifyPullRequest','verifyReviewResult','verifyWorkerFailure'])
    bridge[method]=args=>call(method,args);
  const isFresh=r=>r && typeof r.source==='string' && !!r.source.trim() &&
    /^\d{4}-\d\d-\d\dT.*Z$/.test(r.checked_at||'') && Number.isFinite(Date.parse(r.checked_at)) &&
    Date.now()-Date.parse(r.checked_at)>=0 && Date.now()-Date.parse(r.checked_at)<=3600000;
  bridge.head=async args=>{const r=await call('head',args);return isFresh(r)?r.head_sha:null;};
  for(const method of ['dependency','verifyReview','verifyPullRequest','verifyReviewResult','verifyWorkerFailure'])
    bridge[method]=async args=>{const r=await call(method,args);return isFresh(r)?r:{state:'UNKNOWN',reason:'fresh source evidence required'};};
  return bridge;
}
module.exports={createEvidenceBridge,digest};
