#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

if command -v docker >/dev/null; then status_line Healthy "Docker installed"; else status_line Error "Docker unavailable"; fi
if docker info >/dev/null 2>&1; then status_line Healthy "Docker daemon running"; else status_line Error "Docker daemon unavailable"; fi
container="$(docker compose -f "$ROOT_DIR/docker-compose.yml" ps --status running -q postgres 2>/dev/null || true)"
[[ -n "$container" ]] && status_line Healthy "PostgreSQL container running" || status_line Error "PostgreSQL container stopped"
if [[ -n "$container" ]] && docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T postgres pg_isready -U oppo_dev -d oppo_line_oa >/dev/null 2>&1; then status_line Healthy "database accepts connections"; else status_line Error "database unhealthy"; fi
"$ROOT_DIR/scripts/check-ports.sh"
for check in "backend:http://localhost:3001/health" "frontend:http://localhost:3000/"; do name="${check%%:*}"; url="${check#*:}"; if wait_http "$url" 200 1; then status_line Healthy "$name HTTP response"; else status_line Error "$name HTTP unavailable"; fi; done
if pgrep -f '[n]grok.*3001' >/dev/null 2>&1; then status_line Healthy "ngrok forwarding process found"; else status_line Warning "ngrok not running (optional)"; fi
if (cd "$ROOT_DIR/backend" && npx prisma migrate status >/dev/null 2>&1); then status_line Healthy "Prisma migrations current"; else status_line Error "Prisma migration status failed"; fi
mode="$(sed -n 's/^NODE_ENV=//p' "$ROOT_DIR/backend/.env" 2>/dev/null | tr -d '"' | head -n 1)"; status_line Healthy "environment mode: ${mode:-not configured}"
