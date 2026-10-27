# Hosts — what differs between `claude` and `codex`

Two hosts run this stack. This file describes the integration provided by this
checkout's installer and adapters; a host may support features beyond it.

| | `claude` (Claude Code) | `codex` (Codex CLI) |
|---|---|---|
| Installer output | `~/.claude/skills/<name>` | `${CODEX_HOME:-~/.codex}/skills/<name>/SKILL.md` |
| Mechanism | **symlink** per skill → the canonical directory in this repo | **generated pointer file** per skill |
| Body of the skill | read through the symlink; edits are live | never copied; the pointer sends the agent to the canonical path |
| Kstack hook registration | skill frontmatter registers `PreToolUse` | installer writes no hook configuration |
| Enforcement of `careful` / `freeze` | hook-enforced | **prompt-level in this integration** |
| Tool vocabulary in prose | named tools (`Read`, `Bash`, …) resolve | name the capability, not the tool |
| Workflow tool | Claude Code only; `/wave` runs the graph | absent; `/wave plan` runs A1 selection only and says the graph did not run; build refuses |
| Regeneration needed after an edit | no | yes, whenever frontmatter changes; body edits remain live |

## Install

**`claude`** — `bin/install` creates one symlink per skill from
`~/.claude/skills/<name>` to the canonical directory (`core/<name>/`,
`roles/<name>/`, `tools/<group>/<name>/`, `router/stack/`). Nothing is copied,
so editing a `SKILL.md` in this repo takes effect on the next invocation with no
build step. A skill's `bin/` scripts are reached *through* that symlink, which is
why every script resolves its own location with
`cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P` (CONVENTIONS §3) rather than
assuming a repo-relative path.

**`codex`** — `bin/install --host codex` generates a pointer file at
`~/.codex/skills/<name>/SKILL.md`. A pointer is not a copy of the procedure: it
carries the frontmatter fields this host reads, plus one instruction to read the
canonical file at its absolute path and follow it top to bottom. That is the
whole file. Regenerate after changing a skill's **frontmatter**; the body needs
no regeneration because it was never duplicated.

The pointer layout is this installer's existing choice. Current
[Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) lists
`.agents/skills` for repository discovery and `~/.agents/skills` for user skills,
and supports symlinked skill folders. Check the host's skill selector after
installation: writing a pointer under `~/.codex/skills` does not prove that every
host version discovers it. If needed, expose the generated directories through a
supported discovery location, preserving existing skills. Changing the installer
destination is a separate implementation change.

Project skills take precedence under kstack's routing policy. Codex can display
duplicate names, so explicitly select or read the project contract when both exist.

## Refresh after a merge

Invoke `/update-stack` to update the recorded root in
`${KSTACK_STATE:-$HOME/.kstack}/stack-root` from the remote default branch and
run that checkout's installer for both hosts. The canonical checkout must be
clean and able to fast-forward; local edits are preserved by stopping, never
stashed/reset automatically. `/update-stack --check` is read-only and labels
its remote-tracking evidence as potentially stale.

The read-only `core/update-stack/bin/installation-status` helper verifies every
expected Claude symlink and Codex pointer's target/name/version/description,
root record and source SHA. It can scan explicit projects and immediate sibling
repos plus their registered worktrees for local skill copies. Global installation
status and project-local copies are separate results, with the scan boundary
reported. Neither it nor check-stack proves what an already-running agent has
loaded; ask that session to re-read a changed skill or restart if needed.

A global reinstall does not rewrite project configuration, remove local skills,
or activate an update schedule. Use the normal installer for all adapter writes.

## Independent CLI review

pr-loop runs in the implementation engine's session. Codex implementations call
Claude Code CLI for review, then Codex fixes; Claude implementations call Codex
CLI for review, then Claude fixes. The controller reads Codex's session ID or
Claude Code's child-session marker from its shell; missing, simultaneous, or
mismatched markers block before paid work. There is no recursive whole-loop
handoff. Posting accounts are verified per command and do not establish which
engine performed the work.

The shared contract is `tools/github/pr-loop/references/routing.md`. Its runner
uses a canonical absolute review skill path, exact PR/head, closed stdin, pinned
engine-specific model/effort, captured output and checked exit status. It checks
installed CLI help/auth and submitted GitHub review evidence. Host permissions
are inherited; unavailable CLI/auth or denied actions block without bypasses or
fallback self-review. The reviewer no-write boundary remains prompt-level.

This capability does not add a Workflow tool to Codex. Native /wave build in
Codex remains unavailable; that needs a separate execution backend. Update the
canonical source and regenerate adapters only after merge via the normal
installer/update-stack flow, then re-read skills in active sessions.

## Hooks — the one difference that changes a guarantee

Claude Code reads a `hooks:` block in skill frontmatter and runs the named
command before every matching tool call, honoring the returned `deny` / `ask`
decision. That is how `core/careful` blocks `rm -rf /` and how `core/freeze`
blocks an `Edit` outside the boundary. Neither depends on the model choosing to
comply.

Current [Codex hook documentation](https://learn.chatgpt.com/docs/hooks) includes
`PreToolUse` configured through `hooks.json`, config tables, or plugins. Kstack's
Codex installer only writes pointers and registers none of those hook sources.
Both skills therefore remain **prompt-level in this integration** unless a
separate, verified adapter installs equivalent guards. Host support alone is not
evidence that a particular guard is installed. References checked 27 October 2026.

Consequences, stated so nobody has to infer them:

1. **The generated Codex pointers do not install kstack's guards.** Today that
   affects `core/careful` and `core/freeze`. Check any separately configured
   integration before claiming hook enforcement.
2. **Change what you claim, not just what you do.** On `claude`: "the command was
   blocked by the guard." On `codex`: "I checked it against the careful list" —
   which is a different, weaker sentence, and the honest one.
3. **The enforcement label in CONVENTIONS §5 is per host, not per skill.** A
   skill labelled *hook-enforced* is hook-enforced on `claude` and prompt-level
   on `codex`. The skill file says which; this file says why.
4. **Tool-list enforcement is a separate mechanism from hooks.** Claude Code's
   agent definitions carry a `tools:` allowlist the harness enforces, which is
   what makes three of the four role contracts read-only by construction. A host
   without an equivalent allowlist gives you prompt-level refusal only — verify
   before claiming a role cannot write on that host. Do not assume hooks and
   tool lists degrade together; they are independent.

The investigation rule is prompt-level on both hosts. Its optional freeze
boundary is a separate guard. Do not label the whole debugging procedure as
hook-enforced because one optional step can register a hook.

## Tool names and phrasing

Claude Code exposes tools by name — `Read`, `Write`, `Edit`, `Grep`, `Glob`,
`Bash`, and a subagent dispatch tool. Codex exposes a different surface with
different names.

**Canonical procedure text names the capability, not the harness's tool.** Write
"read the file", "run this command", "search the repo for", "dispatch the role
as a subagent". Those sentences execute correctly on both hosts and need no
rewrite rule.

Three places a Claude tool name is legitimately required, and where each belongs:

| Requirement | Where it goes |
|---|---|
| A hook matcher (`matcher: "Bash"`) | skill frontmatter — already host-specific |
| A role's `tools:` allowlist | the project's `.claude/agents/<role>.md` adapter |
| A note that a step needs a shell because no read-only alternative exists | the adapter's host-specific notes section |

Never in the procedure body. A tool name in the body is a sentence that is
subtly wrong on one of the two hosts, and the wrongness is invisible until
somebody runs it there.

## Frontmatter — which fields each host honors

| Field | `claude` | `codex` | Notes |
|---|---|---|---|
| `name` | yes | yes | invocation name; must match the directory name |
| `description` | yes — loaded every session | yes | the routing surface. 1024-byte cap, target ≤500 (CONVENTIONS §3) |
| `version` | not read by the harness | not read by the harness | read by humans and by `bin/check-stack`. See below |
| `hooks:` | yes — registers `PreToolUse` | not copied into kstack pointers | use an actual host hook configuration to register guards |
| `tools:` (role adapters) | yes — enforced allowlist | verify on the host | not a skill field; role adapters only |

This table covers fields kstack uses, not every field either host supports.
Verify additional host-specific metadata against that host's current schema.

## Adapters never restate procedure

A codex pointer file and a project's `.claude/agents/<role>.md` are both
adapters. An adapter contains exactly three things:

1. the frontmatter its host reads,
2. host-specific notes (which tools are available, what degrades here),
3. a pointer: read `<canonical path>` and follow it exactly.

It never contains the procedure. This is CONVENTIONS §4, and the reason is
specific: a second copy of a prompt drifts, and the drift stays invisible until
the two hosts return different verdicts on the same PR — at which point neither
answer is trustworthy and there is no record of which copy is current.

If an adapter *needs* to say something the canonical file does not, that is a
signal the canonical file is missing a host-neutral way to say it, or that the
content belongs in the project's `role_appendix_dir`. It is never a reason to
paste the procedure into the adapter.

## `version` is the drift detector

Bump a skill's `version` on any behavior change (CONVENTIONS §3). It exists for
exactly one job: the `codex` pointer file carries a **copy** of the frontmatter,
so a version mismatch between

```
~/.codex/skills/<name>/SKILL.md      # generated pointer
<tier>/<name>/SKILL.md               # canonical
```

is the single observable signal that the generated copy is stale and must be
regenerated. `bin/check-stack` compares them — it reads every pointer carrying
the generated-by marker under `${CODEX_HOME:-~/.codex}/skills/` and fails on a
version that differs from canonical, or on a pointer with no version at all.
Without a version bump the comparison is vacuous and a stale pointer looks
identical to a fresh one.

An absent pointer tree is not a failure: it means Codex is not installed on this
machine, which is a supported state, not drift.

On `claude` the symlink makes staleness structurally impossible, which is
exactly why the version field is easy to forget to bump — the host you develop
on never punishes you for it. Bump it anyway.

Two rules that keep the detector working:

- **Bump on behavior change, not on typo fixes.** A version that moves on every
  edit is noise and stops being read.
- **Never edit a generated pointer file by hand.** The next regeneration
  overwrites it, and until then the two hosts run different instructions with
  matching version numbers — the one failure mode the field exists to catch.

## Adding a third host

A host is a five-field tuple: install path, linking mechanism, frontmatter
fields honored, hook support, tool vocabulary. Write those five down in the
table at the top of this file **before** writing an installer branch, and write
down what degrades — without a verified hook adapter, that is at minimum
`core/careful` and `core/freeze` dropping to prompt-level.

A host whose degradations are undocumented will be claimed as equivalent to
`claude` by the next session that uses it. That claim is the failure this file
exists to prevent.
