export type AutoResponseDict = {
  title: string;
  subtitle: string;
  duplicateWarning: string;
  createRuleButton: string;
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
  versionLabel: (v: number) => string;
  usageLabel: (count: number) => string;
  emptyList: string;
  emptyListDesc: string;

  // Editor
  editorCreateTitle: string;
  editorEditTitle: string;
  fieldName: string;
  fieldNamePlaceholder: string;
  fieldDescription: string;
  fieldDescriptionPlaceholder: string;
  fieldTextTemplate: string;
  fieldTextTemplatePlaceholder: string;
  insertStoreVariable: string;
  varStoreName: string;
  varGoogleMapsUrl: string;
  varLineOaLink: string;
  varTiktokUrl: string;

  // Message Builder
  messageSequenceTitle: string;
  addMessageButton: string;
  typeText: string;
  typeImage: string;
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

  activeEditWarning: string;
  saveDraftButton: string;
  activateButton: string;
  deactivateButton: string;
  archiveButton: string;
  editButton: string;
  cancelButton: string;
  saving: string;

  // Preview
  previewTitle: string;
  previewStoreSelect: string;
  previewResolvedTitle: string;
  previewBubbleHeader: string;
  previewReady: string;
  previewBlocked: string;
  previewNoStore: string;
  previewMissingMaps: string;
  previewMissingImage: string;

  // Modals & Confirmation
  deactivateConfirmTitle: string;
  deactivateConfirmDesc: (name: string, count: number) => string;
  archiveConfirmTitle: string;
  archiveConfirmDesc: (name: string, count: number) => string;
  confirmAction: string;
  linkedRichMenusTitle: string;
  noLinkedMenus: string;
  viewUsageButton: string;

  // Toast / Messages
  createSuccess: string;
  updateSuccess: string;
  activateSuccess: string;
  deactivateSuccess: string;
  archiveSuccess: string;
  errorRequiredName: string;
  errorRequiredText: string;
  errorInvalidBlocks: string;
};

export const autoResponseI18n: Record<"th" | "en" | "zh", AutoResponseDict> = {
  th: {
    title: "ข้อความตอบกลับอัตโนมัติ",
    subtitle: "สร้างและจัดการข้อความตอบกลับสำหรับ LINE OA ทุกสาขา",
    duplicateWarning:
      "เพื่อป้องกันการตอบซ้ำ ควรปิดข้อความตอบกลับอัตโนมัติที่ทำงานซ้ำกันใน LINE Official Account Manager",
    createRuleButton: "สร้างข้อความตอบกลับ",
    searchPlaceholder: "ค้นหาตามชื่อหรือข้อความ...",
    filterAll: "ทั้งหมด",
    filterActive: "ใช้งานอยู่",
    filterDraft: "แบบร่าง",
    filterInactive: "ปิดใช้งาน",
    filterArchived: "เก็บถาวร",
    statusActive: "ใช้งานอยู่",
    statusDraft: "แบบร่าง",
    statusInactive: "ปิดใช้งาน",
    statusArchived: "เก็บถาวร",
    versionLabel: (v) => `v${v}`,
    usageLabel: (count) => `ใช้ใน Rich Menu ${count} เทมเพลต`,
    emptyList: "ไม่พบข้อความตอบกลับอัตโนมัติ",
    emptyListDesc: "กดปุ่ม 'สร้างข้อความตอบกลับ' เพื่อเริ่มต้นสร้างข้อความแรก",

    editorCreateTitle: "สร้างข้อความตอบกลับใหม่",
    editorEditTitle: "แก้ไขข้อความตอบกลับ",
    fieldName: "ชื่อข้อความตอบกลับ",
    fieldNamePlaceholder: "เช่น โปรโมชั่นประจำเดือน, ที่ตั้งและเวลาทำการ",
    fieldDescription: "คำอธิบาย (ไม่บังคับ)",
    fieldDescriptionPlaceholder: "รายละเอียดภายในสำหรับการบริหารจัดการ",
    fieldTextTemplate: "ข้อความ",
    fieldTextTemplatePlaceholder:
      "พิมพ์ข้อความที่ต้องการตอบกลับลูกค้า รองรับตัวแปร เช่น {{store.storeName}} และ {{store.googleMapsUrl}}",
    insertStoreVariable: "แทรกข้อมูลร้าน",
    varStoreName: "ชื่อร้าน ({{store.storeName}})",
    varGoogleMapsUrl: "ลิงก์ Google Maps ({{store.googleMapsUrl}})",
    varLineOaLink: "ลิงก์ LINE OA ({{store.lineOaLink}})",
    varTiktokUrl: "ลิงก์ TikTok ({{store.tiktokProfileUrl}})",

    messageSequenceTitle: "ลำดับข้อความตอบกลับ (Message Builder)",
    addMessageButton: "เพิ่มข้อความ",
    typeText: "ข้อความ",
    typeImage: "รูปภาพ",
    uploadImageButton: "อัปโหลดรูปภาพ",
    changeImageButton: "เปลี่ยนรูป",
    deleteBlockButton: "ลบ",
    moveUpButton: "เลื่อนขึ้น",
    moveDownButton: "เลื่อนลง",
    maxBlocksNotice: "รองรับสูงสุด 5 ข้อความต่อ 1 การตอบกลับ",
    blocksCount: (n) => `${n} / 5 ข้อความ`,
    uploading: "กำลังอัปโหลด...",
    uploadSuccess: "อัปโหลดสำเร็จ",
    uploadFailed: "อัปโหลดไม่สำเร็จ",
    invalidImage: "รองรับเฉพาะไฟล์ JPG และ PNG ขนาดไม่เกิน 10 MB",
    dropImageHint: "ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์ (JPG, PNG ไม่เกิน 10 MB)",
    imageDimensions: (w, h, kb) => `${w} × ${h} px • ${kb} KB`,

    activeEditWarning:
      "การแก้ไขข้อความหรือรูปภาพที่เปิดใช้งานอยู่จะมีผลกับ Rich Menu ที่เชื่อมโยงทันที",
    saveDraftButton: "บันทึกแบบร่าง",
    activateButton: "เปิดใช้งาน",
    deactivateButton: "ปิดใช้งาน",
    archiveButton: "เก็บถาวร",
    editButton: "แก้ไข",
    cancelButton: "ยกเลิก",
    saving: "กำลังบันทึก...",

    previewTitle: "ดูตัวอย่างสำหรับร้าน",
    previewStoreSelect: "เลือกร้านค้า",
    previewResolvedTitle: "ข้อความที่ลูกค้าจะได้รับ",
    previewBubbleHeader: "จำลองมุมมองลูกค้าบน LINE",
    previewReady: "พร้อมใช้งาน",
    previewBlocked: "ไม่พร้อมใช้งาน",
    previewNoStore: "ไม่มีข้อมูลสาขาสำหรับการแสดงตัวอย่าง",
    previewMissingMaps: "ไม่มีลิงก์ Google Maps ใน Store Master",
    previewMissingImage: "ยังไม่ได้อัปโหลดรูปภาพ",

    deactivateConfirmTitle: "ยืนยันการปิดใช้งานข้อความตอบกลับ",
    deactivateConfirmDesc: (name, count) =>
      count > 0
        ? `ข้อความตอบกลับ "${name}" กำลังถูกใช้งานใน Rich Menu ${count} เทมเพลต หากปิดใช้งาน ปุ่มเหล่านั้นจะไม่ตอบกลับลูกค้า`
        : `คุณต้องการปิดใช้งานข้อความตอบกลับ "${name}" ใช่หรือไม่?`,
    archiveConfirmTitle: "ยืนยันการเก็บถาวรข้อความตอบกลับ",
    archiveConfirmDesc: (name, count) =>
      count > 0
        ? `ข้อความตอบกลับ "${name}" กำลังถูกใช้งานใน Rich Menu ${count} เทมเพลต หากเก็บถาวร ปุ่มเหล่านั้นจะไม่สามารถทำงานได้`
        : `คุณต้องการเก็บถาวรข้อความตอบกลับ "${name}" ใช่หรือไม่?`,
    confirmAction: "ยืนยัน",
    linkedRichMenusTitle: "Rich Menu ที่เชื่อมโยง",
    noLinkedMenus: "ยังไม่มี Rich Menu ที่เชื่อมโยงกับข้อความนี้",
    viewUsageButton: "ดูการเชื่อมโยง",

    createSuccess: "สร้างข้อความตอบกลับเรียบร้อยแล้ว",
    updateSuccess: "บันทึกการแก้ไขเรียบร้อยแล้ว",
    activateSuccess: "เปิดใช้งานข้อความตอบกลับเรียบร้อยแล้ว",
    deactivateSuccess: "ปิดใช้งานข้อความตอบกลับเรียบร้อยแล้ว",
    archiveSuccess: "เก็บถาวรข้อความตอบกลับเรียบร้อยแล้ว",
    errorRequiredName: "กรุณากรอกชื่อข้อความตอบกลับ",
    errorRequiredText: "กรุณากรอกข้อความตอบกลับ",
    errorInvalidBlocks: "กรุณาตรวจสอบข้อความตอบกลับ (ต้องมี 1-5 ข้อความและกรอกข้อมูลครบถ้วน)",
  },
  en: {
    title: "Auto-responses",
    subtitle: "Create and manage automated responses for all store LINE OAs",
    duplicateWarning:
      "To avoid duplicate replies, disable overlapping auto-response rules in LINE Official Account Manager.",
    createRuleButton: "Create Auto-response",
    searchPlaceholder: "Search by name or message...",
    filterAll: "All",
    filterActive: "Active",
    filterDraft: "Draft",
    filterInactive: "Inactive",
    filterArchived: "Archived",
    statusActive: "Active",
    statusDraft: "Draft",
    statusInactive: "Inactive",
    statusArchived: "Archived",
    versionLabel: (v) => `v${v}`,
    usageLabel: (count) => `Used in ${count} Rich Menu template${count === 1 ? "" : "s"}`,
    emptyList: "No auto-response rules found",
    emptyListDesc: "Click 'Create Auto-response' to start building your first response.",

    editorCreateTitle: "New Auto-response Rule",
    editorEditTitle: "Edit Auto-response Rule",
    fieldName: "Rule Name",
    fieldNamePlaceholder: "e.g., Monthly Promotion, Location & Hours",
    fieldDescription: "Description (Optional)",
    fieldDescriptionPlaceholder: "Internal reference note",
    fieldTextTemplate: "Text Message",
    fieldTextTemplatePlaceholder:
      "Enter response text for customers. Supports variables like {{store.storeName}} and {{store.googleMapsUrl}}",
    insertStoreVariable: "Insert Store Variable",
    varStoreName: "Store Name ({{store.storeName}})",
    varGoogleMapsUrl: "Google Maps URL ({{store.googleMapsUrl}})",
    varLineOaLink: "LINE OA Link ({{store.lineOaLink}})",
    varTiktokUrl: "TikTok Link ({{store.tiktokProfileUrl}})",

    messageSequenceTitle: "Message Sequence (Builder)",
    addMessageButton: "Add Message",
    typeText: "Text",
    typeImage: "Image",
    uploadImageButton: "Upload Image",
    changeImageButton: "Change Image",
    deleteBlockButton: "Delete",
    moveUpButton: "Move Up",
    moveDownButton: "Move Down",
    maxBlocksNotice: "Maximum 5 messages per response",
    blocksCount: (n) => `${n} / 5 messages`,
    uploading: "Uploading...",
    uploadSuccess: "Upload succeeded",
    uploadFailed: "Upload failed",
    invalidImage: "Only JPEG and PNG files up to 10 MB are supported",
    dropImageHint: "Drag and drop image here or click to browse (JPG, PNG up to 10 MB)",
    imageDimensions: (w, h, kb) => `${w} × ${h} px • ${kb} KB`,

    activeEditWarning:
      "Editing active responses takes effect immediately on all linked Rich Menus.",
    saveDraftButton: "Save Draft",
    activateButton: "Activate",
    deactivateButton: "Deactivate",
    archiveButton: "Archive",
    editButton: "Edit",
    cancelButton: "Cancel",
    saving: "Saving...",

    previewTitle: "Store Preview",
    previewStoreSelect: "Select Store",
    previewResolvedTitle: "Customer Chat Preview",
    previewBubbleHeader: "LINE Customer View Simulation",
    previewReady: "Ready",
    previewBlocked: "Not Ready",
    previewNoStore: "No store data available for preview",
    previewMissingMaps: "Missing Google Maps URL in Store Master",
    previewMissingImage: "No image uploaded",

    deactivateConfirmTitle: "Confirm Deactivation",
    deactivateConfirmDesc: (name, count) =>
      count > 0
        ? `Auto-response "${name}" is currently used in ${count} Rich Menu template${count === 1 ? "" : "s"}. Deactivating it will prevent buttons from replying.`
        : `Are you sure you want to deactivate "${name}"?`,
    archiveConfirmTitle: "Confirm Archive",
    archiveConfirmDesc: (name, count) =>
      count > 0
        ? `Auto-response "${name}" is currently used in ${count} Rich Menu template${count === 1 ? "" : "s"}. Archiving it will detach and disable response buttons.`
        : `Are you sure you want to archive "${name}"?`,
    confirmAction: "Confirm",
    linkedRichMenusTitle: "Linked Rich Menus",
    noLinkedMenus: "No Rich Menus currently linked to this response.",
    viewUsageButton: "View Links",

    createSuccess: "Auto-response rule created successfully",
    updateSuccess: "Auto-response rule updated successfully",
    activateSuccess: "Auto-response rule activated successfully",
    deactivateSuccess: "Auto-response rule deactivated",
    archiveSuccess: "Auto-response rule archived",
    errorRequiredName: "Rule name is required",
    errorRequiredText: "Response message text is required",
    errorInvalidBlocks: "Please check message blocks (1 to 5 valid blocks required)",
  },
  zh: {
    title: "自动回复",
    subtitle: "为所有门店 LINE OA 创建和管理自动化回复消息",
    duplicateWarning:
      "为防止重复回复，请在 LINE Official Account Manager 中关闭重叠的自动回复规则。",
    createRuleButton: "新建自动回复",
    searchPlaceholder: "按名称或内容搜索...",
    filterAll: "全部",
    filterActive: "已启用",
    filterDraft: "草稿",
    filterInactive: "已停用",
    filterArchived: "已归档",
    statusActive: "已启用",
    statusDraft: "草稿",
    statusInactive: "已停用",
    statusArchived: "已归档",
    versionLabel: (v) => `v${v}`,
    usageLabel: (count) => `已在 ${count} 个 Rich Menu 模板中使用`,
    emptyList: "未找到自动回复规则",
    emptyListDesc: "点击“新建自动回复”开始创建第一条规则。",

    editorCreateTitle: "新建自动回复规则",
    editorEditTitle: "编辑自动回复规则",
    fieldName: "规则名称",
    fieldNamePlaceholder: "例如：本月促销、门店位置与营业时间",
    fieldDescription: "描述（可选）",
    fieldDescriptionPlaceholder: "内部管理备注",
    fieldTextTemplate: "回复消息",
    fieldTextTemplatePlaceholder:
      "输入回复客户的消息内容，支持 {{store.storeName}} 和 {{store.googleMapsUrl}} 等变量",
    insertStoreVariable: "插入门店数据",
    varStoreName: "门店名称 ({{store.storeName}})",
    varGoogleMapsUrl: "Google Maps 链接 ({{store.googleMapsUrl}})",
    varLineOaLink: "LINE OA 链接 ({{store.lineOaLink}})",
    varTiktokUrl: "TikTok 链接 ({{store.tiktokProfileUrl}})",

    messageSequenceTitle: "回复消息流序列 (Message Builder)",
    addMessageButton: "添加消息",
    typeText: "文本",
    typeImage: "图片",
    uploadImageButton: "上传图片",
    changeImageButton: "更换图片",
    deleteBlockButton: "删除",
    moveUpButton: "上移",
    moveDownButton: "下移",
    maxBlocksNotice: "单次回复最多支持 5 条消息",
    blocksCount: (n) => `${n} / 5 条消息`,
    uploading: "正在上传...",
    uploadSuccess: "上传成功",
    uploadFailed: "上传失败",
    invalidImage: "仅支持 10 MB 以内的 JPG 和 PNG 文件",
    dropImageHint: "拖放图片至此处或点击浏览选择文件（JPG、PNG，最大 10 MB）",
    imageDimensions: (w, h, kb) => `${w} × ${h} 像素 • ${kb} KB`,

    activeEditWarning:
      "修改已启用的回复消息将立即对所有关联的 Rich Menu 生效。",
    saveDraftButton: "保存草稿",
    activateButton: "启用",
    deactivateButton: "停用",
    archiveButton: "归档",
    editButton: "编辑",
    cancelButton: "取消",
    saving: "正在保存...",

    previewTitle: "门店效果预览",
    previewStoreSelect: "选择门店",
    previewResolvedTitle: "客户收到的消息",
    previewBubbleHeader: "LINE 客户端效果模拟",
    previewReady: "已就绪",
    previewBlocked: "未就绪",
    previewNoStore: "暂无门店数据可供预览",
    previewMissingMaps: "Store Master 中缺少 Google Maps 链接",
    previewMissingImage: "尚未上传图片",

    deactivateConfirmTitle: "确认停用自动回复",
    deactivateConfirmDesc: (name, count) =>
      count > 0
        ? `自动回复“${name}”正在被 ${count} 个 Rich Menu 模板使用。停用后相关按钮将无法回复客户。`
        : `确定要停用自动回复“${name}”吗？`,
    archiveConfirmTitle: "确认归档自动回复",
    archiveConfirmDesc: (name, count) =>
      count > 0
        ? `自动回复“${name}”正在被 ${count} 个 Rich Menu 模板使用。归档后相关按钮将断开连接。`
        : `确定要归档自动回复“${name}”吗？`,
    confirmAction: "确认",
    linkedRichMenusTitle: "关联的 Rich Menu",
    noLinkedMenus: "暂无 Rich Menu 关联此回复规则。",
    viewUsageButton: "查看关联",

    createSuccess: "自动回复规则创建成功",
    updateSuccess: "自动回复规则更新成功",
    activateSuccess: "自动回复规则已启用",
    deactivateSuccess: "自动回复规则已停用",
    archiveSuccess: "自动回复规则已归档",
    errorRequiredName: "请输入规则名称",
    errorRequiredText: "请输入回复消息内容",
    errorInvalidBlocks: "请检查消息内容（需包含 1 至 5 条完整有效的消息）",
  },
};
