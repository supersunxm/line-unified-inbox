#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

for entry in "3000:frontend" "3001:backend" "5432:postgres"; do
  port="${entry%%:*}"; service="${entry##*:}"; pid="$(port_pid "$port")"
  if [[ -z "$pid" ]]; then status_line Healthy "port $port is free"
  elif [[ "$service" != postgres ]] && is_project_pid "$pid" "$service"; then status_line Healthy "port $port occupied by this project (PID $pid: $(pid_command "$pid"))"
  elif [[ "$service" == postgres && "$(pid_command "$pid")" == *docker* ]]; then status_line Healthy "port $port occupied by project-compatible Docker PostgreSQL (PID $pid)"
  else status_line Warning "port $port occupied by another process (PID $pid: $(pid_command "$pid"))"; fi
done
