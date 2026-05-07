#!/bin/bash
# PreToolUse hook: Enforce worktree boundary for per-task agents.
# Configure in .claude/settings.json under hooks.PreToolUse with matcher Edit|Write|MultiEdit.
#
# Stdin is PreToolUse JSON (tool_name, tool_input, cwd, ...).
# Output is a JSON decision: approve, or block with a reason.
#
# Decision logic (scope C, v5.3.0 T004b):
#   Identity is inferred from the *target path* (tool_input.file_path), not from CWD.
#   1. Target outside any worktree         -> approve (not governed by this hook)
#   2. CWD outside any worktree             -> approve (architect/coordinator on main repo)
#   3. CWD worktree == target worktree     -> approve (in-worktree edit)
#   4. CWD worktree != target worktree     -> block (cross-worktree write)
#
# Exempt paths (writable from any per-task agent):
#   docs/team/, docs/dev-log/, __tests__/, *.test.*, *.spec.*

set -eu

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "MultiEdit" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

if [[ -z "$FILE_PATH" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

CWD=$(pwd)

# Resolve file path to absolute (CWD only used for relative->absolute, not for identity).
resolve_path() {
  local path="$1"
  if [[ "$path" != /* ]]; then
    path="$CWD/$path"
  fi
  if command -v python3 &>/dev/null; then
    python3 - "$path" <<'PYEOF'
import os, sys
p = sys.argv[1]
if os.path.exists(p):
    print(os.path.realpath(p))
else:
    print(os.path.normpath(p))
PYEOF
  else
    echo "$path"
  fi
}

RESOLVED_PATH=$(resolve_path "$FILE_PATH")

# Exempt paths — always approved regardless of worktree layout.
if echo "$RESOLVED_PATH" | grep -qE '/docs/(team|dev-log)/'; then
  echo '{"decision": "approve"}'
  exit 0
fi
if echo "$RESOLVED_PATH" | grep -qE '(/__tests__/|\.(test|spec)\.)'; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Extract worktree root from a path, or empty if not inside a worktree.
# Supported worktree names: T<digits>[<lowercase-letters>]  (e.g. T001, T004a, T004b)
extract_worktree_root() {
  local p="$1"
  echo "$p" | sed -nE 's|^(.*/worktrees/T[0-9]+[a-z]*)(/.*)?$|\1|p'
}

TARGET_WT=$(extract_worktree_root "$RESOLVED_PATH")
CWD_WT=$(extract_worktree_root "$CWD")

# Rule 1: target not in any worktree -> not governed by this hook.
if [[ -z "$TARGET_WT" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Rule 2: CWD not in any worktree (architect/coordinator/main repo) -> approve.
if [[ -z "$CWD_WT" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Rule 3: same worktree -> approve.
if [[ "$TARGET_WT" == "$CWD_WT" ]]; then
  echo '{"decision": "approve"}'
  exit 0
fi

# Rule 4: different worktrees -> block.
CWD_TASK=$(basename "$CWD_WT")
TARGET_TASK=$(basename "$TARGET_WT")
echo "{\"decision\": \"block\", \"reason\": \"Cross-worktree write blocked. You are operating in worktree ${CWD_TASK} but the target path is in worktree ${TARGET_TASK}. Move to the correct worktree, or ask the architect to coordinate the change.\"}"
exit 0
