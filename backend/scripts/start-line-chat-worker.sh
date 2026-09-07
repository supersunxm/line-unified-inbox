#!/bin/sh
set -eu

if [ "${LINE_CHAT_MANUAL_READINESS_DRY_RUN_ENABLED:-false}" = "true" ]; then
  STORES="${LINE_CHAT_MANUAL_READINESS_DRY_RUN_STORES:-}"
  OUTPUT="${LINE_CHAT_MANUAL_READINESS_DRY_RUN_OUTPUT:-/tmp/line-chat-manual-readiness.csv}"

  echo "{\"event\":\"line_chat_manual_readiness_bootstrap_started\",\"stores\":\"${STORES}\",\"output\":\"${OUTPUT}\"}"

  set +e
  if [ -n "$STORES" ]; then
    npx tsx scripts/line-chat-manual-readiness-dry-run.ts --stores="$STORES" --output="$OUTPUT"
  else
    npx tsx scripts/line-chat-manual-readiness-dry-run.ts --output="$OUTPUT"
  fi
  SCAN_EXIT_CODE=$?
  set -e

  echo "{\"event\":\"line_chat_manual_readiness_bootstrap_finished\",\"exitCode\":${SCAN_EXIT_CODE}}"
fi

exec node dist/line-chat/line-chat-nickname-worker.js
