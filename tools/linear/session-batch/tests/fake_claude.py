#!/usr/bin/env python3
"""Fake CLI wire peer for the official SDK; never performs model/network calls."""
import json, os, sys

if sys.argv[1:3]==['auth','status']:
    print(json.dumps({'loggedIn':True}))
    raise SystemExit
if '--help' in sys.argv:
    print('--session-id --restricted --permission-mode --permission-prompts')
    raise SystemExit
if '-v' in sys.argv or '--version' in sys.argv:
    print('2.1.322 (Claude Code)')
    raise SystemExit

session = next((x.split('=', 1)[1] for x in sys.argv if x.startswith('--session-id=')), None)
if not session and '--session-id' in sys.argv:
    session = sys.argv[sys.argv.index('--session-id')+1]
mode = 'plan'
callback = None

def send(data):
    print(json.dumps(data), flush=True)

for line in sys.stdin:
    message=json.loads(line)
    if message.get('type') == 'control_request':
        req=message['request']; subtype=req['subtype']
        if subtype=='initialize':
            callback=req['hooks']['PreToolUse'][0]['hookCallbackIds'][0]
            answer={'hook_on_failure_supported': not bool(os.environ.get('FAKE_HOOK_UNSUPPORTED')), 'hooks_applied': True}
        elif subtype=='set_permission_mode':
            mode=req['mode'];answer={}
        else:
            answer={}
        send({'type':'control_response','response':{'subtype':'success','request_id':message['request_id'],'response':answer}})
    elif message.get('type')=='user':
        send({'type':'system','subtype':'init','session_id':session,'cwd':os.getcwd(),'permissionMode':mode})
        send({'type':'control_request','request_id':'fake_hook','request':{'subtype':'hook_callback','callback_id':callback,
            'input':{'hook_event_name':'PreToolUse','tool_name':'Edit','tool_input':{},'tool_use_id':'fake'},'tool_use_id':'fake'}})
        hook=json.loads(sys.stdin.readline())
        decision=hook['response']['response'].get('hookSpecificOutput',{}).get('permissionDecision','defer')
        with open(os.environ['FAKE_SESSION_LOG'],'a') as f:
            f.write(json.dumps({'pid':os.getpid(),'session_id':session,'mode':mode,'decision':decision})+'\n')
        body={'text':'revised plan' if 'revise' in str(message.get('message',{}).get('content','')).lower() else 'a plan','files':['src/a.py'],'tests':['focused test']} if mode=='plan' else {'pr_url':'https://example.test/pull/1','head_sha':'b'*40}
        send({'type':'result','subtype':'success','duration_ms':1,'duration_api_ms':1,'is_error':False,
              'num_turns':1,'session_id':session,'result':json.dumps(body)})
