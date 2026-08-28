export type GreetingDict = {
  title: string;
  subtitle: string;
  duplicationWarning: string;
  createTemplateButton: string;
  searchPlaceholder: string;
  filterAll: string;
  filterActive: string;
  filterDraft: string;
  filterInactive: string;
  filterArchived: string;
  statusActive: string;
  statusDraft: string;
  statusInactive: string;
  statusArchived: string;
  sendPolicyFirstTime: string;
  sendPolicyAddAndUnblock: string;
  sendPolicyFirstTimeDesc: string;
  sendPolicyAddAndUnblockDesc: string;
  versionLabel: (v: number) => string;
  assignedStoresLabel: (count: number) => string;
  emptyList: string;
  emptyListDesc: string;

  // Editor
  editorCreateTitle: string;
  editorEditTitle: string;
  fieldName: string;
  fieldNamePlaceholder: string;
  fieldDescription: string;
  fieldDescriptionPlaceholder: string;
  fieldSendPolicy: string;
  insertVariable: string;
  varUserDisplayName: string;
  varAccountName: string;
  varStoreName: string;
  varGoogleMapsUrl: string;
  varExternalStoreId: string;
  varProvince: string;
  varRegion: string;
  varLineId: string;
  varTiktokUsername: string;

  // Message Builder
  messageSequenceTitle: string;
  addTextBlockButton: string;
  addImageBlockButton: string;
  textBlockTitle: (idx: number) => string;
  imageBlockTitle: (idx: number) => string;
  textBlockPlaceholder: string;
  charCount: (current: number, max: number) => string;
  uploadImageButton: string;
  changeImageButton: string;
  deleteBlockButton: string;
  moveUpButton: string;
  moveDownButton: string;
  maxBlocksNotice: string;
  blocksCount: (n: number) => string;
  uploading: string;
  uploadSuccess: string;
  uploadFailed: string;
  invalidImage: string;
  dropImageHint: string;
  imageDimensions: (w: number, h: number, kb: number) => string;

  // Modals & Actions
  activeEditWarningTitle: string;
  activeEditWarningMessage: (count: number) => string;
  activeEditWarningConfirm: string;
  activeEditWarningCancel: string;
  saveTemplateButton: string;
  saveAndAssignButton: string;
  activateButton: string;
  deactivateButton: string;
  archiveButton: string;
  archiveConfirm: string;
  editButton: string;
  previewButton: string;
  assignStoresButton: string;
  cancelButton: string;
  closeButton: string;
  backToList: string;

  // Store Readiness Table
  storeAssignmentTitle: string;
  storeAssignmentDesc: string;
  selectAllReady: string;
  clearSelection: string;
  colSelect: string;
  colStoreName: string;
  colBasicId: string;
  colGoogleMaps: string;
  colReadiness: string;
  colCurrentTemplate: string;
  statusReady: string;
  statusBlocked: string;
  assignedToThis: string;
  assignedToOther: (name: string) => string;
  notAssigned: string;
  readyStoresSummary: (ready: number, total: number, selected: number) => string;
  saveAssignmentsSuccess: (count: number) => string;

  // Live Mobile Preview
  previewTitle: string;
  previewStoreSelector: string;
  previewCustomerNameLabel: string;
  previewCustomerNamePlaceholder: string;
  previewSimulatedHeader: string;
  previewNoticeZeroPush: string;
  previewReadyBadge: string;
  previewBlockedBadge: string;
  previewSimulateFollow: string;
};

const th: GreetingDict = {
  title: "จัดการข้อความต้อนรับ (Greeting Message Manager)",
  subtitle: "กำหนดและส่งข้อความทักทายอัตโนมัติเมื่อลูกค้าเพิ่มเพื่อน LINE Official Account ประจำสาขา",
  duplicationWarning: "⚠️ เพื่อป้องกันข้อความส่งซ้ำซ้อน กรุณาปิดข้อความทักทาย (Greeting Message) ใน LINE Official Account Manager ก่อนเปิดใช้งานเทมเพลตที่นี่",
  createTemplateButton: "สร้างเทมเพลตข้อความต้อนรับ",
  searchPlaceholder: "ค้นหาชื่อเทมเพลตหรือรายละเอียด...",
  filterAll: "ทั้งหมด",
  filterActive: "เปิดใช้งาน (Active)",
  filterDraft: "ฉบับร่าง (Draft)",
  filterInactive: "ปิดชั่วคราว (Inactive)",
  filterArchived: "จัดเก็บแล้ว (Archived)",
  statusActive: "เปิดใช้งาน",
  statusDraft: "ฉบับร่าง",
  statusInactive: "ปิดใช้งาน",
  statusArchived: "จัดเก็บแล้ว",
  sendPolicyFirstTime: "เพิ่มเพื่อนครั้งแรกเท่านั้น (First-time only)",
  sendPolicyAddAndUnblock: "เพิ่มเพื่อนและปลดบล็อก (Add & Unblock)",
  sendPolicyFirstTimeDesc: "ส่งเฉพาะเมื่อลูกค้าเพิ่มเพื่อนครั้งแรก หากเคยได้รับข้อความแล้วหรือปลดบล็อกจะไม่ส่งซ้ำ",
  sendPolicyAddAndUnblockDesc: "ส่งทุกครั้งที่มีอีเวนต์ follow ทั้งการเพิ่มเพื่อนใหม่และเมื่อลูกค้าปลดบล็อก (Unblock)",
  versionLabel: (v) => `v${v}`,
  assignedStoresLabel: (count) => `${count} สาขาที่ใช้งาน`,
  emptyList: "ไม่พบเทมเพลตข้อความต้อนรับ",
  emptyListDesc: "เริ่มต้นสร้างเทมเพลตข้อความต้อนรับเพื่อส่งทักทายลูกค้าประจำสาขา",

  editorCreateTitle: "สร้างเทมเพลตข้อความต้อนรับใหม่",
  editorEditTitle: "แก้ไขเทมเพลตข้อความต้อนรับ",
  fieldName: "ชื่อเทมเพลต",
  fieldNamePlaceholder: "เช่น ข้อความต้อนรับมาตรฐานสาขา 2026",
  fieldDescription: "คำอธิบาย (ไม่บังคับ)",
  fieldDescriptionPlaceholder: "ระบุรายละเอียดหรือวัตถุประสงค์ของเทมเพลตนี้...",
  fieldSendPolicy: "นโยบายการส่งข้อความ (Send Policy)",
  insertVariable: "แทรกตัวแปรอัตโนมัติ:",
  varUserDisplayName: "ชื่อลูกค้า",
  varAccountName: "ชื่อ LINE OA",
  varStoreName: "ชื่อสาขา",
  varGoogleMapsUrl: "ลิงก์ Google Maps",
  varExternalStoreId: "รหัสสาขา",
  varProvince: "จังหวัด",
  varRegion: "ภูมิภาค",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "ลำดับข้อความต้อนรับ (1 - 5 บล็อก)",
  addTextBlockButton: "+ เพิ่มข้อความ (Text)",
  addImageBlockButton: "+ เพิ่มรูปภาพ (Image)",
  textBlockTitle: (idx) => `บล็อกที่ ${idx}: ข้อความ`,
  imageBlockTitle: (idx) => `บล็อกที่ ${idx}: รูปภาพ`,
  textBlockPlaceholder: "พิมพ์ข้อความต้อนรับที่ต้องการส่งถึงลูกค้า... สามารถแทรกตัวแปรสาขาหรือชื่อลูกค้าได้",
  charCount: (curr, max) => `${curr} / ${max} ตัวอักษร`,
  uploadImageButton: "อัปโหลดรูปภาพ",
  changeImageButton: "เปลี่ยนรูปภาพ",
  deleteBlockButton: "ลบบล็อกนี้",
  moveUpButton: "เลื่อนขึ้น",
  moveDownButton: "เลื่อนลง",
  maxBlocksNotice: "เพิ่มข้อความครบ 5 บล็อกแล้ว (ขีดจำกัดของ LINE คือ 5 ข้อความต่อ 1 Follow event)",
  blocksCount: (n) => `${n} / 5 บล็อก`,
  uploading: "กำลังอัปโหลดรูปภาพ...",
  uploadSuccess: "อัปโหลดรูปภาพสำเร็จ",
  uploadFailed: "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  invalidImage: "รองรับเฉพาะไฟล์รูปภาพ JPG หรือ PNG ขนาดไม่เกิน 10MB",
  dropImageHint: "ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์ (JPEG / PNG สูงสุด 10MB)",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "คำเตือน: กำลังแก้ไขเทมเพลตที่เปิดใช้งานอยู่",
  activeEditWarningMessage: (count) => `เทมเพลตนี้กำลังเปิดใช้งานและถูกผูกอยู่กับ ${count} สาขา การบันทึกจะมีผลกับการทักทายลูกค้าใหม่ทันที ยืนยันการบันทึกหรือไม่?`,
  activeEditWarningConfirm: "ยืนยันและบันทึกทันที",
  activeEditWarningCancel: "ยกเลิก",
  saveTemplateButton: "บันทึกเทมเพลต",
  saveAndAssignButton: "บันทึกและจัดการสาขา",
  activateButton: "เปิดใช้งาน (Activate)",
  deactivateButton: "ปิดใช้งานชั่วคราว (Deactivate)",
  archiveButton: "จัดเก็บ (Archive)",
  archiveConfirm: "ต้องการจัดเก็บเทมเพลตนี้หรือไม่? การจัดเก็บจะปลดการผูกสาขาทั้งหมดออก",
  editButton: "แก้ไข",
  previewButton: "ดูตัวอย่าง (Live Preview)",
  assignStoresButton: "จัดการสาขาที่ใช้งาน",
  cancelButton: "ยกเลิก",
  closeButton: "ปิด",
  backToList: "กลับไปหน้ารายการ",

  storeAssignmentTitle: "เลือกสาขาที่ต้องการใช้เทมเพลตนี้",
  storeAssignmentDesc: "เลือกสาขา LINE OA ที่ต้องการให้ส่งข้อความต้อนรับนี้เมื่อมีลูกค้าเพิ่มเพื่อน",
  selectAllReady: "เลือกสาขาที่พร้อมใช้งานทั้งหมด",
  clearSelection: "ล้างการเลือกทั้งหมด",
  colSelect: "เลือก",
  colStoreName: "ชื่อสาขา / Store",
  colBasicId: "LINE ID",
  colGoogleMaps: "Google Maps",
  colReadiness: "ความพร้อมของข้อมูล",
  colCurrentTemplate: "เทมเพลตปัจจุบัน",
  statusReady: "พร้อมใช้งาน",
  statusBlocked: "ข้อมูลไม่ครบถ้วน",
  assignedToThis: "ผูกกับเทมเพลตนี้แล้ว",
  assignedToOther: (name) => `ผูกกับ: ${name}`,
  notAssigned: "ยังไม่ได้ผูกเทมเพลต",
  readyStoresSummary: (ready, total, selected) => `พร้อมใช้งาน ${ready} จาก ${total} สาขา (เลือกอยู่ ${selected} สาขา)`,
  saveAssignmentsSuccess: (count) => `บันทึกการผูกข้อความต้อนรับกับ ${count} สาขาเรียบร้อยแล้ว`,

  previewTitle: "จำลองการแสดงผลบนมือถือ (Mobile Live Preview)",
  previewStoreSelector: "เลือกสาขาสำหรับดูตัวอย่าง:",
  previewCustomerNameLabel: "ชื่อลูกค้าตัวอย่าง (จำลอง):",
  previewCustomerNamePlaceholder: "เช่น คุณสมชาย",
  previewSimulatedHeader: "OPPO Retail Official",
  previewNoticeZeroPush: "ℹ️ ระบบส่งผ่าน LINE Reply Token เท่านั้น ไม่มีการใช้ Push Message เสียค่าใช้จ่ายเพิ่มเติม",
  previewReadyBadge: "สาขานี้ข้อมูลพร้อมส่ง",
  previewBlockedBadge: "สาขานี้ยังขาดข้อมูลตัวแปร",
  previewSimulateFollow: "จำลองเหตุการณ์เพิ่มเพื่อน (Follow Event)",
};

const en: GreetingDict = {
  title: "Greeting Message Manager",
  subtitle: "Configure and automatically send multi-message greetings when customers add store LINE Official Accounts.",
  duplicationWarning: "⚠️ To prevent duplicate greeting messages, please disable native Greeting Messages in LINE Official Account Manager before activating templates here.",
  createTemplateButton: "Create Greeting Template",
  searchPlaceholder: "Search templates by name or description...",
  filterAll: "All",
  filterActive: "Active",
  filterDraft: "Draft",
  filterInactive: "Inactive",
  filterArchived: "Archived",
  statusActive: "Active",
  statusDraft: "Draft",
  statusInactive: "Inactive",
  statusArchived: "Archived",
  sendPolicyFirstTime: "First-time only",
  sendPolicyAddAndUnblock: "Add & Unblock",
  sendPolicyFirstTimeDesc: "Send only when a customer adds the OA for the first time. Skips unblocks and existing followers.",
  sendPolicyAddAndUnblockDesc: "Send on every follow event, including both new friend adds and unblocks.",
  versionLabel: (v) => `v${v}`,
  assignedStoresLabel: (count) => `${count} stores assigned`,
  emptyList: "No greeting templates found",
  emptyListDesc: "Get started by creating your first store greeting message template.",

  editorCreateTitle: "Create Greeting Template",
  editorEditTitle: "Edit Greeting Template",
  fieldName: "Template Name",
  fieldNamePlaceholder: "e.g. Standard Store Welcome 2026",
  fieldDescription: "Description (optional)",
  fieldDescriptionPlaceholder: "Describe the purpose or campaign for this greeting...",
  fieldSendPolicy: "Send Policy",
  insertVariable: "Insert Variable:",
  varUserDisplayName: "Customer Name",
  varAccountName: "LINE OA Name",
  varStoreName: "Store Name",
  varGoogleMapsUrl: "Google Maps URL",
  varExternalStoreId: "Store Code",
  varProvince: "Province",
  varRegion: "Region",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "Greeting Sequence (1 - 5 blocks)",
  addTextBlockButton: "+ Add Text",
  addImageBlockButton: "+ Add Image",
  textBlockTitle: (idx) => `Block #${idx}: Text`,
  imageBlockTitle: (idx) => `Block #${idx}: Image`,
  textBlockPlaceholder: "Type greeting message text... Insert variables for store details or customer name.",
  charCount: (curr, max) => `${curr} / ${max} chars`,
  uploadImageButton: "Upload Image",
  changeImageButton: "Change Image",
  deleteBlockButton: "Delete block",
  moveUpButton: "Move up",
  moveDownButton: "Move down",
  maxBlocksNotice: "Maximum 5 blocks reached (LINE Messaging API limit is 5 messages per follow event)",
  blocksCount: (n) => `${n} / 5 blocks`,
  uploading: "Uploading image...",
  uploadSuccess: "Image uploaded successfully",
  uploadFailed: "Upload failed. Please try again.",
  invalidImage: "Only JPG or PNG images under 10MB are supported.",
  dropImageHint: "Drag and drop image here, or click to browse (JPEG / PNG up to 10MB)",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "Warning: Editing Active Template",
  activeEditWarningMessage: (count) => `This template is active and currently assigned to ${count} store(s). Changes will take effect immediately for incoming friends. Confirm save?`,
  activeEditWarningConfirm: "Confirm & Save Immediately",
  activeEditWarningCancel: "Cancel",
  saveTemplateButton: "Save Template",
  saveAndAssignButton: "Save & Assign Stores",
  activateButton: "Activate",
  deactivateButton: "Deactivate",
  archiveButton: "Archive",
  archiveConfirm: "Are you sure you want to archive this template? All store assignments will be unassigned.",
  editButton: "Edit",
  previewButton: "Live Preview",
  assignStoresButton: "Assign Stores",
  cancelButton: "Cancel",
  closeButton: "Close",
  backToList: "Back to list",

  storeAssignmentTitle: "Assign Target Stores",
  storeAssignmentDesc: "Select store LINE Official Accounts that should execute this greeting template on follow.",
  selectAllReady: "Select All Ready Stores",
  clearSelection: "Clear Selection",
  colSelect: "Select",
  colStoreName: "Store Name",
  colBasicId: "LINE ID",
  colGoogleMaps: "Google Maps",
  colReadiness: "Variable Readiness",
  colCurrentTemplate: "Current Template",
  statusReady: "Ready",
  statusBlocked: "Missing Variables",
  assignedToThis: "Assigned to this template",
  assignedToOther: (name) => `Assigned to: ${name}`,
  notAssigned: "Unassigned",
  readyStoresSummary: (ready, total, selected) => `${ready} of ${total} stores ready (${selected} selected)`,
  saveAssignmentsSuccess: (count) => `Successfully updated assignments for ${count} store(s).`,

  previewTitle: "Mobile Live Preview",
  previewStoreSelector: "Preview as Store:",
  previewCustomerNameLabel: "Sample Customer Name:",
  previewCustomerNamePlaceholder: "e.g. John Doe",
  previewSimulatedHeader: "OPPO Retail Official",
  previewNoticeZeroPush: "ℹ️ Greetings are dispatched exclusively via LINE Reply Tokens with zero push cost.",
  previewReadyBadge: "Store Ready",
  previewBlockedBadge: "Missing Store Variables",
  previewSimulateFollow: "Simulated Follow Event",
};

const zh: GreetingDict = {
  title: "欢迎消息管理 (Greeting Message Manager)",
  subtitle: "为各门店 LINE Official Account 配置并自动发送多条欢迎消息。",
  duplicationWarning: "⚠️ 为防止消息重复发送，请在启用此处的模板前，在 LINE Official Account Manager 中关闭原生的问候消息。",
  createTemplateButton: "创建欢迎消息模板",
  searchPlaceholder: "按名称或描述搜索...",
  filterAll: "全部",
  filterActive: "已启用 (Active)",
  filterDraft: "草稿 (Draft)",
  filterInactive: "已停用 (Inactive)",
  filterArchived: "已归档 (Archived)",
  statusActive: "已启用",
  statusDraft: "草稿",
  statusInactive: "已停用",
  statusArchived: "已归档",
  sendPolicyFirstTime: "仅首次加好友 (First-time only)",
  sendPolicyAddAndUnblock: "加好友与解除拉黑 (Add & Unblock)",
  sendPolicyFirstTimeDesc: "仅在用户首次关注时发送。若用户曾收到过或解除拉黑则不重复发送。",
  sendPolicyAddAndUnblockDesc: "在每次关注事件触发时发送，包括新加好友和解除拉黑。",
  versionLabel: (v) => `v${v}`,
  assignedStoresLabel: (count) => `已分配 ${count} 家门店`,
  emptyList: "未找到欢迎消息模板",
  emptyListDesc: "点击上方按钮创建您的第一个门店欢迎消息模板。",

  editorCreateTitle: "创建欢迎消息模板",
  editorEditTitle: "编辑欢迎消息模板",
  fieldName: "模板名称",
  fieldNamePlaceholder: "例如：2026 门店标准欢迎消息",
  fieldDescription: "描述（可选）",
  fieldDescriptionPlaceholder: "说明该欢迎消息的用途或活动...",
  fieldSendPolicy: "发送策略 (Send Policy)",
  insertVariable: "插入变量:",
  varUserDisplayName: "客户姓名",
  varAccountName: "LINE OA 名称",
  varStoreName: "门店名称",
  varGoogleMapsUrl: "Google Maps 链接",
  varExternalStoreId: "门店编号",
  varProvince: "省份",
  varRegion: "地区",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "消息序列 (1 - 5 个消息块)",
  addTextBlockButton: "+ 添加文本 (Text)",
  addImageBlockButton: "+ 添加图片 (Image)",
  textBlockTitle: (idx) => `第 ${idx} 块：文本`,
  imageBlockTitle: (idx) => `第 ${idx} 块：图片`,
  textBlockPlaceholder: "输入要发送给客户的文本... 可插入门店信息或客户姓名变量。",
  charCount: (curr, max) => `${curr} / ${max} 字`,
  uploadImageButton: "上传图片",
  changeImageButton: "更换图片",
  deleteBlockButton: "删除此块",
  moveUpButton: "上移",
  moveDownButton: "下移",
  maxBlocksNotice: "已达最大 5 个消息块上限（LINE 每次关注最多发送 5 条消息）",
  blocksCount: (n) => `${n} / 5 块`,
  uploading: "正在上传图片...",
  uploadSuccess: "图片上传成功",
  uploadFailed: "上传失败，请重试。",
  invalidImage: "仅支持 10MB 以内的 JPG 或 PNG 图片。",
  dropImageHint: "拖拽图片至此处，或点击浏览选择（JPEG / PNG 最大 10MB）",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "警告：正在编辑已启用的模板",
  activeEditWarningMessage: (count) => `该模板当前处于启用状态并已分配给 ${count} 家门店。保存后将立即对新加好友的客户生效。确认保存？`,
  activeEditWarningConfirm: "确认并立即保存",
  activeEditWarningCancel: "取消",
  saveTemplateButton: "保存模板",
  saveAndAssignButton: "保存并分配门店",
  activateButton: "启用 (Activate)",
  deactivateButton: "停用 (Deactivate)",
  archiveButton: "归档 (Archive)",
  archiveConfirm: "确定要归档此模板吗？将解除所有门店的绑定。",
  editButton: "编辑",
  previewButton: "实时预览",
  assignStoresButton: "分配门店",
  cancelButton: "取消",
  closeButton: "关闭",
  backToList: "返回列表",

  storeAssignmentTitle: "分配目标门店",
  storeAssignmentDesc: "选择在用户加好友时执行此欢迎消息的门店 LINE Official Account。",
  selectAllReady: "全选所有就绪门店",
  clearSelection: "清除所有选择",
  colSelect: "选择",
  colStoreName: "门店名称",
  colBasicId: "LINE ID",
  colGoogleMaps: "Google Maps",
  colReadiness: "数据就绪状态",
  colCurrentTemplate: "当前绑定模板",
  statusReady: "就绪",
  statusBlocked: "缺少必要变量",
  assignedToThis: "已绑定到当前模板",
  assignedToOther: (name) => `已绑定至：${name}`,
  notAssigned: "未绑定",
  readyStoresSummary: (ready, total, selected) => `共 ${total} 家门店中 ${ready} 家已就绪（当前选中 ${selected} 家）`,
  saveAssignmentsSuccess: (count) => `已成功更新 ${count} 家门店的欢迎消息绑定。`,

  previewTitle: "手机实时预览 (Mobile Live Preview)",
  previewStoreSelector: "预览门店：",
  previewCustomerNameLabel: "模拟客户姓名：",
  previewCustomerNamePlaceholder: "例如：张先生",
  previewSimulatedHeader: "OPPO 官方零售店",
  previewNoticeZeroPush: "ℹ️ 消息完全通过 LINE Reply Token 发送，不产生 Push 费用。",
  previewReadyBadge: "门店数据已就绪",
  previewBlockedBadge: "门店缺少变量",
  previewSimulateFollow: "模拟关注事件 (Follow Event)",
};

export function getGreetingDict(lang: string): GreetingDict {
  if (lang === "th") return th;
  if (lang === "zh") return zh;
  return en;
}
