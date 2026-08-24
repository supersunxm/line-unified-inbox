# Unified Identity and Permission Architecture

## Goal

Web and mobile are two clients of the same OPPO LINE OA Monitor account system.

A person has one `User` identity. Web and mobile sessions may be different, but they resolve to the same user record, credentials, lifecycle state, memberships, and authorization context.

The target architecture separates four concerns that were previously partially mixed together:

1. **Identity** — who the user is.
2. **Platform access** — whether the user may use Web and/or Mobile.
3. **Workspace/capability access** — what product areas the user may use.
4. **Scope** — which stores or global data the user may access.

## Stage 1: normalized authorization context

Stage 1 is intentionally backwards-compatible. It does **not** change who can currently log in or which protected routes currently allow access.

The backend now projects the existing role/membership model into one normalized context returned by authentication and `/auth/me`.

```text
User
└── authorization
    ├── identity
    │   ├── platformRole
    │   └── membershipRoles
    ├── platforms
    │   ├── web
    │   └── mobile
    ├── workspaces
    │   ├── hq
    │   ├── store
    │   └── mainOa
    ├── scope
    │   ├── allStores
    │   └── storeIds
    └── capabilities
        ├── manageAccounts
        ├── reply
        ├── accessMainOa
        └── manageMainOa
```

The legacy flat `permissions` keys remain present so existing Web and Flutter clients continue to work. The same normalized values are also exposed under `authorization` and nested permission fields for future clients.

### Stage 1 compatibility mapping

| Existing state | Normalized result |
| --- | --- |
| `UserRole.ADMIN` | HQ workspace, all-store scope, account-management capability |
| Active Store membership | Store workspace and membership-scoped store IDs |
| `canAccessMainOa` | Main OA workspace/access capability |
| `canManageMainOa` | Main OA management capability |
| Existing authenticated user | Web + Mobile platform access remain enabled |

The final row is deliberate: Stage 1 must not introduce a login regression. Explicit persisted Web/Mobile grants are deferred to Stage 2.

## Stage 2: unified authentication and registration

Stage 2 will make platform/workspace grants explicit and persisted, while continuing to use one `User` identity.

Target examples:

```text
BM
- Web: false (default policy, configurable)
- Mobile: true
- Store workspace: true
- Store scope: assigned membership(s)
- HQ workspace: false

HQ analyst
- Web: true
- Mobile: true
- HQ workspace: true
- All-store/read analytics capabilities as granted
- Account management: false unless explicitly granted

HQ administrator
- Web: true
- Mobile: true
- HQ workspace: true
- Account management: true
- Other capabilities as explicitly granted
```

Registration from Web or Mobile must create/reuse the same account identity flow. There must not be separate WebUser and MobileUser records.

Mobile OTP eligibility must stop assuming that every mobile user requires a Store membership; HQ users with mobile access must be supported.

## Stage 3: adaptive client experience

Web and Flutter should render navigation and home/workspace experiences from the normalized authorization context rather than hard-coding `ADMIN`, `VIEWER`, BM, or PC assumptions.

Examples:

- BM/PC mobile: store-focused home, chats, notifications, profile.
- HQ mobile: HQ overview, store network, analytics, alerts, optional Main OA.
- Users with multiple scopes: workspace selection without creating a second account.

## Compatibility rules

Until Stage 2 explicitly changes enforcement:

- `AuthGuard` role checks remain authoritative where already used.
- `StoreAccessService` keeps its current ADMIN-versus-membership behavior.
- `MainOaAccessService` keeps its current capability checks.
- Web and Mobile login behavior remains unchanged.
- No Prisma migration is required for Stage 1.

This avoids changing production authorization semantics before the new permission model has been validated by tests and clients.
