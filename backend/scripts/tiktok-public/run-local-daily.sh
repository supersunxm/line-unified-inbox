#!/usr/bin/env bash
set -euo pipefail

# OPPO LINE OA Monitor — TikTok Public Daily Multi-Provider Collector Runner
# Executed via macOS launchd (com.oppo.tiktok-public-daily-collector) or manually.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Ensure PATH contains Homebrew and standard binaries
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH}"

cd "${BACKEND_DIR}"

LOG_DIR="${BACKEND_DIR}/local-data/tiktok-public-collector/logs"
mkdir -p "${LOG_DIR}"
WRAPPER_LOG="${LOG_DIR}/launchd-runner.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [launchd-runner] Starting TikTok Public Daily Collector..." >> "${WRAPPER_LOG}"

# Load secure production configuration if available (chmod 600 outside git)
if [ -f "${BACKEND_DIR}/local-data/production-db.env" ]; then
  chmod 600 "${BACKEND_DIR}/local-data/production-db.env" 2>/dev/null || true
  set -a
  source "${BACKEND_DIR}/local-data/production-db.env"
  set +a
fi

NODE_BIN="$(which node || echo "/opt/homebrew/bin/node")"
EXIT_CODE=0
"${NODE_BIN}" "${BACKEND_DIR}/scripts/tiktok-public/run-daily-collector.mjs" --headless true "$@" >> "${WRAPPER_LOG}" 2>&1 || EXIT_CODE=$?

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [launchd-runner] Completed with exit code ${EXIT_CODE}" >> "${WRAPPER_LOG}"
exit "${EXIT_CODE}"
