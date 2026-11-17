'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createClaudeRuntime,hash}=require('../lib/claude_runtime.cjs');
const {spawn}=require('node:child_process');
const children=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'kstack-runtime-test-'));
const sid='7fcd9bad-c10a-487d-9405-b8d3957e0925';
const log=path.join(root,'fake.log');
const spec={repo:root,worktree:root,branch:'codex/t-1',issue_id:'T-1',session_id:sid,mode:'implement',plan_prompt:'please plan',
  admission:{main_sha:'a'.repeat(40),scope_digest:'sha256:'+'b'.repeat(64),criteria_digest:'sha256:'+'c'.repeat(64)}};
const actualSdk=process.env.KSTACK_SDK_TEST_PYTHON;
const sdkEnv={...process.env,FAKE_SESSION_LOG:log};
if(actualSdk) delete sdkEnv.PYTHONPATH; else sdkEnv.PYTHONPATH=path.join(__dirname,'fake_sdk');
const runtime=createClaudeRuntime({stateRoot:root,python:actualSdk||process.env.PYTHON||'python3',claude:actualSdk?path.join(__dirname,'fake_claude.py'):'/nonexistent/claude',
  worker:path.join(__dirname,'../lib/claude_worker.py'),env:sdkEnv,
  spawnProcess:(...args)=>{const child=spawn(...args);children.push(child);return child;},requestTimeout:2000,startTimeout:5000});
(async()=>{
  try {
    const first=await runtime.start(spec);
    assert.equal(first.state,'READY');assert.equal(first.created,true);
    const second=await runtime.start(spec);
    assert.equal(second.state,'READY');assert.equal(second.created,false);
    assert.equal((await runtime.start({...spec,issue_id:'T-2'})).state,'UNKNOWN');
    let plan;
    for(let i=0;i<40;i++){const r=await runtime.plan(sid);if(r.state==='READY'){plan=r.plan;break;}await sleep(50);}
    assert.ok(plan);assert.equal(plan.session_id,sid);assert.equal(plan.issue_id,'T-1');
    assert.equal((await runtime.revisePlan(sid,plan,'revise the plan')).state,'WAIT');
    for(let i=0;i<40;i++){const r=await runtime.plan(sid);if(r.state==='READY' && r.plan.text==='revised plan'){plan=r.plan;break;}await sleep(50);}
    assert.equal(plan.text,'revised plan');
    assert.equal((await runtime.build(sid,plan,'sha256:'+'0'.repeat(64),'build')).state,'UNKNOWN');
    assert.equal((await runtime.build(sid,plan,hash(plan),'build')).state,'WAIT');
    let built;
    for(let i=0;i<40;i++){const r=await runtime.buildStatus(sid);if(r.state==='READY'){built=r;break;}await sleep(50);}
    assert.equal(built.session_id,sid);assert.equal(built.result.head_sha,'b'.repeat(40));
    assert.equal((await runtime.review(sid,'review')).state,'WAIT');
    let review;for(let i=0;i<40;i++){const r=await runtime.reviewStatus(sid);if(r.state==='READY'){review=r;break;}await sleep(50);}
    assert.equal(review.session_id,sid);
    const turns=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(turns.map(x=>x.mode),['plan','plan','auto','auto']);
    if(actualSdk) {assert.equal(turns[0].decision,'deny');assert.equal(turns[1].decision,'deny');assert.equal(turns[2].decision,'defer');assert.equal(turns[3].decision,'defer');}
    assert.equal(turns[0].pid,turns[1].pid);assert.equal(turns[1].pid,turns[2].pid);assert.equal(turns[2].pid,turns[3].pid);
    assert.equal(turns[0].session_id,sid);assert.equal(turns[1].session_id,sid);assert.equal(turns[2].session_id,sid);assert.equal(turns[3].session_id,sid);
    assert.equal((await runtime.close(sid)).state,'STOPPED');
    await sleep(100);
    assert.equal((await runtime.start(spec)).state,'UNKNOWN');
    assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,4);
    const secondId='8fcd9bad-c10a-487d-9405-b8d3957e0925', secondSpec={...spec,session_id:secondId};
    assert.equal((await runtime.start(secondSpec)).state,'READY');
    const launch=JSON.parse(fs.readFileSync(path.join(root,'claude-sessions',secondId,'launch.json')));
    const child=children.find(p=>p.pid===launch.pid);assert.ok(child);child.kill('SIGTERM');await sleep(100);
    assert.equal((await runtime.start(secondSpec)).state,'UNKNOWN');
    assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').length,5);

    console.log('PASS persistent worker stays in one session and never silently recreates a lost worker');
  } finally {
    for(const child of children) if(child.exitCode===null && child.signalCode===null) child.kill('SIGTERM');
    fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
