#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
files=$(rg -l --hidden --glob '!**/.git/**' --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**' --glob '!**/.env' --glob '!**/.env.local' --glob '!backend/scripts/security-check.sh' '(-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|ngrok.*authtoken|sk-[A-Za-z0-9_-]{20,}|LINE_CREDENTIAL_ENCRYPTION_KEY=[A-Za-z0-9+/=]{20,})' . || true)
if [ -n "$files" ]; then printf '%s\n' "Potential secret patterns found in:" "$files"; exit 1; fi
printf '%s\n' "Security check passed; no common committed-secret patterns found."
