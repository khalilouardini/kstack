'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync,spawn}=require('node:child_process');
const {createClaudeRuntime}=require('../lib/claude_runtime.cjs');
const children=[];
const {Controller,digest}=require('../lib/controller.cjs');
const {createAdapter}=require('../lib/claude_adapter.cjs');
const {createEvidenceBridge}=require('../lib/supervisor_evidence.cjs');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'batch-live-adapter-'));
const repo=path.join(tmp,'repo'),wt=path.join(tmp,'worktree');fs.mkdirSync(repo);
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8'}).trim();
git(repo,'init','-q','-b','main');git(repo,'-c','user.name=Test','-c','user.email=test@example.test','commit','--allow-empty','-qm','base');
const base=git(repo,'rev-parse','HEAD');git(repo,'worktree','add','-qb','codex/t-1',wt);
const stateRoot=path.join(repo,'.git','kstack-session-batch'), H='sha256:'+'d'.repeat(64),issue='T-1';
const facts={scope_digest:H,criteria_digest:H,closure_graph_digest:H,closure_evidence_digest:H};
const sat={state:'SATISFIED',source:'fixture source',detail:'observed'};
const snapshot={schema_version:2,complete:true,snapshot_id:'fixture',source_revision:'c'.repeat(40),command:['--parallel','1'],requested:1,main_sha:base,checked_at:new Date().toISOString(),
 candidates:[{issue_id:issue,project:null,milestone:'M1',priority:1,active_release:true,ownership:{state:'INACTIVE',source:'fixture'},lifecycle:{state:'STARTABLE',source:'fixture',detail:'ready'},file_scope:['src/a.py'],external_overlaps:[],checks:Object.fromEntries(['scope_plan','scope_build','native','plan_graph','build_graph','foundation'].map(x=>[x,sat]))}],pairs:[]};
const input={run_id:'run',repo,authorization:{mode:'plan_only',source:'user batch grant',issue_ids:[issue],max_tracks:1},policy:{mode:'plan_only',auto_plan_validation:true,max_plan_revisions:1,operation_timeout_ms:10000,worker_concurrency:1,review_concurrency:1},selection_snapshot:snapshot,review_edges:[]};
const bridge=createEvidenceBridge({stateRoot,interval:10,timeout:5000});
const runtime=createClaudeRuntime({stateRoot,python:process.env.PYTHON||'python3',claude:'/nonexistent/claude',
 worker:path.join(__dirname,'../lib/claude_worker.py'),env:{...process.env,PYTHONPATH:path.join(__dirname,'fake_sdk'),FAKE_SESSION_LOG:path.join(tmp,'fake.log')},
 spawnProcess:(...args)=>{const child=spawn(...args);children.push(child);return child;}});
const adapter=createAdapter({stateRoot,evidence:bridge,runtime,checkCapabilities:false});
const controller=new Controller(stateRoot,adapter);
const response=({method,args})=>{
 const now=new Date().toISOString();
 if(method==='verifyRunAuthorization')return {state:'APPROVED',mode:args.authorization.mode,source:'original request',authorization_digest:digest(args.authorization)};
 if(method==='captureBatch')return {complete:true,source:'fixture audit',issues:{[issue]:H},admissions:{[issue]:{plan:facts,build:facts}}};
 if(method==='verifyReviewGraph')return {complete:true,source:'fixture graph',checked_at:now,digest:H,edges:[],issues:{[issue]:H}};
 if(method==='verifyBatch')return {state:'SATISFIED',issue_id:issue,digest:H,source:'fresh issue and graph',checked_at:now};
 if(method==='admit')return {state:'ALLOW',issue_id:issue,stage:args.stage,source:'live admission',checked_at:now,main_sha:base,...facts};
 if(method==='prepareSession')return {state:'PREPARED',issue_id:issue,session_id:args.session_id,worktree:wt,branch:'codex/t-1',default_branch:'main',protected_branches:['main'],tracker_status:{issue_id:issue,type:'unstarted',id:'unstarted'},checked_at:now,status_verified:true,status_source:'tracker read',source:'fixture read',plan_prompt:'Return a plan'};
 if(method==='validatePlan')return {verdict:'PASS',plan_digest:args.plan_digest,validator_id:'supervisor',independent:true,evidence:'criteria and scope independently checked'};
 throw Error('unexpected source request '+method);
};
let supervisorError;
const timer=setInterval(()=>{try {for(const r of bridge.pending('run'))bridge.respond('run',r.id,response(r));} catch(e){supervisorError=e;}},20);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try {
 await controller.create(input);
 let run=await controller.tick('run');assert.equal(run.results[0].stage,'START');
 for(let i=0;i<40;i++) {await controller.tick('run');if(controller.snapshot('run').tracks[issue].state==='COMPLETED')break;await pause(50);}
 const t=controller.snapshot('run').tracks[issue];
 assert.equal(t.state,'COMPLETED');assert.equal(t.phase,'PLAN');assert.equal(t.cleanup_pending,false);
 assert.equal(t.session.session_id,t.plan.session_id);
 assert.equal(fs.readFileSync(path.join(tmp,'fake.log'),'utf8').trim().split('\n').length,1);
 if(supervisorError)throw supervisorError;
 console.log('PASS default source bridge and persistent Claude adapter run a supervised plan-only batch with fixtures');
} finally {clearInterval(timer);for(const child of children) if(child.exitCode===null && child.signalCode===null)child.kill('SIGTERM');fs.rmSync(tmp,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
