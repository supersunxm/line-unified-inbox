export type AndroidRelease = {
  version: string;
  build: number;
  releasedAt: string;
  releasedAtDisplay: string;
  size: string;
  fileName: string;
  sha256: string;
  notes: string[];
};

export const androidReleases: AndroidRelease[] = [
  {
    version: "1.0.15",
    build: 16,
    releasedAt: "2026-08-26",
    releasedAtDisplay: "26 สิงหาคม 2026",
    size: "58.0 MB",
    fileName: "oppo-line-oa-chat-v1.0.15-production.apk",
    sha256: "f09d53b2e25bf9467f0994e9934c4b1da666ae4637075bfad09f52d9e2f29ead",
    notes: [
      "HQ สามารถดูบทสนทนาจากทุกร้านที่ได้รับอนุญาตได้ใน Inbox เดียว",
      "แสดงชื่อร้านอย่างชัดเจนในแต่ละบทสนทนาเพื่อยืนยันบริบทก่อนดำเนินการ",
      "เพิ่มรายละเอียดบทสนทนา HQ สำหรับตอบกลับ เปลี่ยนสถานะ และแจ้ง BM",
      "เพิ่มจำนวนข้อความที่ยังไม่อ่านและตัวกรอง All, Not Replied, Notified BM, Replied และ Unread",
      "เพิ่ม pull-to-refresh และการ reconcile เพื่อให้ preview เวลา สถานะ และ unread เป็นข้อมูลล่าสุด",
    ],
  },
  {
    version: "1.0.14",
    build: 15,
    releasedAt: "2026-08-25",
    releasedAtDisplay: "25 สิงหาคม 2026",
    size: "57.6 MB",
    fileName: "oppo-line-oa-chat-v1.0.14-production.apk",
    sha256: "10d9716e8f75ec989a2c4979a6fef3b33b0173c862d94537b07a927fce49d1ba",
    notes: [
      "ผู้ใช้สำนักงานใหญ่ (HQ) ที่ไม่มี Store membership สามารถเข้าสู่แอปหลังยืนยันตัวตนได้",
      "ปรับสิทธิ์ App shell ให้รองรับ HQ, Store และ Main OA workspace grants อย่างถูกต้อง",
      "รวมหน้าจอเข้าสู่ระบบและลงทะเบียนเวอร์ชันล่าสุด",
    ],
  },
  {
    version: "1.0.13",
    build: 14,
    releasedAt: "2026-08-19",
    releasedAtDisplay: "19 สิงหาคม 2026",
    size: "57.7 MB",
    fileName: "oppo-line-oa-chat-v1.0.13-production.apk",
    sha256: "05734b9dd50ba649e4db858c28a6248a5ed2b5dec7900687a15700ca253c097f",
    notes: [
      "แก้ปัญหาบางเครื่องขึ้นข้อความว่าแพ็กเกจขัดแย้งและไม่สามารถติดตั้งแอปได้",
      "เปลี่ยนมาใช้ Android package click.lineoppo.chat สำหรับแอปนี้โดยเฉพาะ",
      "ใช้ลายเซ็น production แบบถาวรเพื่อรองรับการอัปเดตเวอร์ชันถัดไป",
    ],
  },
  {
    version: "1.0.12",
    build: 13,
    releasedAt: "2026-08-19",
    releasedAtDisplay: "19 สิงหาคม 2026",
    size: "56.9 MB",
    fileName: "oppo-line-oa-chat-v1.0.12-production.apk",
    sha256: "",
    notes: ["ปรับปรุงหน้าจอและความสอดคล้องของข้อมูลการขายในแอป"],
  },
  {
    version: "1.0.11",
    build: 12,
    releasedAt: "2026-08-19",
    releasedAtDisplay: "19 สิงหาคม 2026",
    size: "56.8 MB",
    fileName: "oppo-line-oa-chat-v1.0.11-production.apk",
    sha256: "",
    notes: ["ปรับปรุงความสอดคล้องของสถานะข้อมูลการขายและ metadata ของ Android release"],
  },
];

export const latestAndroidRelease = androidReleases[0];
