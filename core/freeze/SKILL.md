---
name: freeze
version: 0.1.0
description: Restrict Edit and Write to one directory for the session — every file outside the boundary is blocked, not warned. Use when asked to "freeze edits", "restrict edits to <dir>", "only edit this folder", "lock the editing scope", or while debugging, to stop unrelated code being "fixed" along the way. Clear it with /unfreeze. (kstack)
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "bash \"$HOME/.claude/skills/freeze/bin/check-freeze.sh\""
          statusMessage: "Checking freeze boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: "bash \"$HOME/.claude/skills/freeze/bin/check-freeze.sh\""
          statusMessage: "Checking freeze boundary..."
---

# freeze — restrict edits to one directory

## When to invoke

Work should touch exactly one directory and nothing else: debugging one module,
a scoped refactor, or any session where "while I was there I also fixed…" is the
failure you are guarding against. Invoke on "freeze", "restrict edits", "only
edit this folder", "lock down edits".

Not for guarding destructive shell commands — that is `/careful`. Run both when
you want the edit boundary and the command guard together.

## Set the boundary

1. **Get the directory.** If the user named one, use it. If not, ask which
   directory to restrict edits to — a typed path, not a multiple choice. Do not
   guess from the current working directory; a boundary the user did not choose
   is worse than none, because it reads as enforced.

2. **Resolve it to an absolute path** and confirm it exists:

   ```bash
   FREEZE_DIR=$(cd "<user-provided-path>" 2>/dev/null && pwd -P)
   echo "$FREEZE_DIR"
   ```

   Empty output means the directory does not exist — say so and stop, rather
   than writing a boundary nothing can ever match.

3. **Write it with a trailing slash** to the state file:

   ```bash
   FREEZE_DIR="${FREEZE_DIR%/}/"
   STATE_DIR="${KSTACK_STATE:-$HOME/.kstack}"
   mkdir -p "$STATE_DIR"
   printf '%s\n' "$FREEZE_DIR" > "$STATE_DIR/freeze-dir.txt"
   echo "Freeze boundary set: $FREEZE_DIR"
   ```

   `${KSTACK_STATE:-$HOME/.kstack}/freeze-dir.txt` is the contract between this
   procedure and `bin/check-freeze.sh`, which reads the identical expression.
   Never write the boundary anywhere else: a writer and a reader that disagree
   produce a boundary that is set, reported, and never enforced — and the
   failure is silent, in the direction that allows everything.

   The trailing `/` is what stops `/src` from matching `/src-old`.

4. **Tell the user** the boundary is set, that Edit and Write outside it are
   blocked, that `/freeze` again changes it, and `/unfreeze` removes it.

## What is enforced, and by what mechanism

**Hook-enforced on Claude Code.** The frontmatter registers `PreToolUse` hooks
on `Edit` and `Write`; the harness runs `bin/check-freeze.sh` before each call
and honors a `deny`. The model's cooperation is not part of the mechanism.

**On a host without `PreToolUse` hooks this degrades to prompt-level advice** —
the boundary becomes a request, and nothing checks it. State which host you are
on before telling anyone edits are blocked.

**This is not a security boundary even where the hook runs.** Only `Edit` and
`Write` are matched. `Read`, `Glob`, and `Grep` are unaffected by design, and a
Bash command (`sed -i`, `tee`, a script) writes wherever it likes. It prevents
accidents, not a determined agent and not an attacker.

## Fail-closed polarity

An unreadable payload **denies**. No JSON parser on `PATH`, a payload that is
not valid JSON, or a missing helper file all produce `deny` with a reason. This
is the opposite of `/careful`, which asks in the same situations, and the
asymmetry is deliberate: careful gates a decision a human is about to make
anyway, while freeze asserts a boundary, and a boundary that fails open is not a
boundary.

Two edges resolve the other way, both correctly:

- A payload that parses but carries no `file_path` is a non-file tool — allowed.
- No state file at all means the boundary was never set — allowed. Absence of a
  boundary is not a boundary of zero size.

## Path resolution

`file_path` is made absolute against the current directory, double slashes are
squeezed, a trailing slash is dropped, and symlinks are resolved through the
**final** component (bounded at 40 hops, cycle-safe) on both the file and the
boundary. Resolving only the parent would let an in-boundary symlink whose
target sits outside the boundary pass the check while the write lands outside
it. A final component that does not exist yet — the normal case for a new file —
has nothing to follow, and parent resolution is the correct answer.

Boundaries containing spaces work: the state file is trimmed at its ends only,
never internally.

## Deactivate

`/unfreeze` deletes the state file; the hooks stay registered for the session
and allow everything, since there is no boundary to enforce. Ending the session
removes the hooks.
