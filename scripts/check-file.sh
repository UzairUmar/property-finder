#!/bin/zsh
# PostToolUse hook: lint + format check the edited file with Biome, then typecheck the project.
# Reads Claude Code's hook JSON on stdin. Exit 2 feeds the findings back to Claude.
f="$(jq -r '.tool_input.file_path // empty')"
[ -z "$f" ] && exit 0
cd "$(dirname "$0")/.." || exit 0

case "$f" in
  *.ts|*.json)
    if ! out="$(npx biome check "$f" 2>&1)"; then
      printf '%s\n' "$out" >&2
      exit 2
    fi
    ;;
esac

case "$f" in
  *.ts)
    if ! out="$(npx tsc 2>&1)"; then
      printf 'tsc failed:\n%s\n' "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
