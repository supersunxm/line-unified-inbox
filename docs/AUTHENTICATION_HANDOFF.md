# Authentication Foundation Handoff

## Scope

This document describes the current authentication and user-management foundation for LINE OA Chat Hub AI. It covers BM registration, administrator approval, web and mobile sessions, authorization, rate limiting, and audit logging.

The implementation is NestJS + Prisma/PostgreSQL. The Flutter client consumes the mobile bearer-token APIs.

## Current architecture

The backend has one authentication domain with two session transports:

- Web: email/password login creates a `WEB` session and an `httpOnly` cookie named `oppo_session`.
- Mobile: email/password login creates a `MOBILE` session and returns a bearer access token. Flutter stores the token in secure storage.

The global `AuthGuard` accepts either the web cookie or an `Authorization: Bearer` token. It resolves the user through the hashed session token, checks expiry and account state, then applies role and store-access rules.

Registration is intentionally separate from authentication:

1. A BM submits an email, password, store, role, and name.
2. The backend creates a pending `User`, pending `UserStoreMembership`, and `RegistrationRequest` in one transaction.
3. An ADMIN reviews pending registrations.
4. Approval atomically activates the user and membership.
5. Rejection marks both as rejected; records are never deleted.

Legacy OTP models and services remain for compatibility with admin setup and legacy mobile OTP paths, but BM registration/login uses email and password.

## Core database models

### User

Important fields:

- `email`, `normalizedEmail`
- `passwordHash`
- platform `role`: `ADMIN` or `VIEWER`
- `status`: `ACTIVE`, `PENDING_APPROVAL`, `SUSPENDED`, `REJECTED`
- `isActive`
- profile fields and login timestamp

Existing users remain compatible; passwords and `isActive` are preserved.

### UserStoreMembership

Connects a user to `Store.id`.

- membership role: `STORE_MANAGER` or `STAFF`
- membership status: `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `REJECTED`
- approval metadata: approver and timestamp
- unique `(userId, storeId)` constraint

Store authorization must always resolve through this relation. Do not use `StoreMaster` for user ownership.

### RegistrationRequest

Audit/staging record for BM registration.

- email and normalized email
- optional legacy OTP/profile fields
- password hash for the submitted registration record
- requested membership role
- linked `createdUserId`
- status: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `EXPIRED` plus retained legacy statuses
- expiry and timestamps

Pending responses expose only safe registration fields; password hashes are never returned.

### Session

Stores only `tokenHash`, never the raw token.

- `sessionType`: `WEB` or `MOBILE`
- user relation
- expiry and creation timestamps

Sessions expire after 12 hours. Logout deletes the current session.

### AuthRateLimitBucket

PostgreSQL-backed distributed fixed-window counters used across backend replicas.

- unique `(key, windowStart)`
- request count and update timestamp

### AuditLog

Security event history with nullable actor/target references:

- actor user
- target user
- target registration
- action
- JSON metadata
- IP address and user agent
- timestamp

Indexed by actor, target, action, and creation time.

### Legacy/adjacent models

- `OtpChallenge`
- `AdminRegistrationOtp`
- device and push-notification models

These remain for compatibility and are not part of the current BM password flow.

## API endpoints

### Public registration

`GET /registration/stores`

Returns active, non-archived stores using `Store.id`.

`POST /registration/request`

Payload:

```json
{
  "name": "BM Name",
  "email": "bm@example.com",
  "storeId": "store-uuid",
  "role": "STAFF",
  "password": "minimum-12-characters"
}
```

Creates pending user, membership, and registration request atomically.

### Web authentication

`POST /auth/login`

Payload uses `identifier` and `password`. On success, sets the `oppo_session` cookie.

`POST /auth/logout`

Deletes the current web session and clears the cookie.

`GET /auth/me`

Returns the authenticated safe user profile, memberships, stores, and derived permissions.

### Mobile authentication

`POST /auth/mobile/login`

Payload:

```json
{
  "email": "bm@example.com",
  "password": "..."
}
```

Returns `accessToken` and `expiresAt`.

`POST /auth/mobile/logout`

Invalidates the current mobile bearer session.

`GET /auth/me`

Accepts the bearer token and returns the same safe authenticated profile.

### Admin approval

All routes require `ADMIN` role:

`GET /admin/registrations/pending`

`PATCH /admin/registrations/:id/approve`

`PATCH /admin/registrations/:id/reject`

Approval and rejection never delete users.

### Admin audit log

`GET /admin/audit-logs`

Supports:

- `page`
- `pageSize` (capped at 100)
- `action`
- `from`
- `to`

Only ADMIN users may access this endpoint.

### Legacy OTP endpoints

The following remain registered for compatibility:

- `/auth/mobile/send-otp`
- `/auth/mobile/verify-otp`
- admin setup OTP endpoints

Do not use these for new BM registration/login integrations.

## Authentication flow

### BM registration and approval

```text
Flutter registration form
        |
        | POST /registration/request
        v
Validate store, email, password
        |
        v
Hash password
        |
        v
Transaction:
  User(PENDING_APPROVAL)
  UserStoreMembership(PENDING_APPROVAL)
  RegistrationRequest(PENDING_APPROVAL)
        |
        v
ADMIN reviews /admin/registrations/pending
        |
        +--> approve --> User ACTIVE + Membership ACTIVE + Request APPROVED
        |
        +--> reject  --> User REJECTED + Membership REJECTED + Request REJECTED
```

### Mobile login

```text
Flutter email/password form
        |
        | POST /auth/mobile/login
        v
Normalize identifier and check login limiter
        |
        v
Verify scrypt password hash
        |
        v
Require ACTIVE user, active account, active store membership
        |
        v
Create MOBILE Session(tokenHash, expiry)
        |
        v
Return raw accessToken once
        |
        v
Flutter stores token in secure storage
```

### Authenticated request

```text
Cookie or Bearer token
        |
        v
Hash token and load Session + User + active memberships
        |
        v
Check expiry, User status, isActive, membership/store state
        |
        v
AuthGuard applies role and store authorization
        |
        v
Controller/service executes
```

## Authorization rules

- `ADMIN`: global store access and access to admin endpoints.
- `VIEWER`/BM users: require `User.status = ACTIVE`, `isActive = true`, and at least one active membership on an active, non-archived store.
- `STORE_MANAGER` and `STAFF`: access only assigned active stores.
- Pending, suspended, rejected, inactive users, and suspended/rejected memberships cannot authenticate or access conversations.
- The backend must derive store ownership from database relations. Never trust client-supplied store IDs, LINE OA IDs, or frontend filters.
- Admin approval endpoints are protected by the global guard and `@Roles("ADMIN")`.

## Security decisions

- Passwords use salted `scrypt`; raw passwords never enter persistence or logs.
- Raw session tokens are returned only at login and are not stored server-side.
- Web sessions use `httpOnly` cookies; production cookies are secure.
- Mobile sessions use bearer tokens and Flutter secure storage.
- Login failures are rate limited by IP + normalized email: 5 failures per 15 minutes.
- Registration requests are limited to 10 per IP per hour.
- Repeat registration for the same email is blocked for 24 hours.
- Audit records never contain passwords, tokens, or credentials.
- Audit write failure is isolated from the business operation and logged safely.
- Error responses retain safe authentication codes without returning credential details.

## Environment and deployment requirements

Required operational configuration includes:

- `DATABASE_URL`
- `NODE_ENV=production`
- secure `FRONTEND_URL`
- production session/cookie HTTPS deployment
- production LINE and storage variables as required by the broader application

Before deployment:

1. Back up the production database.
2. Deploy application code.
3. Run `npx prisma migrate deploy`.
4. Verify `/health` and `/health/readiness`.
5. Verify web login, mobile login, approval, logout, and admin audit access.
6. Confirm logs contain no secrets or raw tokens.

Do not use `prisma db push` or `prisma migrate reset` in production.

## Deferred improvements

These are not required for the current foundation but should be planned:

- session cleanup/retention job
- audit-log retention and archival policy
- rate-limit bucket cleanup policy
- device/session management and revoke-all capability
- transactional audit outbox for zero-loss audit delivery
- stronger login-state enumeration policy if threat modeling requires generic status errors
- distributed operational metrics and alerting
- employee-ID validation or automated approval rules

## Integration guidance for LINE OA conversation features

When adding inbox features:

1. Authenticate through the global guard; do not create parallel token logic.
2. Use `request.user.id` as the actor identity.
3. Resolve conversation ownership from the conversation’s store relation and `StoreAccessService`.
4. Never accept a client-submitted store assignment as authorization.
5. Enforce the same access boundary for conversation list, detail, messages, replies, notes, tags, and media.
6. Record security-sensitive actions through `AuditLogService` without storing message contents, tokens, or credentials.
7. Preserve `WEB` versus `MOBILE` session type when creating or invalidating sessions.
8. Keep webhook processing public only where signature validation explicitly protects it; webhook routes must not rely on BM sessions.
9. For mobile APIs, return stable error codes (`401`, `403`, `404`) and never force a login redirect for ordinary validation errors.
10. Add focused authorization tests for same-store success, cross-store rejection, inactive membership, and inactive store cases.

## Verification baseline

At handoff, the authentication-focused backend suite passes 44/44 tests. Prisma validation, backend build, changed-file ESLint, and diff checks pass. Flutter analyzer and Flutter tests pass.
