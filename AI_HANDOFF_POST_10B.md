# LINE OA Chat Hub AI — Post-Phase 10B Handoff

## Project Overview

LINE OA Chat Hub AI is a multi-store LINE OA conversation management system for retail operations. It gives Web Admin users and BM/PC mobile users a shared, store-scoped workspace for customer conversations, replies, verified purchase information, and operational analytics.

## Current Architecture

### Frontend

- Next.js Web Admin for administration, operations, and analytics.
- Flutter Android mobile app for BM/PC inbox and conversation work.

### Backend

- NestJS application services and authorization guards.
- Prisma data access layer.
- PostgreSQL production database.

### Core domains

- Authentication and session management.
- Conversation and message management.
- Verified Purchase Information.
- AI Insight and rule-based classification.
- Operational and summary analytics.
- Store and membership authorization.

## Security Baseline Completed

- Store reads and conversation summaries are scoped through `StoreAccessService` and active memberships. BM/PC users can access only active assigned stores; ADMIN access is limited to the server-authorized store scope.
- Store mutations are ADMIN-only. Client-supplied role, store, and scope values are not used as authorization authority.
- Dashboard analytics derive store scope from the authenticated user and reject unauthorized selections or empty-scope fallbacks.
- `mustChangePassword` is enforced by the backend authorization layer. A forced-change session can use profile, password-change, and logout routes only until the password is changed.
- A shared password policy now applies to new registration, admin password reset, password change, and admin setup: at least 12 characters, uppercase, lowercase, number, and special character. Existing password hashes remain valid for login.
- Purchase writes are owned by the provenance-aware Purchase Information flow. Legacy tag endpoints cannot mutate verified purchase fields.

## Business Rules

### Purchase Information

Purchase Information is MANUAL BM-recorded data and represents verified customer purchase information. It is provenance-bearing, including the recording user and timestamp, and its updates are auditable.

### AI Insight

AI Insight is RULE/system classification data such as mentioned products, topics, and confidence. It describes what a customer mentioned or what the classifier inferred; it is not proof of purchase.

These two domains must never be mixed. A RULE product mention must not be rendered or counted as a verified purchase.

## Current Status

- **Phase 10B:** COMPLETED
- **Production Security Baseline:** READY

## Next Recommended Phase

### Phase 10C — Pilot Readiness

The next phase should focus on operational readiness rather than new product capabilities:

- UAT execution.
- BM training.
- Admin training.
- Pilot store selection.
- Monitoring metrics.
