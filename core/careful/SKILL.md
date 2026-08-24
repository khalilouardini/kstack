---
name: careful
version: 0.1.0
description: Guard destructive shell commands — recursive delete, SQL DROP/TRUNCATE, force-push, git reset --hard, kubectl delete, docker prune — by asking before each one runs, and hard-denying recursive delete of / or $HOME and force-push to the default branch. Use when asked to "be careful", "safety mode", "careful mode", "prod mode", or before touching production or a shared environment. (kstack)
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "bash \"$HOME/.claude/skills/careful/bin/check-careful.sh\""
          statusMessage: "Checking for destructive commands..."
---

# careful — destructive-command guardrails

## When to invoke

You are about to work somewhere a mistake is expensive — production, a live
database, a shared cluster, someone else's checkout — and you want every
destructive command surfaced before it runs. Invoke on "be careful", "safety
mode", "careful mode", "prod mode", or before a session that touches prod.

Not for restricting *which files* get edited — that is `/freeze`. Run both when
you want the command guard and the edit boundary together.

## What is enforced, and by what mechanism

**Hook-enforced on Claude Code.** The frontmatter registers a `PreToolUse` hook
on `Bash`; the harness runs `bin/check-careful.sh` before every Bash tool call
and honors the returned decision. Nothing about this depends on the model
choosing to comply.

**On a host without `PreToolUse` hooks it degrades to prompt-level advice** —
the tables below become a checklist the agent is asked to follow, and nothing
checks that it did. Say which one you are on before claiming a command was
guarded. A guarantee whose mechanism is absent is not a guarantee.

Session-scoped either way: invoking the skill registers the hook for that
session, and ending the session removes it.

## Hard deny (HIGH tier)

Two shapes return `deny`, not `ask`:

| Shape | Example | Why deny |
|---|---|---|
| Recursive delete whose **only** targets are root-class | `rm -rf /`, `sudo rm -rf ~`, `rm -rf "$HOME"` | No recoverable intent; the whole machine |
| Force-push to the repo's **default branch** | `git push -f origin main`, `git push origin +main` | Rewrites the history everyone else pulls |

Constraints that keep the deny tier honest:

- **SIMPLE commands only.** Anything containing `;`, `&&`, `||`, `|`, or a
  newline is not eligible — string matching cannot tell what
  `cd X && git push --force` targets. Compound shapes fall through to the ask
  tier. Conservative failure is ask, never guess.
- **Recursive delete is tokenized, not regex-matched.** Options are skipped in
  any position (`--no-preserve-root` may trail the target), one layer of
  surrounding quotes is stripped, and the deny fires only when at least one
  token is root-class **and zero tokens are anything else** — so
  `rm -rf / home/me/scratch` does not deny, it asks.
- **`--force-with-lease` is never HIGH.** It is the safe variant.
- **The default branch is resolved, not assumed** — `git symbolic-ref
  refs/remotes/origin/HEAD` first, then a probe of `origin/main` and
  `origin/master`. A worktree missing the symbolic ref would otherwise make the
  whole tier silently inert. Comparison is per-token and fixed-string; a branch
  name is never interpolated into a regex.

This is a best-effort advisory hard-stop, not a policy boundary. The escape
hatch is ending the `/careful` session.

## Ask tier (MEDIUM — always overridable)

| Family | Example |
|---|---|
| `rm -r` / `-R` / `--recursive` | `rm -rf /var/data` |
| `DROP TABLE` / `DROP DATABASE` | `DROP TABLE users;` |
| `TRUNCATE` | `TRUNCATE orders;` |
| `git push --force` / `-f` / `+refspec` | `git push -f origin feature` |
| `git reset --hard` | `git reset --hard HEAD~3` |
| `git checkout .` / `git restore .` | `git checkout .` |
| `kubectl delete` | `kubectl delete pod api-0` |
| `docker rm -f` / `docker system prune` | `docker system prune -a` |

Two ask-tier behaviors that are not families:

- **Shell-obfuscation tripwire.** `${IFS}` / `$IFS` word-splitting and
  base64-decode piped to a shell ask unconditionally. Every check reads the
  command as a string, but bash executes what the string *means after
  expansion* — `rm${IFS}-rf${IFS}/` matches no `rm\s+` pattern and executes as a
  full recursive delete.
- **Unparseable payload asks.** No JSON parser on `PATH`, an unreadable payload,
  or a missing helper file all return `ask` with a reason saying so. The ask-tier
  hook fails toward asking; it never falls silent.

### Safe exception

One standalone recursive `rm` of build artifacts is allowed without asking:
`node_modules`, `.next`, `dist`, `__pycache__`, `.cache`, `build`, `.turbo`,
`coverage`. The exception matches the **complete** command, is single-line only,
and rejects command substitution in the target — `rm -rf $(./wipe-all)/node_modules`
does not ride the whitelist.

## Operator patterns (additive only)

Add warn rules — one POSIX ERE per line, `#` comments allowed — in
`${KSTACK_STATE:-$HOME/.kstack}/careful-patterns.txt`. The file is consulted
**after** the built-in families and only when none matched, so config can add
rules and can never suppress a baseline warning. An invalid regex line is
skipped rather than breaking the hook.

## Deactivate

End the conversation or start a new one — hooks are session-scoped. If you wired
the hook at project level (appendix below), remove it from
`.claude/settings.json` instead.

## Appendix — wiring the hook always-on for a repo

Skill-scoped is the default: the guard exists only in sessions where `/careful`
was invoked. A repo that wants it on for **every** session wires the same script
in `.claude/settings.json` at the project root:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$HOME/.claude/skills/careful/bin/check-careful.sh\"",
            "statusMessage": "Checking for destructive commands..."
          }
        ]
      }
    ]
  }
}
```

Same script, same decisions; the only difference is lifetime. Two consequences
worth stating before you commit that file: the hook now fires for every
contributor who has the stack installed, and it fails to `ask` for anyone who
does not (the missing-helper branch), which reads as a broken install rather
than a missing feature. Track it in the tracked `settings.json` only if both are
acceptable to the repo.
