#!/bin/sh
set -eu
cd "$(dirname "$0")/.."; mkdir -p backups
backup="backups/oppo-line-oa-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --file="$backup" "$DATABASE_URL"
printf '%s\n' "Backup created: $backup" "Warning: this file may contain customer data."
