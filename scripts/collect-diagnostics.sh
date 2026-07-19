#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
stamp="$(date '+%Y%m%d-%H%M%S')"; output="$RUNTIME_DIR/diagnostics/$stamp"; mkdir -p "$output"
capture() { local file="$1"; shift; ("$@" 2>&1 || true) | sanitize > "$output/$file"; }
capture dev-status.txt "$ROOT_DIR/scripts/dev-status.sh"
capture ports.txt "$ROOT_DIR/scripts/check-ports.sh"
capture docker.txt docker compose -f "$ROOT_DIR/docker-compose.yml" ps
capture migrations.txt bash -c "cd \"$ROOT_DIR/backend\" && npx prisma migrate status"
for service in backend frontend; do if [[ -f "$LOG_DIR/$service.log" ]]; then tail -n 150 "$LOG_DIR/$service.log" | sanitize > "$output/$service.log"; else echo "No managed log available" > "$output/$service.log"; fi; done
capture health.txt "$ROOT_DIR/scripts/health-check.sh"
capture versions.txt bash -c "node --version; npm --version; docker --version; docker compose version; cd \"$ROOT_DIR/backend\" && npx prisma --version"
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then capture diff-summary.txt bash -c "cd \"$ROOT_DIR\" && git status --short && git diff --stat"; else echo "Git metadata unavailable" > "$output/diff-summary.txt"; fi
printf 'Safe diagnostics written to %s\n' "$output"
