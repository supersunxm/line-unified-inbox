export type Review15Example = {
  id: string;
  label: string;
  text: string;
};

/**
 * Sample reviews for the public Review15 checker.
 *
 * The set intentionally mixes:
 * - under-15 and over-15 examples,
 * - Thai / English / mixed-script text,
 * - spaced and no-space Thai,
 * - product names and audited compound words.
 *
 * This makes the sample button useful for both normal users and rule auditing.
 */
export const REVIEW15_EXAMPLES: readonly Review15Example[] = [
  {
    id: "classic-pass",
    label: "รีวิวทั่วไป",
    text: "พนักงาน บริการ ดี มาก แนะนำ OPPO Reno 5G ใช้งาน ง่าย กล้อง สวย ราคา คุ้ม ประทับใจ",
  },
  {
    id: "short-fail",
    label: "รีวิวสั้น",
    text: "บริการดี พนักงานน่ารัก ให้คำแนะนำดี ราคาโอเค ประทับใจมาก",
  },
  {
    id: "promo",
    label: "โปรโมชั่นและของแถม",
    text: "โปรโมชั่นดีมาก ของแถมเยอะ ราคาคุ้ม พนักงานให้คำแนะนำละเอียด บริการรวดเร็ว เครื่องสวย ใช้งานง่าย ประทับใจมาก",
  },
  {
    id: "mixed-model",
    label: "ไทยและชื่อรุ่น",
    text: "วันนี้มาซื้อOPPOReno14Pro5Gโปรโมชั่นดีมากพนักงานให้คำแนะนำละเอียดใช้งานง่ายกล้องสวยแบตอึดชาร์จเร็วของแถมเยอะ",
  },
  {
    id: "after-sales",
    label: "บริการหลังการขาย",
    text: "บริการหลังการขายดีมาก พนักงานดูแลลูกค้าเป็นอย่างดี อธิบายขั้นตอนชัดเจน รอไม่นาน แก้ปัญหาเร็ว และกลับมาใช้บริการอีกแน่นอน",
  },
  {
    id: "finance",
    label: "ผ่อนชำระ",
    text: "พนักงานแนะนำโปรโมชั่นผ่อนชำระเข้าใจง่าย ใช้บัตรประชาชนสะดวก ขั้นตอนไม่ยุ่งยาก ได้เครื่องเร็ว ของแถมครบ และบริการดีมาก",
  },
  {
    id: "camera-battery",
    label: "กล้องและแบตเตอรี่",
    text: "สมาร์ทโฟนเครื่องนี้กล้องสวย ถ่ายรูปชัด แบตอึด ชาร์จเร็ว หน้าจอลื่น ใช้งานง่าย น้ำหนักเบา พนักงานแนะนำดีมาก",
  },
  {
    id: "english",
    label: "English review",
    text: "Very nice and polite employees, they explain the products clearly and help me choose the right phone. Great service and I will come back again.",
  },
  {
    id: "mixed-language",
    label: "ไทยผสมอังกฤษ",
    text: "บริการดีมาก staff ให้คำแนะนำละเอียด OPPO Reno14 Pro 5G ใช้งานง่าย camera สวย battery อึด ราคาโอเค และของแถมเยอะ",
  },
  {
    id: "dense-thai",
    label: "ภาษาไทยติดกัน",
    text: "พนักงานให้คำแนะนำดีมากของแถมเยอะโปรโมชั่นคุ้มใช้งานง่ายกล้องสวยแบตอึดชาร์จเร็วบริการดีประทับใจมาก",
  },
  {
    id: "store-experience",
    label: "ประสบการณ์หน้าร้าน",
    text: "ร้านสะอาด เดินทางสะดวก พนักงานต้อนรับดี พูดจาสุภาพ ให้ข้อมูลครบถ้วน มีสินค้าให้เลือกเยอะ ทดลองเครื่องได้ และบริการรวดเร็ว",
  },
  {
    id: "exact-english-15",
    label: "ตัวอย่าง 15 คำ",
    text: "staff give clear advice and good service with useful promotions for customers buying new phones today",
  },
] as const;

export const REVIEW15_EXAMPLE_TEXT = REVIEW15_EXAMPLES[0].text;

export function pickRandomReview15Example(
  currentText = "",
  random: () => number = Math.random,
): Review15Example {
  const alternatives = REVIEW15_EXAMPLES.filter(
    (example) => example.text !== currentText,
  );
  const pool = alternatives.length > 0 ? alternatives : REVIEW15_EXAMPLES;
  const randomValue = random();
  const safeRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999999999)
    : 0;
  const index = Math.floor(safeRandom * pool.length);

  return pool[index];
}
