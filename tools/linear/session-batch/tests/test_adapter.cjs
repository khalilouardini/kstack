'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createAdapter}=require('../lib/claude_adapter.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'batch-adapter-'));
const repo=path.join(tmp,'repo'),wt=path.join(tmp,'worktree');fs.mkdirSync(repo);
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8'}).trim();
git(repo,'init','-q','-b','main');git(repo,'-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','base');
const base=git(repo,'rev-parse','HEAD');git(repo,'worktree','add','-qb','codex/t-1',wt);
const session='7fcd9bad-c10a-487d-9405-b8d3957e0925',issue='T-1';
const req={run_id:'run',issue_id:issue,session_id:session,repo,mode:'implement',admission:{main_sha:base,scope_digest:'sha256:'+'b'.repeat(64),criteria_digest:'sha256:'+'c'.repeat(64)}};
const prepared={state:'PREPARED',issue_id:issue,session_id:session,branch:'codex/t-1',default_branch:'main',protected_branches:['main'],tracker_status:{issue_id:issue,type:'started',id:'started'},worktree:wt,checked_at:new Date().toISOString(),status_verified:true,source:'real git',status_source:'tracker read',plan_prompt:'plan',build_prompt:'build',review_prompt:'review'};
let preparedCount=0;
const evidence={prepareSession:async()=>{preparedCount++;return prepared;},
  verifyPullRequest:async()=>({state:'PR_OPEN',session_id:session,issue_id:issue,pr_url:'https://example.test/pr/1',head_sha:base,evidence:'forge read'}),
  verifyReviewResult:async()=>({verdict:'CLEAN',head_sha:base,review_id:'1',reviewer_id:'reviewer',independent:true,review_process_stopped:true,ci:'GREEN',evidence:'forge and process'})};
const runtime={start:async x=>({state:'READY',session_id:x.session_id,issue_id:x.issue_id,permission_mode:'plan',branch:x.branch,worktree:x.worktree,source:'sdk init'}),
 plan:async()=>({state:'WAIT'}),idle:async()=>({state:'IDLE',session_id:session}),build:async()=>({state:'WAIT',session_id:session}),buildStatus:async()=>({state:'READY',session_id:session,result:{}}),
 review:async()=>({state:'WAIT',session_id:session}),reviewStatus:async()=>({state:'READY',session_id:session,result:{}})};
(async()=>{try {
 const a=createAdapter({stateRoot:path.join(repo,'.git','kstack-session-batch'),evidence,runtime,checkCapabilities:false});
 if(process.env.KSTACK_SDK_TEST_PYTHON) {
  const probe=createAdapter({stateRoot:path.join(repo,'.git','kstack-session-batch'),evidence,runtime,
    python:process.env.KSTACK_SDK_TEST_PYTHON,claude:path.join(__dirname,'fake_claude.py')});
  assert.equal((await probe.ensureSession(req)).state,'READY');
  const before=preparedCount;
  const bad=createAdapter({stateRoot:path.join(repo,'.git','kstack-session-batch'),evidence,runtime,
    python:process.env.KSTACK_SDK_TEST_PYTHON,claude:path.join(__dirname,'fake_claude.py'),env:{...process.env,FAKE_HOOK_UNSUPPORTED:'1'}});
  await assert.rejects(()=>bad.ensureSession(req),/fail-closed hooks/);
  assert.equal(preparedCount,before,'failed capability check must precede preparation');
 }
 const created=await a.ensureSession(req);assert.equal(created.state,'READY');assert.equal(created.workspace_verified,true);assert.equal(created.status_verified,true);
 const pr=await a.pollBuild({run_id:'run',issue_id:issue,session_id:session,session:created});assert.equal(pr.state,'PR_OPEN');
 const review=await a.pollReview({run_id:'run',issue_id:issue,session_id:session,session:created});assert.equal(review.verdict,'CLEAN');
 evidence.verifyReviewResult=async()=>({verdict:'CLEAN'});assert.equal((await a.pollReview({run_id:'run',issue_id:issue,session_id:session,session:created})).state,'UNKNOWN');
 fs.writeFileSync(path.join(wt,'untracked'),'x');assert.equal((await a.ensureSession(req)).state,'UNKNOWN');
 assert.equal((await a.build({session:created,session_id:session,plan:{main_sha:base},plan_digest:'x'})).state,'UNKNOWN');
 assert.equal((await a.review({session:created,session_id:session,pr:{head_sha:base}})).state,'UNKNOWN');
 fs.unlinkSync(path.join(wt,'untracked'));prepared.protected_branches=['codex/*'];assert.equal((await a.ensureSession(req)).state,'UNKNOWN');
 prepared.protected_branches=['main'];prepared.default_branch='codex/t-1';assert.equal((await a.ensureSession(req)).state,'UNKNOWN');
 assert.equal(preparedCount,process.env.KSTACK_SDK_TEST_PYTHON ? 5 : 4);
 console.log('PASS Claude adapter verifies worktrees, PR heads and review process evidence');
} finally {fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
