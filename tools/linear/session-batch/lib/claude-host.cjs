'use strict';

// Read-only discovery. A registry entry proves neither permissions nor that
// creating/resuming this session is idempotent. In particular Claude may fork
// a running session, or a stopped session resumed with changed options.
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const path = require('node:path');
const execFileAsync = promisify(execFile);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createClaudeHost({run = execFileAsync, command = 'claude', timeout = 10000} = {}) {
  return {
    // The host currently offers no proven exclusive, idempotent create/resume
    // contract. The controller must reject this adapter before calling launch.
    idempotentSessionCreation: false,
    async inspectSession({repo, session_id}) {
      if (typeof repo !== 'string' || !path.isAbsolute(repo) || typeof session_id !== 'string' || !UUID.test(session_id))
        return {state:'UNKNOWN', reason:'absolute repo and full session UUID required'};
      let entries;
      try {
        const result = await run(command, ['agents','--all','--json','--cwd',repo],
          {cwd:repo, timeout, maxBuffer:1024*1024, encoding:'utf8'});
        entries = JSON.parse(result.stdout);
      } catch {
        return {state:'UNKNOWN', reason:'Claude session registry unavailable or invalid'};
      }
      if (!Array.isArray(entries)) return {state:'UNKNOWN', reason:'Claude session registry is not an array'};
      const matches = entries.filter(e=>e && e.sessionId===session_id);
      if (matches.length !== 1) return {state:'UNKNOWN', reason:'session UUID missing or duplicated in registry'};
      const entry=matches[0];
      if (entry.cwd!==repo || typeof entry.id!=='string' || !entry.id ||
          !['background','interactive'].includes(entry.kind) ||
          !['running','blocked','stopped','completed'].includes(entry.state))
        return {state:'UNKNOWN', reason:'registry entry does not establish the requested session and workspace'};
      return {state:'OBSERVED', session_id, short_id:entry.id, repo:entry.cwd,
        kind:entry.kind, host_state:entry.state, started_at:entry.startedAt ?? null,
        source:'claude agents --all --json --cwd',
        limitation:'registry does not attest permission mode, issue, branch, worktree binding or tracker status'};
    },
    async ensureSession() {
      return {state:'UNKNOWN', reason:'exclusive idempotent session creation and actual plan-mode lifecycle are unverified'};
    }
  };
}

module.exports = {createClaudeHost, createAdapter:createClaudeHost};
