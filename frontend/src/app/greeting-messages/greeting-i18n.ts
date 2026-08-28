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

  // LINE OA Visual Layout Strings
  headerTitle: string;
  headerSubtitle: string;
  headerHelp: string;
  saveChanges: string;
  saveTemplate: string;
  insights: string;
  templatesButton: string;
  sendingRestrictions: string;
  onlySendFirstTime: string;
  onlySendFirstTimeHelp: string;
  messageContent: string;
  userDisplayName: string;
  accountName: string;
  storeName: string;
  googleMaps: string;
  moreVariables: string;
  userDisplayNameNotice: string;
  add: string;
  text: string;
  image: string;
  emoji: string;
  preview: string;
  chatScreen: string;
  chatList: string;
  sampleStore: string;
  sampleUser: string;
  previewFor: string;
  basedOnSelectedStore: string;
  testPreviewButton: string;
  unsavedChanges: string;
  storeAssignmentsSection: string;
  storesSummary: (active: number, ready: number, blocked: number) => string;
  manageStores: string;
  applyToAllReady: string;
  applyToStores: (count: number) => string;
  openLineOaManager: string;
  oaManagerWarning: string;

  // Status Badges & Lifecycle Actions
  statusActiveBadge: (count: number, version: number) => string;
  statusDraftBadge: (version: number) => string;
  statusInactiveBadge: (count: number, version: number) => string;
  statusArchivedBadge: (version: number) => string;
  activateTemplate: string;
  deactivateTemplate: string;
  colGreetingStatus: string;
  noGreetingAssigned: string;
  assignedDraftNotice: string;

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
  title: "ข้อความต้อนรับ",
  subtitle: "สร้างข้อความที่ส่งอัตโนมัติเมื่อลูกค้าเพิ่ม LINE OA เป็นเพื่อน",
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

  // LINE OA Visual Layout
  headerTitle: "ข้อความต้อนรับ",
  headerSubtitle: "สร้างข้อความที่ส่งอัตโนมัติเมื่อลูกค้าเพิ่ม LINE OA เป็นเพื่อน",
  headerHelp: "หากไม่ต้องการส่งข้อความต้อนรับ คุณสามารถปิดการใช้งานได้ที่ การตั้งค่า > การตั้งค่าการตอบกลับ",
  saveChanges: "บันทึกเทมเพลต",
  saveTemplate: "บันทึกเทมเพลต",
  insights: "ข้อมูลเชิงลึก",
  templatesButton: "เทมเพลต",
  sendingRestrictions: "ข้อจำกัดการส่ง",
  onlySendFirstTime: "ส่งเฉพาะเพื่อนใหม่ครั้งแรก",
  onlySendFirstTimeHelp: "เปิดใช้ตัวเลือกนี้เพื่อป้องกันไม่ให้ข้อความต้อนรับส่งซ้ำ เมื่อผู้ใช้ปลดบล็อกบัญชี",
  messageContent: "เนื้อหาข้อความ",
  userDisplayName: "ชื่อผู้ใช้",
  accountName: "ชื่อบัญชี",
  storeName: "ชื่อร้าน",
  googleMaps: "Google Maps",
  moreVariables: "ตัวแปรเพิ่มเติม",
  userDisplayNameNotice: "ข้อความที่มีชื่อผู้ใช้จะแสดงเมื่อระบบสามารถเข้าถึงโปรไฟล์ของผู้ใช้ได้",
  add: "เพิ่ม",
  text: "ข้อความ",
  image: "รูปภาพ",
  emoji: "อิโมจิ",
  preview: "Preview",
  chatScreen: "Chat screen",
  chatList: "Chat list",
  sampleStore: "ร้านตัวอย่าง:",
  sampleUser: "ชื่อผู้ใช้ตัวอย่าง:",
  previewFor: "ดูตัวอย่างสำหรับ:",
  basedOnSelectedStore: "อิงจากร้านที่เลือก",
  testPreviewButton: "ทดสอบตัวอย่าง",
  unsavedChanges: "มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก",
  storeAssignmentsSection: "การใช้งานกับสาขา",
  storesSummary: (active, ready, blocked) => `ใช้งานอยู่ ${active} ร้าน • พร้อมใช้งาน ${ready} ร้าน • ข้อมูลไม่ครบ ${blocked} ร้าน`,
  manageStores: "เลือกสาขา",
  applyToAllReady: "ใช้กับทุกสาขาที่พร้อม",
  applyToStores: (count) => `นำไปใช้กับ ${count} ร้าน`,
  openLineOaManager: "เปิด LINE Official Account Manager ↗",
  oaManagerWarning: "หากบัญชีนี้เปิด Greeting message ใน LINE Official Account Manager อยู่ ลูกค้าอาจได้รับข้อความต้อนรับซ้ำ",

  // Status Badges & Lifecycle Actions
  statusActiveBadge: (count, v) => `ใช้งานอยู่ · ${count} ร้าน · v${v}`,
  statusDraftBadge: (v) => `แบบร่าง · ยังไม่เปิดใช้งาน · v${v}`,
  statusInactiveBadge: (count, v) => `ปิดใช้งาน · ${count} ร้าน · v${v}`,
  statusArchivedBadge: (v) => `เก็บถาวร · v${v}`,
  activateTemplate: "เปิดใช้งานเทมเพลต",
  deactivateTemplate: "ปิดใช้งานเทมเพลต",
  colGreetingStatus: "สถานะข้อความต้อนรับ",
  noGreetingAssigned: "ไม่มีข้อความต้อนรับจากระบบนี้",
  assignedDraftNotice: "ผูกเทมเพลตแล้ว แต่ยังเป็นแบบร่าง",

  editorCreateTitle: "สร้างข้อความต้อนรับใหม่",
  editorEditTitle: "แก้ไขข้อความต้อนรับ",
  fieldName: "ชื่อเทมเพลต",
  fieldNamePlaceholder: "เช่น ข้อความต้อนรับมาตรฐานสาขา 2026",
  fieldDescription: "คำอธิบาย (ไม่บังคับ)",
  fieldDescriptionPlaceholder: "ระบุรายละเอียดหรือวัตถุประสงค์ของเทมเพลตนี้...",
  fieldSendPolicy: "นโยบายการส่งข้อความ",
  insertVariable: "แทรกตัวแปรอัตโนมัติ:",
  varUserDisplayName: "ชื่อผู้ใช้",
  varAccountName: "ชื่อบัญชี",
  varStoreName: "ชื่อร้าน",
  varGoogleMapsUrl: "Google Maps",
  varExternalStoreId: "รหัสสาขา",
  varProvince: "จังหวัด",
  varRegion: "ภูมิภาค",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "เนื้อหาข้อความ (สูงสุด 5 ข้อความ)",
  addTextBlockButton: "+ เพิ่มข้อความ",
  addImageBlockButton: "+ เพิ่มรูปภาพ",
  textBlockTitle: (idx) => `ข้อความที่ ${idx}`,
  imageBlockTitle: (idx) => `รูปภาพที่ ${idx}`,
  textBlockPlaceholder: "พิมพ์ข้อความต้อนรับที่ต้องการส่งถึงลูกค้า... สามารถแทรกตัวแปรสาขาหรือชื่อผู้ใช้ได้",
  charCount: (curr, max) => `${curr} / ${max}`,
  uploadImageButton: "อัปโหลดรูปภาพ",
  changeImageButton: "เปลี่ยนรูปภาพ",
  deleteBlockButton: "ลบ",
  moveUpButton: "เลื่อนขึ้น",
  moveDownButton: "เลื่อนลง",
  maxBlocksNotice: "เพิ่มข้อความครบ 5 ข้อความแล้ว (ขีดจำกัดสูงสุด 5 ข้อความ)",
  blocksCount: (n) => `${n} / 5 ข้อความ`,
  uploading: "กำลังอัปโหลดรูปภาพ...",
  uploadSuccess: "อัปโหลดรูปภาพสำเร็จ",
  uploadFailed: "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  invalidImage: "รองรับเฉพาะไฟล์รูปภาพ JPG หรือ PNG ขนาดไม่เกิน 10MB",
  dropImageHint: "ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์ (JPEG / PNG สูงสุด 10MB)",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "คำเตือน: กำลังแก้ไขข้อความที่เปิดใช้งานอยู่",
  activeEditWarningMessage: (count) =>
    `การแก้ไขเทมเพลตนี้จะมีผลกับ ${count} สาขาที่ใช้งานอยู่ทันที สำหรับ Follow event ใหม่หลังจากบันทึก`,
  activeEditWarningConfirm: "ยืนยันและบันทึกทันที",
  activeEditWarningCancel: "ยกเลิก",
  saveTemplateButton: "บันทึกเทมเพลต",
  saveAndAssignButton: "บันทึกและจัดการสาขา",
  activateButton: "เปิดใช้งาน (Activate)",
  deactivateButton: "ปิดใช้งานชั่วคราว (Deactivate)",
  archiveButton: "จัดเก็บ (Archive)",
  archiveConfirm: "ต้องการจัดเก็บเทมเพลตนี้หรือไม่? การจัดเก็บจะปลดการผูกสาขาทั้งหมดออก",
  editButton: "แก้ไข",
  previewButton: "ดูตัวอย่าง",
  assignStoresButton: "จัดการสาขาที่ใช้งาน",
  cancelButton: "ยกเลิก",
  closeButton: "ปิด",
  backToList: "กลับไปหน้ารายการ",

  storeAssignmentTitle: "เลือกสาขาที่ต้องการใช้ข้อความต้อนรับนี้",
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

  previewTitle: "Preview",
  previewStoreSelector: "ร้านตัวอย่าง:",
  previewCustomerNameLabel: "ชื่อผู้ใช้ตัวอย่าง:",
  previewCustomerNamePlaceholder: "เช่น คุณสมชาย",
  previewSimulatedHeader: "OPPO Retail Official",
  previewNoticeZeroPush: "ℹ️ ระบบส่งผ่าน LINE Reply Token เท่านั้น ไม่มีการใช้ Push Message",
  previewReadyBadge: "พร้อมส่ง",
  previewBlockedBadge: "ข้อมูลไม่ครบ",
  previewSimulateFollow: "จำลองเหตุการณ์เพิ่มเพื่อน",
};

const en: GreetingDict = {
  title: "Greeting message",
  subtitle: "This message will be sent automatically to users when they add you as a friend.",
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

  // LINE OA Visual Layout
  headerTitle: "Greeting message",
  headerSubtitle: "This message will be sent automatically to users when they add you as a friend.",
  headerHelp: "If you don't want to send a greeting message, you can disable it under Settings > 'Response settings.'",
  saveChanges: "Save template",
  saveTemplate: "Save template",
  insights: "Insights",
  templatesButton: "Templates",
  sendingRestrictions: "Sending restrictions",
  onlySendFirstTime: "Only send for first-time friends",
  onlySendFirstTimeHelp: "Turn on this setting to prevent this message from reappearing for friends who unblocked your account.",
  messageContent: "Message content",
  userDisplayName: "User's display name",
  accountName: "Account name",
  storeName: "Store name",
  googleMaps: "Google Maps",
  moreVariables: "More variables",
  userDisplayNameNotice: "Messages containing users' display names will only appear for recipients whose profiles you have permission to view.",
  add: "Add",
  text: "Text",
  image: "Image",
  emoji: "Emoji",
  preview: "Preview",
  chatScreen: "Chat screen",
  chatList: "Chat list",
  sampleStore: "Sample store:",
  sampleUser: "Sample user:",
  previewFor: "Preview for:",
  basedOnSelectedStore: "Based on selected store",
  testPreviewButton: "Test preview",
  unsavedChanges: "Unsaved changes",
  storeAssignmentsSection: "Store Assignments",
  storesSummary: (active, ready, blocked) => `${active} assigned • ${ready} ready • ${blocked} not ready`,
  manageStores: "Select stores",
  applyToAllReady: "Apply to all ready stores",
  applyToStores: (count) => `Apply to ${count} ${count === 1 ? "store" : "stores"}`,
  openLineOaManager: "Open LINE Official Account Manager ↗",
  oaManagerWarning: "If Greeting message is enabled in LINE Official Account Manager, customers might receive duplicate greetings.",

  // Status Badges & Lifecycle Actions
  statusActiveBadge: (count, v) => `Active · ${count} stores · v${v}`,
  statusDraftBadge: (v) => `Draft · Not activated · v${v}`,
  statusInactiveBadge: (count, v) => `Inactive · ${count} stores · v${v}`,
  statusArchivedBadge: (v) => `Archived · v${v}`,
  activateTemplate: "Activate template",
  deactivateTemplate: "Deactivate template",
  colGreetingStatus: "Greeting message status",
  noGreetingAssigned: "No greeting message from this system",
  assignedDraftNotice: "Assigned, but template is in draft",

  editorCreateTitle: "Create Greeting Message",
  editorEditTitle: "Edit Greeting Message",
  fieldName: "Template Name",
  fieldNamePlaceholder: "e.g. Standard Store Welcome 2026",
  fieldDescription: "Description (Optional)",
  fieldDescriptionPlaceholder: "State the purpose or campaign for this greeting message...",
  fieldSendPolicy: "Sending Policy",
  insertVariable: "Insert Variable:",
  varUserDisplayName: "User's display name",
  varAccountName: "Account name",
  varStoreName: "Store name",
  varGoogleMapsUrl: "Google Maps",
  varExternalStoreId: "Store ID",
  varProvince: "Province",
  varRegion: "Region",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "Message Sequence (Max 5)",
  addTextBlockButton: "+ Add Text",
  addImageBlockButton: "+ Add Image",
  textBlockTitle: (idx) => `Message ${idx}`,
  imageBlockTitle: (idx) => `Image ${idx}`,
  textBlockPlaceholder: "Type your greeting message... you can insert store variables or user name",
  charCount: (curr, max) => `${curr} / ${max}`,
  uploadImageButton: "Upload Image",
  changeImageButton: "Change Image",
  deleteBlockButton: "Delete",
  moveUpButton: "Move Up",
  moveDownButton: "Move Down",
  maxBlocksNotice: "Maximum of 5 messages reached (LINE API limit)",
  blocksCount: (n) => `${n} / 5 messages`,
  uploading: "Uploading image...",
  uploadSuccess: "Image uploaded successfully",
  uploadFailed: "Image upload failed. Please try again.",
  invalidImage: "Only JPG or PNG images up to 10MB are supported",
  dropImageHint: "Drag and drop image here or click to browse (JPEG / PNG max 10MB)",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "Warning: Editing Active Template",
  activeEditWarningMessage: (count) =>
    `Saving this active template will immediately affect ${count} assigned stores for new follow events.`,
  activeEditWarningConfirm: "Confirm and Save",
  activeEditWarningCancel: "Cancel",
  saveTemplateButton: "Save template",
  saveAndAssignButton: "Save and Manage Stores",
  activateButton: "Activate",
  deactivateButton: "Deactivate",
  archiveButton: "Archive",
  archiveConfirm: "Archive this template? This will remove all store assignments.",
  editButton: "Edit",
  previewButton: "Preview",
  assignStoresButton: "Manage Stores",
  cancelButton: "Cancel",
  closeButton: "Close",
  backToList: "Back to list",

  storeAssignmentTitle: "Select Stores for this Greeting Message",
  storeAssignmentDesc: "Select store LINE Official Accounts that will send this greeting upon customer follow.",
  selectAllReady: "Select all ready stores",
  clearSelection: "Clear selection",
  colSelect: "Select",
  colStoreName: "Store Name",
  colBasicId: "LINE ID",
  colGoogleMaps: "Google Maps",
  colReadiness: "Data Readiness",
  colCurrentTemplate: "Current Template",
  statusReady: "Ready",
  statusBlocked: "Missing Variables",
  assignedToThis: "Assigned to this template",
  assignedToOther: (name) => `Assigned to: ${name}`,
  notAssigned: "Not assigned",
  readyStoresSummary: (ready, total, selected) => `${ready} of ${total} stores ready (${selected} selected)`,
  saveAssignmentsSuccess: (count) => `Successfully assigned greeting message to ${count} stores`,

  previewTitle: "Preview",
  previewStoreSelector: "Sample store:",
  previewCustomerNameLabel: "Sample user:",
  previewCustomerNamePlaceholder: "e.g. Somchai",
  previewSimulatedHeader: "OPPO Retail Official",
  previewNoticeZeroPush: "ℹ️ Sent via LINE Reply Token only; no Push Message costs incurred",
  previewReadyBadge: "Ready",
  previewBlockedBadge: "Missing Variables",
  previewSimulateFollow: "Simulate Follow Event",
};

const zh: GreetingDict = {
  title: "问候消息",
  subtitle: "当用户添加您为好友时自动发送此消息。",
  duplicationWarning: "⚠️ 为防止重复发送问候消息，在此处启用模板前，请关闭 LINE 官方账号管理器中的原生问候消息。",
  createTemplateButton: "创建问候模板",
  searchPlaceholder: "按名称或描述搜索模板...",
  filterAll: "全部",
  filterActive: "已启用",
  filterDraft: "草稿",
  filterInactive: "已停用",
  filterArchived: "已归档",
  statusActive: "已启用",
  statusDraft: "草稿",
  statusInactive: "已停用",
  statusArchived: "已归档",
  sendPolicyFirstTime: "仅首次加好友",
  sendPolicyAddAndUnblock: "加好友与解除拉黑",
  sendPolicyFirstTimeDesc: "仅在客户首次添加为好友时发送。解除拉黑或已关注用户不重复发送。",
  sendPolicyAddAndUnblockDesc: "在每次关注事件时发送，包括新好友添加和解除拉黑。",
  versionLabel: (v) => `v${v}`,
  assignedStoresLabel: (count) => `已关联 ${count} 家门店`,
  emptyList: "未找到问候模板",
  emptyListDesc: "立即创建您的第一个门店问候消息模板。",

  // LINE OA Visual Layout
  headerTitle: "问候消息",
  headerSubtitle: "当用户添加您为好友时自动发送此消息。",
  headerHelp: "如果您不想发送问候消息，可以在 设置 > 回复设置 中禁用它。",
  saveChanges: "保存模板",
  saveTemplate: "保存模板",
  insights: "数据洞察",
  templatesButton: "模板",
  sendingRestrictions: "发送限制",
  onlySendFirstTime: "仅向首次加好友的用户发送",
  onlySendFirstTimeHelp: "开启此设置以防止向解除拉黑账号的好友重复发送问候消息。",
  messageContent: "消息内容",
  userDisplayName: "用户显示名称",
  accountName: "账号名称",
  storeName: "门店名称",
  googleMaps: "Google Maps",
  moreVariables: "更多变量",
  userDisplayNameNotice: "包含用户显示名称的消息仅对您有权查看其资料的接收者显示。",
  add: "添加",
  text: "文本",
  image: "图片",
  emoji: "表情",
  preview: "Preview",
  chatScreen: "Chat screen",
  chatList: "Chat list",
  sampleStore: "示例门店:",
  sampleUser: "示例用户:",
  previewFor: "预览针对:",
  basedOnSelectedStore: "基于已选门店",
  testPreviewButton: "测试预览",
  unsavedChanges: "有未保存的更改",
  storeAssignmentsSection: "门店关联应用",
  storesSummary: (active, ready, blocked) => `已关联 ${active} 家 • 准备就绪 ${ready} 家 • 未就绪 ${blocked} 家`,
  manageStores: "选择门店",
  applyToAllReady: "应用于所有就绪门店",
  applyToStores: (count) => `应用到 ${count} 家门店`,
  openLineOaManager: "打开 LINE 官方账号管理器 ↗",
  oaManagerWarning: "如果在此账号的 LINE 官方账号管理器中启用了问候消息，客户可能会收到重复的问候消息。",

  // Status Badges & Lifecycle Actions
  statusActiveBadge: (count, v) => `已启用 · ${count} 家门店 · v${v}`,
  statusDraftBadge: (v) => `草稿 · 未启用 · v${v}`,
  statusInactiveBadge: (count, v) => `已停用 · ${count} 家门店 · v${v}`,
  statusArchivedBadge: (v) => `已归档 · v${v}`,
  activateTemplate: "启用模板",
  deactivateTemplate: "停用模板",
  colGreetingStatus: "问候消息状态",
  noGreetingAssigned: "此系统暂无问候消息",
  assignedDraftNotice: "已关联，但模板仍为草稿",

  editorCreateTitle: "创建问候消息",
  editorEditTitle: "编辑问候消息",
  fieldName: "模板名称",
  fieldNamePlaceholder: "例如：2026 门店标准欢迎语",
  fieldDescription: "描述（可选）",
  fieldDescriptionPlaceholder: "注明此问候消息的目的或活动...",
  fieldSendPolicy: "发送策略",
  insertVariable: "插入变量:",
  varUserDisplayName: "用户显示名称",
  varAccountName: "账号名称",
  varStoreName: "门店名称",
  varGoogleMapsUrl: "Google Maps",
  varExternalStoreId: "门店编号",
  varProvince: "省份",
  varRegion: "区域",
  varLineId: "LINE ID",
  varTiktokUsername: "TikTok",

  messageSequenceTitle: "消息序列（最多 5 条）",
  addTextBlockButton: "+ 添加文本",
  addImageBlockButton: "+ 添加图片",
  textBlockTitle: (idx) => `消息 ${idx}`,
  imageBlockTitle: (idx) => `图片 ${idx}`,
  textBlockPlaceholder: "输入问候消息... 可插入门店变量或用户名",
  charCount: (curr, max) => `${curr} / ${max}`,
  uploadImageButton: "上传图片",
  changeImageButton: "更换图片",
  deleteBlockButton: "删除",
  moveUpButton: "上移",
  moveDownButton: "下移",
  maxBlocksNotice: "已达 5 条消息上限（LINE API 限制）",
  blocksCount: (n) => `${n} / 5 条消息`,
  uploading: "正在上传图片...",
  uploadSuccess: "图片上传成功",
  uploadFailed: "图片上传失败，请重试",
  invalidImage: "仅支持最大 10MB 的 JPG 或 PNG 图片",
  dropImageHint: "拖放图片到此处或点击选择文件（JPEG / PNG 最大 10MB）",
  imageDimensions: (w, h, kb) => `${w} × ${h} px (${kb} KB)`,

  activeEditWarningTitle: "警告：正在编辑已启用的模板",
  activeEditWarningMessage: (count) =>
    `修改此已启用的模板将在保存后立即对关联的 ${count} 家门店的新关注事件生效。`,
  activeEditWarningConfirm: "确认并保存",
  activeEditWarningCancel: "取消",
  saveTemplateButton: "保存模板",
  saveAndAssignButton: "保存并管理门店",
  activateButton: "启用",
  deactivateButton: "停用",
  archiveButton: "归档",
  archiveConfirm: "确认归档此模板？这将解除所有门店关联。",
  editButton: "编辑",
  previewButton: "预览",
  assignStoresButton: "管理门店",
  cancelButton: "取消",
  closeButton: "关闭",
  backToList: "返回列表",

  storeAssignmentTitle: "选择应用此问候消息的门店",
  storeAssignmentDesc: "选择在客户关注时发送此问候消息的门店 LINE 官方账号。",
  selectAllReady: "选择所有就绪门店",
  clearSelection: "清除所有选择",
  colSelect: "选择",
  colStoreName: "门店名称",
  colBasicId: "LINE ID",
  colGoogleMaps: "Google Maps",
  colReadiness: "数据就绪情况",
  colCurrentTemplate: "当前模板",
  statusReady: "准备就绪",
  statusBlocked: "缺少变量数据",
  assignedToThis: "已关联至此模板",
  assignedToOther: (name) => `已关联至: ${name}`,
  notAssigned: "未关联模板",
  readyStoresSummary: (ready, total, selected) => `${total} 家中 ${ready} 家已就绪（已选 ${selected} 家）`,
  saveAssignmentsSuccess: (count) => `已成功将问候消息关联至 ${count} 家门店`,

  previewTitle: "Preview",
  previewStoreSelector: "示例门店:",
  previewCustomerNameLabel: "示例用户:",
  previewCustomerNamePlaceholder: "例如：张三",
  previewSimulatedHeader: "OPPO Retail Official",
  previewNoticeZeroPush: "ℹ️ 仅通过 LINE Reply Token 发送，无额外 Push 成本",
  previewReadyBadge: "就绪",
  previewBlockedBadge: "缺少变量",
  previewSimulateFollow: "模拟加好友事件",
};

export function getGreetingDict(lang?: string): GreetingDict {
  if (lang === "zh") return zh;
  if (lang === "en") return en;
  return th;
}
