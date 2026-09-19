#!/bin/sh
set -eu

if [ "${LINE_CHAT_OA_FLEET_DISCOVERY_ENABLED:-false}" = "true" ]; then
  SESSIONS="${LINE_CHAT_OA_FLEET_DISCOVERY_SESSIONS:-profile-b,account-1}"
  DISCOVERY_OUTPUT="${LINE_CHAT_OA_FLEET_DISCOVERY_OUTPUT:-/tmp/line-chat-fleet-oa-discovery.csv}"

  echo "{\"event\":\"line_chat_fleet_oa_network_discovery_bootstrap_started\",\"sessions\":\"${SESSIONS}\",\"output\":\"${DISCOVERY_OUTPUT}\"}"

  set +e
  npx tsx scripts/line-chat-fleet-oa-network-discovery.ts --sessions="$SESSIONS" --output="$DISCOVERY_OUTPUT"
  DISCOVERY_EXIT_CODE=$?
  set -e

  echo "{\"event\":\"line_chat_fleet_oa_network_discovery_bootstrap_finished\",\"exitCode\":${DISCOVERY_EXIT_CODE}}"
fi

if [ "${LINE_CHAT_FLEET_MAPPING_ENABLED:-false}" = "true" ]; then
  MAPPING_SESSIONS="${LINE_CHAT_FLEET_MAPPING_SESSIONS:-profile-b,account-1}"
  MAPPING_APPLY="${LINE_CHAT_FLEET_MAPPING_APPLY:-false}"

  echo "{\"event\":\"line_chat_fleet_exact_mapping_bootstrap_started\",\"sessions\":\"${MAPPING_SESSIONS}\",\"apply\":\"${MAPPING_APPLY}\"}"

  set +e
  if [ "$MAPPING_APPLY" = "true" ]; then
    npx tsx scripts/line-chat-fleet-exact-mapping-apply.ts --sessions="$MAPPING_SESSIONS" --apply
  else
    npx tsx scripts/line-chat-fleet-exact-mapping-apply.ts --sessions="$MAPPING_SESSIONS"
  fi
  MAPPING_EXIT_CODE=$?
  set -e

  echo "{\"event\":\"line_chat_fleet_exact_mapping_bootstrap_finished\",\"exitCode\":${MAPPING_EXIT_CODE}}"
fi

if [ "${LINE_CHAT_ENSURE_MANUAL_RESPONSE_ENABLED:-false}" = "true" ]; then
  RESPONSE_STORES="${LINE_CHAT_ENSURE_MANUAL_RESPONSE_STORES:-25610,27627,25391,24804,27789,3791}"
  RESPONSE_APPLY="${LINE_CHAT_ENSURE_MANUAL_RESPONSE_APPLY:-false}"

  echo "{\"event\":\"line_chat_response_method_bootstrap_started\",\"stores\":\"${RESPONSE_STORES}\",\"apply\":\"${RESPONSE_APPLY}\"}"

  set +e
  if [ "$RESPONSE_APPLY" = "true" ]; then
    npx tsx scripts/line-chat-ensure-manual-response.ts --stores="$RESPONSE_STORES" --apply
  else
    npx tsx scripts/line-chat-ensure-manual-response.ts --stores="$RESPONSE_STORES"
  fi
  RESPONSE_EXIT_CODE=$?
  set -e

  echo "{\"event\":\"line_chat_response_method_bootstrap_finished\",\"exitCode\":${RESPONSE_EXIT_CODE}}"
fi

# One-shot confirmed outbound recovery. Disabled by default and scoped by explicit targets.
if [ "${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_ENABLED:-false}" = "true" ]; then
  RECOVERY_STORE="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_STORE:-27627}"
  RECOVERY_CUSTOMERS="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_CUSTOMERS:-}"
  RECOVERY_CONVERSATIONS="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_CONVERSATIONS:-}"
  RECOVERY_FROM="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_FROM:-}"
  RECOVERY_TO="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_TO:-}"
  RECOVERY_APPLY="${LINE_CHAT_RECOVER_CONFIRMED_OUTBOUNDS_APPLY:-false}"

  echo "{\"event\":\"confirmed_outbound_recovery_bootstrap_started\",\"store\":\"${RECOVERY_STORE}\",\"apply\":\"${RECOVERY_APPLY}\"}"

  set +e
  if [ "$RECOVERY_APPLY" = "true" ]; then
    npx tsx scripts/recover-confirmed-failed-outbounds.ts --store="$RECOVERY_STORE" --customers="$RECOVERY_CUSTOMERS" --conversation-ids="$RECOVERY_CONVERSATIONS" --from="$RECOVERY_FROM" --to="$RECOVERY_TO" --apply
  else
    npx tsx scripts/recover-confirmed-failed-outbounds.ts --store="$RECOVERY_STORE" --customers="$RECOVERY_CUSTOMERS" --conversation-ids="$RECOVERY_CONVERSATIONS" --from="$RECOVERY_FROM" --to="$RECOVERY_TO"
  fi
  RECOVERY_EXIT_CODE=$?
  set -e

  echo "{\"event\":\"confirmed_outbound_recovery_bootstrap_finished\",\"exitCode\":${RECOVERY_EXIT_CODE}}"
fi

if [ "${LINE_CHAT_VERIFY_FAILED_OUTBOUNDS_ENABLED:-false}" = "true" ]; then
  echo "{\"event\":\"failed_manager_outbound_presence_audit_bootstrap_started\"}"
  set +e
  npx tsx scripts/inspect-failed-manager-outbounds.ts
  PRESENCE_AUDIT_EXIT_CODE=$?
  set -e
  echo "{\"event\":\"failed_manager_outbound_presence_audit_bootstrap_finished\",\"exitCode\":${PRESENCE_AUDIT_EXIT_CODE}}"
fi

if [ "${LINE_CHAT_AUDIT_MANAGER_OUTBOUNDS_ENABLED:-false}" = "true" ]; then
  echo "{\"event\":\"manager_outbound_delivery_audit_bootstrap_started\"}"
  set +e
  npx tsx scripts/audit-manager-outbound-delivery.ts
  AUDIT_EXIT_CODE=$?
  set -e
  echo "{\"event\":\"manager_outbound_delivery_audit_bootstrap_finished\",\"exitCode\":${AUDIT_EXIT_CODE}}"
fi

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
