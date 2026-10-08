import { pickLanguageText, type AppLanguage } from "../../app/language-utils.ts";

const v2BaseTranslations = {
  "monthOverview": {
    "th": "ภาพรวมเดือน",
    "en": "Monthly overview",
    "zh": "月度概览"
  },
  "now": {
    "th": "ตอนนี้",
    "en": "Now",
    "zh": "当前"
  },
  "stores": {
    "th": "สาขา",
    "en": "Stores",
    "zh": "门店"
  },
  "storePartners": {
    "th": "Partner ของสาขา",
    "en": "Store partners",
    "zh": "门店合作伙伴"
  },
  "customersSales": {
    "th": "ลูกค้าและการขาย",
    "en": "Customers and sales",
    "zh": "客户与销售"
  },
  "growth": {
    "th": "การเติบโต",
    "en": "Growth",
    "zh": "增长"
  },
  "sendMessage": {
    "th": "ส่งข้อความ",
    "en": "Send messages",
    "zh": "发送消息"
  },
  "report": {
    "th": "รายงาน",
    "en": "Report",
    "zh": "报表"
  },
  "admin": {
    "th": "ผู้ดูแลระบบ",
    "en": "Administration",
    "zh": "系统管理"
  },
  "newVersion": {
    "th": "เวอร์ชันใหม่ (v2)",
    "en": "New version (v2)",
    "zh": "新版（v2）"
  },
  "navigation": {
    "th": "เมนู v2",
    "en": "v2 navigation",
    "zh": "v2 导航"
  },
  "tools": {
    "th": "เครื่องมือ",
    "en": "Tools",
    "zh": "工具"
  },
  "backLegacy": {
    "th": "กลับไปเวอร์ชันเดิม",
    "en": "Back to previous version",
    "zh": "返回旧版"
  },
  "refresh": {
    "th": "รีเฟรช",
    "en": "Refresh",
    "zh": "刷新"
  },
  "logout": {
    "th": "ออกจากระบบ",
    "en": "Log out",
    "zh": "退出登录"
  },
  "lightMode": {
    "th": "สลับเป็นโหมดสว่าง",
    "en": "Switch to light mode",
    "zh": "切换为浅色模式"
  },
  "darkMode": {
    "th": "สลับเป็นโหมดมืด",
    "en": "Switch to dark mode",
    "zh": "切换为深色模式"
  },
  "month": {
    "th": "เดือน",
    "en": "Month",
    "zh": "月份"
  },
  "thisMonth": {
    "th": " (เดือนนี้)",
    "en": " (This month)",
    "zh": "（本月）"
  },
  "followBadge": {
    "th": "{count} ร้านต้องตามวันนี้",
    "en": "{count} stores need follow-up today",
    "zh": "今天需跟进{count}家门店"
  },
  "overviewViews": {
    "th": "มุมมองภาพรวม",
    "en": "Overview views",
    "zh": "概览视图"
  },
  "loading": {
    "th": "กำลังโหลด",
    "en": "Loading",
    "zh": "正在加载"
  },
  "loadFailed": {
    "th": "โหลดไม่สำเร็จ",
    "en": "Unable to load",
    "zh": "加载失败"
  },
  "notCollected": {
    "th": "ระบบยังไม่ได้เก็บข้อมูลช่วงนี้",
    "en": "Data has not been collected for this period",
    "zh": "尚未采集此期间的数据"
  },
  "closeError": {
    "th": "ตรวจสถานะปิดเดือนไม่ได้ จึงแสดงตัวเลขสด: {error}",
    "en": "Unable to check month-close status; showing live figures: {error}",
    "zh": "无法检查月度结算状态，现显示实时数据：{error}"
  },
  "excludedStores": {
    "th": "ไม่นับ {count} ร้านที่ยังไม่มี LINE OA ({names})",
    "en": "Excludes {count} stores without LINE OA ({names})",
    "zh": "不计入{count}家尚无 LINE OA 的门店（{names}）"
  },
  "unattributed": {
    "th": "แชท {count} แชทไม่อยู่ในสาขาที่แสดง",
    "en": "{count} chats are outside the stores shown",
    "zh": "有{count}个聊天不属于所显示的门店"
  },
  "wholeMonth": {
    "th": "ทั้งเดือน {month}",
    "en": "Full month: {month}",
    "zh": "整月：{month}"
  },
  "period": {
    "th": "{days} {month}",
    "en": "{month}, days {days}",
    "zh": "{month}，{days}日"
  },
  "comparison": {
    "th": "{current} เทียบ {previous}",
    "en": "{current} vs {previous}",
    "zh": "{current} 对比 {previous}"
  },
  "openMonth": {
    "th": "เดือนนี้ยังไม่ปิด (ข้อมูลถึงวันที่ {day})",
    "en": "Month still open (data through day {day})",
    "zh": "本月尚未结算（数据截至{day}日）"
  },
  "closedMonth": {
    "th": "ปิดเดือนแล้ว",
    "en": "Month closed",
    "zh": "月份已结算"
  },
  "repliedRate": {
    "th": "ตอบแล้ว %",
    "en": "Replied %",
    "zh": "已回复率"
  },
  "rate24": {
    "th": "ตอบใน 24 ชม. %",
    "en": "Replied within 24 hours %",
    "zh": "24小时内回复率"
  },
  "howCounted": {
    "th": "นับยังไง",
    "en": "How it is counted",
    "zh": "统计方式"
  },
  "mainKpis": {
    "th": "ตัวชี้วัดหลัก",
    "en": "Key KPIs",
    "zh": "核心 KPI"
  },
  "metric": {
    "th": "ตัวชี้วัด",
    "en": "Metric",
    "zh": "指标"
  },
  "change": {
    "th": "เปลี่ยน",
    "en": "Change",
    "zh": "变化"
  },
  "target": {
    "th": "เป้า",
    "en": "Target",
    "zh": "目标"
  },
  "chats": {
    "th": "แชท",
    "en": "Chats",
    "zh": "聊天"
  },
  "unanswered": {
    "th": "ยังไม่ตอบ",
    "en": "Unanswered",
    "zh": "未回复"
  },
  "tagCoverage": {
    "th": "ความครบของแท็ก",
    "en": "Tag coverage",
    "zh": "标签覆盖率"
  },
  "noStores": {
    "th": "ยังไม่มีสาขา",
    "en": "No stores yet",
    "zh": "暂无门店"
  },
  "reportLink": {
    "th": "รายงาน ↗",
    "en": "Report ↗",
    "zh": "报表 ↗"
  },
  "allStores": {
    "th": "ทุกสาขา",
    "en": "All stores",
    "zh": "全部门店"
  },
  "topUnanswered": {
    "th": "สาขาที่ยังไม่ตอบมากที่สุด",
    "en": "Stores with the most unanswered chats",
    "zh": "未回复聊天最多的门店"
  },
  "topTen": {
    "th": "{period} · 10 อันดับ",
    "en": "{period} · Top 10",
    "zh": "{period} · 前10名"
  },
  "viewStores": {
    "th": "ดูทุกสาขา →",
    "en": "View all stores →",
    "zh": "查看全部门店 →"
  },
  "noUnanswered": {
    "th": "ไม่มีแชทที่ยังไม่ตอบในช่วงนี้",
    "en": "No unanswered chats in this period",
    "zh": "此期间没有未回复聊天"
  },
  "loadError": {
    "th": "โหลดข้อมูลไม่สำเร็จ: {error}",
    "en": "Unable to load data: {error}",
    "zh": "无法加载数据：{error}"
  },
  "rate24Label": {
    "th": "ตอบใน 24 ชม.",
    "en": "Within 24 hours",
    "zh": "24小时内回复"
  },
  "partnerSort": {
    "th": "{period} · เรียงตามช่องว่างถึงเป้าตอบใน 24 ชม. (ห่างสุดก่อน)",
    "en": "{period} · Sorted by gap to the 24-hour response target (largest first)",
    "zh": "{period} · 按24小时回复目标差距排序（差距最大优先）"
  },
  "overviewTitle": {
    "th": "ภาพรวมเดือน {month}",
    "en": "Monthly overview: {month}",
    "zh": "月度概览：{month}"
  },
  "overviewDescription": {
    "th": "{period} · ตัวเลขแชทตรงกับหน้าแชทร้านค้า · ตอบใน 24 ชม. ตรงกับหน้าอัตราตอบกลับ 24 ชม.",
    "en": "{period} · Chat counts match Store chats · 24-hour replies match the 24-hour response page",
    "zh": "{period} · 聊天数量与门店聊天页一致 · 24小时回复率与对应页面一致"
  },
  "storeListError": {
    "th": "รายชื่อสาขา: {error}",
    "en": "Store list: {error}",
    "zh": "门店列表：{error}"
  },
  "partnersError": {
    "th": "partner ของสาขา (ทุกสาขาแสดงเป็น \"ไม่ระบุ partner\"): {error}",
    "en": "Store partners (all stores shown as Unassigned): {error}",
    "zh": "门店合作伙伴（所有门店显示为未指定）：{error}"
  },
  "chatCountError": {
    "th": "จำนวนแชท: {error}",
    "en": "Chat count: {error}",
    "zh": "聊天数量：{error}"
  },
  "comparisonError": {
    "th": "ช่วงเทียบ: {error}",
    "en": "Comparison period: {error}",
    "zh": "对比期间：{error}"
  },
  "rate24Error": {
    "th": "ตอบใน 24 ชม.: {error}",
    "en": "24-hour replies: {error}",
    "zh": "24小时内回复：{error}"
  },
  "previousRateError": {
    "th": "ตอบใน 24 ชม. ช่วงเทียบ: {error}",
    "en": "24-hour replies for comparison period: {error}",
    "zh": "对比期间的24小时回复：{error}"
  },
  "failedSources": {
    "th": "โหลดไม่สำเร็จ — {errors}",
    "en": "Unable to load — {errors}",
    "zh": "加载失败 — {errors}"
  },
  "noPartner": {
    "th": "ไม่ระบุ partner",
    "en": "Unassigned partner",
    "zh": "未指定合作伙伴"
  },
  "coverage": {
    "th": "สาขาที่มีข้อมูลแชท {currentLabel} {count} ร้าน · {previousLabel} {previous} (จาก {total} ร้าน)",
    "en": "Stores with chat data: {currentLabel}, {count} stores · {previousLabel}, {previous} (of {total} stores)",
    "zh": "有聊天数据的门店：{currentLabel}，{count}家 · {previousLabel}，{previous}（共{total}家）"
  },
  "storeCount": {
    "th": "{count} ร้าน",
    "en": "{count} stores",
    "zh": "{count}家门店"
  },
  "noData": {
    "th": "ไม่มีข้อมูล",
    "en": "No data",
    "zh": "无数据"
  },
  "reclosed": {
    "th": "ปิดใหม่ครั้งที่ {revision} เมื่อ {date} โดย {actor}{reason}",
    "en": "Reclosed, revision {revision}, on {date} by {actor}{reason}",
    "zh": "第{revision}次重新结算，时间：{date}，操作人：{actor}{reason}"
  },
  "backfilledClose": {
    "th": "ปิดย้อนหลัง เมื่อ {date} (ตัวเลข ณ เวลาที่ปิด)",
    "en": "Closed retrospectively on {date} (figures at close)",
    "zh": "补结算于{date}（结算时的数据）"
  },
  "closedOn": {
    "th": "ปิดเดือนแล้ว เมื่อ {date}",
    "en": "Month closed on {date}",
    "zh": "月份已于{date}结算"
  },
  "autoClosePending": {
    "th": "สิ้นเดือนแล้ว รอปิดอัตโนมัติ {date} · ตัวเลขยังเปลี่ยนได้",
    "en": "Month ended; automatic close pending on {date} · Figures may still change",
    "zh": "月份已结束，等待{date}自动结算 · 数据仍可能变化"
  },
  "closePending": {
    "th": "สิ้นเดือนแล้ว ยังไม่ปิด · ตัวเลขยังเปลี่ยนได้",
    "en": "Month ended, still open · Figures may still change",
    "zh": "月份已结束，尚未结算 · 数据仍可能变化"
  },
  "howReplied": {
    "th": "แชทที่ตอบแล้ว ÷ แชททั้งหมดของช่วงนี้ · แชทนับตามวันที่ของข้อความล่าสุด · ตอบแล้ว = ข้อความล่าสุดของลูกค้าได้รับคำตอบแล้ว (สถานะตอนนี้) · เหมือนหน้าแชทร้านค้า",
    "en": "Replied chats ÷ all chats in the period · Chats use the latest message date · Replied means the customer’s latest message has a reply now · Matches Store chats",
    "zh": "已回复聊天 ÷ 此期间全部聊天 · 按最新消息日期统计 · 已回复表示客户最新消息当前已有回复 · 与门店聊天页一致"
  },
  "howRate24": {
    "th": "แชทที่ข้อความแรกของลูกค้าในช่วงนี้ได้รับคำตอบภายใน 24 ชม. ÷ แชทที่ลูกค้าทักมาในช่วงนี้ · นับตามวันที่ลูกค้าทักครั้งแรกในช่วง · เหมือนหน้าอัตราตอบกลับ 24 ชม.",
    "en": "Chats whose first customer message in the period was answered within 24 hours ÷ chats initiated by customers in the period · Uses the first contact date · Matches the 24-hour response page",
    "zh": "此期间客户首条消息在24小时内获回复的聊天 ÷ 此期间客户发起的聊天 · 按首次联系日期统计 · 与24小时回复率页面一致"
  },
  "kpiDifference": {
    "th": "ตอบใน 24 ชม. ดูแค่ข้อความแรกของลูกค้าในช่วงนี้ ส่วนตอบแล้ว % ดูข้อความล่าสุด แชทที่ตอบครั้งแรกทันแต่ลูกค้าทักมาใหม่แล้วยังไม่ได้ตอบ จึงนับเป็น “ตอบใน 24 ชม.” และ “ยังไม่ตอบ” พร้อมกัน",
    "en": "Within 24 hours uses the first customer message in the period; Replied % uses the latest message. A chat answered on time initially can also be Unanswered if the customer sends a new message without a reply.",
    "zh": "24小时回复率按此期间客户首条消息统计，已回复率按最新消息统计。首次及时回复后，客户再次发消息尚未获回复时，同一聊天可同时计为24小时内回复和未回复。"
  },
  "noTarget": {
    "th": "ยังไม่กำหนดเป้า",
    "en": "No target set",
    "zh": "尚未设置目标"
  },
  "targetBelow": {
    "th": "เป้า {target}% · ต่ำกว่าเป้า {gap} จุด",
    "en": "Target {target}% · {gap} points below target",
    "zh": "目标{target}% · 低于目标{gap}个百分点"
  },
  "targetMet": {
    "th": "เป้า {target}% · ถึงเป้า",
    "en": "Target {target}% · Met",
    "zh": "目标{target}% · 已达标"
  },
  "targetSmallSample": {
    "th": "เป้า {target}% · แชทน้อยเกินกว่าจะเทียบ",
    "en": "Target {target}% · Too few chats to compare",
    "zh": "目标{target}% · 聊天样本不足，无法比较"
  },
  "targetOnly": {
    "th": "เป้า {target}%",
    "en": "Target {target}%",
    "zh": "目标{target}%"
  },
  "noActivity": {
    "th": "ไม่มีแชทในช่วงนี้",
    "en": "No chats in this period",
    "zh": "此期间无聊天"
  },
  "notApplicable": {
    "th": "ไม่ใช้กับรายการนี้",
    "en": "Not applicable",
    "zh": "不适用"
  },
  "lowSample": {
    "th": "แชทน้อยกว่า {count} แชท ใช้เทียบเป้าไม่ได้",
    "en": "Fewer than {count} chats; cannot compare with target",
    "zh": "聊天不足{count}个，无法与目标比较"
  },
  "stale": {
    "th": "ข้อมูลอาจไม่เป็นปัจจุบัน",
    "en": "Data may be outdated",
    "zh": "数据可能不是最新的"
  },
  "loadingEllipsis": {
    "th": "กำลังโหลด…",
    "en": "Loading…",
    "zh": "正在加载…"
  },
  "noPreviousWeek": {
    "th": "ไม่มีข้อมูลสัปดาห์ก่อน",
    "en": "No previous-week data",
    "zh": "无上周数据"
  },
  "unchanged": {
    "th": "เท่าเดิม",
    "en": "Unchanged",
    "zh": "无变化"
  },
  "points": {
    "th": "{value} จุด",
    "en": "{value} points",
    "zh": "{value}个百分点"
  },
  "noChats": {
    "th": "ไม่มีแชท",
    "en": "No chats",
    "zh": "无聊天"
  },
  "dailyRate": {
    "th": "อัตราตอบใน 24 ชม. รายวัน: {values}",
    "en": "Daily 24-hour response rate: {values}",
    "zh": "每日24小时回复率：{values}"
  },
  "chartTarget": {
    "th": "เส้นประ = เป้า {target}% · แท่งสีส้ม = ต่ำกว่าเป้า",
    "en": "Dashed line = {target}% target · Orange bars = below target",
    "zh": "虚线 = 目标{target}% · 橙色柱 = 未达标"
  },
  "managerLink": {
    "th": "เปิดใน LINE OA Manager ↗",
    "en": "Open in LINE OA Manager ↗",
    "zh": "在 LINE OA Manager 中打开 ↗"
  },
  "noDataYet": {
    "th": "ยังไม่มีข้อมูลนี้",
    "en": "No data yet",
    "zh": "暂无数据"
  },
  "sentAt": {
    "th": "ส่งเมื่อ {date}",
    "en": "Sent {date}",
    "zh": "发送于{date}"
  },
  "sentBusiness": {
    "th": "ส่งเมื่อ {date} · นับเฉพาะเวลาเปิดร้าน",
    "en": "Sent {date} · Counts store opening hours only",
    "zh": "发送于{date} · 仅计算门店营业时间"
  },
  "waitMinutes": {
    "th": "{minutes} นาที",
    "en": "{minutes} min",
    "zh": "{minutes}分钟"
  },
  "waitHours": {
    "th": "{hours} ชม. {minutes} นาที",
    "en": "{hours} hr {minutes} min",
    "zh": "{hours}小时{minutes}分钟"
  },
  "waitDays": {
    "th": "{days} วัน {hours} ชม.",
    "en": "{days} days {hours} hr",
    "zh": "{days}天{hours}小时"
  },
  "yesterdayTime": {
    "th": "เมื่อวาน {time}",
    "en": "Yesterday {time}",
    "zh": "昨天{time}"
  },
  "followToday": {
    "th": "ตามวันนี้",
    "en": "Follow up today",
    "zh": "今日跟进"
  },
  "all": {
    "th": "ทั้งหมด",
    "en": "All",
    "zh": "全部"
  },
  "sortRecent": {
    "th": "รอตอบตั้งแต่เมื่อวาน",
    "en": "Waiting since yesterday",
    "zh": "从昨天起待回复"
  },
  "sortWait": {
    "th": "รอนานสุด",
    "en": "Longest wait",
    "zh": "等待最久"
  },
  "sortRate": {
    "th": "ตอบใน 24 ชม. (ต่ำสุดก่อน)",
    "en": "24-hour reply rate (lowest first)",
    "zh": "24小时回复率（最低优先）"
  },
  "sortAge": {
    "th": "แชทค้างนานสุด",
    "en": "Oldest unanswered chats",
    "zh": "积压最久的聊天"
  },
  "storeFilters": {
    "th": "ตัวกรองร้าน",
    "en": "Store filters",
    "zh": "门店筛选"
  },
  "sortBy": {
    "th": "เรียงตาม",
    "en": "Sort by",
    "zh": "排序方式"
  },
  "view": {
    "th": "มุมมอง",
    "en": "View",
    "zh": "视图"
  },
  "storeOverview": {
    "th": "ภาพรวมร้าน",
    "en": "Store overview",
    "zh": "门店概览"
  },
  "chatView": {
    "th": "หน้าแชท",
    "en": "Chat view",
    "zh": "聊天视图"
  },
  "followStores": {
    "th": "ร้านที่ต้องตามวันนี้",
    "en": "Stores to follow up today",
    "zh": "今日需跟进的门店"
  },
  "waitingChats": {
    "th": "แชทที่รอคำตอบ",
    "en": "Chats awaiting a reply",
    "zh": "待回复聊天"
  },
  "backlogDays": {
    "th": "ค้างเกิน {days} วัน",
    "en": "Waiting over {days} days",
    "zh": "积压超过{days}天"
  },
  "weekRate": {
    "th": "ตอบใน 24 ชม. · 7 วัน",
    "en": "24-hour reply rate · 7 days",
    "zh": "24小时回复率 · 7天"
  },
  "noDataStores": {
    "th": "ร้านที่ไม่มีข้อมูล",
    "en": "Stores without data",
    "zh": "无数据门店"
  },
  "tableWait": {
    "th": "ร้านเรียงตามเวลารอนานสุด",
    "en": "Stores by longest wait",
    "zh": "按等待时间最长排序的门店"
  },
  "tableFollow": {
    "th": "ร้านที่ต้องตามวันนี้ (แชทเกินเกณฑ์มากสุดก่อน)",
    "en": "Stores to follow up today (most overdue chats first)",
    "zh": "今日需跟进的门店（超时聊天最多优先）"
  },
  "tableRecent": {
    "th": "ร้านเรียงตามแชทที่รอตั้งแต่เมื่อวาน",
    "en": "Stores by chats waiting since yesterday",
    "zh": "按从昨天起待回复聊天排序的门店"
  },
  "tableRate": {
    "th": "ร้านเรียงตามอัตราตอบใน 24 ชม. (ต่ำสุดก่อน)",
    "en": "Stores by 24-hour reply rate (lowest first)",
    "zh": "按24小时回复率排序的门店（最低优先）"
  },
  "tableAge": {
    "th": "ร้านเรียงตามแชทที่ค้างนานสุด",
    "en": "Stores by oldest unanswered chats",
    "zh": "按积压聊天最久排序的门店"
  },
  "waiting": {
    "th": "รอตอบ",
    "en": "Awaiting reply",
    "zh": "待回复"
  },
  "waitingYesterday": {
    "th": "รอตอบ (ตั้งแต่เมื่อวาน)",
    "en": "Awaiting reply (since yesterday)",
    "zh": "待回复（从昨天起）"
  },
  "waitYesterday": {
    "th": "รอนานสุด (ตั้งแต่เมื่อวาน)",
    "en": "Longest wait (since yesterday)",
    "zh": "等待最久（从昨天起）"
  },
  "waitWeek": {
    "th": "รอนานสุด (7 วัน)",
    "en": "Longest wait (7 days)",
    "zh": "等待最久（7天）"
  },
  "rateWeek": {
    "th": "ตอบใน 24 ชม. (7 วัน)",
    "en": "24-hour reply rate (7 days)",
    "zh": "24小时回复率（7天）"
  },
  "trendWeek": {
    "th": "แนวโน้ม 7 วัน",
    "en": "7-day trend",
    "zh": "7天趋势"
  },
  "allHaveData": {
    "th": "ทุกร้านมีข้อมูลแชท",
    "en": "All stores have chat data",
    "zh": "所有门店都有聊天数据"
  },
  "noneHaveData": {
    "th": "ไม่มีร้านที่มีข้อมูล",
    "en": "No stores with data",
    "zh": "没有有数据的门店"
  },
  "notCollectingStore": {
    "th": "ระบบไม่ได้เก็บแชทของร้านนี้",
    "en": "Chat data is not collected for this store",
    "zh": "未采集此门店的聊天数据"
  },
  "storeDetails": {
    "th": "รายละเอียดร้าน",
    "en": "Store details",
    "zh": "门店详情"
  },
  "selectStoreHelp": {
    "th": "เลือกร้านจากตารางเพื่อดูแชทที่รอและแนวโน้ม 7 วัน",
    "en": "Select a store to see waiting chats and the 7-day trend",
    "zh": "选择门店查看待回复聊天及7天趋势"
  },
  "notCollectingHelp": {
    "th": "ระบบไม่ได้เก็บแชทของร้านนี้ จึงไม่นับในตัวเลขใด ๆ ดูสถานะที่ LINE Chat Health",
    "en": "This store’s chats are not collected, so it is excluded from all figures. Check LINE Chat Health.",
    "zh": "未采集此门店的聊天，因此不计入任何数据。请在 LINE Chat Health 查看状态。"
  },
  "dailyRateTitle": {
    "th": "ตอบใน 24 ชม. รายวัน",
    "en": "Daily 24-hour reply rate",
    "zh": "每日24小时回复率"
  },
  "noWaiting": {
    "th": "ไม่มีแชทที่รอคำตอบ",
    "en": "No chats awaiting a reply",
    "zh": "没有待回复聊天"
  },
  "noWaitingYesterday": {
    "th": "ไม่มีแชทที่รอตั้งแต่เมื่อวาน 10:00",
    "en": "No chats waiting since yesterday at 10:00",
    "zh": "没有从昨天10:00起等待的聊天"
  },
  "allListedStores": {
    "th": "ทุกร้านในรายการนี้",
    "en": "All listed stores",
    "zh": "列表中的全部门店"
  },
  "store": {
    "th": "ร้าน",
    "en": "Store",
    "zh": "门店"
  },
  "noListedChats": {
    "th": "ไม่มีแชทในรายการนี้",
    "en": "No chats in this list",
    "zh": "列表中没有聊天"
  },
  "replied": {
    "th": "ตอบแล้ว",
    "en": "Replied",
    "zh": "已回复"
  },
  "waitPrefix": {
    "th": "รอ",
    "en": "Waiting",
    "zh": "等待中"
  },
  "imageLink": {
    "th": "[รูปภาพ] เปิดดู ↗",
    "en": "[Image] Open ↗",
    "zh": "[图片] 打开 ↗"
  },
  "image": {
    "th": "รูปภาพ",
    "en": "Image",
    "zh": "图片"
  },
  "video": {
    "th": "วิดีโอ",
    "en": "Video",
    "zh": "视频"
  },
  "audio": {
    "th": "ข้อความเสียง",
    "en": "Voice message",
    "zh": "语音消息"
  },
  "file": {
    "th": "ไฟล์",
    "en": "File",
    "zh": "文件"
  },
  "location": {
    "th": "ตำแหน่ง",
    "en": "Location",
    "zh": "位置"
  },
  "sticker": {
    "th": "สติกเกอร์",
    "en": "Sticker",
    "zh": "贴纸"
  },
  "unsupported": {
    "th": "ข้อความที่แสดงไม่ได้",
    "en": "Unsupported message",
    "zh": "不支持的消息"
  },
  "conversationLoad": {
    "th": "โหลดแชทไม่สำเร็จ",
    "en": "Unable to load chat",
    "zh": "无法加载聊天"
  },
  "earlierLoad": {
    "th": "โหลดข้อความก่อนหน้าไม่สำเร็จ",
    "en": "Unable to load earlier messages",
    "zh": "无法加载历史消息"
  },
  "selectChat": {
    "th": "เลือกแชทเพื่อดูข้อความ",
    "en": "Select a chat to view messages",
    "zh": "选择聊天查看消息"
  },
  "messages": {
    "th": "ข้อความ",
    "en": "Messages",
    "zh": "消息"
  },
  "earlierMessages": {
    "th": "โหลดข้อความก่อนหน้า",
    "en": "Load earlier messages",
    "zh": "加载历史消息"
  },
  "loadingMessages": {
    "th": "กำลังโหลดข้อความ…",
    "en": "Loading messages…",
    "zh": "正在加载消息…"
  },
  "readOnly": {
    "th": "ดูอย่างเดียว · ร้านตอบลูกค้าผ่าน LINE OA Manager",
    "en": "Read-only · Stores reply through LINE OA Manager",
    "zh": "仅供查看 · 门店通过 LINE OA Manager 回复客户"
  },
  "responseDescription": {
    "th": "ลูกค้าที่รอคำตอบตอนนี้ · นับเฉพาะเวลาเปิดร้าน (10:00–21:00) · ตามวันนี้ = ร้านที่ลูกค้ารอ ≥ {minutes} นาทีตั้งแต่เมื่อวาน 10:00 มากที่สุด {limit} ร้าน · ร้านที่ไม่มีข้อมูลไม่นับในทุกตัวเลข · ตัวเลขรายเดือนอยู่ที่แท็บ ภาพรวมเดือน",
    "en": "Customers waiting now · Counts store opening hours only (10:00–21:00) · Follow up today shows up to {limit} stores with the most customers waiting ≥ {minutes} minutes since yesterday at 10:00 · Stores without data are excluded · Monthly figures are on Monthly overview",
    "zh": "当前待回复客户 · 仅计算门店营业时间（10:00–21:00）· 今日跟进显示从昨天10:00起等待不少于{minutes}分钟的客户最多的至多{limit}家门店 · 无数据门店不计入 · 月度数据见月度概览"
  },
  "responseStatusError": {
    "th": "โหลดสถานะการตอบไม่สำเร็จ: {error}",
    "en": "Unable to load reply status: {error}",
    "zh": "无法加载回复状态：{error}"
  },
  "waitingError": {
    "th": "โหลดรายการแชทที่รอไม่สำเร็จ: {error}",
    "en": "Unable to load waiting chats: {error}",
    "zh": "无法加载待回复聊天：{error}"
  },
  "truncatedWait": {
    "th": "แชทที่รอใน {days} วันมีมากกว่า {count} แชท จึงวัดเวลารอจากแชทล่าสุดเท่านั้น จำนวนแชทที่รอยังนับครบจากระบบ",
    "en": "Over {count} chats are waiting within {days} days. Wait times use the latest chats only; the total waiting count remains complete.",
    "zh": "{days}天内待回复聊天超过{count}个，等待时间仅基于最近聊天计算，待回复总数仍完整统计。"
  },
  "activityFallback": {
    "th": "โหลดสถานะการเก็บแชทไม่สำเร็จ จึงนับร้านที่มีแชทใน 7 วันล่าสุดว่า \"มีข้อมูล\" แทน: {error}",
    "en": "Unable to load collection status; stores with chats in the last 7 days are treated as having data: {error}",
    "zh": "无法加载采集状态，暂将最近7天有聊天的门店视为有数据：{error}"
  },
  "collectionError": {
    "th": "โหลดสถานะการเก็บแชทไม่สำเร็จ จึงยังแยกร้านที่ไม่มีข้อมูลไม่ได้: {error}",
    "en": "Unable to load collection status or identify stores without data: {error}",
    "zh": "无法加载采集状态，暂无法识别无数据门店：{error}"
  },
  "responseRateError": {
    "th": "โหลดอัตราตอบใน 24 ชม. ไม่สำเร็จ: {error}",
    "en": "Unable to load the 24-hour reply rate: {error}",
    "zh": "无法加载24小时回复率：{error}"
  },
  "dailyError": {
    "th": "โหลดแนวโน้มรายวันไม่สำเร็จ: {error}",
    "en": "Unable to load daily trends: {error}",
    "zh": "无法加载每日趋势：{error}"
  },
  "followCandidates": {
    "th": "จาก {count} ร้านที่มีลูกค้ารอ ≥ {minutes} นาทีตั้งแต่เมื่อวาน 10:00 · แสดงสูงสุด {limit} ร้าน",
    "en": "From {count} stores with customers waiting ≥ {minutes} minutes since yesterday at 10:00 · Shows up to {limit} stores",
    "zh": "共{count}家门店有客户从昨天10:00起等待不少于{minutes}分钟 · 最多显示{limit}家"
  },
  "waitingCoverage": {
    "th": "ใน {count} ร้าน จาก {total} ร้านที่มีข้อมูล",
    "en": "In {count} of {total} stores with data",
    "zh": "涉及{count}家门店，有数据门店共{total}家"
  },
  "oldBacklogStores": {
    "th": "ใน {count} ร้าน · ไม่นับใน “ตามวันนี้”",
    "en": "In {count} stores · Excluded from Follow up today",
    "zh": "涉及{count}家门店 · 不计入今日跟进"
  },
  "viewAge": {
    "th": "ดูเรียงตามอายุ",
    "en": "View by age",
    "zh": "按积压时长查看"
  },
  "rateComparison": {
    "th": "เป้า {target}% · 7 วันก่อนหน้า {previous}{change}",
    "en": "Target {target}% · Previous 7 days {previous}{change}",
    "zh": "目标{target}% · 前7天{previous}{change}"
  },
  "noDataCoverage": {
    "th": "จาก {count} ร้าน · ระบบไม่ได้เก็บแชท ไม่นับในตัวเลขอื่น",
    "en": "Of {count} stores · Chats are not collected; excluded from other figures",
    "zh": "共{count}家门店 · 未采集聊天，不计入其他数据"
  },
  "noOverdueStores": {
    "th": "ไม่มีร้านที่ลูกค้ารอเกิน {minutes} นาทีตั้งแต่เมื่อวาน 10:00",
    "en": "No stores with customers waiting over {minutes} minutes since yesterday at 10:00",
    "zh": "没有客户从昨天10:00起等待超过{minutes}分钟的门店"
  },
  "oldCount": {
    "th": "ค้างเกิน {days} วัน {count}",
    "en": "Over {days} days: {count}",
    "zh": "超过{days}天：{count}"
  },
  "overdueCount": {
    "th": "เกิน {minutes} นาที {count}",
    "en": "Over {minutes} minutes: {count}",
    "zh": "超过{minutes}分钟：{count}"
  },
  "waitingDays": {
    "th": "แชทที่รอคำตอบ ({days} วันล่าสุด)",
    "en": "Chats awaiting a reply (last {days} days)",
    "zh": "待回复聊天（最近{days}天）"
  },
  "additionalBacklog": {
    "th": "และค้างเกิน {days} วันอีก {count} แชท (ไม่นับใน “ตามวันนี้”)",
    "en": "Plus {count} chats waiting over {days} days (excluded from Follow up today)",
    "zh": "另有{count}个聊天积压超过{days}天（不计入今日跟进）"
  },
  "noWaitingDays": {
    "th": "ไม่มีแชทที่รอภายใน {days} วัน",
    "en": "No waiting chats within {days} days",
    "zh": "{days}天内没有待回复聊天"
  },
  "olderChats": {
    "th": "เก่ากว่าเมื่อวาน ({count})",
    "en": "Before yesterday ({count})",
    "zh": "昨天之前（{count}）"
  },
  "storePaneCount": {
    "th": "ร้าน ({count})",
    "en": "Stores ({count})",
    "zh": "门店（{count}）"
  },
  "chatPaneCount": {
    "th": "แชท ({count}){loading}",
    "en": "Chats ({count}){loading}",
    "zh": "聊天（{count}）{loading}"
  },
  "recentChatError": {
    "th": "โหลดแชทล่าสุดไม่สำเร็จ: {error}",
    "en": "Unable to load recent chats: {error}",
    "zh": "无法加载最近聊天：{error}"
  },
  "waitingTime": {
    "th": "รอ {duration}",
    "en": "Waiting {duration}",
    "zh": "已等待{duration}"
  },
  "latestAt": {
    "th": "ล่าสุด {date}",
    "en": "Latest {date}",
    "zh": "最新消息：{date}"
  }
} as const;

const v2ExtendedTranslations = {
  sort24Gap: { th: "ห่างเป้าตอบใน 24 ชม. (ห่างสุดก่อน)", en: "Largest gap to 24-hour target", zh: "距24小时回复目标差距最大" },
  sortReplyRate: { th: "ตอบแล้ว % (ต่ำสุดก่อน)", en: "Replied rate (lowest first)", zh: "已回复率（从低到高）" },
  sort24Drop: { th: "ตอบใน 24 ชม. ลดลงมากสุด (จุด)", en: "Largest 24-hour rate drop (points)", zh: "24小时回复率降幅最大（百分点）" },
  sortUnanswered: { th: "ยังไม่ตอบ (มากสุดก่อน)", en: "Unanswered chats (most first)", zh: "未回复聊天数（从多到少）" },
  noPartnerRank: { th: "ไม่ระบุ partner", en: "No partner assigned", zh: "未分配合作伙伴" },
  tooFewForRank: { th: "แชทน้อยกว่า {count} แชท ไม่จัดอันดับ", en: "Fewer than {count} chats; not ranked", zh: "聊天少于{count}条，不参与排名" },
  reviewNotChecked: { th: "ยังไม่ตรวจเดือนนี้", en: "Not reviewed this month", zh: "本月尚未审核" },
  targetMetShort: { th: "ถึงเป้า", en: "On target", zh: "达到目标" },
  targetBelowShort: { th: "ต่ำกว่าเป้า", en: "Below target", zh: "低于目标" },
  monthlyReportPartner: { th: "รายงานเดือน · {partner} ↗", en: "Monthly report · {partner} ↗", zh: "月度报表 · {partner} ↗" },
  monthlyReport: { th: "รายงานเดือน", en: "Monthly report", zh: "月度报表" },
  scorecardTitle: { th: "สาขา · {month}", en: "Stores · {month}", zh: "门店 · {month}" },
  scorecardDescription: { th: "คะแนนรายเดือนของแต่ละสาขา · {period} · คลิกชื่อสาขาเพื่อดูรายละเอียด", en: "Monthly store scores · {period} · Select a store name for details", zh: "各门店月度评分 · {period} · 点击门店名称查看详情" },
  sourceLoadListFailed: { th: "โหลดไม่สำเร็จ — {details}", en: "Unable to load — {details}", zh: "加载失败 — {details}" },
  partnerMappingFailed: { th: "โหลด partner ของสาขาไม่สำเร็จ ทุกสาขาจึงแสดงเป็น “ไม่ระบุ partner”: {error}", en: "Unable to load store partners; all stores are shown as “No partner assigned”: {error}", zh: "无法加载门店合作伙伴，因此所有门店均显示为“未分配合作伙伴”：{error}" },
  chatCountLabelError: { th: "จำนวนแชท: {error}", en: "Chat count: {error}", zh: "聊天数：{error}" },
  replyWithin24Error: { th: "ตอบใน 24 ชม.: {error}", en: "24-hour replies: {error}", zh: "24小时内回复：{error}" },
  comparisonPeriodError: { th: "ช่วงเทียบ: {error}", en: "Comparison period: {error}", zh: "对比期间：{error}" },
  partnerFilter: { th: "Partner", en: "Partner", zh: "合作伙伴" },
  partnerNamed: { th: "Partner: {partner}", en: "Partner: {partner}", zh: "合作伙伴：{partner}" },
  allPartners: { th: "ทุก partner", en: "All partners", zh: "全部合作伙伴" },
  region: { th: "ภาค", en: "Region", zh: "地区" },
  allRegions: { th: "ทุกภาค", en: "All regions", zh: "全部地区" },
  sortBy: { th: "เรียงตาม", en: "Sort by", zh: "排序方式" },
  searchStoreName: { th: "ค้นหาชื่อสาขา", en: "Search store names", zh: "搜索门店名称" },
  targetWithValue: { th: "เป้า {value}%", en: "Target {value}%", zh: "目标 {value}%" },
  kpiDifferenceLegend: { th: "ตัวเลขใต้อัตรา = เปลี่ยนกี่จุดจากช่วงเทียบ · ตัวเลขใต้จำนวนแชทไม่ใช้สี เพราะขึ้นลงตามจำนวนแชท", en: "Rate figures show the point change from the comparison period. Chat counts are neutral because they move with volume.", zh: "比率下方的数字表示相较对比期间的百分点变化。聊天数保持中性色，因为它会随聊天量变化。" },
  storeScorecard: { th: "คะแนนสาขา", en: "Store scorecard", zh: "门店评分卡" },
  storesFiltered: { th: "{visible} จาก {total} สาขา · {period}", en: "{visible} of {total} stores · {period}", zh: "{visible}/{total} 家门店 · {period}" },
  scorecardFooter: { th: "อัตราที่มาจากแชทน้อยกว่า {count} แชทแสดงเป็นสีจาง ไม่เทียบเป้า และอยู่ท้ายเมื่อเรียงตามอัตรา · ความครบของแท็ก = % ของชื่อลูกค้าที่อ่านแล้วที่มีแท็กอย่างน้อย 1 อย่าง{tagNote}{reviewNote}", en: "Rates based on fewer than {count} chats are muted, excluded from target comparisons, and sorted last. Tag coverage is the share of read customer names with at least one tag.{tagNote}{reviewNote}", zh: "基于少于{count}条聊天的比率会淡化显示、不与目标比较，并在按比率排序时排在最后。标签覆盖率是已读取客户名称中至少带有一个标签的比例。{tagNote}{reviewNote}" },
  tagCoverageNoteSuffix: { th: " ({note})", en: " ({note})", zh: "（{note}）" },
  noGoogleReviewData: { th: " · ยังไม่มีผล Google Review ของเดือนนี้ จึงไม่แสดงคอลัมน์", en: " · No Google Review results for this month; the column is hidden", zh: " · 本月暂无 Google Review 结果，因此隐藏此列" },
  storeId: { th: "รหัสสาขา", en: "Store ID", zh: "门店 ID" },
  storeName: { th: "สาขา", en: "Store", zh: "门店" },
  partnerRank: { th: "อันดับใน partner", en: "Partner rank", zh: "合作伙伴内排名" },
  rank: { th: "อันดับ", en: "Rank", zh: "排名" },
  date: { th: "วันที่", en: "Date", zh: "日期" },
  tagCoverageLabel: { th: "ความครบของแท็ก", en: "Tag coverage", zh: "标签覆盖率" },
  reviewLabel: { th: "Google Review", en: "Google Review", zh: "Google Review" },
  noStoresForFilter: { th: "ไม่พบสาขาตามตัวกรองนี้", en: "No stores match these filters", zh: "没有符合这些筛选条件的门店" },
  monthColumn: { th: "เดือน", en: "Month", zh: "月份" },
  daily: { th: "รายวัน", en: "Daily", zh: "每日" },
  lastMessageDay: { th: "ตามวันของข้อความล่าสุด · {period}", en: "By latest-message date · {period}", zh: "按最新消息日期 · {period}" },
  latestChatsTruncated: { th: "แสดงเฉพาะ {shown} แชทล่าสุด จาก {total} แชท", en: "Showing the latest {shown} of {total} chats", zh: "仅显示最近{shown}/{total}条聊天" },
  dailyCountMismatch: { th: "รายวันรวม {listed} แชท ต่างจากยอดเดือน {expected} เพราะโหลดคนละเวลา กดรีเฟรชเพื่อให้ตรงกัน", en: "Daily rows total {listed} chats, versus {expected} for the month, because they loaded at different times. Refresh to align them.", zh: "每日合计为{listed}条聊天，与月度总数{expected}不同，因为数据加载时间不同。请刷新以同步。" },
  chartDescription: { th: "กราฟ", en: "Chart", zh: "图表" },
  rate24PerFirstChat: { th: "ตอบใน 24 ชม. ÷ แชทที่ลูกค้าทักวันนั้น", en: "Replied within 24 hours ÷ chats started by customers that day", zh: "24小时内回复数 ÷ 当天客户发起的聊天数" },
  dailyBarsExplanation: { th: "แถบเขียว = ตอบแล้ว · แถบแดง = ยังไม่ตอบ (ตามวันของข้อความล่าสุด) · ตอบใน 24 ชม. = ตอบทัน ÷ แชทที่ลูกค้าทักวันนั้น (ตามวันที่ทักครั้งแรก){error}", en: "Green = replied; red = unanswered (by latest-message date). Within 24 hours = on-time replies ÷ chats started by customers that day (by first-message date).{error}", zh: "绿色 = 已回复；红色 = 未回复（按最新消息日期）。24小时内回复率 = 按时回复数 ÷ 当天客户发起的聊天数（按首条消息日期）。{error}" },
  dailyRateLoadError: { th: " · โหลดตอบใน 24 ชม. รายวันไม่สำเร็จ: {error}", en: " · Unable to load daily 24-hour rates: {error}", zh: " · 无法加载每日24小时回复率：{error}" },
  responseStatusCoverage: { th: "มีข้อมูลสถานะการตอบตั้งแต่ {month} จึงแสดง {count} เดือน (ยังไม่ครบ 6 เดือน)", en: "Reply-status data starts in {month}; showing {count} months (fewer than six)", zh: "回复状态数据从{month}开始，因此显示{count}个月（不足6个月）" },
  closeStoreDetails: { th: "ปิดรายละเอียดสาขา", en: "Close store details", zh: "关闭门店详情" },
  close: { th: "ปิด", en: "Close", zh: "关闭" },
  monthlyKpis: { th: "ตัวชี้วัดเดือนนี้", en: "Monthly KPIs", zh: "本月 KPI" },
  longestUnanswered: { th: "แชทที่ยังไม่ตอบที่ค้างนานสุด: {duration} (นับเวลาจริง เหมือนหน้าแชทร้านค้า)", en: "Longest-waiting unanswered chat: {duration} (real elapsed time, as on the store chats page)", zh: "等待时间最长的未回复聊天：{duration}（按实际经过时间，与门店聊天页一致）" },
  noUnansweredThisMonth: { th: "ไม่มีแชทที่ยังไม่ตอบในเดือนนี้", en: "No unanswered chats this month", zh: "本月没有未回复聊天" },
  monthlyTrend: { th: "แนวโน้มรายเดือน", en: "Monthly trend", zh: "月度趋势" },
  upToMonths: { th: "สูงสุด {count} เดือน", en: "Up to {count} months", zh: "最多{count}个月" },
  nextSteps: { th: "ไปต่อ", en: "Next steps", zh: "后续操作" },
  storeChatsThisMonth: { th: "แชทเดือนนี้ในหน้าแชทร้านค้า →", en: "This month’s chats on the store chats page →", zh: "在门店聊天页查看本月聊天 →" },
  unansweredOnly: { th: "เฉพาะยังไม่ตอบ →", en: "Unanswered only →", zh: "仅查看未回复 →" },
  storeReport: { th: "รายงานสาขา ↗", en: "Store report ↗", zh: "门店报表 ↗" },
  store360: { th: "Store 360 →", en: "Store 360 →", zh: "Store 360 →" },
  tagUnread: { th: "ยังไม่ได้อ่านชื่อ", en: "Names not read yet", zh: "尚未读取名称" },
  tagNoChats: { th: "ไม่มีแชทเดือนนี้", en: "No chats this month", zh: "本月没有聊天" },
  readNamesFraction: { th: "อ่านชื่อ {read}/{total}", en: "Names read {read}/{total}", zh: "已读取名称 {read}/{total}" },
  tagReadFailure: { th: "โหลดความครบของแท็กไม่สำเร็จ: {error}", en: "Unable to load tag coverage: {error}", zh: "无法加载标签覆盖率：{error}" },
  tagReadInProgress: { th: "ระบบกำลังอ่านแท็กจากชื่อลูกค้าย้อนหลังครั้งแรก ตัวเลขความครบของแท็กยังไม่ครบ", en: "The first historical tag read is still running; tag coverage is incomplete.", zh: "首次历史标签读取仍在进行，标签覆盖率尚不完整。" },
  tagSourceUpdated: { th: "แท็กอ่านจากชื่อลูกค้าใน LINE OA Manager{updated}", en: "Tags are read from customer names in LINE OA Manager{updated}", zh: "标签从 LINE OA Manager 的客户名称中读取{updated}" },
  updatedAt: { th: " · อัปเดต {date}", en: " · Updated {date}", zh: " · 更新于 {date}" },
  noTagData: { th: "กำลังโหลด…", en: "Loading…", zh: "正在加载…" },
  unreadCustomerNames: { th: "ระบบยังไม่ได้อ่านชื่อลูกค้าของ {count} แชทนี้จาก LINE OA Manager จึงยังบอกไม่ได้ว่ามีแท็กหรือไม่{note}", en: "Customer names for these {count} chats have not been read from LINE OA Manager, so tag presence is unknown.{note}", zh: "LINE OA Manager 尚未读取这{count}条聊天的客户名称，因此无法判断是否带有标签。{note}" },
  oneOrMoreTags: { th: "มีแท็กอย่างน้อย 1 อย่าง", en: "At least one tag", zh: "至少一个标签" },
  withPurchaseMonth: { th: "มีเดือนที่ซื้อ (MM/YY)", en: "Purchase month (MM/YY) available", zh: "有购买月份（MM/YY）" },
  namesRead: { th: "อ่านชื่อแล้ว", en: "Names read", zh: "已读取名称" },
  countOfNames: { th: "{count} จาก {total} ชื่อ", en: "{count} of {total} names", zh: "{count}/{total} 个名称" },
  countOfChats: { th: "{count} จาก {total} แชท", en: "{count} of {total} chats", zh: "{count}/{total} 条聊天" },
  tagTypes: { th: "ชนิดแท็ก", en: "Tag type", zh: "标签类型" },
  tagCount: { th: "ชื่อ", en: "Names", zh: "名称数" },
  percentReadNames: { th: "% ของชื่อที่อ่านแล้ว", en: "% of names read", zh: "占已读取名称的比例" },
  tagCoverageMethod: { th: "นับเฉพาะแชทที่ระบบอ่านชื่อลูกค้าได้แล้ว · ชื่อหนึ่งมีได้หลายชนิดแท็ก{note}", en: "Only chats with a customer name read by the system are counted · A name can have multiple tag types{note}", zh: "仅统计系统已读取客户名称的聊天 · 一个名称可以有多种标签{note}" },
  tagProduct: { th: "รุ่นสินค้า", en: "Product model", zh: "产品型号" },
  tagPeriod: { th: "เดือนที่ซื้อ (MM/YY)", en: "Purchase month (MM/YY)", zh: "购买月份（MM/YY）" },
  tagOnline: { th: "Online", en: "Online", zh: "线上" },
  tagFilm: { th: "ติดฟิล์ม", en: "Screen protector", zh: "贴膜" },
  tagPayment: { th: "เงินสด / ผ่อน", en: "Cash / installment", zh: "现金 / 分期" },
  tagFinance: { th: "ไฟแนนซ์ (SG / UFUND)", en: "Financing (SG / UFUND)", zh: "金融分期（SG / UFUND）" },
  tagSource: { th: "แพลตฟอร์ม (TikTok, Facebook …)", en: "Platform (TikTok, Facebook …)", zh: "平台（TikTok、Facebook …）" },
  tagDate: { th: "วันที่ (วัน/เดือน/ปี)", en: "Date (day/month/year)", zh: "日期（日/月/年）" },
  scorecardPeriodData: { th: "คะแนนรายเดือนของแต่ละสาขา", en: "Monthly store scores", zh: "各门店月度评分" },
  reportBack: { th: "← กลับ", en: "← Back", zh: "← 返回" },
  copySummary: { th: "คัดลอกสรุป", en: "Copy summary", zh: "复制摘要" },
  printSavePdf: { th: "พิมพ์ / บันทึก PDF", en: "Print / Save PDF", zh: "打印 / 保存为 PDF" },
  summaryCopied: { th: "คัดลอกสรุปแล้ว วางใน LINE ได้เลย", en: "Summary copied. You can paste it into LINE.", zh: "摘要已复制，可以粘贴到 LINE。" },
  copyFailed: { th: "คัดลอกไม่ได้ เลือกข้อความด้านล่างแล้วคัดลอกเอง", en: "Could not copy. Select the text below and copy it manually.", zh: "无法复制。请选中下方文本并手动复制。" },
  reportNotFound: { th: "ไม่พบข้อมูลสำหรับ {scope} ในเดือนที่เลือก", en: "No {scope} found for the selected month", zh: "所选月份没有找到{scope}" },
  selectedStoreScope: { th: "สาขา {name}", en: "Store {name}", zh: "门店 {name}" },
  allStoresScope: { th: "ทุกสาขา", en: "All stores", zh: "全部门店" },
  scoreCompareTarget: { th: "ตัวชี้วัดเทียบเดือนก่อนและเป้า", en: "Metrics vs previous month and targets", zh: "指标与上月及目标对比" },
  storeRankHeading: { th: "สาขา ({count}) เรียงตามช่องว่างถึงเป้าตอบใน 24 ชม.", en: "Stores ({count}), sorted by gap to the 24-hour target", zh: "门店（{count}），按距24小时回复目标的差距排序" },
  dataCoverageLabel: { th: "ความครบของข้อมูล: {coverage}{excluded}{comparisonError}", en: "Data coverage: {coverage}{excluded}{comparisonError}", zh: "数据覆盖：{coverage}{excluded}{comparisonError}" },
  dataExcludesNoLine: { th: " · ไม่นับ {count} ร้านที่ยังไม่มี LINE OA", en: " · Excludes {count} stores without LINE OA", zh: " · 不计入{count}家尚无 LINE OA 的门店" },
  reportComparisonError: { th: " · ช่วงเทียบ: {error}", en: " · Comparison period: {error}", zh: " · 对比期间：{error}" },
  howCountedLabel: { th: "นับยังไง — {label}: {detail}", en: "How it is counted — {label}: {detail}", zh: "统计方式 — {label}：{detail}" },
  rateInterpretation: { th: "ตัวเลขใต้อัตรา = เปลี่ยนกี่จุดจากช่วงเทียบ · จำนวนแชทและการเปลี่ยนแปลงไม่ใช้สี เพราะขึ้นลงตามจำนวนแชท · อัตราจากแชทน้อยกว่า 10 แชทแสดงสีจางและไม่เทียบเป้า", en: "Rate figures show point changes from the comparison period. Chat counts and their changes are neutral because they move with volume. Rates based on fewer than 10 chats are muted and not compared with targets.", zh: "比率下方的数字表示相较对比期间的百分点变化。聊天数及其变化保持中性色，因为它们会随聊天量变化。基于少于10条聊天的比率会淡化显示且不与目标比较。" },
  printedAt: { th: "พิมพ์เมื่อ {date}", en: "Printed {date}", zh: "打印时间：{date}" },
  reportSummaryTitle: { th: "สรุปเดือน {month} · {scope}", en: "{month} summary · {scope}", zh: "{month}摘要 · {scope}" },
  reportPeriod: { th: "ช่วง: {period}", en: "Period: {period}", zh: "期间：{period}" },
  reportChats: { th: "แชท {chats} · ยังไม่ตอบ {unanswered}{delta}", en: "Chats {chats} · Unanswered {unanswered}{delta}", zh: "聊天 {chats} · 未回复 {unanswered}{delta}" },
  reportRepliedRate: { th: "ตอบแล้ว {rate}{delta} · {target}", en: "Replied {rate}{delta} · {target}", zh: "已回复 {rate}{delta} · {target}" },
  reportRate24: { th: "ตอบใน 24 ชม. {rate}{delta} · {target}", en: "Within 24 hours {rate}{delta} · {target}", zh: "24小时内回复 {rate}{delta} · {target}" },
  reportTopUnanswered: { th: "ยังไม่ตอบมากสุด: {stores}", en: "Most unanswered: {stores}", zh: "未回复最多：{stores}" },
  reportTopStoreItem: { th: "{rank}) {store} {count} แชท", en: "{rank}) {store} · {count} chats", zh: "{rank}) {store} · {count} 条聊天" },
  reportNoUnanswered: { th: "ไม่มีแชทที่ยังไม่ตอบ", en: "No unanswered chats", zh: "没有未回复聊天" },
  reportOpenMonthNote: { th: "ตัวเลขเดือนที่ยังไม่ปิดอาจเปลี่ยนได้", en: "Figures for an open month may change.", zh: "尚未结算月份的数据可能会变化。" },
  reportSame: { th: "เท่าเดิม", en: "No change", zh: "无变化" },
  reportDeltaPoints: { th: " จุด", en: " points", zh: "个百分点" },
  reportTarget: { th: "เป้า {value}%", en: "Target {value}%", zh: "目标 {value}%" },
  partnerMappingTitle: { th: "Partner ของสาขา", en: "Store partners", zh: "门店合作伙伴" },
  partnerMappingDescription: { th: "partner ผูกกับ Store ID ของสาขา (ไม่อ่านจากชื่อร้าน) · ทุกการแก้ไขบันทึกผู้แก้และเวลา · สาขาที่ไม่มี partner แสดงเป็น “ไม่ระบุ partner” ในทุกหน้า v2", en: "Partners are assigned by store ID, not store name. Each change records who made it and when. Stores without a partner appear as “No partner assigned” throughout v2.", zh: "合作伙伴按门店 ID 绑定（不根据门店名称匹配）。每次修改都会记录操作者和时间。未分配合作伙伴的门店会在所有 v2 页面中显示为“未分配合作伙伴”。" },
  readOnlyAdmin: { th: "ดูได้อย่างเดียว · เฉพาะผู้ดูแลระบบ (ADMIN) แก้ไข partner ได้", en: "Read-only · Only administrators (ADMIN) can edit partners", zh: "只读 · 仅管理员（ADMIN）可以编辑合作伙伴" },
  onlyUnsetPartners: { th: "เฉพาะสาขาที่ยังไม่ระบุ ({count})", en: "Only stores without a partner ({count})", zh: "仅显示未分配合作伙伴的门店（{count}）" },
  partnerAdminSearch: { th: "ค้นหา Store ID / ชื่อสาขา / partner", en: "Search store ID / store name / partner", zh: "搜索门店 ID / 门店名称 / 合作伙伴" },
  storePartnerHeading: { th: "สาขา", en: "Store", zh: "门店" },
  lastEdited: { th: "แก้ไขล่าสุด", en: "Last edited", zh: "最近修改" },
  save: { th: "บันทึก", en: "Save", zh: "保存" },
  saving: { th: "กำลังบันทึก…", en: "Saving…", zh: "正在保存…" },
  storeNoIdTitle: { th: "สาขานี้ไม่มี Store ID จึงผูก partner ไม่ได้", en: "This store has no store ID, so a partner cannot be assigned", zh: "此门店没有门店 ID，无法分配合作伙伴" },
  noStoreId: { th: "ไม่มี Store ID", en: "No store ID", zh: "没有门店 ID" },
  partnerEditLabel: { th: "Partner ของ {store}", en: "Partner for {store}", zh: "{store}的合作伙伴" },
  savedPartner: { th: "บันทึกแล้ว: {store} → {partner}", en: "Saved: {store} → {partner}", zh: "已保存：{store} → {partner}" },
  editHistory: { th: "ประวัติการแก้ไข", en: "Change history", zh: "修改记录" },
  latestChanges: { th: "50 รายการล่าสุด", en: "Latest 50 changes", zh: "最近50条修改" },
  time: { th: "เวลา", en: "Time", zh: "时间" },
  previousToNew: { th: "เดิม → ใหม่", en: "Previous → New", zh: "修改前 → 修改后" },
  changedBy: { th: "ผู้แก้", en: "Changed by", zh: "修改人" },
  source: { th: "ที่มา", en: "Source", zh: "来源" },
  partnerAdminCount: { th: "{visible} จาก {total} สาขา · {partners} partner", en: "{visible} of {total} stores · {partners} partners", zh: "{visible}/{total} 家门店 · {partners} 个合作伙伴" },
  noChanges: { th: "ยังไม่มีการแก้ไข", en: "No changes yet", zh: "暂无修改记录" },
  seededFromStoreName: { th: "ตั้งต้นจากชื่อร้าน", en: "Seeded from store name", zh: "根据门店名称初始化" },
  administrator: { th: "ผู้ดูแลระบบ", en: "Administrator", zh: "管理员" },
  unableToLoadPartnerHistory: { th: "โหลดประวัติไม่สำเร็จ ({status})", en: "Unable to load change history ({status})", zh: "无法加载修改记录（{status}）" },
  unableToLoadData: { th: "โหลดข้อมูลไม่สำเร็จ", en: "Unable to load data", zh: "无法加载数据" },
  unableToSave: { th: "บันทึกไม่สำเร็จ", en: "Unable to save", zh: "保存失败" },
  unableToLoadDataWithError: { th: "โหลดข้อมูลไม่สำเร็จ: {error}", en: "Unable to load data: {error}", zh: "无法加载数据：{error}" },
  unableToLoadTagsWithError: { th: "โหลดความครบของแท็กไม่สำเร็จ: {error}", en: "Unable to load tag coverage: {error}", zh: "无法加载标签覆盖率：{error}" },
  sourceUpdateStamp: { th: "อัปเดต {date}", en: "Updated {date}", zh: "更新于{date}" },
} as const;

// Home, Dashboard and Store 360 (the metrics pages, 8 Oct 2026).
const metricsTranslations = {
  storeScope: { th: "{count} จาก {total} ร้านที่มีข้อมูลแชท", en: "{count} of {total} stores with chat data", zh: "{total} 家门店中 {count} 家有聊天数据" },
} as const;

export const v2Translations = { ...v2BaseTranslations, ...v2ExtendedTranslations, ...metricsTranslations } as const;
export type V2TranslationKey = keyof typeof v2Translations;

/** The metrics pages read the same table; metricsText is v2Text under its new name. */
export function v2Text(language: AppLanguage) {
  return (key: V2TranslationKey, values: Record<string, string | number> = {}) => {
    const template: string = pickLanguageText(language, v2Translations[key]);
    return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]));
  };
}

export const metricsText = v2Text;
