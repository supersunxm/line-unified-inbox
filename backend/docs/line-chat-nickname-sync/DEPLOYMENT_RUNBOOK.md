# LINE Chat Nickname Synchronization: Railway Deployment & Operations Runbook

## 1. Overview & Architecture

This document provides the operational runbook for deploying and operating the automated LINE Chat Nickname Synchronization system across ~150 LINE Official Accounts (OAs) managed by OPPO.

### Architecture Summary

```
                      ┌────────────────────────────┐
                      │    Main Backend / Web UI   │
                      │  (PATCH customer-sales)   │
                      └─────────────┬──────────────┘
                                    │
                         Transaction Committed
                                    │
                                    ▼
                      ┌────────────────────────────┐
                      │ LineChatNicknameQueueService│
                      │  (Checks OA rollout flag,  │
                      │   builds nickname, latest- │
                      │   wins, enqueues to DB)    │
                      └─────────────┬──────────────┘
                                    │
                                    ▼
                   ┌──────────────────────────────────┐
                   │ PostgreSQL: LineChatNicknameSync │
                   │ Job (status: PENDING / LEASED)   │
                   └────────────────┬─────────────────┘
                                    │
                         Atomic Claim & Recovery
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │   Dedicated Railway Worker Service                     │
       │   (line-chat-nickname-worker)                          │
       │   - Isolated NestJS bootstrap                          │
       │   - Multi-session routing (Profile A, B, C...)         │
       │   - Headless Playwright persistent browser context     │
       │   - Circuit breaker on AUTH_REQUIRED                   │
       └────────────────────────────┬───────────────────────────┘
                                    │
                    Page-context fetch (PUT nickname)
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │    https://chat.line.biz      │
                    │   (Customer Nickname Updated) │
                    └───────────────────────────────┘
```

---

## 2. Prerequisites & Pre-Deployment Checklist

- [ ] PostgreSQL database running (Railway managed or replica).
- [ ] Railway CLI installed locally: `npm install -g @railway/cli` or Railway Web Dashboard access.
- [ ] Valid LINE Business accounts:
  - Account A (covers Profile A: ~100 OAs)
  - Account B (covers Profile B: remaining ~50 OAs)
  - Optional Account C (if expanding beyond 200 OAs)
- [ ] All code changes verified and approved on branch `feature/line-chat-nickname-sync`.

---

## 3. Step-by-Step Railway Deployment Guide

### Step 3.1: Apply Database Migration

Run the additive Prisma migration on the production database:

```bash
# In Railway backend service or via CI/CD deployment:
npx prisma migrate deploy
```

> **Safety Check**: All migrations are strictly additive. Defaults ensure `lineChatNicknameSyncEnabled = false` for all existing OAs. Zero production data or webhook configurations are altered.

---

### Step 3.2: Create Standalone Railway Worker Service

1. In the Railway project dashboard, click **+ New Service** $\to$ **GitHub Repo** $\to$ `supersunxm/line-unified-inbox`.
2. Name the service: `line-chat-nickname-worker`.
3. In **Settings** $\to$ **Service Settings**:
   - **Root Directory**: `/backend`
   - **Build Command**: `npm run build && npx playwright install chromium --with-deps`
   - **Start Command**: `npm run worker:line-chat-nickname:prod`
4. Set Resource Limits:
   - Memory: Minimum **1 GB** (2 GB recommended for headless Chromium).
   - CPU: 1 vCPU.

---

### Step 3.3: Attach Persistent Volume for Browser Profiles

1. In the Railway dashboard for `line-chat-nickname-worker`, go to **Volumes**.
2. Click **+ Add Volume**:
   - **Mount Path**: `/data/line-chat-profiles`
   - **Size**: `5 GB`
3. This volume ensures that persistent Chromium browser cookies and session storage survive restarts, redeployments, and code updates.

---

### Step 3.4: Configure Environment Variables

Configure the following environment variables on the `line-chat-nickname-worker` service:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Node environment |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference to PostgreSQL database |
| `LINE_CHAT_PROFILE_ROOT` | `/data/line-chat-profiles` | Persistent volume root directory |
| `LINE_CHAT_SYNC_DELAY_MS` | `1000` | Delay between consecutive requests per session (rate limit protection) |
| `DISABLE_NICKNAME_WORKER` | `false` | Master kill-switch toggle (set to `true` to pause polling) |

---

## 4. Initial Authentication Setup for Profile A & Profile B

Because Railway is a headless server, browser profiles are authenticated using one of the following two secure operational flows:

### Option A: Local Authentication & Secure Transfer (Recommended)

1. **Authenticate Profile A locally**:
   ```bash
   npm run line-chat:login -- --profile ./local-data/line-chat-profiles/profile-a
   ```
   - A visible Chromium window opens at `https://chat.line.biz/`.
   - Log in using LINE Business Account A.
   - Confirm login in terminal; the authenticated profile is saved to `./local-data/line-chat-profiles/profile-a`.

2. **Authenticate Profile B locally**:
   ```bash
   npm run line-chat:login -- --profile ./local-data/line-chat-profiles/profile-b
   ```
   - A visible Chromium window opens at `https://chat.line.biz/`.
   - Log in using LINE Business Account B.
   - Confirm login in terminal; the authenticated profile is saved to `./local-data/line-chat-profiles/profile-b`.

3. **Transfer Profiles to Railway Persistent Volume**:
   ```bash
   # Create archive of profiles:
   tar -czvf profiles.tar.gz -C ./local-data/line-chat-profiles profile-a profile-b

   # Use Railway CLI to copy into the worker persistent volume:
   railway volume upload /data/line-chat-profiles profiles.tar.gz --service line-chat-nickname-worker
   ```

4. **Verify Session Health via Worker Logs**:
   ```
   [Nest] LOG [LineChatNicknameWorkerService] LINE Chat Nickname background worker started successfully
   ```

---

## 5. Bulk OA Mapping & Import Procedure

Prepare a CSV file named `production_oa_mappings.csv` containing:

```csv
lineOfficialAccountId,chatBotId,sessionKey
01a76f2d-8b01-4475-b44c-9f0e8f7a8123,U092441d025f688e389d25779dd8debf4,profile-a
02b87e3e-9c12-5586-c55d-0a1f9e8b9234,Ud8d5af30ddca3ed4237e157d5d73c2f1,profile-a
...
15f98a4f-0d23-6697-d66e-1b2a0f9c0345,U1234567890abcdef1234567890abcdef,profile-b
```

### 1. Run Dry-Run Validation

```bash
npm run line-chat:mapping:import -- --file ./production_oa_mappings.csv --dry-run
```

*Expected output:*
```
======================================================
  LINE OA NICKNAME CHAT MAPPING IMPORT
======================================================
Mode : 🔍 DRY-RUN (VALIDATION ONLY)
File : /.../production_oa_mappings.csv
Rows : 150

✅ All 150 rows validated successfully.
Planned changes:
---------------------------------------------------------------------------------------------
OA ID                                 OA Name                       chatBotId                           Session
---------------------------------------------------------------------------------------------
01a76f2d-8b01-4475-b44c-9f0e8f7a8123   OPPO BigC MAHACHAI 1          U092441d025f688e389d25779dd8debf4   profile-a
...
---------------------------------------------------------------------------------------------
[DRY-RUN] Validation completed. Zero database modifications performed.
```

### 2. Apply Mappings to Database

```bash
npm run line-chat:mapping:import -- --file ./production_oa_mappings.csv --apply
```

---

## 6. Controlled Staged Rollout Procedure

To guarantee 100% safety, roll out the nickname sync in 5 distinct phases:

### Phase 1: 1 Pilot OA Verification
1. Enable 1 test store OA via Admin Operations API or database:
   ```bash
   curl -X PATCH https://api.yourdomain.com/operations/line-chat-nickname/oa/<pilot-oa-id>/toggle \
     -H "Authorization: Bearer <ADMIN_SESSION>" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true}'
   ```
2. BM performs sales update (`ONLINE` or `PURCHASED` Cash/Installment) in web/mobile UI.
3. Verify in worker logs:
   ```json
   {"event":"line_chat_nickname_job_processing","nickname":"Online","botId":"..."}
   {"event":"line_chat_nickname_job_success","status":200}
   ```
4. Verify in `chat.line.biz`: Customer nickname changes.

### Phase 2: 5 Pilot Stores (Profile A)
- Enable 5 diverse stores (e.g. 2 high traffic, 3 regional).
- Observe queue processing and latency over 24 hours.

### Phase 3: 5 Pilot Stores (Profile B)
- Enable 5 stores mapped to Profile B.
- Verify Profile B session routing and independent token interception.

### Phase 4: Full Profile A Expansion (~100 OAs)
- Enable all Profile A stores in batches of 25.

### Phase 5: Full Network (~150 OAs)
- Enable all remaining Profile B stores.

---

## 7. Operations & Health Visibility

### Check System Health & Metrics
```bash
GET /operations/line-chat-nickname/health
```

*Response Payload Example:*
```json
{
  "timestamp": "2026-08-31T12:00:00.000Z",
  "sessions": [
    {
      "id": "...",
      "sessionKey": "profile-a",
      "displayName": "Profile A (Stores 1-100)",
      "status": "ACTIVE",
      "lastAuthenticatedAt": "2026-08-31T11:55:00.000Z",
      "lastSuccessfulRequestAt": "2026-08-31T11:59:12.000Z",
      "lastAuthFailureAt": null,
      "consecutiveAuthFailures": 0,
      "mappedOaCount": 100,
      "enabledOaCount": 100
    },
    {
      "id": "...",
      "sessionKey": "profile-b",
      "displayName": "Profile B (Stores 101-150)",
      "status": "ACTIVE",
      "lastAuthenticatedAt": "2026-08-31T11:50:00.000Z",
      "lastSuccessfulRequestAt": "2026-08-31T11:58:45.000Z",
      "lastAuthFailureAt": null,
      "consecutiveAuthFailures": 0,
      "mappedOaCount": 50,
      "enabledOaCount": 50
    }
  ],
  "queue": {
    "pending": 2,
    "processing": 1,
    "success": 412,
    "failed": 0,
    "failedAuth": 0,
    "superseded": 15,
    "total": 430
  },
  "rollout": {
    "totalOas": 150,
    "enabledOas": 150,
    "disabledOas": 0,
    "missingChatBotId": 0,
    "missingSession": 0
  }
}
```

---

## 8. Session Expiration & Re-Authentication Runbook

When a session expires:
1. Worker receives HTTP 401.
2. Worker automatically marks `LineChatSession.status = AUTH_REQUIRED` and marks in-flight jobs `FAILED_AUTH`.
3. Subsequent jobs for that session are paused; other sessions continue normally.
4. **Re-authentication Procedure**:
   - Re-run login locally: `npm run line-chat:login -- --profile ./local-data/line-chat-profiles/profile-a`.
   - Upload fresh profile to Railway volume: `railway volume upload /data/line-chat-profiles ...`.
   - Call Admin Re-Queue API:
     ```bash
     POST /operations/line-chat-nickname/retry-failed?sessionKey=profile-a
     ```
   - The session automatically returns to `ACTIVE`, and all pending/failed jobs are processed.

---

## 9. Emergency Rollback & Kill-Switch

If issues arise with LINE OA Manager or private API limits:

### Immediate Kill Switch (Zero Code Deploy Required)
In Railway environment variables for `line-chat-nickname-worker`:
- Set `DISABLE_NICKNAME_WORKER=true` and redeploy.
- The worker will stop claiming or executing any jobs immediately.

### Disable Per-OA Sync (Database-Level)
```sql
UPDATE "LineOfficialAccount" SET "lineChatNicknameSyncEnabled" = false;
```
All BM sales saves continue normally with zero impact or delay.
