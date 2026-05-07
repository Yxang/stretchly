#!/bin/bash
# PostToolUse hook: Log file edits for Chronicler and HR tracking
# Configure in .claude/settings.local.json under hooks.PostToolUse
# Matcher: Edit|Write|MultiEdit
#
# This hook receives JSON on stdin with the tool input and result.
# It appends a log entry to .claude/logs/file-changes.log

INPUT=$(cat)

# Extract relevant fields
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Ensure log directory exists
LOG_DIR=".claude/logs"
mkdir -p "$LOG_DIR"

# Append log entry
echo "${TIMESTAMP} | ${TOOL_NAME} | ${FILE_PATH}" >> "${LOG_DIR}/file-changes.log"
