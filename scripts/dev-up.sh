#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

command -v docker >/dev/null || { echo "Error: Docker is not installed." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Error: Docker daemon is not running." >&2; exit 1; }
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres
for _ in {1..60}; do docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U oppo_dev -d oppo_line_oa >/dev/null 2>&1 && break; sleep 1; done
docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U oppo_dev -d oppo_line_oa >/dev/null
if [[ "${DEV_UP_SKIP_PRISMA:-false}" != true ]]; then (cd "$ROOT_DIR/backend" && npx prisma migrate deploy && npx prisma generate); fi

start_service() {
  local service="$1" port="$2" command="$3" health="$4" pid log
  pid="$(port_pid "$port")"
  if [[ -n "$pid" ]]; then
    if is_project_pid "$pid" "$service"; then
      if wait_http "$health" 200 30 && stable_http "$health"; then status_line Healthy "$service already running (PID $pid)"; return; fi
      echo "Error: project-owned $service process on port $port did not become stably healthy." >&2; exit 1
    fi
    echo "Error: port $port is occupied and cannot be safely reused. Run scripts/check-ports.sh." >&2; exit 1
  fi
  log="$LOG_DIR/$service.log"; trim_log "$log"
  printf '[%s] Starting %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$service" >> "$log"
  (cd "$ROOT_DIR/$service" && exec nohup $command) >> "$log" 2>&1 < /dev/null &
  pid=$!; printf '%s\n' "$pid" > "$RUNTIME_DIR/$service.pid"
  if ! wait_http "$health" 200 90; then echo "Error: $service failed to become healthy. Recent log:" >&2; tail -n 80 "$log" | sanitize >&2; exit 1; fi
  status_line Healthy "$service started (PID $pid)"
}
start_service backend 3001 "npm run start:dev" "http://localhost:3001/health"
start_service frontend 3000 "npm run dev" "http://localhost:3000/"
printf 'Backend: http://localhost:3001 (log: %s)\nFrontend: http://localhost:3000 (log: %s)\n' "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
