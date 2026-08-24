import type { EmailMessage } from "../email-provider";

export type ApprovedAccountEmailInput = {
  to: string;
  displayName: string;
  storeName: string;
  role: "STAFF" | "STORE_MANAGER";
};

export const ACCOUNT_APPROVED_SUBJECT = "บัญชี OPPO LINE OA Monitor ของคุณได้รับการอนุมัติแล้ว";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function roleLabel(role: ApprovedAccountEmailInput["role"]) {
  return role === "STORE_MANAGER" ? "BM" : "PC";
}

export function accountApprovedEmail(input: ApprovedAccountEmailInput): EmailMessage {
  const displayName = input.displayName.trim();
  const storeName = input.storeName.trim();
  const role = roleLabel(input.role);
  const text = [
    `สวัสดี คุณ ${displayName}`,
    "",
    "บัญชีของคุณได้รับการอนุมัติให้เข้าใช้งาน",
    "OPPO LINE OA Monitor เรียบร้อยแล้ว",
    "",
    `สาขา: ${storeName}`,
    `สิทธิ์การใช้งาน: ${role}`,
    "",
    "คุณสามารถเปิดแอป OPPO LINE OA Monitor",
    "และเข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนไว้",
    "เพื่อเริ่มใช้งานได้ทันที",
    "",
    "หากไม่สามารถเข้าใช้งานได้",
    "กรุณาติดต่อผู้ดูแลระบบ",
    "",
    "OPPO Retail Operations",
  ].join("\n");
  const safeName = escapeHtml(displayName);
  const safeStore = escapeHtml(storeName);
  const safeRole = escapeHtml(role);
  const html = `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f4f7f5;color:#17231d;font-family:Arial,'Noto Sans Thai',sans-serif;line-height:1.6;">
    <div style="padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dce7df;border-radius:16px;padding:32px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.04em;color:#087f4e;">OPPO LINE OA Monitor</div>
        <h1 style="margin:20px 0 12px;font-size:24px;line-height:1.3;">บัญชีของคุณได้รับการอนุมัติแล้ว</h1>
        <p style="margin:0 0 20px;">สวัสดี คุณ ${safeName}</p>
        <p style="margin:0 0 20px;">บัญชีของคุณได้รับการอนุมัติให้เข้าใช้งาน OPPO LINE OA Monitor เรียบร้อยแล้ว</p>
        <div style="margin:20px 0;padding:16px;border-radius:12px;background:#f0f8f3;">
          <div><strong>สาขา:</strong> ${safeStore}</div>
          <div><strong>สิทธิ์การใช้งาน:</strong> ${safeRole}</div>
        </div>
        <p style="margin:0 0 20px;">คุณสามารถเปิดแอป OPPO LINE OA Monitor และเข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนไว้เพื่อเริ่มใช้งานได้ทันที</p>
        <p style="margin:0 0 24px;">หากไม่สามารถเข้าใช้งานได้ กรุณาติดต่อผู้ดูแลระบบ</p>
        <p style="margin:0;color:#5d6d63;font-size:13px;">OPPO Retail Operations</p>
      </div>
    </div>
  </body>
</html>`;
  return { to: input.to.trim(), subject: ACCOUNT_APPROVED_SUBJECT, text, html };
}
