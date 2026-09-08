# TikTok App Review Demo Video Recording Script

**Target Duration**: 2 to 3 minutes  
**Format**: Screen recording (1080p, 1920x1080) with English voiceover or clear English subtitles  
**App Name**: OPPO Brand Shop Social Directory (`lineoppo.click`)  
**Target Scopes**: `user.info.basic`, `user.info.profile`, `user.info.stats`  

---

## Recording Guidelines
- Use a clean browser profile (no personal bookmarks or unrelated tabs).
- Ensure the address bar clearly shows `https://lineoppo.click`.
- Do not blur or obscure URL paths.
- Follow the sequence below without skips.

---

## 14-Step End-to-End Demo Script

### Step 1: Open Website Homepage
- **Action**: Navigate to `https://lineoppo.click` in the browser.
- **Visual**: Show the public landing page titled *"OPPO Brand Shop · ค้นหาสาขา & ช่องทางติดต่อ"*.
- **Narration / Caption**:
  > "Welcome to OPPO Brand Shop Social Directory at lineoppo.click, the official directory for OPPO retail branches across Thailand."

### Step 2: Showcase Public Store Directory
- **Action**: Click on "ค้นหาร้าน" or search for a region (e.g., "ภาคเหนือ" or "กรุงเทพมหานคร").
- **Visual**: Show the store directory listing real store cards with province tags, address previews, and action buttons.
- **Narration / Caption**:
  > "Customers can search and browse over 150 OPPO Brand Shop locations, view addresses, and discover official communication channels."

### Step 3: Open a Public Store Profile
- **Action**: Click into an individual store profile (e.g. `/stores/29039` or `/stores/obs-central-phitsanulok-by-oppo-2-29039`).
- **Visual**: Show the store's profile page containing official LINE Official Account and TikTok channel links.
- **Narration / Caption**:
  > "Each store profile displays official contact options, including direct access to the branch's verified TikTok account."

### Step 4: Navigate to TikTok Integration Explanation Page
- **Action**: Click "TikTok Integration" in the footer or navigate directly to `https://lineoppo.click/tiktok-integration`.
- **Visual**: Scroll through `/tiktok-integration`, highlighting the 4 sections:
  1. What the integration does
  2. Data accessed (Profile, Username, Followers, Following, Likes, Video count)
  3. Purpose
  4. Strict boundaries ("No posting, no modifying, no direct messages")
- **Narration / Caption**:
  > "We provide full transparency at /tiktok-integration, explaining that our integration is strictly read-only, requesting only basic user info and public metrics, with absolutely no content posting or messaging capabilities."

### Step 5: Navigate to Public Connection Page
- **Action**: Click "ไปที่หน้าเชื่อมต่อ TikTok" or open `https://lineoppo.click/connect/tiktok`.
- **Visual**: Show the connection setup screen titled *"เชื่อมต่อ TikTok กับ OPPO Brand Shop"*. Show the bulleted list of accessed data and the safety notice.
- **Narration / Caption**:
  > "Authorized store account owners connect their TikTok accounts at /connect/tiktok to verify their channel and sync their public reach metrics."

### Step 6: Initiate TikTok Authorization
- **Action**: Click the green **"เชื่อมต่อกับ TikTok"** button.
- **Visual**: The browser navigates via 302 redirect to `https://www.tiktok.com/v2/auth/authorize/`.
- **Narration / Caption**:
  > "Clicking the connect button redirects securely to the official TikTok OAuth 2.0 authorization screen."

### Step 7: Review Requested Permissions on TikTok Dialog
- **Action**: Pause on the TikTok consent dialog.
- **Visual**: Clearly frame the requested permissions shown by TikTok:
  - *Access your profile info (avatar, display name)* (`user.info.basic`)
  - *Access your profile details (username)* (`user.info.profile`)
  - *Access your profile statistics (followers, likes)* (`user.info.stats`)
- **Narration / Caption**:
  > "Notice that our application requests only the three minimum scopes: user.info.basic, user.info.profile, and user.info.stats. No video publishing, video uploading, or editing permissions are requested."

### Step 8: Authorize with Sandbox / Test Account
- **Action**: Click **"Authorize"** on the TikTok consent dialog.
- **Visual**: Show the approval spinner and seamless return redirect.
- **Narration / Caption**:
  > "The authorized user confirms consent, and TikTok redirects back to our secure server-side callback."

### Step 9: Return to Callback Handler
- **Visual**: Briefly observe the redirect through `https://lineoppo.click/tiktok/callback` to the success page.
- **Narration / Caption**:
  > "Our backend validates the OAuth state cookie, securely exchanges the authorization code server-side, encrypts the access tokens with AES-256-GCM, and queries the official User Info endpoint."

### Step 10: Show Connected TikTok Profile
- **Visual**: The user arrives at `https://lineoppo.click/connect/tiktok/success` (or `/tiktok/connect/success`).
- **Elements Shown**:
  - Connected checkmark icon
  - TikTok avatar image
  - Display name (e.g., "OPPO Retail Test Store")
  - Account handle (e.g., `@oppo_test_store`)
- **Narration / Caption**:
  > "The confirmation page confirms successful connection, displaying the authenticated TikTok avatar, display name, and @username."

### Step 11: Display Verified Official Metrics
- **Visual**: Zoom in on the 4 metric cards:
  - **ผู้ติดตาม (Followers)**: e.g. 1,250
  - **กำลังติดตาม (Following)**: e.g. 85
  - **ยอดถูกใจทั้งหมด (Total Likes)**: e.g. 24,600
  - **วิดีโอ (Videos)**: e.g. 42
- **Highlight**: The confirmation badge *"ข้อมูลนี้ได้รับอนุญาตจากบัญชี TikTok ที่เชื่อมต่อ"*
- **Narration / Caption**:
  > "The four authorized statistics—Followers, Following, Total Likes, and Video Count—are displayed accurately and verified as authorized data."

### Step 12: Demonstrate Zero Posting Functionality
- **Visual**: Show the full success page and navigation.
- **Elements Highlighted**:
  - The explicit statement: *"การเชื่อมต่อนี้เป็นแบบอ่านอย่างเดียว (Read-only) ระบบจะไม่โพสต์ แก้ไข หรือลบคอนเทนต์ใดๆ บน TikTok"*
  - The absence of any upload buttons, publish forms, or draft composers.
- **Narration / Caption**:
  > "There is no video upload, publishing, or content modification functionality in the entire application. The integration is strictly read-only."

### Step 13: Showcase Disconnection Guidance
- **Visual**: Highlight the bottom section on the success page:
  - *"การยกเลิกการเชื่อมต่อ"*
  - Instructions on how to revoke permissions within the TikTok mobile app (Settings & Privacy > Security & Permissions > Third-party Apps) or via email to `obsthailand@gmail.com`.
- **Narration / Caption**:
  > "Users are given clear instructions on how to revoke access at any time directly through their TikTok application settings or by contacting our operations team."

### Step 14: Review Privacy Policy and Terms of Service
- **Action**: Click through to `https://lineoppo.click/privacy` and `https://lineoppo.click/terms`.
- **Visual**:
  - Show the Privacy Policy section covering TikTok data collection, token encryption, and deletion policies.
  - Show the Terms of Service outlining authorized store account connection terms.
- **Narration / Caption**:
  > "Finally, our Privacy Policy and Terms of Service are publicly accessible in Thai, English, and Chinese, fully detailing our data handling, AES-256 token encryption, and user rights. Thank you for reviewing OPPO Brand Shop Social Directory."
