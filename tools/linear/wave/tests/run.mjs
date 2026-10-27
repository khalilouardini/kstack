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
  const args={selection_version:1,stage,repo_root:'/tmp/repo',default_branch:'origin/main',gates:{lint:'lint',test:'test'},identities:{maintainer:'human',reviewer:'review',implementer:'impl'},stack_config:{},date:'2026-10-05',run_id:stage+'-run',wave_id:'wave-1',wave:{max_review_rounds:3,review_concurrency:1,contract_dir:'contracts'},selection:['any','--parallel','3'],paths:Object.fromEntries(['wave','next','dispatch','land','pr_loop','records','seam_check'].map(n=>[n,'/stack/'+n])),plan_record:f.plan_record,approve:'all'};
  args.graph_publication={main_sha:'a'.repeat(40),checked_at:'2026-10-05T12:00:00Z',projects:[{project_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',project_name:'Project',view_path:'docs/project.md',state:'CURRENT'}]};
  args.graph_admission=[{schema_version:1,main_sha:'a'.repeat(40),graph_sha:'a'.repeat(40),checked_at:'2026-10-05T12:00:00Z',
    transition:'build',base_digest:'sha256:'+'c'.repeat(64),graph_digest:'sha256:'+'c'.repeat(64),issue_evidence_digest:'sha256:'+'d'.repeat(64),
    evidence:{issues:{complete:true},request:{selected:['T-1','T-2','T-3']}},delta:{added_nodes:[],changed_edges:[]},
    candidates:fixture.tracks.map(t=>({issue_id:t.issue_id,identifier:t.issue_id,project_id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      state:'ELIGIBLE',mode:'PUBLISHED',node_id:t.issue_id,closure:[t.issue_id],closure_graph_digest:'sha256:'+'f'.repeat(64),closure_evidence_digest:'sha256:'+'e'.repeat(64),unmet:[]}))}];
  const pinEvidence=()=>['Graph publication evidence: '+JSON.stringify(args.graph_publication),'Graph admission evidence: '+JSON.stringify(args.graph_admission)];
  args.plan_record.evidence=pinEvidence();
  args.recovery=null;
  mutate(f,args);
  if(args.recovery===null) args.recovery=args.plan_record.tracks.map(t=>({issue_id:t.issue_id,
    branch:t.branch,worktree:t.worktree,state:'ABSENT',checked_at:args.graph_publication?.checked_at || args.date+'T12:00:00Z',
    result:null,evidence:['Verified no open PR on this branch']}));
  const calls=[],events=[],logs=[];let runningReview=0,maxReview=0;
  const agent=async (prompt,opts)=>{
    calls.push({prompt,...opts});events.push('start '+opts.label);
    assert.ok(opts.schema);assert.ok(prompt.includes('D4 node rule:'));
    const isReview=opts.label.startsWith('B3');
    if (isReview) {runningReview++;maxReview=Math.max(maxReview,runningReview);}
    await new Promise(r=>setTimeout(r,f.delays?.[opts.label] ?? 2));
    assert.ok(Object.hasOwn(f.responses,opts.label),'unexpected call '+opts.label);
    const value=clone(f.responses[opts.label]);
    if(opts.label.startsWith('B3 admission') && value?.state==='OBSERVED' &&
       value.checked_at==='2026-10-05T12:30:00Z' &&
       value.ancestor_exit===null && value.merge_tree_exit===null && value.admission_report===null) {
      value.main_sha=args.graph_publication.main_sha;
      value.checked_at=new Date(Date.parse(args.graph_publication.checked_at)+1800000).toISOString();
      value.ancestor_exit=0;value.merge_tree_exit=0;
      value.head_sha=f.responses['B1 build '+value.issue_id]?.head_sha || '1'.repeat(40);
      const report=args.graph_admission.find(r=>r.candidates?.some(c=>c.identifier===value.issue_id));
      value.admission_report=JSON.stringify({...clone(report),checked_at:value.checked_at});
    }

    if(opts.label==='B4 final verification' && value && value.heads.length===0) {
      const tracks=JSON.parse(prompt.match(/Final tracks: (\[[^\n]*\])\./)[1]);
      value.heads=tracks.map(t=>({issue_id:t.issue_id,pr:t.pr,branch:t.branch,
        head_sha:(args.wave.execution_mode==='streaming' ? f.responses['B3 review '+t.issue_id]?.reviewed_head : null) || f.responses['B1 build '+t.issue_id]?.head_sha || '1'.repeat(40),
        reviewed_head_sha:(args.wave.execution_mode==='streaming' ? f.responses['B3 review '+t.issue_id]?.reviewed_head : null) || f.responses['B1 build '+t.issue_id]?.head_sha || '1'.repeat(40)}));
      if(args.plan_record.contract || ((args.graph_update_flags || []).includes('--local-graph') && args.plan_record.literals.length))value.seam={exit:0,table:tracks.flatMap(t=>args.plan_record.literals.flatMap(e=>e.files.map(file=>({literal:e.literal,branch:value.heads.find(h=>h.issue_id===t.issue_id).head_sha,file,state:'UNCHANGED',evidence:'Final head checked'})))),open_questions:[]};
    }
    if(value!==null) validate(value,opts.schema,opts.label);
    if(isReview) runningReview--;events.push('end '+opts.label);return value;
  };
  const pipeline=async (items,...stages)=>Promise.all(items.map(async (item,index)=>{
    let prev=item;try {for(const stage of stages) prev=await stage(prev,item,index);return prev;}catch(e){logs.push('pipeline drop '+e);return null;}
  }));
  const parallel=async thunks=>Promise.all(thunks.map(async fn=>{try{return await fn();}catch{return null;}}));
  const phase=t=>{assert.ok(['Select','Plan','Build','Seams','Review'].includes(t));events.push('phase '+t);};
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
const advanceMain=a=>{
  const old=a.graph_publication.main_sha;
  a.graph_publication.main_sha='7'.repeat(40);
  for(const r of a.graph_admission) {
    r.main_sha=a.graph_publication.main_sha;
    if(r.graph_sha===old) r.graph_sha=a.graph_publication.main_sha;
  }
};
const changeStored=(a,kind,change)=>{
  const prefix=`Graph ${kind} evidence: `;
  const i=a.plan_record.evidence.findIndex(e=>e.startsWith(prefix));
  const value=JSON.parse(a.plan_record.evidence[i].slice(prefix.length));
  change(value);a.plan_record.evidence[i]=prefix+JSON.stringify(value);
};
const localFlags=['--local-graph'];
const localArgs=(f,a)=>{
  if(a.stage==='plan') a.selection.push(...localFlags);
  else a.graph_update_flags=clone(localFlags);
  a.approved_local_graph={index_path:'/tmp/repo/orchestration/index.json',
    manifest_path:'orchestration/project.json',index_digest:'sha256:'+'b'.repeat(64),
    manifest_digest:'sha256:'+'c'.repeat(64),source_revision:'d'.repeat(40),
    checked_at:a.graph_publication.checked_at,validation_exit:0,coverage_exit:0,coverage_state:'CURRENT',
    project_ids:[a.graph_publication.projects[0].project_id]};
  a.graph_publication.projects[0].state='APPROVED_LOCAL';
  const pins=Object.fromEntries(['index_path','manifest_path','index_digest','manifest_digest','source_revision']
    .map(k=>[k,a.approved_local_graph[k]]));
  for(const report of a.graph_admission){
    report.graph_sha=null;report.local_graph=clone(pins);
    report.evidence.local_scope_sources={'docs/scope.md':{text:'Approved scope',digest:'sha256:'+'a'.repeat(64)}};
    report.candidates.forEach(c=>c.mode='APPROVED_LOCAL');
  }
  for(const t of f.tracks){
    const response=f.responses['B3 admission '+t.issue_id];
    response.ancestor_exit=0;response.merge_tree_exit=0;
    response.head_sha=f.responses['B1 build '+t.issue_id].head_sha;
    response.admission_report=JSON.stringify(a.graph_admission[0]);
  }
};
const tests=[
 async()=>{
   const planned=await run('plan');
   const built=await run('build',(_f,a)=>{
     a.plan_record=planned.result;
     a.graph_publication.main_sha='b'.repeat(40);
     a.graph_publication.projects[0].state='UPDATE_REQUIRED';
     a.graph_publication.projects[0].missing_manifest=['T-474'];
     Object.assign(a.graph_admission[0],{main_sha:'b'.repeat(40),graph_sha:'b'.repeat(40),
       base_digest:'sha256:'+'1'.repeat(64),graph_digest:'sha256:'+'1'.repeat(64)});
   });
   assert.equal(built.result.state,'COMPLETE');
   assert.deepEqual(built.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),
     ['B1 build T-1','B1 build T-2','B1 build T-3']);
   assert.ok(built.result.evidence.some(e=>e.includes('b'.repeat(40))));
   for(const call of built.calls.filter(c=>/^B[13]/.test(c.label))) {
     assert.ok(call.prompt.includes('Run A approved observations for '));
     assert.ok(call.prompt.includes('closure_graph_digest') && call.prompt.includes('closure_evidence_digest'));
     assert.match(call.prompt,/return(?:s)? STOPPED[^\n]*before any write/);
     assert.match(call.prompt,/missing fresh evidence returns STOPPED for this track before any write/);
   }
   assert.ok(planned.calls.every(c=>!c.prompt.includes('Run A approved observations')));
   const renamed=await run('build',(_f,a)=>{
     a.plan_record=planned.result;a.graph_publication.projects[0].project_name='Renamed project';
   });
   assert.equal(renamed.result.state,'COMPLETE','project display rename retains canonical project identity');
   for(const change of ['legacy','main_pin','issue_type','node_type']) {
     const r=await run('build',(_f,a)=>{
       const prefix='Graph admission evidence: ',i=a.plan_record.evidence.findIndex(e=>e.startsWith(prefix));
       const reports=JSON.parse(a.plan_record.evidence[i].slice(prefix.length));
       for(const report of reports) {
         if(change==='main_pin') report.main_sha='9'.repeat(40);
         for(const c of report.candidates) {
           if(change==='legacy') delete c.closure_graph_digest;
           if(change==='issue_type') c.issue_id=null;
           if(change==='node_type') c.node_id=null;
         }
       }
       a.plan_record.evidence[i]=prefix+JSON.stringify(reports);
     });
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
     assert.ok(r.result.evidence.some(e=>e.startsWith('Run A graph admission evidence: ')));
   }

 },
 async()=>{
   for (const change of ['constraints','evidence','blocked','missing','unmapped','mode','issue_id','node_id']) {
     const r=await run('build',(_f,a)=>{
       const report=a.graph_admission[0],c=report.candidates[0];
       if(change==='constraints') c.closure_graph_digest='sha256:'+'1'.repeat(64);
       if(change==='evidence') c.closure_evidence_digest='sha256:'+'1'.repeat(64);
       if(change==='blocked') {c.state='BLOCKED';c.unmet=[{node_id:'new-blocker',event:'merge',state:'UNKNOWN'}];}
       if(change==='missing') delete c.closure_graph_digest;
       if(change==='unmapped') report.candidates.shift();
       if(change==='mode') {c.mode='LOCAL_RECONCILIATION';report.delta.added_nodes=[{id:c.node_id,issue_ref:c.issue_id}];}
       if(change==='issue_id') c.issue_id='different';
       if(change==='node_id') {c.node_id='different';c.closure.push('different');}
     });
     assert.equal(r.result.state,'COMPLETE');
     assert.equal(r.result.tracks[0].state,'STOPPED');
     assert.deepEqual(r.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),['B1 build T-2','B1 build T-3']);
     assert.ok(r.result.tracks[0].evidence.length);
     assert.equal(r.result.tracks[1].state,'CLEAN');
   }
 },
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
     if(stage==='plan' || change==='phase') {
       assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,stage==='plan'?1:0);
     } else {
       assert.equal(r.result.state,'COMPLETE');assert.equal(r.result.tracks[0].state,'STOPPED');
       assert.ok(!r.calls.some(c=>c.label.endsWith('T-1')));
     }
   }
 },
 async()=>{
   const local=a=>{
     const r=a.graph_admission[0],c=r.candidates[0];
     c.mode='LOCAL_RECONCILIATION';r.delta.added_nodes=[{id:c.node_id,issue_ref:c.issue_id}];
     c.published_closure_graph_digest='sha256:'+'b'.repeat(64);
     c.published_closure_evidence_digest='sha256:'+'b'.repeat(64);
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
   };
   for(const stage of ['plan','build']) {
     const r=await run(stage,(_f,a)=>{local(a);a.graph_publication.projects[0].state='UPDATE_REQUIRED';});
     assert.equal(r.result.state,stage==='plan'?'AWAITING_APPROVAL':'COMPLETE');
     assert.ok(r.result.evidence.some(e=>e.includes('LOCAL_RECONCILIATION')));
   }
   const drift=await run('build',(_f,a)=>{local(a);a.graph_admission[0].candidates[0].closure_graph_digest='sha256:'+'1'.repeat(64);});
   assert.equal(drift.result.state,'COMPLETE');assert.equal(drift.result.tracks[0].state,'STOPPED');
   assert.ok(!drift.calls.some(c=>c.label.endsWith('T-1')));
   assert.match(drift.result.tracks[0].result.stop_reason,/repeat reconciliation/);
   const dep=await run('plan',(_f,a)=>{local(a);a.graph_admission[0].delta.changed_edges=[{}];});
   assert.equal(dep.result.state,'STOPPED');assert.equal(dep.calls.length,1);
   const published=await run('build',(_f,a)=>{
     local(a);advanceMain(a);
     Object.assign(a.graph_admission[0].candidates[0],{mode:'PUBLISHED',
       closure_graph_digest:'sha256:'+'b'.repeat(64),closure_evidence_digest:'sha256:'+'b'.repeat(64)});
     a.graph_admission[0].delta.added_nodes=[];
     a.graph_admission[0].graph_digest='sha256:'+'9'.repeat(64);
   });
   assert.equal(published.result.state,'COMPLETE','publication compares the own closure, not the old origin or whole manifest');
   for(const field of ['published_closure_graph_digest','published_closure_evidence_digest']) {
     const missing=await run('build',(_f,a)=>{
       local(a);changeStored(a,'admission',reports=>{delete reports[0].candidates[0][field];});
       Object.assign(a.graph_admission[0].candidates[0],{mode:'PUBLISHED',
         closure_graph_digest:'sha256:'+'b'.repeat(64),closure_evidence_digest:'sha256:'+'b'.repeat(64)});
       a.graph_admission[0].delta.added_nodes=[];
     });
     assert.equal(missing.result.tracks[0].state,'STOPPED');
     assert.deepEqual(missing.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),['B1 build T-2','B1 build T-3']);
   }
   const generated=spawnSync('python3',[join(dir,'fixtures/repair-publication.py')],{encoding:'utf8'});
   assert.equal(generated.status,0,generated.stderr);
   const reports=JSON.parse(generated.stdout);
   assert.notEqual(reports.local.graph_digest,reports.unrelated.graph_digest);
   for(const report of Object.values(reports))
     assert.equal(report.evidence.issues.main_sha,report.main_sha,'retain each real observation at its own pin');
   assert.ok(reports.local.evidence.request.repairs.length);
   assert.ok(!reports.published.evidence.request.repairs);
   for(const change of ['published','unrelated','graph','evidence','origin','reverse','b3_published','b3_unrelated','b3_evidence']) {
     const priorReport=clone(change==='reverse'?reports.published:reports.local);
     const currentReport=clone(change.startsWith('b3_')?reports.local:
       change==='origin'||change==='reverse'?reports[change==='origin'?'blocked':'local']:
       reports[change==='unrelated'?'unrelated':'published']);
     if(change==='graph') Object.assign(currentReport.candidates[0],{closure_graph_digest:'sha256:'+'0'.repeat(64),semantic_closure_graph_digest:'sha256:'+'0'.repeat(64)});
     if(change==='evidence') Object.assign(currentReport.candidates[0],{closure_evidence_digest:'sha256:'+'0'.repeat(64),semantic_closure_evidence_digest:'sha256:'+'0'.repeat(64)});
     const result=await run('build',(f,a)=>{
       const id=priorReport.candidates[0].identifier;
       Object.assign(f,JSON.parse(JSON.stringify(f).replaceAll('T-1',id)));
       a.plan_record=f.plan_record;a.plan_record.tracks[0].project=priorReport.candidates[0].project_id;
       a.date=currentReport.checked_at.slice(0,10);
       const originalProject=a.graph_publication.projects[0];
       const pins=report=>({main_sha:report.main_sha,checked_at:report.checked_at,
         projects:[originalProject,...report.evidence.issues.projects.map(p=>({project_id:p.project_id,
           project_name:p.project_name,view_path:p.view_path,state:'UPDATE_REQUIRED'}))]});
       const siblings=report=>({...clone(a.graph_admission[0]),main_sha:report.main_sha,
         graph_sha:report.graph_sha,checked_at:report.checked_at,candidates:clone(a.graph_admission[0].candidates.slice(1))});
       a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(pins(priorReport)),
         'Graph admission evidence: '+JSON.stringify([priorReport,siblings(priorReport)])];
       const currentSiblings=siblings(currentReport);
       a.graph_publication=pins(currentReport);a.graph_admission=[currentReport,currentSiblings];
       if(change.startsWith('b3_')) {
         const fresh=clone(change==='b3_unrelated'?reports.unrelated:reports.published);
         if(change==='b3_evidence') Object.assign(fresh.candidates[0],{closure_evidence_digest:'sha256:'+'0'.repeat(64),semantic_closure_evidence_digest:'sha256:'+'0'.repeat(64)});
         f.responses['B3 admission '+id]={issue_id:id,pr:f.responses['B1 build '+id].pr,state:'OBSERVED',
           main_sha:fresh.main_sha,checked_at:fresh.checked_at,ancestor_exit:0,merge_tree_exit:0,
           head_sha:'9'.repeat(40),admission_report:JSON.stringify(fresh),stop_reason:null,evidence:['Pinned fixture admission']};
       }
     });
     assert.equal(result.result.state,'COMPLETE');
     assert.deepEqual(result.result.tracks.map(t=>t.state),
       [change==='b3_evidence'?'BLOCKED':
        ['published','unrelated','b3_published','b3_unrelated'].includes(change)?'CLEAN':'STOPPED','CLEAN','CLEAN'],change);
   }

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
   for(const c of build.calls.filter(c=>c.label.startsWith('B3 review'))){
     assert.ok(c.prompt.includes('/pr-loop '));
     assert.ok(c.prompt.includes('--max-rounds 3 --accept-graph-update 900 --accept-graph-update 900'));
     assert.ok(c.prompt.includes('Validated graph publication evidence: '));
     assert.ok(c.prompt.includes('b'.repeat(40)));
   }
   assert.ok(plan.result.evidence.some(e=>e.includes('a'.repeat(40))&&e.includes('b'.repeat(40))));
   assert.ok(build.result.evidence.some(e=>e.includes('a'.repeat(40))&&e.includes('b'.repeat(40))));
   // A moved main alone does not invalidate the accepted head; a changed graph digest does.
   const priorAt=(a,graph_digest)=>{const main_sha='d'.repeat(40);
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify({...a.graph_publication,main_sha}),
       'Graph admission evidence: '+JSON.stringify(a.graph_admission.map(r=>({...r,main_sha,candidates:r.candidates.map(c=>({...c,closure_graph_digest:graph_digest || c.closure_graph_digest}))})))];};
   const moved=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;priorAt(a);});
   assert.equal(moved.result.state,'COMPLETE');
   assert.ok(moved.calls.filter(c=>c.label.startsWith('B1')).every(c=>c.prompt.includes('Run A pinned main '+'d'.repeat(40))));
   const drift=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;priorAt(a,'sha256:'+'1'.repeat(64));});
   assert.equal(drift.result.state,'STOPPED');assert.equal(drift.calls.length,0);
   assert.match(drift.result.stop_reason,/changed since Run A/);
   const movedHead=await run('build',(_f,a)=>{accept(a);a.graph_update_flags=flags;
     a.graph_publication.projects[0].head_sha='c'.repeat(40);a.accepted_graph_updates[0].head_sha='c'.repeat(40);a.accepted_graph_updates[0].reviewed_head_sha='c'.repeat(40);a.graph_admission[0].graph_sha='c'.repeat(40);});
   assert.equal(movedHead.result.state,'COMPLETE',
     'a freshly reviewed accepted head with unchanged selected conditions preserves approval');
   const merged=await run('build',(_f,a)=>{a.plan_record=plan.result;advanceMain(a);});
   assert.equal(merged.result.state,'COMPLETE','accepted graph publication retains approval with fresh exact pins');
   for(const change of ['main_pin','graph_pin','missing_pr','pr_head']) {
     const invalid=await run('build',(_f,a)=>{
       a.plan_record=clone(plan.result);advanceMain(a);
       changeStored(a,change==='missing_pr'||change==='pr_head'?'publication':'admission',value=>{
         if(change==='missing_pr') delete value.projects[0].pr_number;
         if(change==='pr_head') value.projects[0].head_sha='9'.repeat(40);
         if(change==='main_pin') value[0].main_sha='9'.repeat(40);
         if(change==='graph_pin') value[0].graph_sha='9'.repeat(40);
       });
     });
     assert.equal(invalid.result.state,'STOPPED');assert.equal(invalid.calls.length,0);
   }

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
   // Wave r3: A1 returned "MVP 2.1 (<uuid>)" where the script matches project_id exactly.
   const uuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',decorated='Project ('+uuid+')';
   const r=await run('plan',f=>{f.responses['A1 select'].tracks[0].project=decorated;});
   const a1=r.calls.find(c=>c.label==='A1 select');
   assert.ok(a1.prompt.includes('Set each TRACK.project to the issue\'s Linear project_id copied verbatim from\n'+JSON.stringify([uuid])),
     'A1 prompt must name the publication project_id values TRACK.project takes');
   assert.match(a1.prompt,/Never a project name, never a name with the UUID appended/);
   assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,1);
   assert.match(r.result.stop_reason,/no unambiguous eligible candidate audit/);
   assert.deepEqual(r.result.evidence.slice(3),['T-1: TRACK.project '+JSON.stringify(decorated)+' matches 0 of 1 graph publication projects']);
   const planned=await run('plan',f=>{f.responses['A1 select'].tracks.forEach(t=>t.project=uuid);});
   assert.equal(planned.result.state,'AWAITING_APPROVAL');
   assert.ok(planned.result.tracks.every(t=>t.project===uuid));
   const built=await run('build',(_f,a)=>{a.plan_record=planned.result;});
   assert.equal(built.result.state,'COMPLETE');
   const edited=await run('build',(_f,a)=>{a.plan_record=clone(planned.result);a.plan_record.tracks[0].project=decorated;});
   assert.equal(edited.result.tracks[0].state,'STOPPED');assert.ok(!edited.calls.some(c=>c.label==='B1 build T-1'));
   assert.match(edited.result.tracks[0].result.stop_reason,/T-1 has no unambiguous eligible candidate audit for both runs/);
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
   assert.ok(r.calls.filter(c=>/^A[134]/.test(c.label)).every(c=>c.prompt.includes('a'.repeat(40))&&c.prompt.includes('Re-fetch main')));
   assert.ok(r.result.evidence.some(e=>e.startsWith('Graph publication evidence: ')));
 },
 async()=>{const r=await run('plan',f=>{f.responses['A1 select'].tracks=[];});assert.equal(r.result.state,'EMPTY');assert.equal(r.calls.length,1);},
 async()=>{const r=await run('plan');assert.equal(r.result.plans.length,3);assert.equal(r.result.state,'AWAITING_APPROVAL');assert.ok(!r.calls.some(c=>c.label.startsWith('A3')));},
 async()=>{const r=await run('plan',f=>{f.responses['A2 shared-literal scan'].literals=f.literals;});const end=r.events.indexOf('end A3 contract');assert.ok(end>=0);for(const t of fixture.tracks) assert.ok(r.events.indexOf('start A4 plan '+t.issue_id)>end);},
 async()=>{const r=await run('plan',(f,a)=>{f.responses['A2 shared-literal scan'].literals=f.literals;a.wave.contract_dir=null;});assert.equal(r.result.state,'STOPPED');assert.match(r.result.stop_reason,/wave.contract_dir/);assert.equal(r.calls.length,2);},
 async()=>{const r=await run('build',(_f,a)=>{a.approve=['T-2'];});assert.deepEqual(r.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),['B1 build T-2']);assert.equal(r.result.tracks[0].state,'NOT_APPROVED');
 const invalid=await run('build',(_f,a)=>{a.approve=['unknown'];});assert.equal(invalid.result.state,'STOPPED');assert.equal(invalid.calls.length,0);assert.ok(invalid.result.evidence.length);
 },
 async()=>{const r=await run('build',stopped);assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'));assert.equal(r.result.tracks[0].state,'STOPPED');assert.equal(r.calls.filter(c=>c.label.startsWith('B3 review')).length,2);
 const dropped=await run('build',f=>{f.responses['B1 build T-1']=null;});assert.equal(dropped.result.tracks[0].state,'STOPPED');assert.ok(dropped.logs.some(l=>l.includes('dropped')));
 const badGate=await run('build',f=>{f.responses['B1 build T-1'].gates.test.exit=1;});assert.equal(badGate.result.tracks[0].state,'STOPPED');
 },
 async()=>{const r=await run('build',(f,a)=>{a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;f.responses['B2 seam check']={exit:1,table:seamTable(f).map(r=>r.branch==='codex/t-2'&&r.file==='file2.txt'?{...r,state:'MISMATCH',evidence:'absent'}:r),open_questions:[]};});assert.ok(!r.calls.some(c=>c.label==='B3 review T-2'));assert.equal(r.result.tracks[1].state,'SEAM_MISMATCH');for(const t of fixture.tracks)assert.ok(r.events.indexOf('start B2 seam check')>r.events.indexOf('end B1 build '+t.issue_id));assert.equal(r.result.seam_check.table[0].literal,'AGREED');assert.ok(r.result.seam_check.table.some(row=>row.file==='file2.txt'&&row.state==='MISMATCH'));assert.equal(r.calls.filter(c=>c.label.startsWith('B3 review')).length,2);
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
 },
 async()=>{
   // B1 requires A3's contract PR on the default branch, so merging it moves main
   // between Run A and Run B while the graph and closure digests stay the same.
   const planned=await run('plan',f=>{f.responses['A2 shared-literal scan'].literals=f.literals;});
   assert.equal(planned.result.state,'AWAITING_APPROVAL');assert.equal(planned.result.contract.state,'PR_OPEN');
   const pinned='a'.repeat(40),merged='f'.repeat(40);
   const build=(change=()=>{},prior=planned.result)=>run('build',(f,a)=>{
     a.plan_record=clone(prior);f.responses['B2 seam check'].table=seamTable(f);
     a.graph_publication.main_sha=merged;Object.assign(a.graph_admission[0],{main_sha:merged,graph_sha:merged});
     for(const t of fixture.tracks) f.responses['B3 admission '+t.issue_id].main_sha=merged;
     change(a.graph_admission[0]);
   });
   const r=await build();
   assert.equal(r.result.state,'COMPLETE');assert.equal(r.result.seam_check.state,'PASSED');
   const b1=r.calls.filter(c=>c.label.startsWith('B1'));
   assert.equal(b1.length,fixture.tracks.length);
   for(const c of b1){
     assert.ok(c.prompt.includes(JSON.stringify(planned.result.contract)));
     assert.ok(c.prompt.includes(`Run A pinned main ${pinned}`)&&c.prompt.includes(merged));
     assert.match(c.prompt,/is an ancestor of the fetched origin\/main/);
   }
   assert.equal(r.calls.filter(c=>c.label.startsWith('B3 review')).length,fixture.tracks.length);
   assert.deepEqual(r.result.tracks.map(t=>t.state),['CLEAN','CLEAN','CLEAN']);
   assert.ok(r.result.evidence.some(e=>e.includes(pinned)&&e.includes(merged)&&/digests unchanged/.test(e)));
   const same=await run('build',(f,a)=>{a.plan_record=clone(planned.result);f.responses['B2 seam check'].table=seamTable(f);});
   assert.equal(same.result.state,'COMPLETE');
   assert.ok(same.calls.filter(c=>/^B[13]/.test(c.label)).every(c=>c.prompt.includes('Run A approved observations')));
   for(const change of [rep=>{rep.candidates.forEach(c=>c.closure_graph_digest='sha256:'+'9'.repeat(64));},
                        rep=>{rep.candidates[0].closure_evidence_digest='sha256:'+'9'.repeat(64);}]){
     const changed=await build(change);
     assert.ok(changed.result.state==='STOPPED' || changed.result.tracks[0].state==='STOPPED');
     assert.ok(!changed.calls.some(c=>c.label.endsWith('T-1')));
     assert.match(changed.result.stop_reason || changed.result.tracks[0].result.stop_reason,/T-1 changed since Run A/);
   }
   const other=clone(planned.result);
   const pub=JSON.parse(other.evidence[0].slice('Graph publication evidence: '.length));
   pub.projects[0].project_id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
   other.evidence[0]='Graph publication evidence: '+JSON.stringify(pub);
   const project=await build(()=>{},other);
   assert.equal(project.result.state,'STOPPED');assert.equal(project.calls.length,0);
   assert.match(project.result.stop_reason,/no unambiguous eligible candidate audit/);
 },
 async()=>{
   // review_concurrency 1 starts T-1's review after B1 and B2; an unrelated PR merged
   // in between (ogur wave-2026-10-16-mvp21-r2: c5673b96 -> 47299f8c, PR #527 BLOCKED, rounds 0).
   const validated='a'.repeat(40),live='7'.repeat(40);
   const r=await run('build',(f,a)=>{movedAdmission(f,a,'T-1',live);});
   assert.equal(r.result.state,'COMPLETE');
   assert.deepEqual(r.result.tracks.map(t=>t.state),['CLEAN','CLEAN','CLEAN']);
   assert.deepEqual(r.calls.filter(c=>c.label.startsWith('B3 admission')).map(c=>c.label),fixture.tracks.map(t=>'B3 admission '+t.issue_id));
   assert.ok(r.events.indexOf('end B3 admission T-1')<r.events.indexOf('start B3 review T-1'));
   const admission=r.calls.find(c=>c.label==='B3 admission T-1');
   assert.match(admission.prompt,/merge-base --is-ancestor a{40} <live main>/);
   assert.match(admission.prompt,/merge-tree --write-tree <live main> <PR head>/);
   assert.match(admission.prompt,/graph-admission --ref <live main>/);
   const review=r.calls.find(c=>c.label==='B3 review T-1');
   assert.ok(review.prompt.includes(`main moved ${validated} -> ${live}`));
   assert.ok(review.prompt.includes(`For this review node live main ${live} replaces the`));
   assert.ok(review.prompt.includes('"main_sha":"'+live+'"'));
   for(const id of ['T-2','T-3']) assert.ok(!r.calls.find(c=>c.label==='B3 review '+id).prompt.includes('B3 admission '+id+': main moved'));
   assert.ok(r.result.evidence.some(e=>e.includes(validated)&&e.includes(live)&&/graph and closure digests unchanged/.test(e)));
   const exempt=await run('build',(f,a)=>{
     a.graph_publication={projects:[]};a.graph_admission=[];
     a.plan_record.tracks.forEach(t=>t.project=null);movedAdmission(f,a,'T-1',live);
   });
   assert.deepEqual(exempt.result.tracks.map(t=>t.state),['CLEAN','CLEAN','CLEAN']);
   assert.ok(!exempt.calls.some(c=>c.label.startsWith('B3 admission')),'project-less tracks stay exempt');
   const unrelated=await run('build',(f,a)=>{movedAdmission(f,a,'T-1',live,
     {report:rep=>{rep.graph_digest='sha256:'+'9'.repeat(64);}});});
   assert.deepEqual(unrelated.result.tracks.map(t=>t.state),['CLEAN','CLEAN','CLEAN'],
     'a whole-manifest change outside the candidate closure keeps admission');
   for(const missing of [null,'published_closure_graph_digest','published_closure_evidence_digest']) {
     const published=await run('build',(f,a)=>{
       const c=a.graph_admission[0].candidates[0];c.mode='LOCAL_RECONCILIATION';
       c.published_closure_graph_digest='sha256:'+'b'.repeat(64);
       c.published_closure_evidence_digest='sha256:'+'b'.repeat(64);
       if(missing) delete c[missing];
       a.graph_admission[0].delta.added_nodes=[{id:c.node_id,issue_ref:c.issue_id}];
       a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),
         'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
       movedAdmission(f,a,'T-1',live,{report:rep=>{
         Object.assign(rep.candidates[0],{mode:'PUBLISHED',closure_graph_digest:'sha256:'+'b'.repeat(64),
           closure_evidence_digest:'sha256:'+'b'.repeat(64)});rep.delta.added_nodes=[];
       }});
     });
     assert.deepEqual(published.result.tracks.map(t=>t.state),[missing?'BLOCKED':'CLEAN','CLEAN','CLEAN']);
     assert.ok(published.result.evidence.some(e=>e.startsWith('B3 admission observation T-1: ')));
     if(missing) assert.ok(!published.calls.some(c=>c.label==='B3 review T-1'));
   }

 },
 async()=>{
   // Negative control for case 31: the same moved main, but the track's closure digest changed.
   const live='7'.repeat(40),digest='sha256:'+'9'.repeat(64);
   const variants=[
     ['closure changed',{report:rep=>{rep.candidates[0].closure_evidence_digest=digest;}}],
     ['closure changed',{report:rep=>{rep.candidates[0].closure_graph_digest=digest;}}],
     ['closure changed',{report:rep=>{rep.candidates[0].issue_id='another-issue';}}],
     ['closure changed',{report:rep=>{rep.candidates[0].node_id='another-node';rep.candidates[0].closure.push('another-node');}}],
     ['has no eligible build admission at live main',{report:rep=>{rep.graph_sha='a'.repeat(40);}}],
     ['has no eligible build admission at live main',{report:rep=>{rep.checked_at='2026-10-05T12:15:00Z';}}],
     ['has no eligible build admission at live main',{report:rep=>{rep.checked_at='2026-10-05T13:32:00Z';}}],

     ['closure changed',{report:rep=>{rep.candidates[0].mode='LOCAL_RECONCILIATION';rep.delta.added_nodes=[{id:'T-1',issue_ref:'T-1'}];}}],
     ['validated main is not an ancestor of live main',{obs:o=>{o.ancestor_exit=1;}}],
     ['PR head does not merge cleanly with live main',{obs:o=>{o.merge_tree_exit=1;}}],
     ['has no eligible build admission at live main',{report:rep=>{rep.main_sha='a'.repeat(40);}}],
     ['has no eligible build admission at live main',{report:rep=>{rep.candidates[0].state='BLOCKED';}}],
     ['has no eligible build admission at live main',{obs:o=>{o.admission_report='not json';}}],
     ['stopped: fetch failed',{obs:o=>{Object.assign(o,{state:'STOPPED',stop_reason:'fetch failed',main_sha:null,checked_at:null});}}],
     ['returned invalid live main evidence',{obs:o=>{o.checked_at='2026-10-05T11:00:00Z';}}],
   ];
   for(const [reason,change] of variants){
     const r=await run('build',(f,a)=>{movedAdmission(f,a,'T-1',live,change);});
     assert.equal(r.result.state,'COMPLETE');
     assert.deepEqual(r.result.tracks.map(t=>t.state),['BLOCKED','CLEAN','CLEAN'],reason);
     assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'),reason+': no review round may run');
     const review=r.result.tracks[0].review;
     assert.equal(review.rounds,0);
     assert.ok(review.open_findings[0].startsWith('B3 admission: T-1 '+reason),review.open_findings[0]);
     assert.match(review.open_findings[0],/refresh evidence; new approval only for changed conditions/);
     assert.ok(r.result.evidence.includes(review.open_findings[0]));
   }
   const dropped=await run('build',f=>{f.responses['B3 admission T-1']=null;});
   assert.deepEqual(dropped.result.tracks.map(t=>t.state),['BLOCKED','CLEAN','CLEAN']);
   assert.match(dropped.result.tracks[0].review.open_findings[0],/returned no matching admission record/);
 },

 async()=>{
   const r=await run('build',(f,a)=>{
     a.approve=['T-1'];
     Object.assign(a.graph_publication.projects[0],{state:'ACCEPTED_UPDATE',pr_number:900,head_sha:'b'.repeat(40)});
     a.graph_admission[0].graph_sha='b'.repeat(40);
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
     a.graph_update_flags=['--accept-graph-update','900'];
     a.accepted_graph_updates=[{number:900,url:'https://example.test/pull/900',state:'OPEN',base:'main',head_sha:'b'.repeat(40),coverage_exit:0,coverage_state:'CURRENT',validation_exit:0,reviewed_head_sha:'b'.repeat(40),review_source:'Reviewed exact head',project_ids:['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']}];
     movedAdmission(f,a,'T-1','7'.repeat(40));
   });
   assert.equal(r.result.tracks[0].state,'CLEAN','publication between B1 and B3 preserves approval');
   assert.match(r.calls.find(c=>c.label==='B3 review T-1').prompt,/Run \/pr-loop https:\/\/example.test\/pr\/1 --max-rounds 3\s+in/);
 },
 async()=>{
   const recovered=(f,a)=>{a.approve=['T-1'];a.recovery=[{issue_id:'T-1',branch:a.plan_record.tracks[0].branch,worktree:a.plan_record.tracks[0].worktree,state:'PR_OPEN',checked_at:a.graph_publication.checked_at,result:clone(f.responses['B1 build T-1']),evidence:['Verified existing PR/head and gates']}];};
   const r=await run('build',recovered);
   assert.equal(r.result.tracks[0].state,'CLEAN');
   assert.ok(!r.calls.some(c=>c.label.startsWith('B1')),'an existing implementation resumes at review');
   assert.ok(r.calls.some(c=>c.label==='B3 review T-1'));
   for(const bad of ['branch','worktree','identity','gates','evidence']) {
     const broken=await run('build',(f,a)=>{recovered(f,a);const x=a.recovery[0];
       if(bad==='branch')x.branch='other';if(bad==='worktree')x.worktree='/other';
       if(bad==='identity')x.result.issue_id='other';if(bad==='gates')x.result.gates.test.exit=1;
       if(bad==='evidence')x.evidence=[];
     });
     assert.equal(broken.result.state,'STOPPED',bad);assert.equal(broken.calls.length,0,bad);
   }
 },
 async()=>{
   const r=await run('build',(f,a)=>{movedAdmission(f,a,'T-1','7'.repeat(40));});
   const prompt=r.calls.find(c=>c.label==='B3 review T-1').prompt;
   assert.ok(!prompt.includes('If main or the PR head moves again, return BLOCKED before any write.'));
   assert.match(prompt,/Refresh admission at the start of every review round/);
   assert.match(prompt,/own verified fix commits/);
 },
 async()=>{
   for(const kind of ['blocker','missing','stale']) {
     const r=await run('build',(f,a)=>{
       const fresh=clone(a.graph_admission[0]);fresh.checked_at='2026-10-05T14:00:00Z';
       if(kind==='blocker'){fresh.candidates[0].state='BLOCKED';fresh.candidates[0].unmet=[{}];}
       if(kind==='stale')fresh.checked_at='2026-10-05T12:00:00Z';
       Object.assign(f.responses['B3 admission T-1'],{checked_at:'2026-10-05T14:01:00Z',ancestor_exit:0,merge_tree_exit:0,head_sha:'9'.repeat(40),admission_report:kind==='missing'?null:JSON.stringify(fresh)});
     });
     assert.equal(r.result.tracks[0].state,'BLOCKED',kind);
     assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'),kind);
     assert.equal(r.result.tracks[1].state,'CLEAN');
   }
 },
 async()=>{
   const r=await run('build',(f,a)=>{
     a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;
     f.responses['B2 seam check'].table=seamTable(f);
     f.responses['B3 review T-1'].rounds=3;
     f.responses['B4 final verification']={heads:f.tracks.map(t=>({issue_id:t.issue_id,pr:f.responses['B1 build '+t.issue_id].pr,branch:t.branch,head_sha:f.responses['B1 build '+t.issue_id].head_sha,reviewed_head_sha:f.responses['B1 build '+t.issue_id].head_sha})),seam:{exit:1,table:seamTable(f).map(row=>row.branch==='codex/t-1'?{...row,state:'MISMATCH',evidence:'Review fix changed shared literal'}:row),open_questions:[]}};
   });
   assert.equal(r.result.tracks[0].state,'SEAM_MISMATCH');
   assert.equal(r.result.tracks[1].state,'CLEAN');
   assert.ok(r.events.indexOf('start B4 final verification')>r.events.indexOf('end B3 review T-1'));
 }
,
 async()=>{
   for(const change of ['metadata','meaning','missing']) {
     const r=await run('build',(_f,a)=>{
       const c=a.graph_admission[0].candidates[0];
       Object.assign(c,{semantic_closure_graph_digest:c.closure_graph_digest,semantic_closure_evidence_digest:c.closure_evidence_digest});
       a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
       c.closure_graph_digest='sha256:'+'0'.repeat(64);c.closure_evidence_digest='sha256:'+'0'.repeat(64);
       if(change==='meaning')c.semantic_closure_graph_digest='sha256:'+'0'.repeat(64);
       if(change==='missing')delete c.semantic_closure_evidence_digest;
     });
     assert.equal(r.result.tracks[0].state,change==='metadata'?'CLEAN':'STOPPED',change);
     assert.equal(r.result.tracks[1].state,'CLEAN');
     if(change==='metadata')assert.ok(r.calls.find(c=>c.label==='B1 build T-1').prompt.includes('use that semantic pair as the approval binding'));
   }
 }
,
 async()=>{
   for(const kind of ['owned_fix','foreign_head','missing']) {
     const r=await run('build',(f,a)=>{
       a.approve=['T-1'];
       f.responses['B3 review T-1'].rounds=2;
       f.responses['B4 final verification']=kind==='missing'?null:{heads:[{
         issue_id:'T-1',pr:f.responses['B1 build T-1'].pr,branch:'codex/t-1',
         head_sha:'8'.repeat(40),reviewed_head_sha:(kind==='owned_fix'?'8':'1').repeat(40)}],seam:null};
     });
     assert.equal(r.result.tracks[0].state,kind==='owned_fix'?'CLEAN':'BLOCKED',kind);
     if(kind!=='missing')assert.equal(r.result.tracks[0].result.head_sha,'8'.repeat(40));
   }
   for(const verdict of ['CLEAN','BLOCKED','ROUNDS_EXHAUSTED']) {
     const r=await run('build',(f,a)=>{
       a.approve=['T-1'];
       Object.assign(f.responses['B3 review T-1'],{
         verdict,rounds:3,open_findings:verdict==='CLEAN'?[]:['Existing finding'],
         open_questions:[{question:'Does the sibling handle this case?',status:'stale',evidence:'Needs human verification'}]
       });
       f.responses['B4 final verification']=null;
     });
     const review=r.result.tracks[0].review;
     assert.equal(review.verdict,verdict==='CLEAN'?'BLOCKED':verdict);
     assert.equal(review.rounds,3);
     assert.deepEqual(review.model_routing,fixture.responses['B3 review T-1'].model_routing);
     assert.equal(review.open_questions.length,1);
     assert.ok(review.open_findings.includes('Final PR head could not be verified'));
     if(verdict!=='CLEAN')assert.ok(review.open_findings.includes('Existing finding'));
   }
 }

];
// B3 admission observes live main after B1; a moved main carries fresh evidence.
const movedAdmission=(f,a,id,live,change={})=>{
  const report={...clone(a.graph_admission[0]),main_sha:live,graph_sha:live,checked_at:'2026-10-05T13:30:00Z'};
  const obs=Object.assign(f.responses['B3 admission '+id],{main_sha:live,checked_at:'2026-10-05T13:31:00Z',
    ancestor_exit:0,merge_tree_exit:0,head_sha:'9'.repeat(40)});
  change.report?.(report);
  obs.admission_report=JSON.stringify(report);
  change.obs?.(obs);
};
tests.push(
 async()=>{
   const plan=await run('plan',localArgs);
   assert.equal(plan.result.state,'AWAITING_APPROVAL');
   assert.equal(plan.result.build_command,'/wave build --approve all --local-graph');
   const build=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;});
   assert.equal(build.result.state,'COMPLETE');
   assert.ok(build.result.tracks.every(t=>t.state==='CLEAN'));
   for(const call of build.calls.filter(c=>/^B[13]/.test(c.label)))
     assert.ok(call.prompt.includes(JSON.stringify(localFlags)),call.label);
   for(const call of build.calls.filter(c=>c.label.startsWith('B3 review'))) {
     assert.match(call.prompt,/Run \/pr-loop \S+ --max-rounds 3 --local-graph in /);
     assert.ok(call.prompt.includes('Current graph flags ["--local-graph"]'));
   }
   const warnings=await run('plan',(f,a)=>{localArgs(f,a);a.approved_local_graph.coverage_exit=1;
     a.approved_local_graph.coverage_state='UPDATE_REQUIRED';});
   assert.equal(warnings.result.state,'AWAITING_APPROVAL','unrelated missing tickets remain warnings');
   const contract=await run('plan',(f,a)=>{localArgs(f,a);f.responses['A2 shared-literal scan'].literals=f.literals;a.wave.contract_dir=null;});
   assert.equal(contract.result.state,'AWAITING_APPROVAL');
   assert.equal(contract.result.contract,null);
   assert.deepEqual(contract.result.literals,fixture.literals);
   assert.ok(!contract.calls.some(c=>c.label==='A3 contract'));
   for(const c of contract.calls.filter(c=>c.label.startsWith('A4')))
     assert.ok(c.prompt.includes(JSON.stringify(fixture.literals)),c.label);
   const finalMismatch=await run('build',(f,a)=>{
     localArgs(f,a);a.plan_record=contract.result;a.wave.contract_dir=null;
     f.responses['B2 seam check']={exit:0,table:seamTable(f),open_questions:[]};
     const heads=f.tracks.map(t=>({issue_id:t.issue_id,pr:f.responses['B1 build '+t.issue_id].pr,
       branch:t.branch,head_sha:f.responses['B1 build '+t.issue_id].head_sha,
       reviewed_head_sha:f.responses['B1 build '+t.issue_id].head_sha}));
     f.responses['B4 final verification']={heads,seam:{exit:1,open_questions:[],
       table:seamTable(f).map(row=>({...row,branch:heads.find(h=>h.branch===row.branch).head_sha,
         state:row.branch==='codex/t-2'?'MISMATCH':row.state,evidence:'Final local agreement checked'}))}};
   });
   assert.equal(finalMismatch.result.tracks[1].state,'SEAM_MISMATCH');
   assert.equal(finalMismatch.result.tracks[0].state,'CLEAN');
   assert.equal(finalMismatch.result.seam_check.state,'FAILED');
   assert.ok(finalMismatch.calls.find(c=>c.label==='B4 final verification').prompt.includes('temporary file outside the repository'));
   for(const outcome of ['pass','mismatch','absent','incomplete']) {
     const checked=await run('build',(f,a)=>{
       localArgs(f,a);a.plan_record=contract.result;a.wave.contract_dir=null;
       f.responses['B2 seam check']=outcome==='absent'?null:{exit:outcome==='mismatch'?1:0,
         table:outcome==='incomplete'?[]:seamTable(f).map(row=>outcome==='mismatch'&&row.branch==='codex/t-2'&&row.file==='file2.txt'
           ?{...row,state:'MISMATCH',evidence:'absent'}:row),open_questions:[]};
     });
     const seam=checked.calls.find(c=>c.label==='B2 seam check');
     assert.ok(seam,'local agreements must still be checked');
     assert.ok(seam.prompt.includes('temporary file outside the repository'));
     assert.ok(seam.prompt.includes(JSON.stringify(fixture.literals.map(({literal,files})=>({literal,files})))));
     for(const c of checked.calls.filter(c=>c.label.startsWith('B1'))) {
       assert.ok(c.prompt.includes(JSON.stringify(fixture.literals)),c.label);
       assert.ok(!c.prompt.includes('first verify its PR is merged'),c.label);
     }
     if(outcome==='pass') assert.equal(checked.result.seam_check.state,'PASSED');
     else {
       assert.equal(checked.result.seam_check.state,'FAILED');
       assert.ok(!checked.calls.some(c=>c.label==='B3 review T-2'));
       assert.equal(checked.result.tracks[1].state,'SEAM_MISMATCH');
     }
   }
 },
 async()=>{
   for(const mutate of [a=>a.selection.push(...localFlags),
     a=>{a.approved_local_graph.index_path='/tmp/other/orchestration/index.json';},
     a=>{delete a.approved_local_graph;},a=>{a.approved_local_graph.index_digest='invalid';},
     a=>{a.approved_local_graph.validation_exit=1;},a=>{a.approved_local_graph.coverage_state='UNKNOWN';},
     a=>{a.approved_local_graph.project_ids=[];},a=>{a.approved_local_graph.checked_at='2026-10-04T12:00:00Z';},
     a=>{a.selection.push('--accept-graph-update','900');}]){
     const r=await run('plan',(f,a)=>{localArgs(f,a);mutate(a);});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
   }
   const plan=await run('plan',localArgs);
   for(const field of ['index_digest','manifest_digest','source_revision']){
     const r=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;
       a.approved_local_graph[field]=(field==='source_revision'?'':'sha256:')+'e'.repeat(field==='source_revision'?40:64);});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
   }
   const inherited=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;delete a.graph_update_flags;});
   assert.equal(inherited.result.state,'STOPPED');assert.equal(inherited.calls.length,0);
 },
 async()=>{
   const plan=await run('plan',localArgs);
   for(const field of ['closure_graph_digest','closure_evidence_digest','state']){
     const r=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;
       a.graph_admission[0].candidates[0][field]=field==='state'?'BLOCKED':'sha256:'+'9'.repeat(64);});
     assert.equal(r.result.tracks[0].state,'STOPPED');
     assert.equal(r.result.tracks[1].state,'CLEAN');
     assert.ok(!r.calls.some(c=>c.label==='B1 build T-1'));
   }
   for(const approve of [undefined,[],['unknown']]){
     const r=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;a.approve=approve;});
     assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
   }
   const subset=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;a.approve=['T-2'];});
   assert.deepEqual(subset.calls.filter(c=>c.label.startsWith('B1')).map(c=>c.label),['B1 build T-2']);
 },
 async()=>{
   const plan=await run('plan',localArgs);
   for(const change of ['missing','pins','closure']){
     const r=await run('build',(f,a)=>{localArgs(f,a);a.plan_record=plan.result;
       const response=f.responses['B3 admission T-1'];
       if(change==='missing') response.admission_report=null;
       else {const fresh=JSON.parse(response.admission_report);
         if(change==='pins') fresh.local_graph.manifest_digest='sha256:'+'9'.repeat(64);
         else fresh.candidates[0].closure_evidence_digest='sha256:'+'9'.repeat(64);
         response.admission_report=JSON.stringify(fresh);}
     });
     assert.equal(r.result.tracks[0].state,'BLOCKED',change);
     assert.equal(r.result.tracks[1].state,'CLEAN',change);
     assert.ok(!r.calls.some(c=>c.label==='B3 review T-1'));
   }
 }
);
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
  const heads=join(temp,'heads.json'),participants=join(temp,'participants.json');
  writeFileSync(heads,JSON.stringify({good:git('rev-parse','good'),bad:git('rev-parse','bad')}));
  writeFileSync(participants,JSON.stringify({AGREED:['good']}));
  const pinned=()=>spawnSync('python3',[resolve(dir,'../bin/seam-check'),'--repo',temp,'--base','main',
    '--contract',contract,'--expected-heads',heads,'--participants',participants,'--branches','good','bad'],{encoding:'utf8'});
  const pass=pinned();assert.equal(pass.status,0);assert.deepEqual(JSON.parse(pass.stdout).heads,JSON.parse(readFileSync(heads,'utf8')));
  assert.ok(JSON.parse(pass.stdout).table.every(r=>r.branch==='good'));
  writeFileSync(heads,JSON.stringify({good:git('rev-parse','main'),bad:git('rev-parse','bad')}));
  assert.equal(pinned().status,1,'stale reviewed head cannot pass');
  writeFileSync(heads,JSON.stringify({good:git('rev-parse','good')}));
  assert.equal(pinned().status,1,'missing reviewed head cannot pass');
  writeFileSync(contract,'invalid');assert.equal(check('good').status,1);
 }finally{rmSync(temp,{recursive:true,force:true});}
}

const v2Args=(f,a)=>{
  a.selection_version=2;
  const tracks=f.responses['A1 select'].tracks;
  tracks.forEach(t=>t.project=a.graph_publication.projects[0].project_id);
  const candidates=tracks.map((t,i)=>({issue_id:t.issue_id,project:t.project,milestone:t.milestone,
    priority:i,active_release:true,ownership:{state:'INACTIVE',source:'fixture:ownership'},
    file_scope:t.file_scope,external_overlaps:[],checks:Object.fromEntries(
      ['scope_plan','scope_build','native','plan_graph','build_graph','foundation'].map(key=>
      [key,{state:'SATISFIED',source:'fixture:'+key,detail:'Verified '+key}]))}));
  a.selection_snapshot={schema_version:2,complete:true,snapshot_id:'fixture',source_revision:'a'.repeat(40),
    command:clone(a.selection),requested:3,limit:12,main_sha:a.graph_publication.main_sha,
    checked_at:a.graph_publication.checked_at,candidates,pairs:candidates.flatMap((c,i)=>candidates.slice(i+1)
      .map(d=>({a:c.issue_id,b:d.issue_id,relation:'INDEPENDENT',source:'fixture:pairs',detail:'Verified'})))};
  f.responses['A1 select'].planning_tracks=[];
};
const v2Planning=(f,a,all=false)=>{
  v2Args(f,a);
  a.graph_admission.push({...clone(a.graph_admission[0]),transition:'plan'});
  const ids=all ? ['T-1','T-2','T-3'] : ['T-3'];
  for(const id of ids) {
    a.selection_snapshot.candidates.find(c=>c.issue_id===id).checks.build_graph.state='UNSATISFIED';
    a.graph_admission[0].candidates.find(c=>c.identifier===id).state='BLOCKED';
  }
  const response=f.responses['A1 select'];response.planning_tracks=response.tracks.filter(t=>ids.includes(t.issue_id));
  response.tracks=response.tracks.filter(t=>!ids.includes(t.issue_id));
};
cases.push({number:cases.length+1,name:'shared selector source and version 2 approval separation'});
tests.push(async()=>{
  const embedded=script.split('// BEGIN SHARED SELECTION\n')[1].split('\n// END SHARED SELECTION')[0];
  assert.equal(embedded,readFileSync(join(dir,'../../next/lib/selection.cjs'),'utf8').split('\nmodule.exports')[0]);
  const planned=await run('plan',v2Planning);
  assert.equal(planned.result.state,'AWAITING_APPROVAL');
  assert.equal(planned.result.schema_version,2);assert.equal(planned.result.plans.length,2);
  assert.equal(planned.result.planning_plans.length,1);
  assert.ok(planned.calls.find(c=>c.label==='A4 plan T-3').prompt.includes('use PLAN transition admission'));
  const built=await run('build',(_f,a)=>{a.plan_record=planned.result;});
  assert.equal(built.result.state,'COMPLETE');
  assert.deepEqual(built.result.approved,['T-1','T-2']);
  assert.ok(!built.calls.some(c=>c.label==='B1 build T-3'));
  for(const tamper of ['explicit','promote','snapshot']) {
    const r=await run('build',(_f,a)=>{
      a.plan_record=clone(planned.result);
      if(tamper==='explicit')a.approve=['T-3'];
      if(tamper==='promote') {a.plan_record.tracks.push(a.plan_record.planning_tracks[0]);a.plan_record.plans.push(a.plan_record.planning_plans[0]);}
      if(tamper==='snapshot')a.plan_record.selection_report='{}';
    });
    assert.equal(r.result.state,'STOPPED');assert.equal(r.calls.length,0);
  }
});
cases.push({number:cases.length+1,name:'planning-only wave and no invented build authorization'});
tests.push(async()=>{
  const r=await run('plan',(f,a)=>v2Planning(f,a,true));
  assert.equal(r.result.state,'PLANNING_ONLY');assert.equal(r.result.build_command,null);
  assert.equal(r.result.planning_plans.length,3);assert.equal(r.result.tracks.length,0);
  assert.ok(!r.calls.some(c=>/^A[23]/.test(c.label)));
  const build=await run('build',(_f,a)=>a.plan_record=r.result);
  assert.equal(build.result.state,'STOPPED');assert.equal(build.calls.length,0);
});
cases.push({number:cases.length+1,name:'lifecycle-aware advisory planning is retained without dispatch'});
tests.push(async()=>{
  const r=await run('plan',(f,a)=>{
    v2Planning(f,a,true);a.selection_snapshot.lifecycle_contract=1;
    const states=['STARTABLE','UNKNOWN','READ_ONLY_ONLY'];
    a.selection_snapshot.candidates.forEach((c,i)=>c.lifecycle={state:states[i],
      source:'tracker and owner decision',detail:'Observed lifecycle '+states[i]});
    f.responses['A1 select'].planning_tracks=f.responses['A1 select'].planning_tracks.filter(t=>t.issue_id==='T-1');
  });
  assert.equal(r.result.state,'PLANNING_ONLY');
  assert.deepEqual(r.calls.filter(c=>c.label.startsWith('A4')).map(c=>c.label),['A4 plan T-1']);
  const report=JSON.parse(r.result.selection_report);
  assert.deepEqual(report.read_only_planning_ids,['T-3']);assert.equal(report.capacity.read_only_planning,1);
  assert.equal(report.outcomes.find(c=>c.issue_id==='T-2').dispatch.state,'UNKNOWN');
  assert.equal(report.outcomes.find(c=>c.issue_id==='T-3').disposition,'READ_ONLY_PLANNING');
});
cases.push({number:cases.length+1,name:'assessment membership, evidence and pin validation precede writes'});
tests.push(async()=>{
  for(const change of ['absent','incomplete','pins','count','membership','scope','plan_evidence']) {
    const r=await run('plan',(f,a)=>{
      v2Planning(f,a);
      if(change==='absent')delete a.selection_snapshot;
      if(change==='incomplete')a.selection_snapshot.complete=false;
      if(change==='pins')a.selection_snapshot.main_sha='b'.repeat(40);
      if(change==='count')a.selection_snapshot.requested=4;
      if(change==='membership')f.responses['A1 select'].tracks.pop();
      if(change==='scope')f.responses['A1 select'].tracks[0].file_scope=['unassessed'];
      if(change==='plan_evidence')a.graph_admission.pop();
    });
    assert.equal(r.result.state,'STOPPED',change);assert.ok(!r.calls.some(c=>/^A[234]/.test(c.label)),change);
  }
});


const streamingArgs=(f,a)=>{
  a.wave.execution_mode='streaming';a.wave.worker_concurrency=3;
  for(const t of f.tracks)f.responses['B3 review '+t.issue_id].reviewed_head='a'.repeat(40);
};
const finalFixture=(f,a)=>{
  streamingArgs(f,a);a.plan_record.literals=clone(f.literals);a.plan_record.contract=clone(f.contract);
  const ids=f.literals[0].tracks;
  f.responses['B4 final evidence']={exit:0,base_sha:'b'.repeat(40),
    heads:f.tracks.filter(t=>ids.includes(t.issue_id)).map(t=>({issue_id:t.issue_id,branch:t.branch,head_sha:'a'.repeat(40),pr_head_sha:'a'.repeat(40)})),
    table:seamTable(f).filter(row=>ids.some(id=>f.tracks.find(t=>t.issue_id===id).branch===row.branch)),
    open_questions:[],evidence:['verified current GitHub/local heads before and after helper']};
};
cases.push({number:cases.length+1,name:'review begins before the last independent build finishes'});
tests.push(async()=>{
  const r=await run('build',(f,a)=>{
    streamingArgs(f,a);f.delays={'B1 build T-1':1,'B1 build T-2':3,'B1 build T-3':90};
  });
  assert.equal(r.result.state,'COMPLETE');assert.ok(r.result.tracks.every(t=>t.state==='CLEAN'));
  assert.ok(r.events.indexOf('start B3 review T-1')<r.events.indexOf('end B1 build T-3'));
  assert.ok(r.calls.find(c=>c.label==='B3 review T-1').prompt.includes('--review-slots 1 --test-slots 1'));
  assert.ok(r.logs.some(l=>l.includes('"event":"ticket_ready"')&&l.includes('T-1')));
});
cases.push({number:cases.length+1,name:'rolling worker and review queues reuse capacity'});
tests.push(async()=>{
  const r=await run('build',(f,a)=>{
    streamingArgs(f,a);a.wave.worker_concurrency=2;
    f.delays={'B1 build T-1':2,'B1 build T-2':3,'B1 build T-3':25,'B3 review T-1':90,'B3 review T-2':1};
  });
  assert.ok(r.events.indexOf('start B3 review T-3')<r.events.indexOf('end B3 review T-1'));
  let running=0,peak=0;
  for(const event of r.events){if(event.startsWith('start B1'))peak=Math.max(peak,++running);if(event.startsWith('end B1'))running--;}
  assert.equal(peak,2);
  for(const key of ['worker_concurrency','test_concurrency']) {
    const bad=await run('build',(_f,a)=>a.wave[key]=0);assert.equal(bad.result.state,'STOPPED');assert.equal(bad.calls.length,0);
  }
});
cases.push({number:cases.length+1,name:'final agreement uses reviewed heads after fixes'});
tests.push(async()=>{
  const r=await run('build',(f,a)=>{
    finalFixture(f,a);f.responses['B3 review T-1'].reviewed_head='c'.repeat(40);
    Object.assign(f.responses['B4 final evidence'].heads[0],{head_sha:'c'.repeat(40),pr_head_sha:'c'.repeat(40)});
  });
  assert.ok(r.result.tracks.every(t=>t.state==='CLEAN'));
  assert.equal(r.result.tracks[0].result.head_sha,'c'.repeat(40),'final result retains the reviewed fix head');
  assert.ok(!r.calls.some(c=>c.label==='B2 seam check'));
  assert.ok(r.events.indexOf('start B4 final evidence')>r.events.indexOf('end B3 review T-2'));
  for(const damage of ['old_head','pr_drift','missing_row','literal_changed','missing_observation','base_moved','branch_error']) {
    const bad=await run('build',(f,a)=>{
      finalFixture(f,a);const final=f.responses['B4 final evidence'];
      if(damage==='old_head')f.responses['B3 review T-1'].reviewed_head='c'.repeat(40);
      if(damage==='pr_drift')final.heads[0].pr_head_sha='d'.repeat(40);
      if(damage==='missing_row')final.table.pop();
      if(damage==='literal_changed'){final.exit=1;final.table[0].state='MISMATCH';}
      if(damage==='missing_observation')f.responses['B4 final evidence']=null;
      if(damage==='base_moved'||damage==='branch_error'){
        final.exit=1;final.table.push({literal:'',file:'',branch:damage==='base_moved'?'origin/main':final.heads[0].branch,state:'ERROR',evidence:'Ref moved'});
      }
    });
    assert.equal(bad.result.tracks[0].state,'SEAM_MISMATCH',damage);
    assert.equal(bad.result.tracks[1].state,'SEAM_MISMATCH',damage);
    assert.equal(bad.result.tracks[2].state,'CLEAN',damage);
  }
});
cases.push({number:cases.length+1,name:'missing agreement participants block only their group'});
tests.push(async()=>{
  for(const missing of ['unapproved','stopped']) {
    const r=await run('build',(f,a)=>{
      finalFixture(f,a);
      if(missing==='unapproved')a.approve=['T-1','T-3'];
      else{const result=f.responses['B1 build T-2'];result.state='STOPPED';result.pr=null;result.stop_reason='gate failed';result.evidence=['gate failed'];}
    });
    assert.equal(r.result.tracks[0].state,'SEAM_MISMATCH');assert.equal(r.result.tracks[2].state,'CLEAN');
    assert.ok(!r.calls.some(c=>c.label==='B4 final evidence'));
  }
});
cases.push({number:cases.length+1,name:'narrow context excludes sibling plans and issue bodies'});
tests.push(async()=>{
  const r=await run('build',(f,a)=>{
    streamingArgs(f,a);a.plan_record.plans[1].risks=['SIBLING-PLAN-PRIVATE'];
    a.graph_admission[0].evidence.issues.unrelated='UNRELATED-ISSUE-BODY';
    a.graph_admission[0].evidence.request.nodes=[{node_id:'outside-closure',description:'UNRELATED-NODE'}];
    a.selection_snapshot={secret:'SELECTION-NOT-FOR-BUILDER'};
  });
  const prompt=r.calls.find(c=>c.label==='B1 build T-1').prompt;
  for(const marker of ['SIBLING-PLAN-PRIVATE','UNRELATED-ISSUE-BODY','UNRELATED-NODE','SELECTION-NOT-FOR-BUILDER'])assert.ok(!prompt.includes(marker));
  assert.ok(r.result.evidence.some(e=>e.includes('UNRELATED-ISSUE-BODY')),'full audit retained');
});
cases.push({number:cases.length+1,name:'legacy review phase follows the seam barrier'});
tests.push(async()=>{
  const r=await run('build',(f,a)=>{a.plan_record.contract=f.contract;a.plan_record.literals=f.literals;});
  const seamEnd=r.events.indexOf('end B2 seam check');
  const reviewPhase=r.events.indexOf('phase Review');
  assert.ok(seamEnd>=0);
  assert.ok(reviewPhase>seamEnd);
});
cases.push({number:cases.length+1,name:'review permit expiry stays distinct in the wave result'});
tests.push(async()=>{
  const r=await run('build',f=>{
    const review=f.responses['B3 review T-1'];
    review.verdict='BLOCKED';
    review.rounds=0;
    review.block_reason_code='SLOT_WAIT_TIMEOUT';
    review.open_findings=['Reviewer permit queue wait expired before a paid review'];
  });
  assert.equal(r.result.tracks[0].state,'BLOCKED');
  assert.equal(r.result.tracks[0].review.block_reason_code,'SLOT_WAIT_TIMEOUT');
  assert.equal(r.result.tracks[0].review.rounds,0);
});


cases.push({number:cases.length+1,name:'local build and review prompts retain saved Run A scope text'});
tests.push(async()=>{
  const saved={'docs/scope.md':{text:'RUN_A_SCOPE: approved section and exclusions',digest:'sha256:'+'a'.repeat(64)}};
  for(const mode of ['legacy','streaming']) {
    const plan=await run('plan',(f,a)=>{
      localArgs(f,a);a.graph_admission[0].evidence.local_scope_sources=clone(saved);
    });
    const build=await run('build',(f,a)=>{
      localArgs(f,a);a.plan_record=plan.result;
      a.wave.execution_mode=mode;
      a.graph_admission[0].evidence.local_scope_sources['docs/scope.md'].text='RUN_B_SCOPE: current text';
    });
    assert.equal(build.result.state,'COMPLETE',mode);
    const calls=build.calls.filter(c=>/^B[13]/.test(c.label));
    assert.ok(calls.length>=6,mode);
    for(const call of calls) {
      const id=call.label.split(' ').at(-1);
      const prefix=`Run A approved observations for ${id}: `;
      const line=call.prompt.split('\n').find(line=>line.startsWith(prefix));
      assert.ok(line,call.label);
      const approved=JSON.parse(line.slice(prefix.length,-1));
      assert.deepEqual(approved.admission.local_scope_sources,saved,mode+': '+call.label);
      assert.ok(call.prompt.includes('RUN_B_SCOPE: current text'),call.label);
    }
  }
});


cases.push({number:cases.length+1,name:'streaming recovery and fresh admission retain main safeguards'});
tests.push(async()=>{
  const recovered=await run('build',(f,a)=>{
    streamingArgs(f,a);a.approve=['T-1'];
    a.recovery=[{issue_id:'T-1',branch:a.plan_record.tracks[0].branch,worktree:a.plan_record.tracks[0].worktree,
      state:'PR_OPEN',checked_at:a.graph_publication.checked_at,result:clone(f.responses['B1 build T-1']),evidence:['Verified existing PR/head and gates']}];
  });
  assert.equal(recovered.result.tracks[0].state,'CLEAN');
  assert.ok(!recovered.calls.some(c=>c.label.startsWith('B1')));
  assert.ok(recovered.calls.some(c=>c.label==='B3 review T-1'));
  const blocked=await run('build',(f,a)=>{
    streamingArgs(f,a);
    const fresh=clone(a.graph_admission[0]);fresh.checked_at='2026-10-05T14:00:00Z';
    fresh.candidates[0].state='BLOCKED';fresh.candidates[0].unmet=[{}];
    Object.assign(f.responses['B3 admission T-1'],{checked_at:'2026-10-05T14:01:00Z',ancestor_exit:0,
      merge_tree_exit:0,head_sha:'9'.repeat(40),admission_report:JSON.stringify(fresh)});
  });
  assert.equal(blocked.result.tracks[0].state,'BLOCKED');
  assert.equal(blocked.result.tracks[1].state,'CLEAN');
  assert.ok(!blocked.calls.some(c=>c.label==='B3 review T-1'));
});
cases.push({number:cases.length+1,name:'streaming rechecks final review identity and local agreements'});
tests.push(async()=>{
  for(const kind of ['owned_fix','foreign_head','stale_marker','missing']) {
    const r=await run('build',(f,a)=>{
      streamingArgs(f,a);a.approve=['T-1'];
      f.responses['B3 review T-1'].reviewed_head='8'.repeat(40);
      f.responses['B4 final verification']=kind==='missing'?null:{heads:[{
        issue_id:'T-1',pr:f.responses['B1 build T-1'].pr,branch:'codex/t-1',
        head_sha:(kind==='foreign_head'?'9':'8').repeat(40),
        reviewed_head_sha:(kind==='stale_marker'?'7':kind==='foreign_head'?'9':'8').repeat(40)}],seam:null};
    });
    assert.equal(r.result.tracks[0].state,kind==='owned_fix'?'CLEAN':'BLOCKED',kind);
    if(kind==='owned_fix')assert.equal(r.result.tracks[0].result.head_sha,'8'.repeat(40));
  }
  const plan=await run('plan',(f,a)=>{localArgs(f,a);f.responses['A2 shared-literal scan'].literals=f.literals;a.wave.contract_dir=null;});
  assert.equal(plan.result.contract,null);
  for(const damage of [false,true]) {
    const r=await run('build',(f,a)=>{
      localArgs(f,a);a.plan_record=clone(plan.result);finalFixture(f,a);
      a.plan_record.contract=null;a.wave.contract_dir=null;
      if(damage)f.responses['B4 final evidence'].table.pop();
    });
    assert.equal(r.result.tracks[1].state,damage?'SEAM_MISMATCH':'CLEAN');
    assert.equal(r.result.tracks[2].state,'CLEAN');
    assert.ok(!r.calls.some(c=>c.label==='B2 seam check'));
    assert.ok(r.calls.some(c=>c.label==='B4 final evidence'));
  }
});

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
 // Remove the B3 closure digest comparison. Case 35's closure variant must detect it.
 const closureMutant=executable.replace('const changed=candidateChanges(current.candidate,now.candidate);',
   "const changed=candidateChanges(current.candidate,now.candidate).filter(c=>c.field!=='closure_evidence_digest');");
 assert.notEqual(closureMutant,executable,'closure mutation target must exist');
 const closureRun=await run('build',(f,a)=>{movedAdmission(f,a,'T-1','7'.repeat(40),
   {report:rep=>{rep.candidates[0].closure_evidence_digest='sha256:'+'9'.repeat(64);}});},closureMutant);
 assert.equal(closureRun.result.tracks[0].state,'CLEAN','closure mutant must let the changed closure through');
 console.log('PASS mutation: removing the B3 closure digest check makes case 35 fail; original source untouched');

 const graphMutation=executable.replace("for (const field of ['closure_graph_digest','closure_evidence_digest'])",
   "for (const field of ['closure_evidence_digest'])");
 assert.notEqual(graphMutation,executable,'publication graph comparison mutation target must exist');
 let graphDetected=false;
 try {
   const r=await run('build',(_f,a)=>{
     const c=a.graph_admission[0].candidates[0];c.mode='LOCAL_RECONCILIATION';
     c.published_closure_graph_digest='sha256:'+'1'.repeat(64);
     c.published_closure_evidence_digest=c.closure_evidence_digest;
     a.graph_admission[0].delta.added_nodes=[{id:c.node_id,issue_ref:c.issue_id}];
     a.plan_record.evidence=['Graph publication evidence: '+JSON.stringify(a.graph_publication),
       'Graph admission evidence: '+JSON.stringify(a.graph_admission)];
     c.mode='PUBLISHED';a.graph_admission[0].delta.added_nodes=[];
   },graphMutation);
   assert.equal(r.result.tracks[0].state,'STOPPED');
 } catch {graphDetected=true;}
 assert.ok(graphDetected,'repair publication must detect removal of its graph comparison');
 console.log('PASS mutation: removing repair publication graph comparison is detected; original source untouched');
}
process.exitCode=failed?1:0;
