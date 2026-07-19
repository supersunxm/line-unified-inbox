# Architectural decisions

## Project-local runtime ownership

Development processes started by automation use PID files and logs under ignored `.runtime/`. Scripts validate both command identity and repository working directory before stopping a process. This prevents accidental termination of unrelated Node services.

## Fixed local ports

Backend and frontend use only ports 3001 and 3000. Port conflicts are reported rather than silently selecting another port, keeping tunnel and API configuration deterministic.

## Safe diagnostics

Diagnostic bundles contain status, versions, sanitized log tails, and diff summaries. Environment-file contents and credential-bearing values are excluded and common secret patterns are redacted.

## Conversation classification precedence

Automatic classification evaluates the accumulated inbound text after every inbound text message so intent can emerge across multiple messages. Rule-generated product/topic rows are replaced on re-analysis, while `MANUAL` rows and manual priority remain authoritative and unchanged. Explicit purchase language and combined stock/commercial questions raise purchase intent and suggested priority consistently across Thai, English, and Simplified Chinese.

## Canonical LINE webhook identity

LINE events are accepted only at `POST /webhook/:webhookKey`. The persisted unique OA key resolves the OA and its encrypted Channel Secret before exact raw-body signature verification. Destination-based and environment-secret fallbacks are intentionally unsupported because they can select the wrong OA or conceal stale LINE Developers URLs. Normal requests, edits, builds, and restarts never mutate the key; only the explicit regeneration action may replace it.

## Railway backend deployment

Railway uses `backend` as the service root rather than a repository-level Dockerfile. Builds install development build tooling, generate Prisma Client, and compile NestJS; pre-deploy uses `prisma migrate deploy`; runtime uses only compiled `dist/main.js`. Production startup validates database, origin, webhook, encryption, pilot, email, and development-admin settings before listening.

## Temporary cross-site authentication

Production session cookies are opaque random tokens stored hashed in PostgreSQL and use `HttpOnly`, `Secure`, and `SameSite=None` for the temporary localhost-to-Railway pilot. CORS accepts only `FRONTEND_URL`. Browser third-party-cookie restrictions can still make this topology unreliable, so deploying the frontend under HTTPS on the same site is the recommended next step; cookie security must not be weakened.
