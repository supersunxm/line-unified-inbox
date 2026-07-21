#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
result=PASS; skips=0
fail() { echo "FAIL: $*" >&2; result=FAIL; }
step() { printf '\n== %s ==\n' "$1"; }
webhook_fingerprint() { (cd "$ROOT_DIR/backend" && node -e 'require("dotenv").config();const{createHash}=require("node:crypto");const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.lineOfficialAccount.findFirst({where:{isActive:true,archivedAt:null,encryptedChannelSecret:{not:null}},orderBy:{id:"asc"},select:{id:true,webhookKey:true}}).then(x=>process.stdout.write(x?`${x.id}:${createHash("sha256").update(x.webhookKey).digest("hex")}`:"")).finally(()=>p.$disconnect())' 2>/dev/null || true); }

step "Repository checks"
for file in AGENTS.md AI_PROGRESS.md DECISIONS.md package.json scripts/dev-up.sh scripts/health-check.sh; do [[ -f "$ROOT_DIR/$file" ]] || fail "missing $file"; done
grep -qxF '.runtime/' "$ROOT_DIR/.gitignore" || fail ".runtime is not ignored"
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git -C "$ROOT_DIR" ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env(\.local)?\.example$' >/dev/null; then fail "tracked environment file detected"; fi
  if git -C "$ROOT_DIR" grep -IlE '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,})' -- ':!*.lock' ':!scripts/verify-all.sh' | grep . >/dev/null; then fail "potential tracked secret pattern detected (values withheld)"; else status_line Healthy "safe tracked-secret pattern scan"; fi
else status_line Warning "Git metadata unavailable; tracked-file and diff checks SKIPPED"; skips=1; fi

step "Backend"
webhook_fingerprint_before="$(webhook_fingerprint)"
[[ -d "$ROOT_DIR/backend/node_modules" ]] || (cd "$ROOT_DIR/backend" && npm install)
(cd "$ROOT_DIR/backend" && npx prisma validate && npx prisma generate && npx prisma migrate status && npm run lint && npm run test && npm run build) || fail "backend verification"

step "Frontend"
[[ -d "$ROOT_DIR/frontend/node_modules" ]] || (cd "$ROOT_DIR/frontend" && npm install)
(cd "$ROOT_DIR/frontend" && npm run lint && npm run build) || fail "frontend verification"

step "Runtime"
if [[ "$result" != FAIL ]]; then DEV_UP_SKIP_PRISMA=true "$ROOT_DIR/scripts/dev-up.sh" || fail "development stack startup"; fi
if [[ "$result" != FAIL ]]; then "$ROOT_DIR/scripts/health-check.sh" || fail "runtime health checks"; fi
for log in "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"; do
  if [[ -f "$log" ]] && tail -n 250 "$log" | grep -E '(EADDRINUSE|Found [1-9][0-9]* errors?|Build error|UnhandledPromiseRejection)' >/dev/null; then fail "startup/compile error found in $(basename "$log")"; fi
done

step "Functional and LINE webhook smoke checks"
if [[ "$result" != FAIL ]]; then
  route_code="$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:3001/store-master/search?q=agent-smoke || true)"
  [[ "$route_code" == 401 ]] || fail "Store Master route expected protected 401, got $route_code"
  unknown_code="$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:3001/__agent_unknown_route__ || true)"; [[ "$unknown_code" == 404 ]] || fail "unknown route expected 404"
  legacy_webhook_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{"events":[]}' http://localhost:3001/webhooks/line/not-a-valid-webhook-key || true)"; [[ "$legacy_webhook_code" == 404 ]] || fail "legacy webhook route must remain unavailable (expected 404, got $legacy_webhook_code)"
  webhook_fingerprint_after="$(webhook_fingerprint)"; [[ "$webhook_fingerprint_before" == "$webhook_fingerprint_after" ]] || fail "persisted webhook key changed across build/restart"
  webhook_key="$(cd "$ROOT_DIR/backend" && node -e 'require("dotenv").config();const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.lineOfficialAccount.findFirst({where:{isActive:true,archivedAt:null,encryptedChannelSecret:{not:null}},select:{webhookKey:true}}).then(x=>process.stdout.write(x?.webhookKey||"")).finally(()=>p.$disconnect())' 2>/dev/null || true)"
  if [[ -n "$webhook_key" ]]; then (cd "$ROOT_DIR/backend" && WEBHOOK_KEY="$webhook_key" npm run test:line-verify) || fail "signed LINE webhook verification"; else status_line Warning "signed webhook test SKIPPED: no usable active OA"; skips=1; fi
fi

step "Review packet"
"$ROOT_DIR/scripts/review-diff.sh" || fail "review packet generation"
if [[ "$result" == FAIL ]]; then echo "FAIL"; exit 1; fi
if [[ "$skips" == 1 ]]; then echo "PASS WITH SKIPS"; else echo "PASS"; fi
