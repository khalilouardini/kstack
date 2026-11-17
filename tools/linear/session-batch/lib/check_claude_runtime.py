#!/usr/bin/env python3
"""Check SDK/CLI control handshake without a model prompt or tracker data."""
import asyncio
import sys
import uuid

async def main():
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, HookMatcher
    async def hook(_data, _tool_id, _context):
        return {'hookSpecificOutput': {'hookEventName':'PreToolUse', 'permissionDecision':'deny', 'permissionDecisionReason':'runtime probe'}}
    options=ClaudeAgentOptions(session_id=str(uuid.uuid4()), cwd=sys.argv[2], cli_path=sys.argv[1],
        permission_mode='plan', tools=['Read','Glob','Grep'], strict_mcp_config=True,
        extra_args={'restricted':None,'permission-prompts':'none'},
        hooks={'PreToolUse':[HookMatcher(hooks=[hook],on_failure='block')]})
    client=ClaudeSDKClient(options=options)
    await client.connect()
    await client.disconnect()

if __name__=='__main__':
    if len(sys.argv)!=3:
        raise SystemExit('Claude CLI path and repository required')
    asyncio.run(main())
