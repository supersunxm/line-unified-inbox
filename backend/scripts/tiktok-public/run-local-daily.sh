#!/usr/bin/env bash
set -euo pipefail

# OPPO LINE OA Monitor — TikTok Public Daily TokCounter Collector Runner
# Executed via macOS launchd (com.oppo.tiktok-public-daily-collector) or manually.

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${BACKEND_DIR}"

mkdir -p "local-data/tiktok-public-collector/logs"
RUN_LOG="local-data/tiktok-public-collector/logs/launchd-runner.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [launchd-runner] Starting TikTok Public Daily Collector..." >> "${RUN_LOG}"

# Forward any extra arguments (e.g. --metricDate, --dryRun, --limit)
node scripts/tiktok-public/run-daily-collector.mjs --headless true "$@" >> "${RUN_LOG}" 2>&1
EXIT_CODE=$?

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [launchd-runner] Completed with exit code ${EXIT_CODE}" >> "${RUN_LOG}"
exit ${EXIT_CODE}
