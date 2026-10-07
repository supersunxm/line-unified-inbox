# Role-based application download policy

The persisted platform roles were ADMIN and VIEWER. VIEWER remains the existing BM/PC/store role; it is not equivalent to the new HQ ASSISTANT role. The additive migration adds ASSISTANT without rewriting any existing user or membership. Existing administrators remain ADMIN; existing store users remain VIEWER. An administrator explicitly changes a HQ account through PATCH /admin/registrations/hq-users/:id/role.

ADMIN has downloadData and account administration. ASSISTANT has neither, even if an old stored canManageAccounts flag is true. Existing platform, workspace, store, Reply and Main OA grants continue through the permission-context projection. Existing ADMIN compatibility semantics (including all-store access) are preserved. Acting-store context still limits an administrator to the selected store, and StoreAccessService remains authoritative in Store 360 export.

The shared backend DownloadGuard derives downloadData from the authenticated, freshly loaded User role. RequireDownload decorates every file-export route below. Authentication, active-state checks, existing route-role checks and store-access checks remain in place. Sessions are retained on role changes: the next request reloads the changed role, so previously issued cookies and mobile tokens cannot retain download or administration privileges.

DownloadAction and useCanDownloadData hide built-in export actions in desktop/mobile views. Client file actions revalidate /auth/me with credentials and no-store before creating downloadable output. This also rejects stale tabs. Visible raw data can still be copied or independently converted into a file by a user; this policy governs the application's own export features.

## Inventory and verification matrix

ADMIN is permitted and ASSISTANT is denied for every data-export row. Client actions fail closed without an authenticated ADMIN identity. Server routes return 403 for authenticated ASSISTANT and 401 without a valid session. Existing filters/calculations/file contents are retained.

| Feature | Page | Action / implementation | Backend route and previous authorization | New enforcement | Coverage |
| --- | --- | --- | --- | --- | --- |
| Store 360 workbook | /store-360 | Store360ExportControl / downloadStore360Export | POST /store-insights/export; auth + StoreAccessService | DownloadGuard + client revalidation + hidden whole control | download-authorization.spec.ts; store-insights-export.spec.ts; real HTTP including cross-store denial |
| Monthly operations workbook | /monthly-operations-report | downloadXlsx | GET /monthly-operations-report/export; auth + report scope | DownloadGuard + hidden button | download-authorization.spec.ts; monthly-operations-report.service.spec.ts; real HTTP |
| Google Review weekly XLSX | /google-review-kpi | handleDownloadWeeklyExport | GET /google-review-kpi/weekly/export?format=xlsx; auth + canonical store validation | DownloadGuard + client revalidation + hidden action | download-authorization.spec.ts; canonical export regression; real HTTP |
| Google Review weekly CSV | /google-review-kpi | same weekly export action, CSV format | GET /google-review-kpi/weekly/export?format=csv; same route checks | Same shared guard | Same route guard matrix and canonical export regression |
| LINE OA CSV | /storemanagement | exportLineOaCsv | GET /line-official-accounts/export.csv; ADMIN | Existing ADMIN + DownloadGuard + client revalidation + hidden action | download-authorization.spec.ts; canonical export regression; real HTTP |
| LINE OA credential handover CSV | /storemanagement | exportLineOaHandoverCsv | GET /line-official-accounts/handover.csv; ADMIN + audit | Existing ADMIN + DownloadGuard + client revalidation + hidden action | download-authorization.spec.ts; real HTTP on empty-credential local fixtures; secret contents never logged |
| Download Center store master | /download-center | downloadStoreMaster uses LINE OA CSV | GET /line-official-accounts/export.csv | Same server guard + client revalidation + hidden action | Shared route matrix; frontend policy tests |
| Download Center daily LINE followers | /download-center | downloadLine / daily follower workbook | Client workbook from authenticated viewing APIs | Client revalidation + hidden action | Frontend policy and existing follower workbook tests |
| Follower daily workbook dialog | /follower-insights | DailyFollowerGrowthExportControl | Client XLSX | Client revalidation + hidden whole control | Frontend policy and follower workbook tests |
| Follower daily workbook button | /follower-insights desktop/mobile | DailyFollowerGrowthDownloadButton | Client XLSX | Same guarded workbook helper + hidden action | Frontend policy and follower workbook tests |
| Follower store breakdown CSV | /follower-insights desktop/mobile | exportStoreCsv | Client CSV | Client revalidation + hidden action | Frontend policy and follower tests |
| Friend source link workbook | /friend-source-links desktop/mobile | handleExportExcel / triggerBrowserDownload; distribution/detail workbooks | Client XLSX from viewing APIs formerly ADMIN | Client revalidation + hidden export menu/actions | Frontend policy and existing workbook tests |
| Purchase audience CSV desktop | /admin/purchase-analytics | downloadAudience | Client CSV from scoped audience API | Client revalidation + hidden action | Frontend policy and purchase regression tests |
| Purchase audience CSV mobile | /admin/purchase-analytics | downloadAudience / onDownload | Client CSV | Same policy + hidden action | Frontend policy and purchase regression tests |
| Purchase intelligence/full report CSV | /admin/purchase-analytics | downloadAudience | Client CSV | Same policy + hidden actions | Frontend policy and purchase regression tests |
| Google Review monthly CSV | /google-review-kpi | handleDownloadCsv, all/filtered variants | Client CSV | Client revalidation + hidden actions | Frontend policy and Google Review regression tests |
| Google Review monthly JSON | /google-review-kpi | handleDownloadJson | Client JSON | Same policy | Frontend policy and Google Review regression tests |
| Google Review import history JSON | /google-review-kpi | handleDownloadImportHistoryJson | Client JSON | Same policy | Frontend policy and Google Review regression tests |
| Google Review needs-attention CSV | /google-review-kpi | handleDownloadNeedsAttentionCsv | Client CSV | Same policy | Frontend policy and Google Review regression tests |
| Google Review single-store JSON | /google-review-kpi | handleDownloadSingleStoreJson | Client JSON | Same policy | Frontend policy and Google Review regression tests |
| LINE chat blocked-mapping CSV | /operations/line-chat-health | downloadBlockedCustomersCsv | Client CSV; administration page already ADMIN | Client revalidation + hidden action, existing administration gate retained | Frontend policy and LINE chat UI regressions |
| Rich menu overview CSV | /rich-menus/overview | exportCsv | Client CSV | Client revalidation + hidden action | Frontend policy and rich menu regressions |
| TikTok dashboard CSV | /tiktok | exportCsv | Client CSV from normal dashboard data | Client revalidation + hidden action | Frontend policy and TikTok dashboard regressions; collector untouched |

Repository searches include attachment headers, Blob/ObjectURL downloads, anchor download attributes, XLSX generation, CSV/JSON files, archives, PDF reports and signed URL generation. No additional generated data ZIP/PDF or signed data-report download endpoint was found.

### Operational files and public installation assets

These are deliberately separate from data export:

- GET /messages/:messageId/media serves inline message images/video/PDF with existing store checks. The explicit chat attachment Save action in message-media.tsx is normal operational handling of one received attachment. It remains available; it is not an analytics/report export.
- Public signed message image/video URLs, rich-message preview images, and GET /d/:token inline PDF links support LINE delivery and ordinary document viewing. Blocking them by HQ role would break message rendering or public recipients. They retain their existing access/signature/token rules.
- Frontend image/video preview ObjectURLs and Review15 uploaded screenshot previews are rendering, not export.
- Public /download and /downloads/... APK installation files and release assets are excluded from business-data download policy. Installation does not require an application data-export role.

This classification must remain explicit when new downloads are added. New data-file routes must use RequireDownload; new built-in client exports must use DownloadAction plus authorizeDataDownload.

## Account administration and lockout

Only ADMIN can enter HQ account administration or invoke its read/mutation routes. The role dialog identifies the account, describes Administrator/Assistant consequences, requires confirmation for self-demotion and displays server errors without optimistic saved state.

Role changes acquire a shared PostgreSQL transaction advisory lock, recheck the active actor, count active administrators before an active-admin demotion, update only role and canManageAccounts, then create HQ_ACCOUNT_ROLE_CHANGED in the existing AuditLog table within the same transaction. Actor, target, previousRole, newRole and createdAt are persisted. An audit failure rolls the change back. Deactivation uses the same lock/count invariant and preserves the stronger existing prohibition on self-deactivation. No role change resets passwords, changes platform grants, removes membership, deactivates a user or revokes sessions.

Normal scoped data views, Reply and Main OA continue using existing grants. Reviewed previously ADMIN-only operational reads (campaign history, templates/rules, rich-menu overview, friend-link lists/summary) are available to HQ ASSISTANT with all-store scope. Global legacy read APIs are not silently granted to a limited-store Assistant; privileged configuration, audit/worker controls and mutations retain their existing ADMIN gate. Coupon and mass-message pages retain history views for Assistant without creation/status mutation controls.

## Deployment and rollback

Use normal migration deployment and normal release of both applications. No production user is changed by SQL or migration. The target account is changed only through the supported role dialog/API and verified against its previous grants and audit history.

The enum addition is backward compatible for existing records and has no destructive down migration. Prefer rolling forward. Before returning to an older binary that does not understand ASSISTANT, an authorized administrator must explicitly restore affected roles through the supported API and verify them; keep the enum addition and audit history. Do not drop/rebuild the enum or bulk-remap users to roll back.
