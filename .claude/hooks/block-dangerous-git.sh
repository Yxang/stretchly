#!/bin/bash
# PreToolUse hook: Block dangerous git operations
# Configure in .claude/settings.local.json under hooks.PreToolUse
#
# This hook receives JSON on stdin with the tool input.
# It outputs JSON with a decision: "approve" or "block" (with reason).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Block direct push to main or dev
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*\b(main|dev)\b'; then
  echo '{"decision": "block", "reason": "Direct push to main or dev is forbidden. Use feature branches and let Architect merge via squash merge."}'
  exit 0
fi

# Block force push
if echo "$COMMAND" | grep -qE 'git\s+push\s+.*--force\b'; then
  echo '{"decision": "block", "reason": "Force push is forbidden unless explicitly approved by Architect. Use --force-with-lease if absolutely necessary."}'
  exit 0
fi

# Block hard reset
if echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard'; then
  echo '{"decision": "block", "reason": "git reset --hard is destructive. Consider git stash or git checkout for specific files instead."}'
  exit 0
fi

# Block dangerous rm operations
if echo "$COMMAND" | grep -qE 'rm\s+(-rf?|--recursive).*(/|\.\.)'; then
  echo '{"decision": "block", "reason": "Recursive delete on broad paths is blocked. Be specific about what you are deleting."}'
  exit 0
fi

# Allow everything else
echo '{"decision": "approve"}'
