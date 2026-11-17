import json, os
class ClaudeAgentOptions:
    def __init__(self,**kwargs): self.__dict__.update(kwargs)
class HookMatcher:
    def __init__(self,**kwargs): self.__dict__.update(kwargs)
class SystemMessage:
    def __init__(self,data): self.subtype='init';self.data=data
class ResultMessage:
    def __init__(self,sid,body):
        self.session_id=sid;self.structured_output=None;self.result=json.dumps(body);self.is_error=False;self.permission_denials=None
class ClaudeSDKClient:
    def __init__(self,options):self.options=options;self.mode=options.permission_mode
    async def connect(self):pass
    async def disconnect(self):pass
    async def set_permission_mode(self,mode):self.mode=mode
    async def query(self,prompt,session_id):
        self.prompt=prompt
        with open(os.environ['FAKE_SESSION_LOG'],'a') as f:f.write(json.dumps({'pid':os.getpid(),'session_id':session_id,'mode':self.mode})+'\n')
    async def receive_response(self):
        yield SystemMessage({'session_id':self.options.session_id,'cwd':self.options.cwd,'permissionMode':self.mode})
        body={'text':'revised plan' if 'revise' in self.prompt.lower() else 'a plan','files':['src/a.py'],'tests':['focused test']} if self.mode=='plan' else {'pr_url':'https://example.test/pull/1','head_sha':'b'*40}
        yield ResultMessage(self.options.session_id,body)
