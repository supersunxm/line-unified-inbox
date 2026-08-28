export const PILOT_STORE_EXTERNAL_ID = "28375";
export const PILOT_MATCHER_VERSION = 1;

// These are the two reviewed pilot responses. Keeping them in one backend
// constant lets LIVE mode fail closed if an admin rule's text drifts from the
// approved copy; no generated or model-authored factual response is allowed.
export const PILOT_APPROVED_RESPONSE_TEMPLATES = {
  STORE_LOCATION: `📌Google Map สาขาของร้านเรานะครับ

https://maps.app.goo.gl/FzD4bVeFAx5Dsk3D8

👉หน้าร้านอยู่ชั้น 2  ฝั่งธนาคาร กรุงศรี ติดบูทรองเท้า Adidas  จะขายแค่ OPPO แบรนด์เดียวเท่านั้น`,
  FINANCE_INFO: `⭐ข้อมูลในการสมัครสินเชื่อ ⭐

-บัตรประชาชนตัวจริง 1 ใบครับ
-อายุ 20 ปีขึ้นไป
-ใช้เวลาสมัคร 5 นาทีรู้ผล
-วางดาวน์รับเครื่องกลับบ้านได้เลย

❌เช็คเครดิตเบื้องต้น เงื่อนไขจะขึ้นอยู่กับสินเชื่ออีกครั้งหนึ่งครับ
❌ชำระแค่เงินดาวน์อย่างเดียวไม่ต้องชำระอย่างอื่นเพิ่ม
❌ไม่ต้องใช้คนค้ำ`,
} as const;

export type AutoResponsePilotMode = "OFF" | "SHADOW" | "LIVE";

export function getAutoResponsePilotMode(
  environment: NodeJS.ProcessEnv = process.env,
): AutoResponsePilotMode {
  const configured = environment.AUTO_REPLY_PILOT_MODE?.trim().toUpperCase();
  if (configured === "SHADOW" || configured === "LIVE") return configured;
  return "OFF";
}
