import asyncio
import hashlib
import json
import os
import tempfile
import unittest
from types import SimpleNamespace

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__),'../lib'))
from claude_worker import Worker, serve

SID='7fcd9bad-c10a-487d-9405-b8d3957e0925'
PIN={'main_sha':'a'*40, 'scope_digest':'sha256:'+'b'*64, 'criteria_digest':'sha256:'+'c'*64}

class System:
    def __init__(self,data): self.subtype='init'; self.data=data
class Result:
    def __init__(self,sid,body,failed=False,denials=None):
        self.session_id=sid; self.result=json.dumps(body); self.structured_output=None
        self.is_error=failed; self.permission_denials=denials
class Fake:
    def __init__(self, config, *, bad=None): self.config=config; self.bad=bad; self.mode='plan'; self.queries=[]; self.modes=[]
    async def connect(self): pass
    async def disconnect(self): pass
    async def query(self,prompt,session_id): self.queries.append((prompt,session_id))
    async def set_permission_mode(self,mode): self.mode=mode; self.modes.append(mode)
    async def receive_response(self):
        data={'session_id':SID, 'permissionMode':self.mode, 'cwd':self.config['worktree']}
        if self.bad == 'sid': data['session_id']='wrong'
        if self.bad == 'mode': data['permissionMode']='auto'
        if self.bad == 'cwd': data['cwd']='/somewhere/else'
        yield System(data)
        if self.mode=='plan': body={'text':'Revised plan' if 'revise' in self.queries[-1][0] else 'Plan cites the criteria', 'files':['src/file.py'], 'tests':['run focused test']}
        else: body={'pr_url':'https://example.test/1'}
        yield Result('wrong' if self.bad=='result_sid' else SID,body,failed=self.bad=='error',denials=['deny'] if self.bad=='denial' else None)

def make_config(d):
    return {'issue_id':'T-1','session_id':SID,'worktree':d,'token':'a'*64,'admission':PIN,
            'mode':'implement','plan_prompt':'make a plan','ipc_dir':os.path.join(d,'ipc')}

def digest(plan):
    return 'sha256:' + hashlib.sha256(json.dumps(plan,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.config=make_config(self.tmp.name)
        self.client=Fake(self.config); self.worker=Worker(self.config,self.client,System,Result)
    async def asyncTearDown(self): self.tmp.cleanup()

    async def test_plan_mode_blocks_writes_before_and_after_init(self):
        req=lambda name:{'tool_name':name}
        self.worker.init_event.set()  # an unverified host remains denied
        self.assertEqual((await self.worker.pre_tool_use(req('Read'),None,None))['hookSpecificOutput']['permissionDecision'],'deny')
        await self.worker.run_plan()
        self.assertEqual(self.worker.state,'PLAN_READY')
        self.assertEqual(await self.worker.pre_tool_use(req('Read'),None,None),{})
        for tool in ('Bash','Edit','Write','Agent','mcp__linear__save_issue'):
            self.assertEqual((await self.worker.pre_tool_use(req(tool),None,None))['hookSpecificOutput']['permissionDecision'],'deny')
        self.assertEqual(self.worker.plan['main_sha'],PIN['main_sha'])

    async def test_build_uses_same_client_and_only_the_exact_plan_once(self):
        await self.worker.run_plan()
        plan=self.worker.plan
        bad={'token':self.config['token'],'command':'build','plan':plan,'plan_digest':'bad','prompt':'build'}
        self.assertEqual((await self.worker.handle(bad))['state'],'UNKNOWN')
        good={**bad,'plan_digest':digest(plan)}
        result=await asyncio.gather(self.worker.handle(good),self.worker.handle(good))
        self.assertEqual(sorted(x['state'] for x in result),['UNKNOWN','WAIT'])
        await self.worker.task
        self.assertEqual(self.worker.state,'BUILD_DONE')
        self.assertEqual(self.client.modes,['auto'])
        self.assertEqual([x[1] for x in self.client.queries],[SID,SID])
        self.assertEqual(self.worker.build_result['pr_url'],'https://example.test/1')
        self.assertEqual((await self.worker.handle({'token':self.config['token'],'command':'idle'}))['state'],'IDLE')

    async def test_revision_stays_in_the_same_plan_session(self):
        await self.worker.run_plan()
        previous=self.worker.plan
        request={'token':self.config['token'],'command':'revise_plan','plan':previous,'prompt':'revise the plan'}
        self.assertEqual((await self.worker.handle(request))['state'],'WAIT')
        self.assertEqual((await self.worker.handle(request))['state'],'UNKNOWN')
        await self.worker.task
        self.assertEqual(self.worker.state,'PLAN_READY')
        self.assertEqual(self.worker.plan['text'],'Revised plan')
        self.assertEqual([q[1] for q in self.client.queries],[SID,SID])
        self.assertEqual(self.client.modes,[])

    async def test_plan_only_cannot_build(self):
        self.config['mode']='plan_only'
        await self.worker.run_plan()
        plan=self.worker.plan
        request={'token':self.config['token'],'command':'build','plan':plan,'plan_digest':digest(plan),'prompt':'build'}
        self.assertEqual((await self.worker.handle(request))['state'],'UNKNOWN')
        self.assertEqual(self.client.modes,[])

    async def test_review_runs_in_the_implementation_session(self):
        await self.worker.run_plan()
        plan=self.worker.plan
        await self.worker.handle({'token':self.config['token'],'command':'build','plan':plan,'plan_digest':digest(plan),'prompt':'build'})
        await self.worker.task
        result=await self.worker.handle({'token':self.config['token'],'command':'review','prompt':'review this PR'})
        self.assertEqual(result['state'],'WAIT')
        await self.worker.task
        self.assertEqual(self.worker.state,'REVIEW_DONE')
        self.assertEqual([q[1] for q in self.client.queries],[SID,SID,SID])

    async def test_missing_or_mismatched_host_evidence_fails_closed(self):
        for bad in ['sid','mode','cwd','result_sid','error','denial']:
            with self.subTest(bad=bad):
                worker=Worker(self.config,Fake(self.config,bad=bad),System,Result)
                await worker.run_plan()
                self.assertEqual(worker.state,'ERROR')
                self.assertFalse(worker.verified_init)
                self.assertIsNone(worker.plan)

    async def test_only_stopped_error_can_be_closed(self):
        self.worker.client=Fake(self.config,bad='error')
        self.worker.task=asyncio.create_task(self.worker.run_plan())
        await self.worker.task
        self.assertEqual(self.worker.state,'ERROR')
        response=await self.worker.handle({'token':self.config['token'],'command':'close'})
        self.assertEqual(response['state'],'CLOSING')
        self.assertEqual(self.worker.state,'CLOSING')
        self.assertEqual((await self.worker.handle({'token':self.config['token'],'command':'close'}))['state'],'UNKNOWN')

    async def test_exclusive_worker_claim_is_not_reused(self):
        server=asyncio.create_task(serve(self.config,self.worker))
        try:
            for _ in range(100):
                if os.path.exists(os.path.join(self.config['ipc_dir'],'owner.lock')): break
                await asyncio.sleep(.01)
            other=Worker(self.config,Fake(self.config),System,Result)
            with self.assertRaises(FileExistsError): await serve(self.config,other)
        finally:
            server.cancel()
            try: await server
            except asyncio.CancelledError: pass
        other=Worker(self.config,Fake(self.config),System,Result)
        with self.assertRaises(FileExistsError): await serve(self.config,other)

    async def test_mailbox_authorization_and_plan_poll(self):
        server=asyncio.create_task(serve(self.config,self.worker))
        async def call(name, body):
            requests=os.path.join(self.config['ipc_dir'],'requests')
            responses=os.path.join(self.config['ipc_dir'],'responses')
            for _ in range(100):
                if os.path.isdir(requests): break
                await asyncio.sleep(.01)
            path=os.path.join(requests,name+'.json')
            with open(path+'.tmp','x') as f: json.dump(body,f)
            os.replace(path+'.tmp',path)
            response=os.path.join(responses,name+'.json')
            for _ in range(100):
                if os.path.exists(response):
                    with open(response) as f: return json.load(f)
                await asyncio.sleep(.01)
            self.fail('worker did not respond')
        try:
            response=await call('a',{'token':'wrong','command':'status'})
            self.assertEqual(response['state'],'UNKNOWN')
            response=await call('b',{'token':self.config['token'],'command':'plan'})
            self.assertEqual(response['state'],'READY')
            self.assertEqual(response['session_id'],SID)
        finally:
            server.cancel()
            try: await server
            except asyncio.CancelledError: pass

if __name__=='__main__': unittest.main()
