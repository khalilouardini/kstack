---
name: unfreeze
version: 0.1.0
description: Clear the edit boundary set by /freeze so Edit and Write are allowed everywhere again, reporting what the boundary was. Use when asked to "unfreeze", "unlock edits", "remove the freeze", "clear the edit boundary", or "allow all edits". (khalilou-stack)
---

# unfreeze — clear the freeze boundary

## When to invoke

The edit boundary set by `/freeze` needs to widen and the session should
continue. Invoke on "unfreeze", "unlock edits", "remove freeze", "allow all
edits".

## Clear it

```bash
STATE_DIR="${KSTACK_STATE:-$HOME/.kstack}"
if [ -f "$STATE_DIR/freeze-dir.txt" ]; then
  PREV=$(head -n 1 "$STATE_DIR/freeze-dir.txt")
  rm -f "$STATE_DIR/freeze-dir.txt"
  echo "Freeze boundary cleared (was: $PREV). Edits are now allowed everywhere."
else
  echo "No freeze boundary was set."
fi
```

Read the previous value **before** deleting the file — the point of this skill
is that the user learns what was lifted, not just that something was.
`${KSTACK_STATE:-$HOME/.kstack}/freeze-dir.txt` is the same path `/freeze` writes
and `check-freeze.sh` reads; do not resolve the state directory any other way.

## Report

Tell the user the result verbatim from the command, then one line of
consequence: the `/freeze` hooks remain registered for the rest of the session
and now allow every path, because no state file exists for them to read. To set
a new boundary, run `/freeze` again.
