import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const dir=dirname(fileURLToPath(import.meta.url));
const script=readFileSync(process.env.WAVE_SCRIPT || join(dir,'../workflow/wave.js'),'utf8');
const fixture=JSON.parse(readFileSync(join(dir,'fixtures/base.json'),'utf8'));
const cases=JSON.parse(readFileSync(join(dir,'fixtures/cases.json'),'utf8'));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const executable=script.replace('export const meta', 'const meta');
const schemaText=executable.slice(executable.indexOf('const schemas = ')+16,executable.indexOf(';\nconst common'));
const schemas=JSON.parse(schemaText);
const clone=x=>structuredClone(x);
function validate(value, schema, where='record') {
  if (schema.anyOf) {
    assert.ok(schema.anyOf.some(s=>{try {validate(value,s,where);return true;}catch {return false;}}),where+' anyOf');return;
  }
  const type=value===null?'null':Array.isArray(value)?'array':Number.isInteger(value)?'integer':typeof value;
  assert.ok((Array.isArray(schema.type)?schema.type:[schema.type]).includes(type),where+' type '+type);
  if (schema.enum) assert.ok(schema.enum.includes(value),where+' enum');
  if (type==='object') {
    for (const k of schema.required) assert.ok(Object.hasOwn(value,k),where+' missing '+k);
    for (const k of Object.keys(value)) {assert.ok(Object.hasOwn(schema.properties,k),where+' extra '+k);validate(value[k],schema.properties[k],where+'.'+k);}
  }
  if (type==='array') value.forEach((v,i)=>validate(v,schema.items,where+'['+i+']'));
}
async function run(stage, mutate=()=>{}, source=executable) {
  const f=clone(fixture);
  const args={stage,repo_root:'/tmp/repo',default_branch:'origin/main',gates:{lint:'lint',test:'test'},identities:{maintainer:'human',reviewer:'review',implementer:'impl'},stack_config:{},date:'2026-10-05',run_id:stage+'-run',wave_id:'wave-1',wave:{max_review_rounds:3,review_concurrency:1,contract_dir:'contracts'},selection:['any','--parallel','3'],paths:Object.fromEntries(['wave','next','dispatch','land','pr_loop','records','seam_check'].map(n=>[n,'/stack/'+n])),plan_record:f.plan_record,approve:'all'};
  args.graph_publication={main_sha:'a'.repeat(40),checked_at:'2026-10-05T12:00:00Z',projects:[{project_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',project_name:'Project',view_path:'docs/project.md',state:'CURRENT'}]};
  args.graph_admission=[{schema_version:1,main_sha:'a'.repeat(40),graph_sha:'a'.repeat(40),checked_at:'2026-10-05T12:00:00Z',
    transition:'build',base_digest:'sha256:'+'c'.repeat(64),graph_digest:'sha256:'+'c'.repeat(64),issue_evidence_digest:'sha256:'+'d'.repeat(64),
    evidence:{issues:{complete:true},request:{selected:['T-1','T-2','T-3']}},delta:{added_nodes:[],changed_edges:[]},
    candidates:fixture.tracks.map(t=>({issue_id:t.issue_id,identifier:t.issue_id,project_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      state:'ELIGIBLE',mode:'PUBLISHED',node_id:t.issue_id,closure:[t.issue_id],closure_evidence_digest:'sha256:'+'e'.repeat(64),unmet:[]}))}];
  const pinEvidence=()=>['Graph publication evidence: '+JSON.stringify(args.graph_publication),'Graph admission evidence: '+JSON.stringify(args.graph_admission)];
  args.plan_record.evidence=pinEvidence();
  mutate(f,args);
  const calls=[],events=[],logs=[];let runningReview=0,maxReview=0;
  const agent=async (prompt,opts)=>{
    calls.push({prompt,...opts});events.push('start '+opts.label);
    assert.ok(opts.schema);assert.ok(prompt.includes('D4 node rule:'));
    const isReview=opts.label.startsWith('B3');
    if (isReview) {runningReview++;maxReview=Math.max(maxReview,runningReview);}
    await new Promise(r=>setTimeout(r,2));
    assert.ok(Object.hasOwn(f.responses,opts.label),'unexpected call '+opts.label);
    const value=clone(f.responses[opts.label]);
    if(value!==null) validate(value,opts.schema,opts.label);
    if(isReview) runningReview--;events.push('end '+opts.label);return value;
  };
  const pipeline=async (items,...stages)=>Promise.all(items.map(async (item,index)=>{
    let prev=item;try {for(const stage of stages) prev=await stage(prev,item,index);return prev;}catch(e){logs.push('pipeline drop '+e);return null;}
  }));
  const parallel=async thunks=>Promise.all(thunks.map(async fn=>{try{return await fn();}catch{return null;}}));
  const phase=t=>assert.ok(['Select','Plan','Build','Seams','Review'].includes(t));
  const result=await new AsyncFunction('agent','pipeline','parallel','phase','log','args','budget',source)(agent,pipeline,parallel,phase,m=>logs.push(m),args,{});
  validate(result,schemas[stage==='plan'?'RUN_A':'WAVE_REPORT']);
  return {result,calls,events,logs,maxReview};
}
const seamTable=f=>f.tracks.flatMap(t=>f.literals.flatMap(e=>e.files.map(file=>({literal:e.literal,branch:t.branch,file,state:'UNCHANGED',evidence:'unchanged'}))));
const stopped=(f)=>{const b=f.responses['B1 build T-1'];b.state='STOPPED';b.pr=null;b.head_sha=null;b.stop_reason='gate failed';b.evidence=['test exit 1'];};
const overlapSelection=['any','--project','Project name','--parallel','3','--accept-overlap','479','--accept-overlap','470','--accept-overlap','479'];
const overlapPR=(number,file)=>({number,title:'Accepted PR '+number,author:'maintainer',
  state:'OPEN',head_sha:'head-'+number,changed_files:1,files:[{filename:file}]});
const overlapArgs=(_f,a)=>{a.selection=clone(overlapSelection);
  a.accepted_prs=[overlapPR(479,'file1.txt'),overlapPR(470,'file2.txt')];};
const promptOverlaps=p=>JSON.parse(p.match(/Relevant accepted overlaps from caller preflight: (\[[^\n]*\])\./)[1]);
const tests=[
 async()=>{
   const planned=await run('plan',(_f,a)=>{
     a.graph_admission.push({...clone(a.graph_admission[0]),transition:'plan'});
   });
   assert.equal(planned.result.state,'AWAITING_APPROVAL',
     'plan-transition reports cannot create ambiguous build candidates');
   const built=await run('build',(_f,a)=>{a.plan_record=planned.result;});
   assert.equal(built.result.state,'COMPLETE');
 },
 async()=>{
   const planned=await run('plan',(_f,a)=>{
     a.graph_admission.push({...clone(a.graph_admission[0]),checked_at:'2026-10-04T12:00:00Z'});
   });
   assert.equal(planned.result.state,'AWAITING_APPROVAL');
   const built=await run('build',(_f,a)=>{a.plan_record=planned.result;});
   assert.equal(built.result.state,'COMPLETE',
     'Run B must discard the same invalid reports Run A discarded');
   const nextDay=await run('build',(_f,a)=>{
     a.plan_record=planned.result;a.date='2026-10-06';
     a.graph_publication.checked_at='2026-10-06T12:00:00Z';
     a.graph_admission[0].checked_at='2026-10-06T12:00:00Z';
   });
   assert.equal(nextDay.result.state,'COMPLETE',
     'prior report validity uses Run A date while current validity uses Run B date');
 },

 async()=>{
   for(const stage of ['plan','build']) for(const change of ['missing','blocked','closure','digest','phase']) {
     const r=await run(stage,(_f,a)=>{
       const report=a.graph_admission[0],c=report.candidates[0];
       if(change==='missing') report.candidates.shift();
       if(change==='blocked') c.state='BLOCKED';
       if(change==='closure') c.closure=[];
       if(change==='digest') c.closure_evidence_digest='unknown';
       if(change==='phase') report.transition='plan';
     });
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,stage==='plan'?1:0);
   }
 },
 async()=>{
   const local=a=>{
     const r=a.graph_admission[0],c=r.candidates[0];
     c.mode='LOCAL_RECONCILIATION';r.delta.added_nodes=[{id:c.node_id,issue_ref:c.issue_id}];
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
   };
   for(const stage of ['plan','build']) {
     const r=await run(stage,(_f,a)=>{local(a);a.graph_publication.projects[0].state='UPDATE_REQUIRED';});
     assert.equal(r.result.state,stage==='plan'?'AWAITING_APPROVAL':'COMPLETE');
     assert.ok(r.result.evidence.some(e=>e.includes('LOCAL_RECONCILIATION')));
   }
   const drift=await run('build',(_f,a)=>{local(a);a.graph_admission[0].graph_digest='sha256:'+'f'.repeat(64);});
   assert.equal(drift.result.state,'STOPPED');assert.equal(drift.calls.length,0);
   assert.match(drift.result.stop_reason,/repeat reconciliation/);
   const dep=await run('plan',(_f,a)=>{local(a);a.graph_admission[0].delta.changed_edges=[{}];});
   assert.equal(dep.result.state,'STOPPED');assert.equal(dep.calls.length,1);
 },

 async()=>{
   for(const stage of ['plan','build']) {
     const r=await run(stage,(_f,a)=>{
       a.graph_publication.projects[0].state='UPDATE_REQUIRED';
       a.graph_publication.projects[0].missing_view=['T-474'];
       a.graph_publication.projects[0].missing_manifest=['T-474'];
     });
     assert.equal(r.result.state,stage==='plan'?'AWAITING_APPROVAL':'COMPLETE',
       'an unrelated maintenance addition must not freeze mapped candidates');
   }
 },

 async()=>{
   for(const stage of ['plan','build']) for(const state of ['UNKNOWN']){
     const r=await run(stage,(_f,a)=>{a.graph_publication.projects[0].state=state;});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,stage==='plan'?1:0);
     assert.match(r.result.stop_reason,/graph publication/);
   }
   const absent=await run('plan',(_f,a)=>{delete a.graph_publication;});
   assert.equal(absent.result.state,'STOPPED');assert.equal(absent.calls.length,0);
 },
 async()=>{
   for(const value of ['0','-1','1.5','abc','#900',undefined]){
     const r=await run('plan',(_f,a)=>{a.selection=['any','--parallel','3','--accept-graph-update',...(value===undefined?[]:[value])];});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
     assert.match(r.result.stop_reason,/--accept-graph-update/);
   }
 },
 async()=>{
   const accept=a=>{
     a.graph_publication.projects[0]={...a.graph_publication.projects[0],state:'ACCEPTED_UPDATE',pr_number:900,head_sha:'b'.repeat(40)};
     a.graph_admission[0].graph_sha='b'.repeat(40);
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
     a.accepted_graph_updates=[{number:900,url:'https://example.test/pull/900',state:'OPEN',base:'main',head_sha:'b'.repeat(40),coverage_exit:0,coverage_state:'CURRENT',validation_exit:0,reviewed_head_sha:'b'.repeat(40),review_source:'Reviewer approved at this exact head',project_ids:['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']}];
   };
   const pending=await run('plan',(_f,a)=>{accept(a);});
   assert.equal(pending.result.state,'STOPPED');assert.equal(pending.calls.length,1);
   const flags=['--accept-graph-update','900','--accept-graph-update','900'];
   const plan=await run('plan',(_f,a)=>{accept(a);a.selection.push(...flags);});
   assert.equal(plan.result.state,'AWAITING_APPROVAL');
   const selected=plan.calls.find(c=>c.label==='A1 select');
   assert.deepEqual(JSON.parse(selected.prompt.match(/Run \/next with argument tokens (\[[^\n]*\])/)[1]).slice(-4),flags);
   for(const call of plan.calls.filter(c=>c.label.startsWith('A4')))
     assert.ok(call.prompt.includes('--plan-only --accept-graph-update 900 --accept-graph-update 900'));
   const build=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;});
   assert.equal(build.result.state,'COMPLETE');
   assert.ok(build.calls.filter(c=>c.label.startsWith('B1')).every(c=>c.prompt.includes(JSON.stringify(flags))));
   for(const c of build.calls.filter(c=>c.label.startsWith('B3'))){
     assert.ok(c.prompt.includes('/pr-loop '));
     assert.ok(c.prompt.includes('--max-rounds 3 --accept-graph-update 900 --accept-graph-update 900'));
     assert.ok(c.prompt.includes('Validated graph publication evidence: '));
     assert.ok(c.prompt.includes('b'.repeat(40)));
   }
   assert.ok(plan.result.evidence.some(e=>e.includes('a'.repeat(40))&&e.includes('b'.repeat(40))));
   assert.ok(build.result.evidence.some(e=>e.includes('a'.repeat(40))&&e.includes('b'.repeat(40))));
   const drift=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify({...a.graph_publication,main_sha:'d'.repeat(40)})];});
   assert.equal(drift.result.state,'STOPPED');assert.equal(drift.calls.length,0);
   assert.match(drift.result.stop_reason,/changed since Run A/);
   const movedHead=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;
     a.graph_publication.projects[0].head_sha='c'.repeat(40);a.accepted_graph_updates[0].head_sha='c'.repeat(40);a.accepted_graph_updates[0].reviewed_head_sha='c'.repeat(40);a.graph_admission[0].graph_sha='c'.repeat(40);});
   assert.equal(movedHead.result.state,'STOPPED');assert.equal(movedHead.calls.length,0);
   assert.match(movedHead.result.stop_reason,/changed since Run A/);
   const inherited=await run('build',(_f,a)=>{accept(a);a.selection.push(...flags);});
   assert.equal(inherited.result.state,'STOPPED');assert.equal(inherited.calls.length,0);
   const warning=await run('plan',(_f,a)=>{accept(a);a.selection.push(...flags);
     Object.assign(a.accepted_graph_updates[0],{coverage_exit:1,coverage_state:'UPDATE_REQUIRED'});});
   assert.equal(warning.result.state,'AWAITING_APPROVAL');
   for(const delta of [{state:'CLOSED'},{state:'MERGED'},{base:'other'},{validation_exit:1},{coverage_state:'UNKNOWN'},{review_source:''},{reviewed_head_sha:'c'.repeat(40)},{head_sha:'c'.repeat(40)},{project_ids:['unrelated']}]){
     const r=await run('plan',(_f,a)=>{accept(a);a.selection.push(...flags);Object.assign(a.accepted_graph_updates[0],delta);});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
   }
 },
 async()=>{
   const r=await run('plan',f=>{f.responses['A1 select'].tracks[0].project='Uncovered';});
   assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,1);
   assert.match(r.result.stop_reason,/no unambiguous eligible candidate audit/);
 },
 async()=>{
   for(const stage of ['plan','build']){
     const r=await run(stage,(f,a)=>{
       a.graph_publication={projects:[]};a.graph_admission=[];
       f.responses['A1 select'].tracks.forEach(t=>t.project=null);
       a.plan_record.tracks.forEach(t=>t.project=null);
     });
     assert.equal(r.result.state,stage==='plan'?'AWAITING_APPROVAL':'COMPLETE');
   }
 },
 async()=>{
   const r=await run('plan',(_f,a)=>{a.graph_publication.projects.push({
     project_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',project_name:'Blocked',view_path:'docs/blocked.md',state:'UPDATE_REQUIRED'});});
   assert.equal(r.result.state,'AWAITING_APPROVAL');
   assert.ok(r.calls[0].prompt.includes('Project coverage warnings'));
   assert.ok(r.calls[0].prompt.includes('Blocked'));
   const selected=await run('plan',(f,a)=>{a.graph_publication.projects.push({
     project_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',project_name:'Blocked',view_path:'docs/blocked.md',state:'UNKNOWN'});
     f.responses['A1 select'].tracks[0].project='Blocked';});
   assert.equal(selected.result.state,'STOPPED');assert.equal(selected.calls.length,1);
   for(const stage of ['plan','build']) {
     const independent=await run(stage,(_f,a)=>{a.graph_admission.push({state:'UNKNOWN',error:'unrelated missing scope evidence'});});
     assert.equal(independent.result.state,stage==='plan'?'AWAITING_APPROVAL':'COMPLETE');
   }
   const build=await run('build',(_f,a)=>{a.graph_publication.projects.push({
     project_id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',project_name:'Blocked',view_path:'docs/blocked.md',state:'UPDATE_REQUIRED'});});
   assert.equal(build.result.state,'COMPLETE');
 },
 async()=>{
   for(const checked_at of ['2020-01-01TZ','2026-10-04T12:00:00Z','2026-10-06T12:00:00Z','2026-02-30T12:00:00Z']){
     const r=await run('plan',(_f,a)=>{a.graph_publication.checked_at=checked_at;});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
     assert.match(r.result.stop_reason,/fresh main/);
   }
   const r=await run('plan');
   assert.ok(r.calls.filter(c=>/^A[134]/.test(c.label)).every(c=>c.prompt.includes('a'.repeat(40))&&c.prompt.includes('Require live main SHA')));
   assert.ok(r.result.evidence.some(e=>e.startsWith('Graph publication evidence: ')));
 },
 async()=>{const r=await run('plan',f=>{f.responses['A1 select'].tracks=[];});assert.equal(r.result.state,'EMPTY');assert.equal(r.calls.length,1);},
 async()=>{const r=await run('plan');assert.equal(r.result.plans.length,3);assert.equal(r.result.state,'AWAITING_APPROVAL');assert.ok(!r.calls.some(c=>c.label.startsWith('A3')));},
 async()=>{const r=await run('plan',f=>{f.responses['A2 shared-literal scan'].literals=f.literals;});const end=r.events.indexOf('end A3 contract');assert.ok(end>=0);for(const t of fixture.tracks) assert.ok(r.events.indexOf('start A4 plan '+t.issue_id)>end);},
 async()=>{const r=await run('plan',(f,a)=>{f.responses['A2 shared-literal scan'].literals=f.literals;a.wave.contract_dir=null;});assert.equal(r.result.state,'STOPPED');assert.match(r.result.stop_reason,/wave.contract_dir/);assert.equal(r.calls.length,2);},
 async()=>{const r=await run('build',(_f,a)=>{a.approve=['T-2'];});assert.deepEqual(r.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),['B1 build T-2']);assert.equal(r.result.tracks[0].state,'NOT_APPROVED');
 const invalid=await run('build',(_f,a)=>{a.approve=['unknown'];});assert.equal(invalid.result.state,'STOPPED');assert.equal(invalid.calls.length,0);assert.ok(invalid.result.evidence.length);
 },
 async()=>{const r=await run('build',stopped);assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'));assert.equal(r.result.tracks[0].state,'STOPPED');assert.equal(r.calls.filter(c=>c.label.startsWith('B3')).length,2);
 const dropped=await run('build',f=>{f.responses['B1 build T-1']=null;});assert.equal(dropped.result.tracks[0].state,'STOPPED');assert.ok(dropped.logs.some(l=>l.includes('dropped')));
 const badGate=await run('build',f=>{f.responses['B1 build T-1'].gates.test.exit=1;});assert.equal(badGate.result.tracks[0].state,'STOPPED');
 },
 async()=>{const r=await run('build',(f,a)=>{a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;f.responses['B2 seam check']={exit:1,table:seamTable(f).map(r=>r.branch==='codex/t-2'&&r.file==='file2.txt'?{...r,state:'MISMATCH',evidence:'absent'}:r),open_questions:[]};});assert.ok(!r.calls.some(c=>c.label==='B3 review T-2'));assert.equal(r.result.tracks[1].state,'SEAM_MISMATCH');for(const t of fixture.tracks)assert.ok(r.events.indexOf('start B2 seam check')>r.events.indexOf('end B1 build '+t.issue_id));assert.equal(r.result.seam_check.table[0].literal,'AGREED');assert.ok(r.result.seam_check.table.some(row=>row.file==='file2.txt'&&row.state==='MISMATCH'));assert.equal(r.calls.filter(c=>c.label.startsWith('B3')).length,2);
   const absent=await run('build',(f,a)=>{a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;f.responses['B2 seam check']=null;});assert.ok(!absent.calls.some(c=>c.label.startsWith('B3')));
   const incomplete=await run('build',(f,a)=>{a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;});assert.ok(!incomplete.calls.some(c=>c.label.startsWith('B3')));
   seamIntegration();
 },
 async()=>{const r=await run('build',f=>{f.responses['B3 review T-1'].verdict='ROUNDS_EXHAUSTED';f.responses['B3 review T-1'].rounds=3;});assert.equal(r.result.tracks[0].state,'ROUNDS_EXHAUSTED');assert.equal(r.calls.filter(c=>c.label==='B3 review T-1').length,1);},
 async()=>{const forbidden=/gh\s+pr\s+merge|--merge/;assert.ok(!forbidden.test(script));for(const stage of ['plan','build']){const r=await run(stage,(f,a)=>{if(stage==='plan')f.responses['A2 shared-literal scan'].literals=f.literals;else {a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;f.responses['B2 seam check'].table=seamTable(f);}});for(const c of r.calls)assert.ok(!forbidden.test(c.prompt),c.label);}},
 async()=>{const doc=readFileSync(join(dir,'../references/records.md'),'utf8');const canonical=JSON.parse(doc.match(/```json\n([\s\S]*?)\n```/)[1]);assert.deepEqual(schemas,canonical);for(const name of ['TRACK','SHARED_LITERAL','PLAN','TRACK_RESULT','REVIEW_RESULT','WAVE_REPORT'])assert.ok(schemas[name]);},
 async()=>{const r=await run('build');assert.equal(r.maxReview,1);for(let i=1;i<3;i++)assert.ok(r.events.indexOf('end B3 review T-'+i)<r.events.indexOf('start B3 review T-'+(i+1)));},
 async()=>{const r=await run('plan',f=>{f.responses['A1 select'].tracks=[];f.responses['A1 select'].sequenced=['T-1 PLAN_ONLY: build waits for contract merge (source: fixture)'];});assert.equal(r.result.state,'EMPTY');assert.equal(r.result.plans.length,0);assert.equal(r.result.build_command,null);assert.equal(r.calls.length,1);assert.match(r.calls[0].prompt,/PLAN_ONLY candidates must go in sequenced/);assert.match(r.result.sequenced[0],/build waits for contract merge/);},
 async()=>{
   const risk='PR #479 — Accepted PR 479 — @maintainer: file1.txt; Pending overlap; rebase onto default branch after merge.';
   const r=await run('plan',(f,a)=>{overlapArgs(f,a);f.responses['A4 plan T-1'].risks=[risk];});
   const a1=r.calls.find(c=>c.label==='A1 select');
   const tokens=JSON.parse(a1.prompt.match(/Run \/next with argument tokens (\[[^\n]*\]) in parallel mode\./)[1]);
   assert.deepEqual(tokens,overlapSelection);
   assert.match(a1.prompt,/Pass every token unchanged, including repeated --accept-overlap flags and values/);
   const plans=r.calls.filter(c=>c.label.startsWith('A4 plan '));
   assert.equal(plans.length,fixture.tracks.length);
   assert.deepEqual(promptOverlaps(plans[0].prompt),[{number:479,title:'Accepted PR 479',author:'maintainer',head_sha:'head-479',files:['file1.txt']}]);
   assert.deepEqual(promptOverlaps(plans[1].prompt).map(p=>p.number),[470]);
   assert.deepEqual(promptOverlaps(plans[2].prompt),[]);
   for(const p of plans){
     assert.match(p.prompt,/Under risks, list every accepted overlap\s+that touches this plan's files/);
     assert.match(p.prompt,/PR number, title, author and exact overlapping files/);
     assert.match(p.prompt,/Re-fetch only relevant PRs'/);
     assert.match(p.prompt,/never use a stale snapshot/);
     assert.ok(p.prompt.indexOf('Before dispatch §1')<p.prompt.indexOf('Read /stack/dispatch'));
     assert.match(p.prompt,/return STOPPED before any dispatch write/);
     assert.match(p.prompt,/For MERGED, record the\s+merge commit and continue/);
     assert.match(p.prompt,/For CLOSED unmerged, record that the active overlap is gone\s+and continue/);
     assert.match(p.prompt,/never base on an accepted PR's branch or rebase onto\s+its head/);
     assert.match(p.prompt,/Before land Step 7, fetch/);
     assert.match(p.prompt,/Pending overlap/);
   }
   assert.deepEqual(r.result.plans[0].risks,[risk]);
   const build=await run('build',(_f,a)=>{a.plan_record=r.result;});
   const b1=build.calls.find(c=>c.label==='B1 build T-1');
   const approvedPlan=JSON.parse(b1.prompt.match(/Approved plan: (\{[^\n]*\})\./)[1]);
   assert.deepEqual(approvedPlan.risks,[risk]);
 },
 async()=>{const r=await run('plan');for(const p of r.calls.filter(c=>c.label.startsWith('A4 plan '))){assert.ok(!p.prompt.includes('Relevant accepted overlaps from caller preflight:'));assert.ok(!p.prompt.includes('accepted overlap'));assert.ok(!p.prompt.includes('Pending overlap'));assert.ok(!p.prompt.includes('Before dispatch §1'));}},
 async()=>{
   for(const value of ['0','-1','1.5','abc','#479','0479',undefined]){
     const r=await run('plan',(_f,a)=>{a.selection=['any','--parallel','3','--accept-overlap',...(value===undefined?[]:[value])];});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
     assert.ok(r.result.stop_reason.includes(JSON.stringify(value===undefined?'<missing>':value)));
   }
   for(const state of ['MERGED','CLOSED',null]){
     const r=await run('plan',(_f,a)=>{a.selection=['any','--parallel','3','--accept-overlap','479'];a.accepted_prs=state?[{...overlapPR(479,'file1.txt'),state}]:[];});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);assert.match(r.result.stop_reason,/"479"/);
   }
 },
 async()=>{
   const partial=await run('plan',(f,a)=>{overlapArgs(f,a);a.accepted_prs[0].changed_files=2;});
   assert.equal(partial.result.state,'STOPPED');assert.equal(partial.calls.length,0);assert.match(partial.result.stop_reason,/"479".*incomplete/);
   const renamed=await run('plan',(f,a)=>{overlapArgs(f,a);a.accepted_prs[0].files=[{filename:'renamed.txt',previous_filename:'file1.txt'}];});
   const plan=renamed.calls.find(c=>c.label==='A4 plan T-1');
   assert.deepEqual(promptOverlaps(plan.prompt)[0].files,['file1.txt']);
 },
 async()=>{
   const stopPlan=(f,id)=>Object.assign(f.responses['A4 plan '+id],{state:'STOPPED',stop_reason:'dispatch §1: '+id+' in Backlog',evidence:['status read-back']});
   const all=await run('plan',f=>{for(const t of fixture.tracks)stopPlan(f,t.issue_id);});
   assert.equal(all.result.state,'STOPPED');assert.equal(all.result.build_command,null);
   assert.equal(all.result.stop_reason,'no PLANNED track; every A4 plan stopped');
   assert.ok(all.result.evidence[0].startsWith('Graph publication evidence: '));
   assert.deepEqual(all.result.evidence.slice(2),fixture.tracks.map(t=>t.issue_id+': dispatch §1: '+t.issue_id+' in Backlog'));
   assert.equal(all.result.plans.length,fixture.tracks.length);
   const mixed=await run('plan',f=>stopPlan(f,'T-1'));
   assert.equal(mixed.result.state,'AWAITING_APPROVAL');assert.equal(mixed.result.build_command,'/wave build --approve all');
   const build=await run('build',(_f,a)=>{a.plan_record=mixed.result;});
   assert.deepEqual(build.result.approved,['T-2','T-3']);assert.ok(!build.calls.some(c=>c.label==='B1 build T-1'));
 }
];
function seamIntegration(){
 const temp=mkdtempSync(join(tmpdir(),'wave-seam-'));
 try{
  const git=(...args)=>{const r=spawnSync('git',['-C',temp,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git('init','-b','main');git('config','user.email','fixture@example.test');git('config','user.name','Fixture');
  writeFileSync(join(temp,'marker.txt'),'baseline\n');git('add','marker.txt');git('commit','-m','base');
  git('checkout','-b','good');writeFileSync(join(temp,'marker.txt'),'AGREED\n');git('add','marker.txt');git('commit','-m','good');
  git('checkout','-b','bad','main');writeFileSync(join(temp,'marker.txt'),'OTHER\n');git('add','marker.txt');git('commit','-m','bad');
  const contract=join(temp,'contract.json');writeFileSync(contract,JSON.stringify([{literal:'AGREED',files:['marker.txt']}]));
  const check=(...branches)=>spawnSync('python3',[resolve(dir,'../bin/seam-check'),'--repo',temp,'--base','main','--contract',contract,'--branches',...branches],{encoding:'utf8'});
  assert.equal(check('good').status,0);const bad=check('good','bad');assert.equal(bad.status,1);assert.ok(JSON.parse(bad.stdout).some(r=>r.state==='MISMATCH'&&r.branch==='bad'));
  git('checkout','-b','renamed','main');git('mv','marker.txt','renamed.txt');git('commit','-m','rename');const rename=check('renamed');assert.equal(rename.status,1);assert.ok(JSON.parse(rename.stdout).some(r=>r.file==='marker.txt'&&r.state==='MISMATCH'));
  assert.equal(check('missing').status,1);assert.equal(check().status,1);assert.ok(JSON.parse(check().stdout).some(r=>r.state==='ERROR'));
  writeFileSync(contract,'invalid');assert.equal(check('good').status,1);
 }finally{rmSync(temp,{recursive:true,force:true});}
}
let failed=0;
for(let i=0;i<tests.length;i++)try{await tests[i]();console.log(`PASS ${cases[i].number} ${cases[i].name}`);}catch(e){failed++;console.error(`FAIL ${cases[i].number} ${cases[i].name}: ${e.stack}`);}
console.log(`${tests.length-failed}/${tests.length} wave cases passed`);
if(process.argv.includes('--mutation-check') && !failed){
 // Remove the stopped filter before review eligibility. Case 6 must detect it.
 const mutated=executable.replace("results[i].state==='PR_OPEN'",'true');
 assert.notEqual(mutated,executable,'mutation target must exist');
 let detected=false;
 try {const r=await run('build',stopped,mutated);assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'));}catch{detected=true;}
 assert.ok(detected,'case 6 must fail when STOPPED guard is removed');
 console.log('PASS mutation: removing STOPPED guard makes case 6 fail; original source untouched');
}
process.exitCode=failed?1:0;
