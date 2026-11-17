'use strict';
const assert = require('node:assert/strict');
const {createClaudeHost} = require('../lib/claude-host.cjs');

const id='7fcd9bad-c10a-487d-9405-b8d3957e0925';
const repo='/tmp/disposable-project';
const entry={id:'7fcd9bad',sessionId:id,cwd:repo,kind:'background',state:'blocked',startedAt:1794494318570};
(async()=>{
  let invoked;
  const host=createClaudeHost({run:async(...args)=>{invoked=args;return {stdout:JSON.stringify([entry])};}});
  assert.equal(host.idempotentSessionCreation,false);
  const found=await host.inspectSession({repo,session_id:id});
  assert.equal(found.state,'OBSERVED');assert.equal(found.host_state,'blocked');
  assert.equal(found.session_id,id);assert.match(found.limitation,/permission mode/);
  assert.deepEqual(invoked[1],['agents','--all','--json','--cwd',repo]);
  assert.equal(invoked[2].cwd,repo);assert.equal(invoked[2].timeout,10000);
  assert.equal((await host.ensureSession({repo,session_id:id})).state,'UNKNOWN');
  for (const entries of [[],[entry,entry],[{...entry,cwd:'/tmp/other'}],[{...entry,state:'mystery'}]]) {
    const adapter=createClaudeHost({run:async()=>({stdout:JSON.stringify(entries)})});
    assert.equal((await adapter.inspectSession({repo,session_id:id})).state,'UNKNOWN');
  }
  for(const stdout of ['bad','{}']) {
    const adapter=createClaudeHost({run:async()=>({stdout})});
    assert.equal((await adapter.inspectSession({repo,session_id:id})).state,'UNKNOWN');
  }
  const unavailable=createClaudeHost({run:async()=>{throw Error('timeout');}});
  assert.equal((await unavailable.inspectSession({repo,session_id:id})).state,'UNKNOWN');
  assert.equal((await host.inspectSession({repo:'relative',session_id:id})).state,'UNKNOWN');
  assert.equal((await host.inspectSession({repo,session_id:'7fcd9bad'})).state,'UNKNOWN');
  console.log('PASS Claude host registry observations are exact and fail closed');
})().catch(e=>{console.error(e);process.exitCode=1;});
