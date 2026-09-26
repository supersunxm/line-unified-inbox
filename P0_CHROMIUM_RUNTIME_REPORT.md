# P0 — Live Mirror Chromium Resource Exhaustion

**Status:** local implementation, regression suite, and real-profile soak complete; **READY_FOR_16_STORE_CANARY**. Production unchanged.
**Branch:** `p0/chromium-runtime-supervisor`
**Base:** local diagnostic branch `c8f4c772a74d30113ee6ea11b8caf312264cdf7d` (parent `8c25a220cc630130073393de0a7cb0eada1dfab2`). The Railway deployment metadata identifies the equivalent diagnostic PR squash as `70b71191a5db35fdb3dcda847d438a2d618adc69`; that squash object is not present in the local clone.
**Worktree:** `mirror-chat-chromium-p0-runtime`. The dirty primary checkout was left untouched.

## 1. Executive summary

The evidence confirms Chromium's child process starts and then fails to create OS threads. This is direct evidence of OS task/thread resource pressure. Low CPU and memory make ordinary CPU/RAM exhaustion unlikely. The exact enforced ceiling—cgroup PID/task limit, per-user/process limit, container runtime limit, or another kernel resource—remains unknown because the deployed code did not record `/proc` or cgroup counters and Railway exposes no PID/task metric here.

The source launches a persistent Chromium context for browser work and closes it at the end of each operation. Live Mirror runs across stores, while nickname, health, relay, media, recovery, and diagnostic producers can also request browser work. Existing profile coordination leases by database `sessionId`; it does not provide an in-process mutex keyed by the resolved user-data directory. Repeated launch/close churn and the absence of a central profile supervisor are proven. Orphaned Chromium processes or a specific leak are **not** proven.

The local change adds one supervisor per resolved Manager profile path: one reusable headless persistent context per profile, serialized operations, page reset between operations, rotation after 20 minutes or 256 operations, bounded crash/launch cooldown, bounded close/escalation, and best-effort Linux runtime telemetry. Headful noVNC contexts remain ephemeral. No business data or production state was changed.

### Pre-canary validation update — 2026-09-25 16:39 UTC

**Authoritative profile model:** two physical Manager profiles. Profile A is `account-1 / pinklao-pilot-v1` (about 100 OAs by the latest manual UI evidence); Profile B is `profile-b / RBS Chonburi` (about 55 OAs). The OA counts can overlap and are not additive. The isolated worker's expected production profile roots are the `account-1` and `profile-b` session paths under `/data/line-chat-profiles`.

| Store | Resolution | Registry Manager owner | Local profile exercised | Production resolver evidence | Expected supervisor |
| --- | --- | --- | --- | --- | --- |
| 18127 | Fallback | B | B | Two sessions considered; one candidate verified | B |
| 20789 | Fallback | A | A | Two sessions considered; one candidate verified | A |
| 24804 | Direct | A | A | Existing OA; direct assignment | A |
| 25389 | Fallback | B | B | Two sessions considered; one candidate verified | B |
| 25391 | Direct | A | A | Existing OA; direct assignment | A |
| 25610 | Direct | A | A | Existing OA; direct assignment | A |
| 27627 | Direct | A | A | Existing OA; direct assignment | A |
| 27789 | Direct | A | A | Existing OA; direct assignment | A |
| 28375 | Direct | B | B | Existing OA; direct assignment | B |
| 29039 | Fallback | A; B is also chat-operable | B | Two sessions and two candidates verified; resolver accepted the same bot ID and deterministically selected the first candidate | A or B; both are within the two-profile set |
| 29113 | Fallback | A | A | Two sessions considered; one candidate verified | A |
| 29737 | Fallback | A | A | Two sessions considered; one candidate verified | A |
| 3050 | Fallback | B | B | Two sessions considered; one candidate verified | B |
| 30606 | Fallback | A | A | Two sessions considered; one candidate verified | A |
| 32564 | Fallback | A | A | Two sessions considered; one candidate verified | A |
| 3791 | Direct | A | A | Existing OA; direct assignment | A |

The store table combines the user-confirmed direct assignments, the local fleet registry's stable-ID mapping, and Railway target-resolution summaries from 13:20–13:57 UTC. The production summaries show exactly two active sessions were considered for every fallback resolution; eight stores had one verified candidate and store 29039 had two. The resolver returns `AMBIGUOUS` for different bot IDs, while the observed 29039 candidates resolved to one bot and were accepted. Production logs do not emit the selected `sessionId` or physical path, so the exact `account-1` versus `profile-b` pick for 29039 is not observable; this is safe because both candidates are known profiles and resolve to that same OA. The registry distinguishes Manager owner from local profile for 29039; its local profile was exercised as B.

**Real saved-profile validation:** both actual saved profiles launched under the host execution context and returned HTTP 200 from `/api/v1/me`. The first restricted-executor attempts had exited with macOS `EXC_BREAKPOINT`/`SIGTRAP` before the auth probe; subsequent approved host-context launches and the soak succeeded. Crash reports did not identify a causal assertion, so no cause is attributed to those preliminary local failures.

**Real read-only soak:** 16 stores × 30 cycles = **480/480** successful first-page chat-list reads, using 11 registry-local Profile A stores and 5 Profile B stores. It accessed no message-history endpoint and printed no customer/chat content. Results: 2 unique canonical local profile paths, 2 peak supervisors, 2 active contexts maximum, 3 context generations (Profile A rotated once after its operation bound; Profile B stayed on one generation), 479 context reuses, 0 failed operations, 0 Chromium launch failures, 0 EAGAIN/pthread markers, 0 cleanup failures, and 0 contexts remaining after final shutdown.

**Resource samples:** captured at startup, after both profile initializations, after 100 and 250 operations, after rotation, after 480 operations, before cleanup, and after cleanup. This Mac reports Linux `/proc` and cgroup process/thread/PID/memory counters as `NOT_APPLICABLE`; no values were fabricated. Application-level supervisor/context counts stayed at or below two throughout. Railway's production PID/task counters remain unavailable.

**Current production snapshot:** at 2026-09-25 16:43 UTC Railway still reported deployment `37b7b035-f333-4d3d-9798-b83c8e8e9151` on commit `70b71191a5db35fdb3dcda847d438a2d618adc69`; no newer deployment was listed. Filtered logs from 16:12:49–16:42:49 UTC contained **155** Chromium launch-failure events and **155** store-cycle failures, with zero completed Mirror cycles. One-hour CPU was 0.0123 current / 0.0135 average / 0.0255 maximum; memory was 0.513 GB current / 0.521 GB average / 0.621 GB maximum. This production failure evidence is why the approved next step is a controlled 16-store canary; this report does not authorize a deployment.

## 2. Production topology and current evidence

Read-only Railway inspection at **2026-09-25 15:11:36 UTC**:

| Item | Evidence |
| --- | --- |
| Railway project/environment | OPPO LINE OA PROJECT / production |
| Worker service | `line-chat-nickname-worker` |
| Deployment | `37b7b035-f333-4d3d-9798-b83c8e8e9151`, status SUCCESS |
| Deployed commit | `70b71191a5db35fdb3dcda847d438a2d618adc69` |
| Region/replicas | `us-west2`, configured 1 replica |
| Start command | `bash scripts/start-line-chat-worker.sh` |
| Worker startup | `2026-09-25 13:20:49.488 UTC` |
| Worker uptime at latest read | **1 h 50 m 46.5 s** |
| Profile storage | Existing worker volume mounted at `/data/line-chat-profiles`; no path or volume changed |

The latest deployment remained the same; no automatic deployment/restart was visible in the deployment list. Railway's service API exposes CPU/memory but not PID/task counts.

### Failures after the first observed failure

From 13:57:00 through 15:11:00 UTC, Railway returned **329** `line_chat_chromium_launch_failed` events and **330** `line_chat_mirror_store_cycle_failed` events; there were **zero** `line_chat_mirror_store_cycle_completed` events in that window. The last launch failure in the sample was 15:10:49.632905587 UTC. Chromium PIDs increased from 43272 to 44696. Signals: SIGTRAP 314, SIGKILL 4, SIGSEGV 3, unknown 8. **112** captured launch events contained `pthread_create: Resource temporarily unavailable (11)`.

Latest one-hour Railway metrics at 15:11 UTC:

- CPU: current 0.0026, average 0.0133, peak 0.0241.
- Memory: current 0.693 GB, average 0.683 GB, peak 0.702 GB.
- Earlier two-hour sample at 15:04 UTC peaked at 0.917 GB against an 8 GB service limit.
- Production `pids.current`, `pids.max`, `pids.events`, `/proc` thread/process counts, and `RLIMIT_NPROC` remain **UNKNOWN**.

Store codes visible in the failure sample included 3050, 18127, 25389, and 29039. Some store-cycle logs omitted `storeCode`; their OA identifiers are intentionally not reproduced here.

### Exact first and second failures

1. **First:** `2026-09-25T13:57:13.878407134Z`, store 25389, worker uptime 36 m 24.390 s, Chromium PID 43272, `browserSpawned=true`, duration 117 ms, SIGKILL, Playwright required force-kill, cleanup completed. Stderr contained four `pthread_create: Resource temporarily unavailable (11)` lines. CPU/memory were low.
2. **Second:** `2026-09-25T14:00:13.915599595Z`, store 3050, Chromium PID 43336, spawned, duration 180002 ms, SIGSEGV after a Playwright timeout, cleanup completed. No thread-error text was present in that event.

The later rapid SIGTRAP failures repeatedly confirm the same launch-failure class; the bounded diagnostic output often has no stderr for those events. This is not evidence that every failure has the same immediate Chromium cause.

## 3. Chromium producer inventory

All LINE Chat browser work in the worker routes through `LineChatSessionService` and its `chromium.launchPersistentContext` call at `backend/src/line-chat/line-chat-session.service.ts:2833-2848`. The worker module provides a single `LineChatSessionService` instance used by Mirror, relay, health, nickname, media, recovery, and diagnostic providers (`backend/src/line-chat/line-chat-nickname-worker.module.ts:28-58`). Existing producer-level guards and database leases remain in place.

| Producer | Call sites / trigger and frequency | Profile/coordinator before change | Context creation, close, retry, overlap, and pre-change launch bound |
| --- | --- | --- | --- |
| Live Mirror | `line-chat-mirror.service.ts:1097,1283`; enabled by configuration, starts after 10 s, default cycle 60 s, minimum 30 s (`:31-33,226-229,329-341`). Stores run sequentially within a guarded cycle. | Per session ID `MIRROR_SYNC` database lease; same-profile cross-session exclusion was not provided by this coordinator. Uses each store's resolved Manager profile. | Target resolution and sync/history paths may each request a context. Every operation closes in `finally`; singleton-lock retries are bounded at 0.5/1/2 s plus confirmed stale-lock recovery. At 30 s minimum, up to 32 store-cycle opportunities/minute for 16 stores, excluding resolver sub-operations; there was no hard browser-launch cap. |
| Historical Mirror path in worker | `line-chat-mirror.service.ts:1636` and backfill helpers; only reachable in an explicitly selected historical mode/run. | Same session lease/profile resolution. | Shares the launcher; dormant for this P0. No historical task or collection was run. |
| Nickname queue and recent resolver | `line-chat-nickname-worker.service.ts:19,100`; 3 s poll, guarded cycle, default 10 jobs per cycle. Resolver/nickname methods use `LineChatSessionService` default launcher. | `NICKNAME_UPDATE` / `RECENT_RESOLUTION` session lease. | An operation could launch a fresh context; operations in a queue cycle are sequential, but other profiles and other producer services could overlap. The poll/limit permits up to 200 job slots/minute when cycles finish within the poll period; it is not a Chromium launch cap. |
| Session/OA health and auth recovery | `line-chat-health-scheduler.service.ts:13-15,82`; 30 s scheduler tick, at most one browser-backed operation per tick; session target 12 min with jitter, OA target 3 h with jitter. Auth recovery runs for an eligible failed session. | `HEALTH_SESSION` / `HEALTH_OA` DB lease. | Before this change, routine health diagnostics could launch a new context. New implementation routes them through the ready supervisor context. Probe operation/page cleanup remains in `finally`. |
| Text/image relay | Text worker call sites `line-chat-manager-message-relay-worker.service.ts:211,386,515,656,1053,1126`; image relay `line-chat-manager-image-relay-worker.service.ts:306`. Triggered by send/verification/recovery work, not a periodic browser scheduler. | Profile coordinator, same-profile `sessionId` lease, per-request in-flight/idempotency guard where present. | Each browser operation requested a persistent context and closes in `finally`. May overlap Mirror/health work on another profile; same resolved path is now serialized. Retry policy is producer-specific and remains unchanged. |
| Manager media materializer | `line-chat-manager-media-materializer.service.ts:22-26,91-94,388-390,687`; enabled/configured only, starts after 20 s, default 60 s/minimum 30 s, default batch size 8, guarded cycle. | `MIRROR_SYNC` session lease. | One browser context is used for the runnable candidate group, then closed in `finally`; bounded retry/defer behavior remains. Other profile work can overlap. |
| noVNC recovery | `line-chat-novnc-recovery-worker.service.ts:147`; manual/operator recovery, closes on stop/TTL/browser close. | Same session/profile path coordinator. | Headful DISPLAY context is explicitly `reuseContext:false`, remains ephemeral, and uses bounded cleanup. It can be requested while other producers exist; the profile mutex serializes it and it rotates out an incompatible headless context. |
| Diagnostics, discovery, auth recovery, session helper APIs | `line-chat-session.service.ts:893,1069,1623,1957` and `line-chat-auth-recovery.service.ts:417`; on-demand/internal or scheduler-triggered. | Most use the same default launcher; some callers already hold a profile coordinator lease. | Before change, default launcher still launched per operation. They now receive safe operation/session metadata and reuse the common path supervisor. |
| TikTok public profile collector | `src/tiktok/tiktok-public-profile.ts:472` calls `chromium.launch`, not the persistent LINE Chat path. | Separate collector/service path, not a provider in the `line-chat-nickname-worker` module. | Outside this LINE Chat worker P0; not changed or attributed to the observed deployment. |

The configured production values for Mirror store codes and other environment variables were not read. Frequencies above are source defaults/minima, not claims about the active production value.

## 4. Lifecycle and concurrency audit

| Resource/path | Owner and cleanup | Assessment |
| --- | --- | --- |
| LINE Chat persistent context launch | Central `launchPlaywrightPersistentContext` → `launchManagedPersistentContext`; all production LINE Chat producers use the managed service/default launcher. | One central funnel proven. Production success PID is not exposed by Playwright's public persistent-context API, so new success events mark PID unavailable rather than infer it. |
| Mirror / relay / health / nickname / materializer pages | Callers use `try/finally` and `closeManagedPersistentContext`; the supervisor closes every open page before retaining a reusable context. | Existing operation cleanup is present. A few callers catch close errors to preserve the operation result; the new central close path logs cleanup failure and enters cooldown. |
| Browser/context crash | Context `close` and browser `disconnected` listeners mark the owned generation DEGRADED. | New lifecycle observation; no arbitrary PID kill. Failure transitions are bounded by per-profile cooldown. |
| Close/escalation | Context close is bounded at 10 s; escalation calls `close()` only on the Browser object owned by that context and is bounded at 5 s. Profile singleton release is observed for up to 4 s. | Failed/unconfirmed cleanup is logged and profile cooldown is applied. Singleton deletion remains restricted to existing confirmed-stale-owner logic. |
| noVNC | One manual headful context with DISPLAY/env, TTL and explicit stop cleanup. | Ephemeral; not retained in the headless supervisor. |
| Cross-profile concurrency | Existing DB coordinator + new in-process FIFO mutex keyed by resolved profile path. | One operation/context per path in this process. Distinct paths remain able to run concurrently. Railway currently has one configured worker replica; this mutex is not a distributed lock across multiple worker processes sharing a volume. |

No orphaned process, leaked file descriptor, or Chromium thread leak is proven from current production evidence. Old logs report `cleanupCompleted=true` on the two early events but do not include PID/task counts. The repeated launch/close pattern and repeated thread-creation failures are proven. This is an observability and lifecycle-pressure issue, not a demonstrated heap/memory leak.

## 5. Root-cause assessment

**Primary finding — OS thread/task creation exhaustion:** high confidence that Chromium is denied OS thread creation during startup; direct `pthread_create` EAGAIN evidence appears in 112/329 captured events. The exact resource limit is unknown.

**Contributing mechanism — repeated browser lifecycle churn and missing profile supervisor:** high confidence from source and failure volume. Store and other operations repeatedly call `launchPersistentContext`; the old `LineChatSessionService` did not retain a healthy context between operations or enforce a path-keyed mutex/cooldown. After the first failure, 329 launch-failure events and 330 store-cycle failures accumulated in about 74 minutes, with no completed store cycle in the queried window.

**Not supported:** ordinary memory exhaustion (sub-1 GB observed against 8 GB); a LINE auth failure; a DB/schema cause; a particular store as the sole cause; proof of orphaned Chromium processes; a specific cgroup/`RLIMIT_NPROC` threshold. Low CPU/RAM does not rule out PID/task or per-user thread limits.

## 6. Local implementation

### Architecture before

`store/operation → launchPersistentContext → page/API work → close context → next operation launches again`. Existing coordinator leases are keyed by `sessionId`, and there was no process-local lock keyed by the actual resolved profile path. Producer running flags prevent overlap within some schedulers, not across all producers.

### Architecture after

- One in-process supervisor entry per resolved profile path; a FIFO path mutex spans browser acquisition, work, page reset, and release. Existing DB session leases remain unchanged.
- A healthy headless context is reused across operations for that profile. Operation pages are closed/reset; cookies and persistent profile data are retained. Different profiles can still progress concurrently.
- Headful/noVNC and explicit `reuseContext:false` runs remain ephemeral.
- Contexts rotate before the next operation after 20 minutes or 256 completed operations. A crash, disconnection, unhealthy page reset, or close failure marks the profile degraded and applies 30/60/120/300 s cooldown backoff. Store retries during cooldown receive the existing retryable busy result; they do not start a launch storm.
- Close has bounded timeout/escalation; shutdown rejects new launches, closes owned contexts once, and waits a bounded time for profile operations to drain.
- The successful launch options, base Chromium arguments/order, profile directories, authentication state, store selection, schedules, DB leases, Mirror semantics, and operation modes remain unchanged.

This bounds browser generations by profile count and rotation policy, rather than store-operation count. It is **not** a fixed global maximum across an unbounded number of distinct profiles; future fleet expansion must measure profile cardinality and resource headroom before increasing it.

## 7. Instrumentation and log safety

The local branch adds unique `launchId`, hashed `profileId`, `operationKind`, safe `sessionId`/`storeCode` when available, worker PID/uptime, generation, active context count, launch/reuse/page-reset/close/exit/cooldown events, and a runtime snapshot. The diagnostic failure event remains capped at 8 KiB, preserves earliest errors, redacts profile paths, cookies, bearer/auth values, tokens, and secrets, and never records chat content or full environment variables.

Linux snapshots are best-effort and fail open. They report availability separately for `/proc/self/status`, `/proc/self/limits`, open FDs, `/proc` process/thread/zombie counts, `/sys/fs/cgroup/pids.*`, and memory cgroup files. `/proc` process scanning has at most eight outstanding status reads and routine snapshots are throttled to one/minute; failure snapshots bypass the throttle. macOS is `NOT_APPLICABLE`. Runtime access failures are represented as `NOT_AVAILABLE`/`PERMISSION_DENIED`; they do not fail a Manager operation.

Playwright does not provide the successful persistent-context child PID through the public API used here. The success path therefore logs `chromiumPid:null`; failure diagnostics capture PID when Playwright exposes it. A context-close/disconnect event proves the API-level lifecycle transition, not independently verified OS child exit. The new `/proc` scan supplies aggregate corroboration when Railway permits it.

## 8. Files changed

- `backend/src/line-chat/line-chat-session.service.ts` — per-profile supervisor, reuse, page reset, rotation, recovery/cooldown, bounded cleanup/shutdown, runtime event correlation.
- `backend/src/line-chat/line-chat-chromium-runtime-telemetry.ts` and `.spec.ts` — best-effort Linux `/proc` and cgroup snapshot.
- `backend/src/line-chat/line-chat-chromium-launch-diagnostics.ts` and `.spec.ts` — safe operation/store correlation on failure events; bounded/redacted diagnostic fallback.
- `backend/src/line-chat/line-chat-profile-browser-lifecycle.spec.ts` — concurrency, two-profile, 16×120-cycle mock soak, reuse, failure/recovery, noVNC, rotation, shutdown, restart/profile-data tests.
- `backend/src/line-chat/line-chat-mirror.service.ts`, `line-chat-manager-image-relay-worker.service.ts`, `line-chat-manager-media-materializer.service.ts`, `line-chat-novnc-recovery-worker.service.ts`, and `line-chat-auth-recovery.service.ts` — safe operation/store/session metadata propagation where available. `line-chat-manager-message-relay-worker.service.ts` was audited; it already used the managed launch path and was not changed.

No schema, migration, DB data, historical archive, customer data, profile path, environment value, Railway setting, store allowlist, or deployment file was changed.

## 9. Tests, build, lint, and soak

- **17 runnable affected spec files: 183/183 passed** (session/lifecycle/diagnostics/telemetry/auth recovery/profile coordinator/Mirror/health/nickname/media/relay verification/noVNC).
- After the only post-suite test edit (removing three lint-redundant non-null assertions), the full lifecycle/supervisor spec was rerun: **21/21 passed**.
- Focused supervisor/diagnostic/telemetry/session run: **54/54 passed**.
- Backend `npm run build` (Prisma generate + Nest build): **passed**.
- ESLint on all touched TypeScript files: **passed**.
- `git diff --check`: passed before documentation updates; rerun at finalization.
- `line-chat-manager-image-relay-worker.spec.ts` could not run: it imports `vitest`, but `vitest` is absent from `backend/package.json` and this worktree's `node_modules`. Its service changes are metadata-only; Nest build and touched-file lint passed. No dependency was added just to bypass the repository test-harness gap.
- An earlier all-files `tsc --noEmit` attempt surfaced pre-existing errors in unrelated specs; the repository's Nest build config passes. Those unrelated errors were not changed.
- Real saved-profile soak: **16 stores × 30 cycles = 480/480 successful chat-list reads**, two authenticated profiles, three generations, 479 reuses, one scheduled rotation, zero Chromium/cleanup failures, peak two supervisors, zero retained contexts after shutdown. No chat history was fetched.

### Mock soak

The deterministic local test ran **16 stores × 120 cycles = 1,920 operations** across two mocked profile paths. It created **8 contexts/Chromium generations** total (four per profile under the 256-operation rotation), peaked at **2 concurrent contexts**, ended the operation loop with two retained READY contexts, reset all pages per operation, then closed all contexts at shutdown. Failures: **0**. Fake process/thread and memory trajectories are **not measurable** in this mock; context/page counts remained bounded. This is an architecture/handle-count simulation, not a 120-minute production soak.

## 10. Remaining risks / limits

1. Exact Railway PID/task ceiling and process/thread counts remain unknown until this code is deployed and runtime snapshot access is observed.
2. Per-profile serialization is in-process. Scaling the worker to multiple replicas that share a profile volume would need a distributed path-level lease or guaranteed profile sharding; current Railway config is one replica.
3. Distinct profiles can run concurrently, so total retained contexts are bounded by the number of profiles touched, not by one global constant. The validated current set maps to two physical profiles; recheck before any fleet expansion.
4. Profile rotation is checked at operation boundaries. A single stuck operation is serialized and retains its context until its caller returns; existing caller timeouts and worker shutdown limits remain relevant.
5. The Mac telemetry runtime marks Linux `/proc` and cgroup counters `NOT_APPLICABLE`. Production PID/task counts remain unknown and must be captured during the canary if the container exposes them.
6. `line-chat-manager-image-relay-worker.spec.ts` remains unavailable because its Vitest dependency is not declared/installed; the changed source compiles and touched-file lint passes.

## 11. Production canary plan — plan only

1. After separate human authorization and code review, deploy this branch through the normal PR/CI path to **only** the existing `line-chat-nickname-worker` 16-store service. Do not change replicas, variables, profiles, schedules, stores, or Mirror mode.
2. Record deployment ID/SHA, worker start, first cycle, first success/failure, profile count, runtime snapshots, launch/reuse/rotation counts, and same deployment continuity.
3. Observe the same deployment for 120 minutes, crossing the previous 36–45-minute failure window. Require at least 3 complete fleet passes and 16/16 store success per pass; zero pthread EAGAIN, spawn EAGAIN, Chromium crash storm, unresolved target-closed failure, DB/schema error, unexpected restart, or monotonic process/task growth toward its ceiling; verify both Manager profiles, stable memory, and healthy reconciliation.
4. If the gate fails, stop expansion and use the prior worker code only under a separately authorized rollback. Do not reset profile data or checkpoints.
5. Discuss any fleet expansion only after a separately authorized successful canary. This P0 does not authorize expanding beyond 16 stores.

## 12. Rollback plan

No migration or data-format change exists. If a separately authorized canary fails, deploy the prior worker build (`70b71191a5db35fdb3dcda847d438a2d618adc69`) to `line-chat-nickname-worker` through the approved production flow. This restores the pre-supervisor launch-per-operation code and may restore the known failure pattern; it is an operational rollback, not a root-cause fix. Do not delete/recreate the `/data/line-chat-profiles` volume or alter DB/checkpoint state.

## 13. Production safety status

During this task: **0** production writes, historical imports, deployments, restarts, variable/config changes, mode changes, new Live stores, or LINE messages. Production inspection was read-only (Railway status, deployment metadata, logs, and CPU/memory metrics). The live worker remains in its existing unhealthy state; this local patch has not been deployed.

## 14. Recommendation

**READY_FOR_16_STORE_CANARY**. The local registry mapped all 16 stores to the two saved profiles, and the real 480-operation soak succeeded. Production target-resolution logs show the nine fallback stores considered exactly the two active sessions; eight had one verified candidate and 29039 had two candidates for the same OA bot. The existing resolver therefore returns one of the two known profiles, with no ambiguous bot result. The 16-store mock supervisor suite, focused post-edit lifecycle suite, backend build, and touched-file lint pass.

This is a pre-canary decision only. It does not authorize a deployment. Production currently remains unhealthy on the unchanged diagnostic deployment; any canary still requires separate human authorization and the 120-minute production observation gate above.
