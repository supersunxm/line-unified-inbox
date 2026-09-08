# TikTok Login Kit App Review Submission Guide

**Product**: TikTok Login Kit (Web OAuth 2.0)  
**Application**: OPPO Brand Shop Social Directory (`lineoppo.click`)  
**Target Environment**: Production (`https://lineoppo.click`) / Sandbox Staging  
**Status**: REVIEW_PACKAGE_READY_WITH_CONFIGURATION  

---

## 1. App Name Recommendation
- **Recommended English Name**: `OPPO Brand Shop Social Directory`
- **Recommended Thai Name**: `OPPO Brand Shop ค้นหาสาขาและช่องทางติดต่อ`
- **Rationale**: Clearly describes the dual customer-facing directory and verified retailer channel connection without using generic or misleading terminology.

## 2. App Description
> OPPO Brand Shop Social Directory (`lineoppo.click`) is the official public directory platform for OPPO retail brand shops in Thailand. It enables retail customers nationwide to discover nearby branches, verify branch identity, and access official communication channels (LINE Official Account, TikTok, Google Maps). Authorized store account operators and retail staff connect their official branch TikTok accounts through TikTok Login Kit to display authenticated social profiles, official usernames, and audience reach metrics on their public store profile and staff operational analytics dashboard.

## 3. Website URL
- **Production URL**: `https://lineoppo.click`
- **Public Store Directory**: `https://lineoppo.click/stores`
- **Integration Overview**: `https://lineoppo.click/tiktok-integration`
- **Public Connection Entry**: `https://lineoppo.click/connect/tiktok`

## 4. Redirect URI
- **Canonical Callback URI**: `https://lineoppo.click/tiktok/callback`
- **Local / Sandbox Callback URI**: `http://localhost:3000/tiktok/callback` (for local development only)

## 5. Products Requested
- **TikTok Login Kit (Web)** — Version 2

## 6. Scopes Requested
The integration requests strictly the **3 minimum read-only scopes**:
1. `user.info.basic`
2. `user.info.profile`
3. `user.info.stats`

> [!IMPORTANT]
> **Strictly Excluded Scopes**:
> - `video.list` is NOT requested.
> - `video.publish` and `video.upload` are NOT requested.
> - Direct Message / Chat API scopes are NOT requested.
> - Research API scopes are NOT requested.
> - Content Posting API scopes are NOT requested.

## 7. Exact Scope Justification

| Requested Scope | User Info Fields Returned | Business Justification & Usage in Application |
|---|---|---|
| `user.info.basic` | `open_id`, `avatar_url`, `display_name` | **Authentication & Identity Display**: Verifies user identity via unique `open_id` and displays the store account's official display name and profile avatar on the connected store confirmation screen and staff dashboard. |
| `user.info.profile` | `username`, `profile_deep_link`, `bio_description`, `is_verified` | **Public Store Profile Channel**: Displays the verified `@username` and deep link to the TikTok profile on the branch's public store page (`/stores/[identifier]`) so customers can follow and interact with the authentic store channel. |
| `user.info.stats` | `follower_count`, `following_count`, `likes_count`, `video_count` | **Audience Reach & Transparency**: Displays total followers, likes, and public video counts on the confirmation page and provides retail management with aggregate store reach metrics. |

## 8. Complete Reviewer Testing Flow
1. **Discover Directory**: Navigate to `https://lineoppo.click` and browse `/stores`. Inspect active OPPO Brand Shop branches across Thailand with LINE, TikTok, and Map buttons.
2. **Review Explanation**: Visit `https://lineoppo.click/tiktok-integration` to review the official integration boundaries, accessed fields, and security commitments.
3. **Initiate Connection**: Navigate to `https://lineoppo.click/connect/tiktok`. Click the primary call-to-action button **"เชื่อมต่อกับ TikTok"**.
4. **Consent Dialog**: The browser redirects to TikTok standard OAuth dialog (`https://www.tiktok.com/v2/auth/authorize/`). Verify that TikTok prompts ONLY for profile information and statistics (`user.info.basic`, `user.info.profile`, `user.info.stats`).
5. **Authorization**: Reviewer logs in with an authorized Sandbox test account and clicks **Authorize**.
6. **Callback & Server-Side Exchange**: TikTok redirects back to `https://lineoppo.click/tiktok/callback?code=...&state=...`. The server securely exchanges the authorization code for tokens, encrypts tokens with AES-256-GCM, and queries `/v2/user/info/`.
7. **Confirmation Display**: Reviewer lands on `/connect/tiktok/success` displaying:
   - Profile avatar and display name
   - Official `@username`
   - Real-time statistics: Followers, Following, Total Likes, Videos
   - Confirmation badge: *"ข้อมูลนี้ได้รับอนุญาตจากบัญชี TikTok ที่เชื่อมต่อ"*
   - Clear read-only reassurance: *"ระบบจะไม่โพสต์ แก้ไข หรือลบคอนเทนต์ใดๆ บน TikTok"*
   - Disconnection guidance: How to revoke access via TikTok mobile app or support email.
8. **Verify Zero Write Capability**: Confirm there are no video creation, posting, editing, or message sending controls anywhere on the website.

## 9. Sandbox Test Flow
For TikTok App Reviewers testing in Developer Sandbox:
1. Ensure the tester account is added as a **Sandbox User** in the TikTok Developer Portal under the App's Sandbox settings.
2. Configure `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` in application environment.
3. Initiate authorization via `https://lineoppo.click/connect/tiktok`.
4. Log into TikTok with the Sandbox tester credentials.
5. Grant consent.
6. Verify successful redirect to `/connect/tiktok/success` showing test account metrics.
7. Account shows as verified and unassigned (`ยังไม่ได้ผูกกับสาขาในระบบ`) without crashing or requiring existing StoreMaster pre-mapping.

## 10. Demo Video Shot List
A 2-to-3 minute video recording following `TIKTOK_REVIEW_DEMO_SCRIPT.md`:
- **Shot 1**: Homepage overview at `https://lineoppo.click`.
- **Shot 2**: Navigating the public Store Directory (`/stores`) showing real OPPO branch profiles.
- **Shot 3**: Viewing a store profile with TikTok channel link.
- **Shot 4**: Visiting `/tiktok-integration` showing permissions disclosure and non-posting commitment.
- **Shot 5**: Opening `/connect/tiktok` showing Thai connection explanation and CTA.
- **Shot 6**: Clicking "เชื่อมต่อกับ TikTok", redirecting to TikTok OAuth consent page.
- **Shot 7**: Close-up of requested scopes on TikTok dialog (`user.info.basic`, `user.info.profile`, `user.info.stats`).
- **Shot 8**: Authorizing the connection with Sandbox credentials.
- **Shot 9**: Redirect to `/connect/tiktok/success` showing avatar, `@username`, and 4 live stats.
- **Shot 10**: Highlighting the read-only notice and revocation instructions.
- **Shot 11**: Showing Privacy Policy at `/privacy` and Terms of Service at `/terms`.

## 11. Privacy Policy URL
- **URL**: `https://lineoppo.click/privacy`
- **Languages**: Thai, English, Chinese
- **Sections**: Identifies collected fields, lawful basis, zero sale/monetization of data, token encryption (AES-256-GCM), 30-day retention/caching rules, and revocation/deletion contact (`obsthailand@gmail.com`).

## 12. Terms of Service URL
- **URL**: `https://lineoppo.click/terms`
- **Languages**: Thai, English, Chinese
- **Sections**: Authorized usage, scoped OAuth 2.0 access, customer directory display, and operator responsibilities.

## 13. Domain Verification Status & Checklist
- [x] Domain is live with TLS 1.3 certificate: `https://lineoppo.click`
- [x] Canonical root `/` serves public customer experience
- [x] Webhook / OAuth callback endpoints respond on same origin (`https://lineoppo.click/tiktok/callback`)
- [ ] TikTok Developer Portal domain verification file or DNS TXT record (must be completed by portal administrator in TikTok Developer Portal when submitting).

## 14. App Icon Requirements & Check
- App icon should feature the OPPO green brand circle or unified retail mark (512x512 PNG, square, transparent or solid background).
- File asset: `frontend/public/icon.png` or `frontend/public/apple-icon.png`.

## 15. Submission Readiness & Remaining Steps
- **Code Readiness**: **COMPLETE**. Minimal scopes enforced, store binding decoupled, explanation and connection pages live, privacy/terms updated.
- **Configuration Required**: Operator must input `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET` in environment when conducting live review or recording the demo video.
- **Action Required Before Submission**:
  1. Record demo video per `TIKTOK_REVIEW_DEMO_SCRIPT.md`.
  2. Upload demo video to YouTube (unlisted) or Vimeo.
  3. Enter URLs and scope justifications into TikTok Developer Portal.
  4. Submit for review.
