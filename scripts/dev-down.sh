#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

stop_service() {
  local service="$1" file="$RUNTIME_DIR/$1.pid" pid child
  [[ -f "$file" ]] || { status_line Warning "$service has no managed PID file"; return; }
  pid="$(tr -dc '0-9' < "$file")"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then rm -f "$file"; status_line Warning "$service PID file was stale"; return; fi
  if ! is_project_pid "$pid" "$service"; then echo "Error: refusing to stop unverified PID $pid for $service" >&2; exit 1; fi
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do is_project_pid "$child" "$service" && kill -TERM "$child" 2>/dev/null || true; done
  kill -TERM "$pid"; for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 0.25; done
  rm -f "$file"; status_line Healthy "$service stopped"
}
stop_service frontend
stop_service backend
if [[ "${1:-}" == "--with-db" ]]; then docker compose -f "$ROOT_DIR/docker-compose.yml" down; status_line Healthy "Docker services stopped; volume preserved"; fi
