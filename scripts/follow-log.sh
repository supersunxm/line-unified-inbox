#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
service="${1:-}"; [[ "$service" == backend || "$service" == frontend ]] || { echo "Usage: $0 backend|frontend" >&2; exit 2; }
touch "$LOG_DIR/$service.log"; tail -n 100 -F "$LOG_DIR/$service.log" | sanitize
