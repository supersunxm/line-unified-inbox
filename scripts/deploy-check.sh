#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
result=READY; external=0
fail() { echo "NOT READY: $*" >&2; result="NOT READY"; }
step() { printf '\n== %s ==\n' "$1"; }

step "Deployment configuration"
for name in DATABASE_URL FRONTEND_URL PUBLIC_WEBHOOK_BASE_URL LINE_CREDENTIAL_ENCRYPTION_KEY LINE_WEBHOOK_ENABLED PILOT_MODE EMAIL_PROVIDER; do grep -q "^${name}=" "$ROOT_DIR/backend/.env.example" || fail "$name is not documented in backend/.env.example"; done
node -e 'const p=require("./backend/package.json");for(const n of ["build","start:prod","db:migrate:deploy","test:line-verify"])if(!p.scripts?.[n])throw new Error(`missing backend script ${n}`)' || fail "required backend package scripts"
grep -q '@Controller("webhook")' "$ROOT_DIR/backend/src/webhooks/line/line-webhook.controller.ts" || fail "canonical webhook controller route"
if rg -l '/webhooks/line' "$ROOT_DIR/frontend" "$ROOT_DIR/backend/src/line-official-accounts" "$ROOT_DIR/backend/scripts" --glob '!**/node_modules/**' --glob '!**/.next/**' >/dev/null; then fail "legacy webhook URL remains in normal generation or scripts"; fi

step "Database and backend"
(cd "$ROOT_DIR/backend" && npx prisma validate && npx prisma generate && npx prisma migrate status && npm run lint && npm run test && npm run build) || fail "backend build verification"

step "Repository safety"
grep -qxF '.runtime/' "$ROOT_DIR/.gitignore" || fail ".runtime is not ignored"
for pattern in '.env' '.env.local' '*.log' 'backups/' '*.csv' 'ngrok.yml'; do grep -qF "$pattern" "$ROOT_DIR/.gitignore" || fail ".gitignore missing $pattern"; done
if rg -l '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,})' "$ROOT_DIR" --glob '!**/node_modules/**' --glob '!**/.runtime/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/*.lock' --glob '!scripts/deploy-check.sh' --glob '!scripts/verify-all.sh' | grep . >/dev/null; then fail "potential source-tree secret detected (value withheld)"; else status_line Healthy "safe source-tree secret pattern scan"; fi
if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git -C "$ROOT_DIR" ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.env\.example$' >/dev/null; then fail "tracked environment file detected"; fi
  if git -C "$ROOT_DIR" grep -IlE '(BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9]{20,})' -- ':!*.lock' ':!scripts/deploy-check.sh' | grep . >/dev/null; then fail "potential tracked secret detected (value withheld)"; fi
else status_line Warning "Git metadata/history unavailable; GitHub history checks require an external step"; external=1; fi

step "Local runtime and webhook"
if [[ "$result" != "NOT READY" && -f "$RUNTIME_DIR/backend.pid" ]] && kill -0 "$(tr -dc '0-9' < "$RUNTIME_DIR/backend.pid")" 2>/dev/null; then "$ROOT_DIR/scripts/dev-restart.sh" backend || fail "managed backend restart after build"; fi
if [[ "$result" != "NOT READY" ]]; then DEV_UP_SKIP_PRISMA=true "$ROOT_DIR/scripts/dev-up.sh" || fail "local stack startup"; fi
if [[ "$result" != "NOT READY" ]]; then "$ROOT_DIR/scripts/health-check.sh" || fail "local health checks"; fi
oa_id="$(cd "$ROOT_DIR/backend" && node -e 'require("dotenv").config();const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.lineOfficialAccount.findFirst({where:{isActive:true,archivedAt:null,encryptedChannelSecret:{not:null}},orderBy:{id:"asc"},select:{id:true}}).then(x=>process.stdout.write(x?.id||"")).finally(()=>p.$disconnect())' 2>/dev/null || true)"
if [[ "$result" != "NOT READY" ]]; then
  if [[ -n "$oa_id" ]]; then (cd "$ROOT_DIR/backend" && npm run test:line-verify -- "$oa_id") || fail "local signed webhook verification"; else status_line Warning "No usable OA for signed verification"; result="NOT READY"; fi
fi

if [[ "$result" == "NOT READY" ]]; then echo "NOT READY"; exit 1; fi
external=1 # GitHub and Railway account actions are intentionally not performed here.
if [[ "$external" == 1 ]]; then echo "READY WITH EXTERNAL STEPS"; else echo "READY"; fi
