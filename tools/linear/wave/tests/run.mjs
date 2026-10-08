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
const tests=[
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
 async()=>{const r=await run('plan',f=>{f.responses['A1 select'].tracks=[];f.responses['A1 select'].sequenced=['T-1 PLAN_ONLY: build waits for contract merge (source: fixture)'];});assert.equal(r.result.state,'EMPTY');assert.equal(r.result.plans.length,0);assert.equal(r.result.build_command,null);assert.equal(r.calls.length,1);assert.match(r.calls[0].prompt,/PLAN_ONLY candidates must go in sequenced/);assert.match(r.result.sequenced[0],/build waits for contract merge/);}
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
