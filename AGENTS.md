# OPPO LINE OA Monitor agent rules

## General behavior

- Inspect the relevant implementation before editing. Do not stop after writing code: run the affected application and verify behavior using actual logs and error output.
- If a test, lint, build, migration, server, or health check fails, diagnose it and continue the repair loop until every required check passes.
- Do not ask the user to copy terminal errors that can be inspected directly, and never report success while a required check is failing.
- Do not suppress warnings, disable lint rules, hide errors, or use `any` to conceal TypeScript problems.
- Preserve existing data unless deletion is explicitly requested. Never expose secrets, tokens, password hashes, OTPs, encryption keys, or credentials.
- Never commit `.env` files or credentials. Never push to GitHub without explicit user permission.

## Required verification loop

For every code change: inspect, implement, format/lint, test, build, start affected services, run health checks, functionally verify, review the diff, fix findings, and repeat until clean.

## Completion criteria

A task is complete only when TypeScript compilation, lint, relevant tests, and builds pass; affected routes respond correctly; no new browser-console or backend-startup errors remain; required migrations are applied; and the final report states actual results.

## Service rules

The local stack is PostgreSQL through Docker Compose, NestJS on port 3001, Next.js on port 3000, and optional ngrok forwarding to port 3001. Before starting a service, inspect its port, reuse a healthy project service, terminate only a stale process belonging to this repository, and never silently choose a fallback port.

## Webhook rules

For LINE webhook work, verify the canonical route registration and persisted key; preserve exact raw body bytes; locally test signed requests (valid 200, invalid 401, unknown key 404); and do not depend on manual LINE Console verification.

## Authentication rules

For authentication work, verify migrations, User and OTP tables, setup-status, login, cookies/sessions, unauthorized and role-restricted requests. Webhook routes remain public but signature-protected.

## Progress documentation

Maintain `AI_PROGRESS.md` with the current task, completed work, checks run/passed, blockers, and next action. Maintain `DECISIONS.md` for meaningful architectural choices and rationale. Never put raw logs or secrets in either file.
