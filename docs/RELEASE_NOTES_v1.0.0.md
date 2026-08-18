# OPPO LINE OA Chat — Release Notes v1.0.0 (Production Pilot)

**Release Date:** 2026-08-17  
**Version:** `1.0.0+1`  
**Package Identifier:** `com.oppo.lineoahub`  
**Target Audience:** OPPO Retail Branch Managers (BM) and Product Consultants (PC)  
**Distribution Channel:** Private Pilot APK Distribution (`https://lineoppo.click/download`)

---

## 1. Package & Binary Information

| Attribute | Details |
| :--- | :--- |
| **Filename** | `oppo-line-oa-chat-hub-v1.0.0-production.apk` |
| **File Size** | **55.8 MB** (58,542,080 bytes) |
| **SHA-256 Checksum** | `501eda26b1b6a0bcbb887d1b9e447482e0cc5785133cd85c4b3f26efc26e5162` |
| **Minimum Android Version** | Android 7.0 (API Level 24) |
| **Target Android Version** | Android 14.0 (API Level 34) |
| **Rendering Engine** | Flutter Impeller (OpenGLES Backend) |
| **Production Backend** | `https://line-unified-inbox-production-544f.up.railway.app` |
| **Download Landing Page** | `https://lineoppo.click/download` |
| **Direct APK Link** | `https://lineoppo.click/downloads/oppo-line-oa-chat-hub-v1.0.0-production.apk` |

---

## 2. Key Capabilities Included in v1.0.0

### Core Inbox & Customer Chat
- **Real-Time Multi-Store Conversation Inbox:** View and handle active customer threads with real-time sync.
- **Queue Filtering & Priority Tabs:** Switch between **Priority**, **All**, **Need Reply**, and **Completed** queues.
- **Rich Media & Payment Slips:** Render customer text messages, photo attachments, and bank payment slips directly in the thread.
- **Direct Outbound Replying:** Reply directly to customer LINE OA chats with outbound message logging and SLA tracking.

### Verified Purchase Information (Provenance-Aware)
- **Manual Purchase Logging Modal:** Capture verified customer sales with channel (`Store` vs. `Online`), payment method (`Cash`, `Transfer`, `Installment`, `Credit Card`), and product model/variant.
- **Audit Provenance:** All purchase updates record the recording BM user ID and timestamp.
- **Strict Data Isolation:** Manual verified purchases are strictly separated from rule-based AI keyword classifications.

### Security & Access Control
- **Role-Based Store Isolation:** Staff access is restricted exclusively to assigned active stores via backend `StoreAccessService`.
- **Password Policy Enforcement:** $\ge 12$ characters (uppercase, lowercase, numeric, symbol) with real-time UI validation checkmarks.
- **Forced Password Change:** Automatic redirection to password change screen for initial onboarding or admin-reset accounts.
- **Session Hygiene:** 12-hour mobile bearer token stored securely with full server-side token hashing.

---

## 3. Installation Instructions for Retail Staff

### Method 1: Scan QR Code / Open Download Link on Mobile Device
1. Open camera or mobile browser and navigate to:  
   👉 **`https://lineoppo.click/download`**
2. Tap **"ดาวน์โหลด APK (Download APK)"**.
3. Once downloaded, tap the file in your notification bar or Downloads folder.
4. If prompted with a security prompt:
   - Tap **"Settings (ตั้งค่า)"**.
   - Enable **"Allow from this source (อนุญาตจากแหล่งที่มานี้)"**.
5. Tap **"Install (ติดตั้ง)"** $\rightarrow$ Tap **"Open (เปิด)"**.

### Method 2: Sideload via USB / ADB
```bash
adb install -r oppo-line-oa-chat-hub-v1.0.0-production.apk
```

---

## 4. Verification Checksum Command
To verify APK integrity prior to deployment:
```bash
# macOS / Linux
shasum -a 256 oppo-line-oa-chat-hub-v1.0.0-production.apk
# Expected output: dc0d534c35beae03b7a64c92f970c81b26a970ca9977e20f7c52eb8b9ddefb2c

# Windows PowerShell
Get-FileHash oppo-line-oa-chat-hub-v1.0.0-production.apk -Algorithm SHA256
```
