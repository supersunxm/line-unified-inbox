#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
mkdir -p "$LOG_DIR"

status_line() { printf '%-8s %s\n' "$1" "$2"; }
port_pid() { lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n 1 || true; }
pid_command() { ps -p "$1" -o command= 2>/dev/null || true; }
pid_cwd() { lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true; }
is_project_pid() {
  local pid="$1" service="$2" command cwd
  command="$(pid_command "$pid")"; cwd="$(pid_cwd "$pid")"
  [[ -n "$command" && "$cwd" == "$ROOT_DIR/$service" && ( "$command" == *node* || "$command" == *npm* || "$command" == *next* || "$command" == *nest* ) ]]
}
wait_http() {
  local url="$1" expected="${2:-200}" attempts="${3:-60}" code i
  for ((i=1; i<=attempts; i++)); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || true)"
    [[ "$code" == "$expected" ]] && return 0
    sleep 1
  done
  return 1
}
stable_http() {
  local url="$1" i
  for i in 1 2 3; do wait_http "$url" 200 1 || return 1; sleep 1; done
}
sanitize() {
  sed -E \
    -e 's/(Authorization:|Bearer|Cookie:|Set-Cookie:)[^[:space:]]*/\1 [REDACTED]/Ig' \
    -e 's/((password|otp|secret|token|api[_-]?key|encryption[_-]?key)["=: ]+)[^, }"[:space:]]+/\1[REDACTED]/Ig' \
    -e 's#(postgres(ql)?://[^:]+:)[^@]+@#\1[REDACTED]@#Ig'
}
trim_log() {
  local file="$1" max_bytes=2097152
  [[ -f "$file" ]] || return 0
  if [[ "$(wc -c < "$file" | tr -d ' ')" -gt "$max_bytes" ]]; then tail -n 2000 "$file" > "$file.tmp" && mv "$file.tmp" "$file"; fi
}
