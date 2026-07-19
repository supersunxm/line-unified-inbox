#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
output="$RUNTIME_DIR/review-packet.txt"; mkdir -p "$RUNTIME_DIR"
if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then printf 'Git metadata is unavailable; no diff packet can be produced.\n' > "$output"; printf 'Review packet written with Git-unavailable notice: %s\n' "$output"; exit 0; fi
{
  echo "CHANGED FILES"; git -C "$ROOT_DIR" status --short | grep -Ev '(^|/)(\.env|\.runtime)(\.|/|$)' || true
  echo; echo "DIFF STATISTICS"; git -C "$ROOT_DIR" diff --stat -- . ':(exclude)**/.env*' ':(exclude).runtime/**' || true
  echo; echo "TESTS AFFECTED"; git -C "$ROOT_DIR" diff --name-only -- . ':(exclude)**/.env*' | grep -E '(spec|test)\.' || echo "None detected"
  echo; echo "MIGRATIONS AFFECTED"; git -C "$ROOT_DIR" diff --name-only -- backend/prisma/migrations || true
  echo; echo "API ROUTES AFFECTED"; git -C "$ROOT_DIR" diff -U0 -- backend/src | grep -E '^\+.*@(Get|Post|Patch|Put|Delete|Controller)' || echo "None detected"
  echo; echo "SANITIZED DIFF"; git -C "$ROOT_DIR" diff -- . ':(exclude)**/.env*' ':(exclude).runtime/**' | sanitize
} > "$output"
printf 'Safe review packet written to %s\n' "$output"
