#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
fail=0
check_code() { local label="$1" url="$2" expected="$3" code; code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || true)"; if [[ "$code" == "$expected" ]]; then status_line Healthy "$label ($code)"; else status_line Error "$label expected $expected, got ${code:-unreachable}"; fail=1; fi; }
check_code "backend /health" "http://localhost:3001/health" 200
check_code "frontend /" "http://localhost:3000/" 200
setup="$(curl -sS --max-time 5 http://localhost:3001/auth/setup-status 2>/dev/null || true)"
if [[ "$setup" == *'"firstAdminRequired":'* && "$setup" == *'"registrationAvailable":'* ]]; then status_line Healthy "authentication setup-status typed JSON"; else status_line Error "authentication setup-status invalid"; fail=1; fi
check_code "protected Store Master search" "http://localhost:3001/store-master/search?q=test" 401
check_code "unknown backend route" "http://localhost:3001/__agent_unknown_route__" 404
check_code "protected database readiness" "http://localhost:3001/health/readiness" 401
exit "$fail"
