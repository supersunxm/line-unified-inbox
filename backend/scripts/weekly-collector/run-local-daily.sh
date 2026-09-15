#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Ensure PATH contains Homebrew and standard binaries
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH}"

cd "${BACKEND_DIR}"

LOG_DIR="${BACKEND_DIR}/local-data/google-review-collector/logs"
mkdir -p "${LOG_DIR}"
WRAPPER_LOG="${LOG_DIR}/launchd-daily-wrapper.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [run-local-daily.sh] Launching scheduled daily collector..." >> "${WRAPPER_LOG}"

# Load secure production configuration if available (chmod 600 outside git)
if [ -f "${BACKEND_DIR}/local-data/production-db.env" ]; then
  chmod 600 "${BACKEND_DIR}/local-data/production-db.env" 2>/dev/null || true
  set -a
  source "${BACKEND_DIR}/local-data/production-db.env"
  set +a
fi

NODE_BIN="$(which node)"
EXIT_CODE=0
"${NODE_BIN}" "${BACKEND_DIR}/scripts/weekly-collector/run-local-daily-collector.mjs" --headless true >> "${WRAPPER_LOG}" 2>&1 || EXIT_CODE=$?

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [run-local-daily.sh] Completed with exit code ${EXIT_CODE}" >> "${WRAPPER_LOG}"
exit "${EXIT_CODE}"
