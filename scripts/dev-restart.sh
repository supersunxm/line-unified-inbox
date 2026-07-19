#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
target="${1:-all}"
[[ "$target" == backend || "$target" == frontend || "$target" == all ]] || { echo "Usage: $0 backend|frontend|all" >&2; exit 2; }
if [[ "$target" == all ]]; then "$ROOT_DIR/scripts/dev-down.sh"; "$ROOT_DIR/scripts/dev-up.sh"; exit; fi
file="$RUNTIME_DIR/$target.pid"
if [[ -f "$file" ]]; then
  pid="$(tr -dc '0-9' < "$file")"; is_project_pid "$pid" "$target" || { echo "Error: refusing to restart unverified $target PID" >&2; exit 1; }
  kill -TERM "$pid"; rm -f "$file"; sleep 1
elif [[ -n "$(port_pid "$([[ "$target" == backend ]] && echo 3001 || echo 3000)")" ]]; then echo "Error: $target is not managed by this project runtime." >&2; exit 1; fi
printf '[%s] Restarting %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$target" >> "$LOG_DIR/$target.log"
if [[ "$target" == backend ]]; then
  log="$LOG_DIR/backend.log"; (cd "$ROOT_DIR/backend" && exec nohup npm run start:dev) >> "$log" 2>&1 < /dev/null & pid=$!; url=http://localhost:3001/health
else log="$LOG_DIR/frontend.log"; (cd "$ROOT_DIR/frontend" && exec nohup npm run dev) >> "$log" 2>&1 < /dev/null & pid=$!; url=http://localhost:3000/; fi
printf '%s\n' "$pid" > "$RUNTIME_DIR/$target.pid"
wait_http "$url" 200 90 || { tail -n 80 "$log" | sanitize >&2; exit 1; }
status_line Healthy "$target restarted (PID $pid)"
