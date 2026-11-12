#!/usr/bin/env python3
"""One long-lived Claude SDK client per issue; never resume or fork a session.

The process owns one private file-based mailbox. An unavailable process is UNKNOWN,
not permission to launch another session. Only the supervisor can advance it.
"""
from __future__ import annotations

import asyncio
import hmac
import hashlib
import json
import os
from pathlib import Path
import sys
from typing import Any

READ_TOOLS = frozenset({'Read', 'Glob', 'Grep', 'LS'})
MAX_REQUEST = 2 * 1024 * 1024


class Worker:
    def __init__(self, config: dict[str, Any], client: Any, system_type: type, result_type: type):
        self.config = config
        self.client = client
        self.system_type = system_type
        self.result_type = result_type
        self.state = 'STARTING'
        self.phase = 'PLAN'
        self.verified_init = False
        self.init_event = asyncio.Event()
        self.plan: dict[str, Any] | None = None
        self.build_result: dict[str, Any] | None = None
        self.review_result: dict[str, Any] | None = None
        self.error: str | None = None
        self.task: asyncio.Task | None = None
        self.shutdown_requested = False
        self.guard = asyncio.Lock()

    async def pre_tool_use(self, data: dict[str, Any], _tool_use_id: Any, _context: Any) -> dict[str, Any]:
        tool = data.get('tool_name')
        if not self.verified_init:
            try:
                await asyncio.wait_for(self.init_event.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass
        # Read-only is a host-enforced Plan boundary, not a model instruction.
        if not self.verified_init or (self.phase == 'PLAN' and tool not in READ_TOOLS):
            return {'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                    'permissionDecisionReason': 'Session mode is unverified or plan is read-only.'}}
        return {}

    def status(self) -> dict[str, Any]:
        return {'state': self.state, 'phase': self.phase, 'session_id': self.config['session_id'],
                'issue_id': self.config['issue_id'], 'worktree': self.config['worktree'],
                'verified_init': self.verified_init, 'error': self.error}

    def observe_init(self, message: Any, expected_mode: str) -> None:
        data = message.data
        if not isinstance(data, dict):
            raise ValueError('missing session initialization')
        if data.get('session_id') != self.config['session_id'] or data.get('permissionMode') != expected_mode:
            raise ValueError('session ID or permission mode mismatch')
        if os.path.realpath(data.get('cwd', '')) != os.path.realpath(self.config['worktree']):
            raise ValueError('session working directory mismatch')
        self.verified_init = True
        self.init_event.set()
        self.state = {'PLAN': 'PLAN_RUNNING', 'BUILD': 'BUILD_RUNNING', 'REVIEW': 'REVIEW_RUNNING'}[self.phase]

    async def turn(self, prompt: str, expected_mode: str) -> Any:
        self.verified_init = False
        self.init_event.clear()
        await self.client.query(prompt, session_id=self.config['session_id'])
        result = None
        async for message in self.client.receive_response():
            if isinstance(message, self.system_type) and message.subtype == 'init':
                self.observe_init(message, expected_mode)
            elif isinstance(message, self.result_type):
                if not self.verified_init or message.session_id != self.config['session_id']:
                    raise ValueError('response has no matching verified initialization')
                if message.is_error or getattr(message, 'permission_denials', None):
                    raise ValueError('Claude reported a failure or denied permission')
                result = message
        if result is None:
            raise ValueError('Claude turn ended without a result')
        return result

    @staticmethod
    def content(result: Any) -> dict[str, Any]:
        value = getattr(result, 'structured_output', None)
        if value is None:
            value = json.loads(result.result)
        if not isinstance(value, dict):
            raise ValueError('JSON object required')
        return value

    async def run_plan(self, prompt: str | None = None) -> None:
        try:
            result = await self.turn(prompt or self.config['plan_prompt'], 'plan')
            body = self.content(result)
            if not isinstance(body.get('text'), str) or not body['text'].strip():
                raise ValueError('plan text required')
            for field in ('files', 'tests'):
                if not isinstance(body.get(field), list) or not body[field] or not all(isinstance(x, str) and x.strip() for x in body[field]):
                    raise ValueError('plan files and tests required')
            pin = self.config['admission']
            self.plan = {'text': body['text'], 'session_id': self.config['session_id'],
                         'issue_id': self.config['issue_id'], 'main_sha': pin['main_sha'],
                         'scope_digest': pin['scope_digest'], 'criteria_digest': pin['criteria_digest'],
                         'files': body['files'], 'tests': body['tests']}
            self.state = 'PLAN_READY'
        except Exception as exc:
            self.verified_init = False
            self.state = 'ERROR'
            self.error = type(exc).__name__

    async def run_build(self, prompt: str) -> None:
        try:
            self.phase = 'BUILD'
            self.verified_init = False
            await self.client.set_permission_mode('auto')
            result = await self.turn(prompt, 'auto')
            self.build_result = self.content(result)
            self.state = 'BUILD_DONE'
        except Exception as exc:
            self.verified_init = False
            self.state = 'ERROR'
            self.error = type(exc).__name__

    async def run_review(self, prompt: str) -> None:
        try:
            self.phase = 'REVIEW'
            self.verified_init = False
            result = await self.turn(prompt, 'auto')
            self.review_result = self.content(result)
            self.state = 'REVIEW_DONE'
        except Exception as exc:
            self.verified_init = False
            self.state = 'ERROR'
            self.error = type(exc).__name__

    async def handle(self, request: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(request, dict) or not hmac.compare_digest(str(request.get('token', '')), self.config['token']):
            return {'state': 'UNKNOWN', 'reason': 'unauthorized'}
        command = request.get('command')
        if command == 'status':
            return self.status()
        if command == 'plan':
            if self.state == 'PLAN_READY':
                return {'state': 'READY', 'session_id': self.config['session_id'], 'plan': self.plan}
            return {'state': 'WAIT' if self.state in ('STARTING', 'PLAN_STARTING', 'PLAN_RUNNING') else 'UNKNOWN', 'status': self.status()}
        if command == 'idle':
            return {'state': 'IDLE' if self.state in ('PLAN_READY', 'BUILD_DONE', 'REVIEW_DONE') else 'UNKNOWN',
                    'session_id': self.config['session_id'], 'source': 'live persistent SDK worker'}
        if command == 'revise_plan':
            async with self.guard:
                prompt = request.get('prompt')
                if self.state != 'PLAN_READY' or request.get('plan') != self.plan or not isinstance(prompt, str) or not prompt.strip():
                    return {'state': 'UNKNOWN', 'reason': 'revision requires the exact preceding plan'}
                self.state = 'PLAN_STARTING'
                self.task = asyncio.create_task(self.run_plan(prompt))
                return {'state': 'WAIT', 'session_id': self.config['session_id']}
        if command == 'close':
            async with self.guard:
                if self.state not in ('PLAN_READY', 'REVIEW_DONE'):
                    return {'state': 'UNKNOWN', 'reason': 'worker is not at a safe terminal point'}
                self.shutdown_requested = True
                self.state = 'CLOSING'
                return {'state': 'CLOSING', 'session_id': self.config['session_id']}
        if command == 'build':
            async with self.guard:
                serialized = json.dumps(self.plan, ensure_ascii=False, separators=(',', ':')).encode()
                plan_digest = 'sha256:' + hashlib.sha256(serialized).hexdigest()
                if self.config.get('mode') != 'implement' or self.state != 'PLAN_READY' or request.get('plan') != self.plan or request.get('plan_digest') != plan_digest:
                    return {'state': 'UNKNOWN', 'reason': 'plan binding or worker state mismatch'}
                prompt = request.get('prompt')
                if not isinstance(prompt, str) or not prompt.strip():
                    return {'state': 'UNKNOWN', 'reason': 'build prompt required'}
                self.state = 'BUILD_STARTING'  # reserve before responding; never duplicate a build.
                self.task = asyncio.create_task(self.run_build(prompt))
                return {'state': 'WAIT', 'session_id': self.config['session_id']}
        if command == 'build_status':
            if self.state == 'BUILD_DONE':
                return {'state': 'READY', 'session_id': self.config['session_id'], 'result': self.build_result}
            return {'state': 'WAIT' if self.state in ('BUILD_STARTING', 'BUILD_RUNNING') else 'UNKNOWN', 'status': self.status()}
        if command == 'review':
            async with self.guard:
                if self.config.get('mode') != 'implement' or self.state != 'BUILD_DONE':
                    return {'state': 'UNKNOWN', 'reason': 'review requires a completed implementation'}
                prompt = request.get('prompt')
                if not isinstance(prompt, str) or not prompt.strip():
                    return {'state': 'UNKNOWN', 'reason': 'review prompt required'}
                self.state = 'REVIEW_STARTING'
                self.task = asyncio.create_task(self.run_review(prompt))
                return {'state': 'WAIT', 'session_id': self.config['session_id']}
        if command == 'review_status':
            if self.state == 'REVIEW_DONE':
                return {'state': 'READY', 'session_id': self.config['session_id'], 'result': self.review_result}
            return {'state': 'WAIT' if self.state in ('REVIEW_STARTING', 'REVIEW_RUNNING') else 'UNKNOWN', 'status': self.status()}
        return {'state': 'UNKNOWN', 'reason': 'unknown command'}


async def serve(config: dict[str, Any], worker: Worker) -> None:
    root = Path(config['ipc_dir'])
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Retain the exclusive process claim after exit or crash. Starting another
    # process with the same config must never silently fork a ticket session.
    fd = os.open(root / 'owner.lock', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump({'pid': os.getpid(), 'session_id': config['session_id']}, f)
        f.flush()
        os.fsync(f.fileno())
    requests, responses = root / 'requests', root / 'responses'
    requests.mkdir(mode=0o700, parents=True, exist_ok=True)
    responses.mkdir(mode=0o700, parents=True, exist_ok=True)
    await worker.client.connect()
    worker.task = asyncio.create_task(worker.run_plan())
    try:
        while not worker.shutdown_requested:
            for request_path in sorted(requests.glob('*.json')):
                if not request_path.is_file() or request_path.is_symlink():
                    continue
                try:
                    if request_path.stat().st_size > MAX_REQUEST:
                        raise ValueError('request too large')
                    request = json.loads(request_path.read_text())
                    result = await worker.handle(request)
                except Exception:
                    result = {'state': 'UNKNOWN', 'reason': 'invalid request'}
                response_path = responses / request_path.name
                # The mailbox is private and each request has a random unique name.
                if not response_path.exists():
                    tmp = responses / (request_path.name + '.tmp')
                    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                    with os.fdopen(fd, 'w') as f:
                        json.dump(result, f, ensure_ascii=False)
                        f.flush()
                        os.fsync(f.fileno())
                    os.replace(tmp, response_path)
                request_path.unlink(missing_ok=True)
            await asyncio.sleep(0.1)
    finally:
        if worker.task and not worker.task.done():
            worker.task.cancel()
        await worker.client.disconnect()
        marker = root / 'terminated.json'
        fd = os.open(marker, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump({'session_id': config['session_id'], 'state': 'STOPPED'}, f)
            f.flush()
            os.fsync(f.fileno())


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('configuration file required')
    config_path = Path(sys.argv[1])
    if config_path.stat().st_mode & 0o077:
        raise SystemExit('configuration must be owner-only')
    config = json.loads(config_path.read_text())
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, HookMatcher, ResultMessage, SystemMessage
    holder: dict[str, Worker] = {}

    async def hook(data: dict[str, Any], tool_use_id: Any, context: Any) -> dict[str, Any]:
        return await holder['worker'].pre_tool_use(data, tool_use_id, context)

    options = ClaudeAgentOptions(session_id=config['session_id'], cwd=config['worktree'], permission_mode='plan',
        cli_path=config['claude_path'], system_prompt={'type':'preset','preset':'claude_code'},
        tools=['Read','Glob','Grep','Bash','Edit','Write','Skill','Agent'],
        extra_args={'restricted': None, 'permission-prompts': 'none'},
        strict_mcp_config=True, hooks={'PreToolUse': [HookMatcher(hooks=[hook], on_failure='block')]})
    client = ClaudeSDKClient(options=options)
    holder['worker'] = Worker(config, client, SystemMessage, ResultMessage)
    asyncio.run(serve(config, holder['worker']))


if __name__ == '__main__':
    main()
