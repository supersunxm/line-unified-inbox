#!/bin/sh
set -eu
file=${1:-}; if [ -z "$file" ] || [ ! -f "$file" ]; then printf '%s\n' "Usage: npm run db:restore -- <backup-file>"; exit 1; fi
printf '%s' "Restore will overwrite database objects. Type RESTORE to continue: "; read -r confirmation
if [ "$confirmation" != "RESTORE" ]; then printf '%s\n' "Restore cancelled."; exit 1; fi
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$file"; printf '%s\n' "Restore completed."
