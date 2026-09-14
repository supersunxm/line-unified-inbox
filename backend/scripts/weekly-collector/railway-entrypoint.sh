#!/usr/bin/env bash
set -Eeuo pipefail

trap 'code=$?; echo "[google-review-entrypoint] FAILED exit=$code line=$LINENO" >&2; exit $code' ERR

echo "================================================================================"
echo "[google-review-entrypoint] started at $(date -u '+%Y-%m-%d %H:%M:%SZ')"
echo "[google-review-entrypoint] Node: $(node -v 2>&1 || echo 'not found')"
echo "[google-review-entrypoint] PWD:  $(pwd)"
echo "[google-review-entrypoint] User: $(id -u -n 2>&1 || id -u)"

# Verify required executables
for bin in node Xvfb chromium; do
  if command -v "$bin" >/dev/null 2>&1; then
    echo "[google-review-entrypoint] Found $bin at $(command -v "$bin")"
  else
    echo "[google-review-entrypoint] ERROR: Missing required executable: $bin" >&2
    exit 1
  fi
done

# Safe environment variable checks (NEVER log secrets or DATABASE_URL)
echo "[google-review-entrypoint] Env: GOOGLE_REVIEW_HEADLESS is ${GOOGLE_REVIEW_HEADLESS:+SET}"
echo "[google-review-entrypoint] Env: GOOGLE_REVIEW_LOCALE is ${GOOGLE_REVIEW_LOCALE:+SET}"
if [ -n "${GOOGLE_REVIEW_WRITE_DATE:-}" ]; then
  echo "[google-review-entrypoint] Env: GOOGLE_REVIEW_WRITE_DATE is SET"
else
  echo "[google-review-entrypoint] Env: GOOGLE_REVIEW_WRITE_DATE is EMPTY/UNSET"
fi

echo "[google-review-entrypoint] Starting virtual display server (Xvfb)..."
# Start Xvfb directly in the background to avoid buggy xvfb-run signal-wait hangs in containers
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp -ac &
XVFB_PID=$!

# Ensure Xvfb is cleaned up if script exits
trap 'kill -9 "$XVFB_PID" 2>/dev/null || true' EXIT

export DISPLAY=:99
sleep 1

if kill -0 "$XVFB_PID" 2>/dev/null; then
  echo "[google-review-entrypoint] Xvfb successfully started (PID=$XVFB_PID, DISPLAY=$DISPLAY)"
else
  echo "[google-review-entrypoint] WARNING: Xvfb failed to start or exited early" >&2
fi

echo "[google-review-entrypoint] launching collector..."
echo "================================================================================"

exec node scripts/weekly-collector/run-single-cycle.mjs

