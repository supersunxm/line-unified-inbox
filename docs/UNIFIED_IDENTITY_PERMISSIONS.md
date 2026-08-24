# Unified Identity and Permission Architecture

## Goal

Web and Mobile are two clients of the same OPPO LINE OA Monitor account system. A person has one `User` identity and one credential set. Web and Mobile sessions are separate sessions, but both resolve to the same user record, lifecycle state, memberships, scopes, and capabilities.

The authorization model separates:

1. **Identity** — who the user is.
2. **Platform access** — Web and/or Mobile.
3. **Workspace access** — HQ, Store, and Main OA.
4. **Scope** — all stores or selected Store memberships.
5. **Capabilities** — actions such as reply, account management, and Main OA management.

## Stage 1 — normalized authorization context

Stage 1 is merged and deployed. It introduced one normalized authorization contract without changing production access decisions.

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

Legacy flat `permissions` keys remain available for current clients.

## Stage 2 — unified authentication and registration

Stage 2 persists the access model on the existing `User` record. It does not introduce separate Web and Mobile user tables.

### Persisted User grants

- `canAccessWeb`
- `canAccessMobile`
- `canAccessHq`
- `canAccessAllStores`
- `canManageAccounts`
- `canReply`
- existing `canAccessMainOa`
- existing `canManageMainOa`

`UserRole.ADMIN` remains the super-admin/security role. An ADMIN retains HQ, all-store, account-management, and reply authority. Non-admin HQ users can instead receive explicit capabilities without being promoted to ADMIN.

### Registration identity rule

The public Store registration endpoint is shared by Web and Mobile. A new registration creates exactly one pending `User` and one pending Store membership.

New Store users receive both platform grants by default:

```text
canAccessWeb    = true
canAccessMobile = true
```

Approval activates that same User and membership and enables Store reply capability. Therefore a person who registered from Mobile can use the same email/password on Web, and a person who registered from Web can use the same credentials on Mobile, unless an administrator later removes a platform grant.

No account synchronization is required because there is only one account identity.

### Platform-aware sessions

Authentication creates a session appropriate to the client:

```text
User
├── WEB Session
└── MOBILE Session
```

- Web login creates `SessionType.WEB` and uses the Web session cookie.
- Mobile password or OTP login creates `SessionType.MOBILE` and uses a bearer token.
- A Web cookie cannot be reused as a Mobile bearer session, and vice versa.
- Current User grants are checked again while authenticating an existing session. Revoking a platform grant therefore blocks that platform on the next authenticated request without changing the User identity.

Valid credentials with a missing platform grant are distinguished from bad credentials:

- `WEB_ACCESS_NOT_GRANTED`
- `MOBILE_ACCESS_NOT_GRANTED`
- `WORKSPACE_ACCESS_NOT_GRANTED`

### HQ Mobile access

Mobile OTP eligibility no longer assumes that every Mobile user owns a Store membership. An active HQ user with Mobile access and a valid workspace can authenticate on Mobile even when the user has no Store membership.

This is required for future HQ-specific Mobile experiences.

### Store scope and reply permission

Store visibility and write authority are independent:

- `canAccessAllStores` can grant all-store scope without making the user ADMIN.
- Store memberships continue to define membership-scoped Store access.
- `canReply` determines whether a non-admin user can perform Store write/reply actions.

Main OA continues to use its existing explicit access/manage capabilities.

### Migration/backfill

The Stage 2 migration keeps existing production behavior during rollout:

- existing non-deleted users retain Web and Mobile access;
- existing ADMIN users are backfilled with HQ/all-store/account-management/reply grants;
- existing users with active Store memberships receive reply capability;
- deleted users receive no Web, Mobile, or reply access;
- existing Main OA flags are unchanged.

## Stage 3 — adaptive client experience

Stage 3 will make Web and Flutter navigation and home/workspace presentation derive from the normalized authorization context.

Examples:

- BM/PC Mobile: Store-focused home, chats, notifications, profile.
- HQ Mobile: HQ overview, Store network, analytics, alerts, optional Main OA.
- Mixed-scope users: workspace switching without a second account.
- Web navigation: features appear according to capabilities instead of relying only on `ADMIN`/`VIEWER` labels.

Stage 3 will also be the appropriate place for administrator-facing controls that change individual platform/workspace capabilities.
