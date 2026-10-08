import type { AppLanguage } from "../../../language-utils";

type HqRegistrationCopy = {
  accountManagement: string;
  secretaryName: string;
  secretarySettings: string;
  secretaryOwnerDescription: string;
  secretaryNotReady: string;
  secretaryRequiredVariables: string;
  secretarySecretWarning: string;
  secretaryWebhookWarning: string;
  secretaryOpenRailway: string;
  secretaryWebhookLabel: string;
  secretaryWebhookUrl: string;
  title: string;
  description: string;
  bmPcAccounts: string;
  refresh: string;
  pendingApproval: string;
  approvedManage: string;
  loadingAccounts: string;
  noPending: string;
  pendingHq: string;
  employeeId: string;
  requested: string;
  reject: string;
  approveFullAccess: string;
  noApproved: string;
  active: string;
  inactive: string;
  lastLogin: string;
  never: string;
  changeRole: string;
  resetPassword: string;
  deactivate: string;
  reactivate: string;
  role: string;
  administrator: string;
  administratorDescription: string;
  assistant: string;
  assistantDescription: string;
  selfDemotionConfirmation: string;
  cancel: string;
  saveChanges: string;
  saving: string;
  temporaryPassword: string;
  resetCompleted: (name: string) => string;
  resetCompletedDetails: string;
  resetPasswordSecurity: string;
  shareSecurely: string;
  copied: string;
  copyPassword: string;
  done: string;
  generatePassword: (name: string) => string;
  resetPasswordDetails: string;
  resetting: string;
  roleUpdated: (name: string) => string;
  unableToChangeRole: string;
  unableToLoad: string;
  approvedNotice: string;
  rejectedNotice: string;
  actionFailed: string;
  accountStatusFailed: string;
  deactivatedNotice: (name: string) => string;
  reactivatedNotice: (name: string) => string;
  passwordResetFailed: string;
  copyPasswordFailed: string;
  requestFailed: (status: number) => string;
};

export const hqPermissionSummaryLabels = {
  th: { web: "Web", mobile: "Mobile", allStores: "ทุกร้าน", accountManagement: "จัดการบัญชี", reply: "ตอบข้อความ", mainOa: "Main OA", manageMainOa: "จัดการ Main OA", export: "ส่งออก / ดาวน์โหลด" },
  en: { web: "Web", mobile: "Mobile", allStores: "All Stores", accountManagement: "Account Management", reply: "Reply", mainOa: "Main OA", manageMainOa: "Main OA management", export: "Export / Download" },
  zh: { web: "Web", mobile: "Mobile", allStores: "全部门店", accountManagement: "账户管理", reply: "回复", mainOa: "Main OA", manageMainOa: "Main OA 管理", export: "导出 / 下载" },
} satisfies Record<AppLanguage, Record<string, string>>;

export const hqRegistrationText: Record<AppLanguage, HqRegistrationCopy> = {
  th: {
    secretaryWebhookLabel: "Webhook URL",
    secretaryWebhookUrl: "https://lineoppo.click/sunn-secretary/webhook",
    secretaryName: "เลขาซันน์",
    secretarySettings: "ตั้งค่า LINE เลขาซันน์",
    secretaryOwnerDescription: "การตั้งค่าส่วนตัวสำหรับบัญชีผู้ดูแลที่ได้รับอนุญาต",
    secretaryNotReady: "ยังไม่เปิดรับข้อมูล LINE ผ่านหน้านี้ และ Webhook ต้องปิดไว้จนกว่าการตรวจสิทธิ์และการจัดเก็บ Secret จะพร้อม",
    secretaryRequiredVariables: "ตัวแปรที่ต้องตั้งค่าบน Railway (Backend Service)",
    secretarySecretWarning: "เก็บ Secret และ Access Token เป็นตัวแปรลับเท่านั้น อย่าส่งผ่านแชทหรือ GitHub",
    secretaryWebhookWarning: "การเข้ากลุ่มสำเร็จไม่ได้หมายความว่า Webhook พร้อมใช้งาน",
    secretaryOpenRailway: "เปิด Railway เพื่อจัดการ Secret",
    accountManagement: "การจัดการบัญชี",
    title: "บัญชี HQ",
    description: "อนุมัติคำขอ HQ และจัดการบทบาทบัญชี",
    bmPcAccounts: "บัญชี BM / PC",
    refresh: "รีเฟรช",
    pendingApproval: "รออนุมัติ",
    approvedManage: "อนุมัติแล้ว / จัดการ",
    loadingAccounts: "กำลังโหลดบัญชี HQ…",
    noPending: "ไม่มีคำขอ HQ ที่รออนุมัติ",
    pendingHq: "รออนุมัติ HQ",
    employeeId: "รหัสพนักงาน:",
    requested: "ส่งคำขอเมื่อ:",
    reject: "ปฏิเสธ",
    approveFullAccess: "อนุมัติสิทธิ์เต็ม",
    noApproved: "ไม่มีบัญชี HQ ที่อนุมัติแล้ว",
    active: "ใช้งานอยู่",
    inactive: "ปิดใช้งาน",
    lastLogin: "เข้าสู่ระบบล่าสุด:",
    never: "ไม่เคย",
    changeRole: "เปลี่ยนบทบาท",
    resetPassword: "รีเซ็ตรหัสผ่าน",
    deactivate: "ปิดใช้งาน",
    reactivate: "เปิดใช้งานอีกครั้ง",
    role: "บทบาท",
    administrator: "ผู้ดูแลระบบ",
    administratorDescription: "สิทธิ์ผู้ดูแลระบบ สามารถส่งออกข้อมูลและจัดการบัญชีได้",
    assistant: "ผู้ช่วย",
    assistantDescription: "ใช้งานเครื่องมือปฏิบัติงานได้ตามขอบเขตร้านค้าเดิม ไม่สามารถส่งออกข้อมูลหรือจัดการบัญชีและสิทธิ์ได้",
    selfDemotionConfirmation: "ฉันเข้าใจว่าจะสูญเสียสิทธิ์จัดการบัญชี",
    cancel: "ยกเลิก",
    saveChanges: "บันทึกการเปลี่ยนแปลง",
    saving: "กำลังบันทึก…",
    temporaryPassword: "รหัสผ่านชั่วคราว",
    resetCompleted: (name) => `รีเซ็ตรหัสผ่านของ ${name} แล้ว`,
    resetCompletedDetails: "เซสชันเดิมถูกออกจากระบบแล้ว และเจ้าของบัญชีต้องเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ",
    resetPasswordSecurity: "รหัสผ่านนี้จะแสดงเฉพาะผลการรีเซ็ตครั้งนี้ โปรดแชร์กับเจ้าของบัญชีผ่านช่องทางที่ปลอดภัย",
    shareSecurely: "โปรดแชร์รหัสผ่านกับเจ้าของบัญชีผ่านช่องทางที่ปลอดภัย",
    copied: "คัดลอกแล้ว",
    copyPassword: "คัดลอกรหัสผ่าน",
    done: "เสร็จสิ้น",
    generatePassword: (name) => `สร้างรหัสผ่านชั่วคราวสำหรับ ${name}?`,
    resetPasswordDetails: "รหัสผ่านปัจจุบันจะใช้ไม่ได้ เซสชันเดิมจะถูกออกจากระบบ และเจ้าของบัญชีต้องตั้งรหัสผ่านใหม่หลังเข้าสู่ระบบ",
    resetting: "กำลังรีเซ็ต…",
    roleUpdated: (name) => `อัปเดตบทบาทของ ${name} แล้ว`,
    unableToChangeRole: "ไม่สามารถเปลี่ยนบทบาทได้",
    unableToLoad: "ไม่สามารถโหลดบัญชี HQ ได้",
    approvedNotice: "อนุมัติบัญชี HQ พร้อมสิทธิ์เต็มแล้ว",
    rejectedNotice: "ปฏิเสธคำขอลงทะเบียน HQ แล้ว",
    actionFailed: "ดำเนินการไม่สำเร็จ",
    accountStatusFailed: "เปลี่ยนสถานะบัญชีไม่สำเร็จ",
    deactivatedNotice: (name) => `ปิดใช้งาน ${name} แล้ว`,
    reactivatedNotice: (name) => `เปิดใช้งาน ${name} อีกครั้งแล้ว`,
    passwordResetFailed: "รีเซ็ตรหัสผ่านไม่สำเร็จ",
    copyPasswordFailed: "คัดลอกรหัสผ่านไม่ได้ โปรดคัดลอกด้วยตนเอง",
    requestFailed: (status) => `คำขอไม่สำเร็จ (${status})`,
  },
  en: {
    secretaryWebhookLabel: "Webhook URL",
    secretaryWebhookUrl: "https://lineoppo.click/sunn-secretary/webhook",
    secretaryName: "Sunn Secretary",
    secretarySettings: "Sunn Secretary LINE settings",
    secretaryOwnerDescription: "Personal configuration for the authorized administrator.",
    secretaryNotReady: "LINE credentials cannot be entered here yet. Keep the webhook disabled until authorization and secure secret storage are ready.",
    secretaryRequiredVariables: "Required Railway variables (Backend Service)",
    secretarySecretWarning: "Store secrets and access tokens only as sealed variables. Never share them in chat or GitHub.",
    secretaryWebhookWarning: "Joining a group does not mean the webhook is ready.",
    secretaryOpenRailway: "Open Railway to manage secrets",
    accountManagement: "Account Management",
    title: "HQ accounts",
    description: "Approve HQ requests and manage account roles.",
    bmPcAccounts: "BM / PC accounts",
    refresh: "Refresh",
    pendingApproval: "Pending approval",
    approvedManage: "Approved / Manage",
    loadingAccounts: "Loading HQ accounts…",
    noPending: "No pending HQ registrations.",
    pendingHq: "Pending HQ",
    employeeId: "Employee ID:",
    requested: "Requested:",
    reject: "Reject",
    approveFullAccess: "Approve full access",
    noApproved: "No approved HQ accounts.",
    active: "Active",
    inactive: "Inactive",
    lastLogin: "Last login:",
    never: "Never",
    changeRole: "Change role",
    resetPassword: "Reset password",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    role: "Role",
    administrator: "Administrator",
    administratorDescription: "Administrative access. Export/download and account management are allowed.",
    assistant: "Assistant",
    assistantDescription: "Operational access within the existing store scope. Export/download and account or permission management are disabled.",
    selfDemotionConfirmation: "I understand that I will lose Account Management access.",
    cancel: "Cancel",
    saveChanges: "Save changes",
    saving: "Saving…",
    temporaryPassword: "Temporary password",
    resetCompleted: (name) => `Password reset completed for ${name}.`,
    resetCompletedDetails: "Their existing sessions were signed out and they must change this password after signing in.",
    resetPasswordSecurity: "This password is shown only for this reset result. Share it securely with the account owner.",
    shareSecurely: "Share this temporary password securely with the account owner.",
    copied: "Copied",
    copyPassword: "Copy password",
    done: "Done",
    generatePassword: (name) => `Generate a temporary password for ${name}?`,
    resetPasswordDetails: "The current password will stop working, existing sessions will be signed out, and the account owner will have to set a new password after signing in.",
    resetting: "Resetting…",
    roleUpdated: (name) => `Role updated for ${name}.`,
    unableToChangeRole: "Unable to change role",
    unableToLoad: "Unable to load HQ accounts",
    approvedNotice: "HQ account approved with full access.",
    rejectedNotice: "HQ registration rejected.",
    actionFailed: "Action failed",
    accountStatusFailed: "Account status change failed",
    deactivatedNotice: (name) => `${name} was deactivated.`,
    reactivatedNotice: (name) => `${name} was reactivated.`,
    passwordResetFailed: "Password reset failed",
    copyPasswordFailed: "Unable to copy the temporary password. Please copy it manually.",
    requestFailed: (status) => `Request failed (${status})`,
  },
  zh: {
    secretaryWebhookLabel: "Webhook URL",
    secretaryWebhookUrl: "https://lineoppo.click/sunn-secretary/webhook",
    secretaryName: "Sunn Secretary",
    secretarySettings: "Sunn Secretary LINE 设置",
    secretaryOwnerDescription: "仅供授权管理员使用的个人配置。",
    secretaryNotReady: "目前无法在此输入 LINE 凭证。在权限验证和安全密钥存储准备好之前，请保持 Webhook 关闭。",
    secretaryRequiredVariables: "Railway 必需变量（后端服务）",
    secretarySecretWarning: "密钥和访问令牌只能存储为保密变量，切勿通过聊天或 GitHub 分享。",
    secretaryWebhookWarning: "成功加入群组并不代表 Webhook 已准备就绪。",
    secretaryOpenRailway: "打开 Railway 管理密钥",
    accountManagement: "账户管理",
    title: "HQ 账户",
    description: "审批 HQ 申请并管理账户角色。",
    bmPcAccounts: "BM / PC 账户",
    refresh: "刷新",
    pendingApproval: "待审批",
    approvedManage: "已批准 / 管理",
    loadingAccounts: "正在加载 HQ 账户…",
    noPending: "没有待审批的 HQ 申请。",
    pendingHq: "待审批 HQ",
    employeeId: "员工编号：",
    requested: "申请时间：",
    reject: "拒绝",
    approveFullAccess: "批准完整权限",
    noApproved: "没有已批准的 HQ 账户。",
    active: "启用",
    inactive: "停用",
    lastLogin: "最近登录：",
    never: "从未登录",
    changeRole: "更改角色",
    resetPassword: "重置密码",
    deactivate: "停用",
    reactivate: "重新启用",
    role: "角色",
    administrator: "管理员",
    administratorDescription: "拥有管理员权限，可导出或下载数据并管理账户。",
    assistant: "助理",
    assistantDescription: "可在现有门店范围内使用运营功能；不能导出或下载数据，也不能管理账户或权限。",
    selfDemotionConfirmation: "我了解降级后将失去账户管理权限。",
    cancel: "取消",
    saveChanges: "保存更改",
    saving: "正在保存…",
    temporaryPassword: "临时密码",
    resetCompleted: (name) => `已重置 ${name} 的密码。`,
    resetCompletedDetails: "该账户的现有会话已退出，账户所有者必须在登录后更改此密码。",
    resetPasswordSecurity: "此密码仅在本次重置结果中显示。请通过安全渠道分享给账户所有者。",
    shareSecurely: "请通过安全渠道将此临时密码分享给账户所有者。",
    copied: "已复制",
    copyPassword: "复制密码",
    done: "完成",
    generatePassword: (name) => `为 ${name} 生成临时密码？`,
    resetPasswordDetails: "当前密码将失效，现有会话将退出，账户所有者登录后必须设置新密码。",
    resetting: "正在重置…",
    roleUpdated: (name) => `已更新 ${name} 的角色。`,
    unableToChangeRole: "无法更改角色",
    unableToLoad: "无法加载 HQ 账户",
    approvedNotice: "已批准 HQ 账户并授予完整权限。",
    rejectedNotice: "已拒绝 HQ 注册申请。",
    actionFailed: "操作失败",
    accountStatusFailed: "无法更改账户状态",
    deactivatedNotice: (name) => `已停用 ${name}。`,
    reactivatedNotice: (name) => `已重新启用 ${name}。`,
    passwordResetFailed: "密码重置失败",
    copyPasswordFailed: "无法复制临时密码，请手动复制。",
    requestFailed: (status) => `请求失败（${status}）`,
  },
};
