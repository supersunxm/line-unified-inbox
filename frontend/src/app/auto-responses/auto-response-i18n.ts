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
  previewReady: string;
  previewBlocked: string;
  previewNoStore: string;
  previewMissingMaps: string;

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
    fieldTextTemplate: "ข้อความตอบกลับ",
    fieldTextTemplatePlaceholder:
      "พิมพ์ข้อความที่ต้องการตอบกลับลูกค้า รองรับตัวแปร เช่น {{store.storeName}} และ {{store.googleMapsUrl}}",
    insertStoreVariable: "แทรกข้อมูลร้าน",
    varStoreName: "ชื่อร้าน ({{store.storeName}})",
    varGoogleMapsUrl: "ลิงก์ Google Maps ({{store.googleMapsUrl}})",
    varLineOaLink: "ลิงก์ LINE OA ({{store.lineOaLink}})",
    varTiktokUrl: "ลิงก์ TikTok ({{store.tiktokProfileUrl}})",

    activeEditWarning:
      "การแก้ไขข้อความที่เปิดใช้งานอยู่จะมีผลกับ Rich Menu ที่เชื่อมโยงทันที",
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
    previewReady: "พร้อมใช้งาน",
    previewBlocked: "ไม่พร้อมใช้งาน",
    previewNoStore: "ไม่มีข้อมูลสาขาสำหรับการแสดงตัวอย่าง",
    previewMissingMaps: "ไม่มีลิงก์ Google Maps ใน Store Master",

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
  },
  en: {
    title: "Auto-response",
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
    usageLabel: (count) => `Used in ${count} Rich Menu templates`,
    emptyList: "No auto-response rules found",
    emptyListDesc: "Click 'Create Auto-response' to start creating your first rule",

    editorCreateTitle: "New Auto-response Rule",
    editorEditTitle: "Edit Auto-response Rule",
    fieldName: "Rule Name",
    fieldNamePlaceholder: "e.g. Monthly Promotion, Store Hours & Location",
    fieldDescription: "Description (optional)",
    fieldDescriptionPlaceholder: "Internal operational notes",
    fieldTextTemplate: "Response Message",
    fieldTextTemplatePlaceholder:
      "Type customer reply text. Supports variables such as {{store.storeName}} and {{store.googleMapsUrl}}",
    insertStoreVariable: "Insert Store Data",
    varStoreName: "Store Name ({{store.storeName}})",
    varGoogleMapsUrl: "Google Maps URL ({{store.googleMapsUrl}})",
    varLineOaLink: "LINE OA Link ({{store.lineOaLink}})",
    varTiktokUrl: "TikTok Profile ({{store.tiktokProfileUrl}})",

    activeEditWarning:
      "Editing active responses takes effect immediately on all linked Rich Menus.",
    saveDraftButton: "Save Draft",
    activateButton: "Activate",
    deactivateButton: "Deactivate",
    archiveButton: "Archive",
    editButton: "Edit",
    cancelButton: "Cancel",
    saving: "Saving...",

    previewTitle: "Preview as Store",
    previewStoreSelect: "Select Store",
    previewResolvedTitle: "Customer Message Preview",
    previewReady: "Ready",
    previewBlocked: "Blocked",
    previewNoStore: "No store account available for preview",
    previewMissingMaps: "Missing Google Maps URL in Store Master",

    deactivateConfirmTitle: "Confirm Deactivation",
    deactivateConfirmDesc: (name, count) =>
      count > 0
        ? `Auto-response "${name}" is used in ${count} Rich Menu templates. If deactivated, those buttons will no longer respond to customers.`
        : `Are you sure you want to deactivate "${name}"?`,
    archiveConfirmTitle: "Confirm Archival",
    archiveConfirmDesc: (name, count) =>
      count > 0
        ? `Auto-response "${name}" is used in ${count} Rich Menu templates. If archived, those buttons will cease responding.`
        : `Are you sure you want to archive "${name}"?`,
    confirmAction: "Confirm",
    linkedRichMenusTitle: "Linked Rich Menus",
    noLinkedMenus: "No Rich Menus are currently linked to this rule",
    viewUsageButton: "View Usages",

    createSuccess: "Auto-response created successfully",
    updateSuccess: "Auto-response updated successfully",
    activateSuccess: "Auto-response activated successfully",
    deactivateSuccess: "Auto-response deactivated successfully",
    archiveSuccess: "Auto-response archived successfully",
    errorRequiredName: "Rule name is required",
    errorRequiredText: "Response message is required",
  },
  zh: {
    title: "自动回复",
    subtitle: "创建并管理所有门店 LINE OA 的自动回复消息",
    duplicateWarning:
      "为防止重复回复，请在 LINE Official Account Manager 中关闭重叠的自动回复规则。",
    createRuleButton: "创建自动回复",
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
    usageLabel: (count) => `在 ${count} 个 Rich Menu 模板中使用`,
    emptyList: "未找到自动回复规则",
    emptyListDesc: "点击“创建自动回复”开始创建第一条规则",

    editorCreateTitle: "新建自动回复规则",
    editorEditTitle: "编辑自动回复规则",
    fieldName: "规则名称",
    fieldNamePlaceholder: "例如：本月促销、门店营业时间与位置",
    fieldDescription: "描述（选填）",
    fieldDescriptionPlaceholder: "用于内部管理的备注",
    fieldTextTemplate: "回复消息",
    fieldTextTemplatePlaceholder:
      "输入回复客户的消息内容，支持变量如 {{store.storeName}} 和 {{store.googleMapsUrl}}",
    insertStoreVariable: "插入门店信息",
    varStoreName: "门店名称 ({{store.storeName}})",
    varGoogleMapsUrl: "Google Maps 链接 ({{store.googleMapsUrl}})",
    varLineOaLink: "LINE OA 链接 ({{store.lineOaLink}})",
    varTiktokUrl: "TikTok 链接 ({{store.tiktokProfileUrl}})",

    activeEditWarning:
      "修改已启用的回复消息将立即对所有关联的 Rich Menu 生效。",
    saveDraftButton: "保存草稿",
    activateButton: "启用",
    deactivateButton: "停用",
    archiveButton: "归档",
    editButton: "编辑",
    cancelButton: "取消",
    saving: "正在保存...",

    previewTitle: "按门店预览",
    previewStoreSelect: "选择门店",
    previewResolvedTitle: "客户接收消息预览",
    previewReady: "就绪",
    previewBlocked: "未就绪",
    previewNoStore: "暂无可用门店进行预览",
    previewMissingMaps: "Store Master 中缺少 Google Maps 链接",

    deactivateConfirmTitle: "确认停用自动回复",
    deactivateConfirmDesc: (name, count) =>
      count > 0
        ? `自动回复“${name}”正在 ${count} 个 Rich Menu 模板中使用。若停用，相关按钮将停止回复客户。`
        : `确定要停用“${name}”吗？`,
    archiveConfirmTitle: "确认归档自动回复",
    archiveConfirmDesc: (name, count) =>
      count > 0
        ? `自动回复“${name}”正在 ${count} 个 Rich Menu 模板中使用。若归档，相关按钮将无法工作。`
        : `确定要归档“${name}”吗？`,
    confirmAction: "确认",
    linkedRichMenusTitle: "关联的 Rich Menu",
    noLinkedMenus: "暂无关联此规则的 Rich Menu",
    viewUsageButton: "查看关联",

    createSuccess: "自动回复创建成功",
    updateSuccess: "自动回复保存成功",
    activateSuccess: "自动回复已启用",
    deactivateSuccess: "自动回复已停用",
    archiveSuccess: "自动回复已归档",
    errorRequiredName: "请输入规则名称",
    errorRequiredText: "请输入回复消息内容",
  },
};
