# v2 terminology

The words v2 shows to users, monthly terms first. One term per concept; the same word
means the same number on every v2 page, in the monthly report and in the LINE summary.
Definitions and their sources are in `decisions.md`.

## Monthly terms (main views, report, LINE summary)

| Term (Thai, as shown) | Meaning |
|---|---|
| ภาพรวมเดือน | The /v2 main view: network KPIs for the selected month. |
| เดือน | A Bangkok calendar month, selected with `?month=YYYY-MM`. |
| เดือนนี้ยังไม่ปิด | The selected month is the current one: numbers are month-to-date and may still change. |
| ปิดเดือนแล้ว | A past month. |
| 1–7 ต.ค. 2026 เทียบ 1–7 ก.ย. 2026 | The period label every number carries: the period, then what it is compared with. |
| ทั้งเดือน | A whole calendar month. |
| แชท / แชททั้งหมด | Chats whose latest message is in the period (same as /chats "ทั้งหมด"). |
| ยังไม่ตอบ | Chats in the period that have not been answered (same as /chats "ยังไม่ตอบ"). Every customer message needs an answer, stickers included. |
| ตอบแล้ว | Chats in the period that have been answered (same as /chats "ตอบแล้ว"). |
| ตอบแล้ว % | ตอบแล้ว ÷ แชท. |
| ตอบใน 24 ชม. | Share of customer messages answered within 24 hours (same as /replymessage). Target 90%. |
| เป้า | The target (90% for ตอบใน 24 ชม.). |
| Δ / เทียบเดือนก่อน | Change vs the comparison period. For ยังไม่ตอบ, a count; for rates, percentage points ("จุด"). |
| partner | The dealer that operates the store, from the store name "By …". |
| ไม่ระบุ partner | Stores whose name has no "By …". |
| อันดับใน partner | The store's position among its partner's stores (1 = best). |
| สาขาที่มีข้อมูลแชท N/M | Stores with at least one chat in the period, out of all stores. |
| แชทน้อยกว่า 10 แชท | Low sample: the rate is shown muted with n and is not compared with the target. |
| แท็กชื่อลูกค้า | Information staff put in the customer's name in LINE OA Manager: source (เช่น Online), product, service (เช่น ติดฟิล์ม), purchase month (MM/YY). |
| ความครบของแท็ก | Share of chats whose customer name carries at least one recognised tag. |
| รอนานสุด | Calendar time since the oldest unanswered chat's latest message (same as /chats). |

## "ตอนนี้" tab only

| Term | Meaning |
|---|---|
| ตอนนี้ | The secondary tab with the live list. Not a monthly number. |
| ตามวันนี้ | The live list of stores where customers have waited ≥ 60 business minutes since yesterday 10:00 (unchanged from before). |
| นับเฉพาะเวลาเปิดร้าน | Waiting time counted only during 10:00–21:00 (assumed opening hours). Only in this tab. |

## Reasons a number is "—"

| Shown | Meaning |
|---|---|
| ไม่มีแชทในช่วงนี้ | No chats in the period, so there is nothing to rate. |
| ระบบยังไม่ได้เก็บข้อมูลช่วงนี้ | The period is before the system recorded reply status (before Sep 2026). |
| โหลดข้อมูลไม่สำเร็จ | The source failed to load. |
| ไม่ใช้กับรายการนี้ | The measure does not apply. |
| ข้อมูลอาจไม่เป็นปัจจุบัน | The source is known to be out of date. |

## Internal terms that must not appear in the UI

| Internal | Say instead |
|---|---|
| mirror, Live Mirror, Chat Mirror | การเก็บแชท |
| resolver, reply-state resolver | (nothing; say ตอบแล้ว / ยังไม่ตอบ) |
| NOTIFIED_BM, NOT_REPLIED, REPLIED | ยังไม่ตอบ / ตอบแล้ว |
| fleet | ทุกสาขา |
| replyAnalytics, bm-reply-status-summary | (nothing; say "เหมือนหน้าแชทร้านค้า" or "เหมือนหน้าอัตราตอบกลับ 24 ชม.") |
| Parser v3, nicknameDerivedMetadata | แท็กชื่อลูกค้า |
