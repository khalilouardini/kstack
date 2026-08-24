# Hosts — what differs between `claude` and `codex`

Two hosts run this stack. This file is the only place the differences are
written down; skills and adapters point here instead of restating them.

| | `claude` (Claude Code) | `codex` (Codex CLI) |
|---|---|---|
| Install path | `~/.claude/skills/<name>` | `~/.codex/skills/<name>/SKILL.md` |
| Mechanism | **symlink** per skill → the canonical directory in this repo | **generated pointer file** per skill |
| Body of the skill | read through the symlink; edits are live | never copied; the pointer sends the agent to the canonical path |
| `hooks:` frontmatter | honored — registers `PreToolUse` | **not read** |
| Enforcement of `careful` / `freeze` | hook-enforced | **prompt-level only** |
| Tool vocabulary in prose | named tools (`Read`, `Bash`, …) resolve | name the capability, not the tool |
| Regeneration needed after an edit | no, except frontmatter for the codex copy | yes, whenever frontmatter changes |

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

Symlink-vs-pointer is the only structural difference in install. It exists
because Codex resolves skills from its own directory and does not follow the
same layout, not because the two hosts need different content.

## Hooks — the one difference that changes a guarantee

Claude Code reads a `hooks:` block in skill frontmatter and runs the named
command before every matching tool call, honoring the returned `deny` / `ask`
decision. That is how `core/careful` blocks `rm -rf /` and how `core/freeze`
blocks an `Edit` outside the boundary. Neither depends on the model choosing to
comply.

**Codex has no `PreToolUse` hook mechanism, and the `hooks:` block is not read.**
On that host both skills degrade to **prompt-level**: their tables become a
checklist the agent is asked to follow, and nothing checks that it did.

Consequences, stated so nobody has to infer them:

1. **Every skill that claims hook enforcement must be read as advisory on
   `codex`.** Today that is `core/careful` and `core/freeze`; the same applies to
   anything added later with a `hooks:` block.
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

There is no workaround that restores enforcement on a host without hooks. The
correct response is the accurate claim, not a louder prompt.

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
| `hooks:` | yes — registers `PreToolUse` | **no** | the enforcement gap above |
| `tools:` (role adapters) | yes — enforced allowlist | verify on the host | not a skill field; role adapters only |

Anything else in frontmatter is ignored by both. Adding a field because another
harness's docs mention it produces a file that looks configured and is not.

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
down what degrades — for any host without `PreToolUse`, that is at minimum
`core/careful` and `core/freeze` dropping to prompt-level.

A host whose degradations are undocumented will be claimed as equivalent to
`claude` by the next session that uses it. That claim is the failure this file
exists to prevent.
