#!/usr/bin/env bash
# check-freeze.sh — PreToolUse hook for the /freeze skill
# Reads JSON from stdin, checks if file_path is within the freeze boundary.
# Returns a PreToolUse hookSpecificOutput with permissionDecision "deny" to block,
# or {} to allow. The decision MUST be nested under hookSpecificOutput — Claude
# Code ignores a top-level permissionDecision, which silently no-ops the block.
#
# Polarity: freeze is a DENY-tier hook, so an unreadable payload DENIES
# (fail closed). A payload that parses but has no file_path is a non-file
# tool — allow. This is the opposite edge-handling from careful's ask-tier
# and intentionally so: both hooks can be active at once, and a boundary that
# fails open is not a boundary.
set -euo pipefail

# Read stdin
INPUT=$(cat)

# Shared JSON helpers (extractor + encoder) — one copy for careful AND freeze,
# owned by core/careful/bin/ and reached by physical path. pwd -P resolves the
# PHYSICAL directory, so ../../careful/bin/hook-extract.sh lands in the same
# checkout whether this script ran through the ~/.claude/skills/freeze symlink
# or directly from the repo.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=core/careful/bin/hook-extract.sh
# Freeze is deny-tier: if its own helpers are missing/broken (partial install,
# mid-upgrade state), the boundary must fail CLOSED — inline JSON, since the
# encoder we would normally use lives in the file that just failed to load.
# NOTE: bash treats `.` on a MISSING file as fatal in non-interactive shells
# (an if-guard cannot catch it) — the existence check must come first.
_HOOK_HELPER="$SCRIPT_DIR/../../careful/bin/hook-extract.sh"
if [ ! -f "$_HOOK_HELPER" ] || ! . "$_HOOK_HELPER" 2>/dev/null; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"[freeze] Hook helpers unavailable (broken install?) - blocked, fail closed. Reinstall the stack or run /unfreeze."}}\n'
  exit 0
fi

# Locate the freeze directory state file. This resolution is the CONTRACT: the
# /freeze skill writes the boundary to exactly this path, and this hook reads
# exactly this path. Any asymmetry between writer and reader produces a boundary
# that is set but never enforced — silently, in the direction that fails open.
STATE_DIR="${KSTACK_STATE:-$HOME/.kstack}"
FREEZE_FILE="$STATE_DIR/freeze-dir.txt"

# If no freeze file exists, allow everything (not yet configured)
if [ ! -f "$FREEZE_FILE" ]; then
  echo '{}'
  exit 0
fi

# First line, trimmed of LEADING/TRAILING whitespace only. A `tr -d '[:space:]'`
# would delete INTERNAL spaces too, so a boundary like "~/My Project/src" could
# never match anything — every edit denied (or the mangled path accidentally
# allowing the wrong tree).
FREEZE_DIR=$(head -n 1 "$FREEZE_FILE" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
# A literal leading ~ in the state file never matches absolute tool paths
# (tilde is not expanded from variables) — expand it here.
case "$FREEZE_DIR" in
  "~/"*) FREEZE_DIR="$HOME/${FREEZE_DIR#\~/}" ;;
  "~") FREEZE_DIR="$HOME" ;;
esac

# If freeze dir is empty, allow
if [ -z "$FREEZE_DIR" ]; then
  echo '{}'
  exit 0
fi

# Extract file_path from tool_input with the shared real-JSON parser.
set +e
FILE_PATH=$(kstack_hook_extract_field "$INPUT" file_path)
EXTRACT_RC=$?
set -e

# Empty payload: DENY. Execution only reaches here with a boundary configured
# (the no-boundary case returned above), and a PreToolUse hook always receives a
# JSON payload — empty stdin means the invocation is broken, not that the tool
# call is harmless. Allowing here is the same fail-open the deny polarity exists
# to prevent, and it is reachable: an upstream wrapper that swallows stdin
# disables the boundary silently, with no error anywhere.
if [ -z "$INPUT" ]; then
  kstack_hook_decision deny "[freeze] No tool payload received, so the target file cannot be checked against the boundary. Blocked (fail closed). Freeze boundary: $FREEZE_DIR"
  exit 0
fi

# Unparseable payload (or no parser available): DENY. A boundary hook that
# allows what it cannot read is not a boundary.
if [ "$EXTRACT_RC" -ne 0 ]; then
  kstack_hook_decision deny "[freeze] Could not parse the tool payload to check the freeze boundary. Blocked (fail closed). Freeze boundary: $FREEZE_DIR"
  exit 0
fi

# Parsed fine but no file_path field: a non-file tool payload — allow.
if [ -z "$FILE_PATH" ]; then
  echo '{}'
  exit 0
fi

# Resolve file_path to absolute if it isn't already
case "$FILE_PATH" in
  /*) ;; # already absolute
  *)
    FILE_PATH="$(pwd)/$FILE_PATH"
    ;;
esac

# Normalize: remove double slashes and trailing slash
FILE_PATH=$(printf '%s' "$FILE_PATH" | sed 's|/\+|/|g;s|/$||')

# Resolve symlinks and .. sequences (POSIX-portable, works on macOS).
# The FULL path is resolved, including the FINAL component: resolving only the
# parent directory lets an in-boundary symlink pointing at an out-of-boundary
# target sail through the check while the actual write lands outside the
# boundary. A final component that is a symlink is followed (bounded,
# cycle-safe) so the TARGET gets checked; a final component that does not exist
# yet (new file) has nothing to follow and parent resolution is correct.
_resolve_path() {
  local _p="$1" _dir _base _tail _tgt _i=0
  while [ -L "$_p" ] && [ "$_i" -lt 40 ]; do
    _tgt=$(readlink "$_p" 2>/dev/null) || break
    case "$_tgt" in
      /*) _p="$_tgt" ;;
      *) _p="$(dirname "$_p")/$_tgt" ;;
    esac
    _i=$((_i + 1))
  done
  # Resolve the deepest ancestor that EXISTS, then re-append the components that
  # do not exist yet. `cd`-ing only the immediate parent is not enough: creating
  # a file in a not-yet-created subdirectory leaves the whole path unresolved, so
  # on any system where an ancestor is a symlink (macOS /tmp -> /private/tmp) an
  # in-boundary write compares raw-vs-physical and is wrongly denied.
  _dir="$(dirname "$_p")"
  _base="$(basename "$_p")"
  _tail="$_base"
  while [ ! -d "$_dir" ] && [ "$_dir" != "/" ] && [ "$_dir" != "." ]; do
    _tail="$(basename "$_dir")/$_tail"
    _dir="$(dirname "$_dir")"
  done
  _dir="$(cd "$_dir" 2>/dev/null && pwd -P || printf '%s' "$_dir")"
  printf '%s/%s' "$_dir" "$_tail"
}
FILE_PATH=$(_resolve_path "$FILE_PATH")
FREEZE_DIR=$(_resolve_path "$FREEZE_DIR")

# Check: does the file path start with the freeze directory?
case "$FILE_PATH" in
  "${FREEZE_DIR}/"*|"${FREEZE_DIR}")
    # Inside freeze boundary — allow
    echo '{}'
    ;;
  *)
    # Outside freeze boundary — deny.
    # The reason is JSON-encoded by the shared helper. Never interpolate paths
    # into hand-built JSON: a path containing a quote or newline produces
    # malformed JSON here, and the deny silently no-ops.
    kstack_hook_decision deny "[freeze] Blocked: $FILE_PATH is outside the freeze boundary ($FREEZE_DIR). Only edits within the frozen directory are allowed."
    ;;
esac
