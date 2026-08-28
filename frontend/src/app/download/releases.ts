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
    version: "1.1.3",
    build: 23,
    releasedAt: "2026-08-28",
    releasedAtDisplay: "28 สิงหาคม 2026",
    size: "59.6 MB",
    fileName: "oppo-line-oa-chat-v1.1.3-production.apk",
    sha256: "61267e70cf27751f297d77d2c9f0600e0226ea4573a5da426e593f84334789b9",
    notes: [
      "เพิ่มสถานะลูกค้าออนไลน์สำหรับบทสนทนาที่มาจากช่องทางออนไลน์",
      "นำสีพื้นหลังแยกอ่านแล้ว/ยังไม่อ่านออกจากรายการข้อความ",
      "นำตัวเลขจำนวนข้อความที่ยังไม่อ่านออกจากการ์ดบทสนทนา",
      "ยังคงสถานะรอตอบ ตอบแล้ว และการแจ้ง BM ตามเดิม",
    ],
  },
  {
    version: "1.1.2",
    build: 22,
    releasedAt: "2026-08-27",
    releasedAtDisplay: "27 สิงหาคม 2026",
    size: "59.6 MB",
    fileName: "oppo-line-oa-chat-v1.1.2-production.apk",
    sha256: "151b0b074d3b6beb8171d62385c485e5fb4a0481c2cd9a530041e8937e441c50",
    notes: [
      "ปรับการตรวจสอบอัปเดตให้ทำงานเฉพาะเมื่อผู้ใช้กดตรวจสอบ",
      "แก้ปัญหาแอปค้างระหว่างเริ่มต้นใช้งาน",
      "เพิ่ม timeout และการกู้คืนเมื่อเครือข่ายหรือบริการภายนอกมีปัญหา",
      "ปรับปรุงความเสถียรของระบบอัปเดตและ session",
    ],
  },
  {
    version: "1.1.1",
    build: 21,
    releasedAt: "2026-08-27",
    releasedAtDisplay: "27 สิงหาคม 2026",
    size: "59.5 MB",
    fileName: "oppo-line-oa-chat-v1.1.1-production.apk",
    sha256: "c4942a9ca1bc9b15bff9bc7408e8b2d535726d7a4946e2d4218df17cb6dc69e5",
    notes: [
      "แก้ไขระบบอัปเดตแอปภายในแอป",
      "แก้ไขการแสดงเวอร์ชันของแอปให้ตรงกับเวอร์ชันที่ติดตั้ง",
      "ปรับปรุงความเสถียรของกระบวนการดาวน์โหลดและติดตั้งอัปเดต",
    ],
  },
  {
    version: "1.1.0",
    build: 20,
    releasedAt: "2026-08-27",
    releasedAtDisplay: "27 สิงหาคม 2026",
    size: "59.5 MB",
    fileName: "oppo-line-oa-chat-v1.1.0-production.apk",
    sha256: "9b4351e1a7b998ff63f2ac7acfd906d0e8324d432f41382ad773f627b77f2f98",
    notes: [
      "Stable milestone release v1.1",
      "รองรับวิดีโอจากลูกค้าใน LINE",
      "ปรับปรุงความเสถียรของการเข้าสู่ระบบและ session",
      "ปรับปรุงระบบอัปเดตแอปภายในแอป",
      "ปรับปรุง Push Notification",
      "แจ้งเตือนแสดงชื่อลูกค้า ร้าน และตัวอย่างข้อความ",
    ],
  },
  {
    version: "1.0.18",
    build: 19,
    releasedAt: "2026-08-26",
    releasedAtDisplay: "26 สิงหาคม 2026",
    size: "59.5 MB",
    fileName: "oppo-line-oa-chat-v1.0.18-production.apk",
    sha256: "8a238d1a41cffc94ee2704f51e37c76362cd086f52bf64719077ed2271516a78",
    notes: [
      "ปรับปรุงระบบอัปเดตแอป ดาวน์โหลด ตรวจสอบ SHA-256 และเปิดตัวติดตั้งได้จากในแอป",
      "ปรับปรุงความเสถียรของ Push Notification สำหรับข้อความลูกค้า",
      "รองรับการแจ้งเตือนสำหรับ BM / HQ / PC ตามสิทธิ์การเข้าถึง",
    ],
  },
  {
    version: "1.0.17",
    build: 18,
    releasedAt: "2026-08-26",
    releasedAtDisplay: "26 สิงหาคม 2026",
    size: "59.2 MB",
    fileName: "oppo-line-oa-chat-v1.0.17-production.apk",
    sha256: "4262aa1ab207f259aa33285c4f2b311e4b7d29d4bbfbb437a51aa4627456c629",
    notes: [
      "รองรับวิดีโอที่ลูกค้าส่งเข้ามาใน LINE",
      "ปรับปรุง session/login ลดปัญหาแอปเด้งให้เข้าสู่ระบบใหม่",
    ],
  },
  {
    version: "1.0.16",
    build: 17,
    releasedAt: "2026-08-26",
    releasedAtDisplay: "26 สิงหาคม 2026",
    size: "58.0 MB",
    fileName: "oppo-line-oa-chat-v1.0.16-production.apk",
    sha256: "5837e94111f7a7fb4398bdefff75e4639610ec9b4bea88a8004ffc906967924e",
    notes: [
      "นำป้าย Normal และ Urgent ออกจากการ์ดบทสนทนาบนมือถือเพื่อให้รายการอ่านง่ายขึ้น",
      "ยังคงการจัดลำดับความสำคัญของระบบและป้ายสถานะการตอบกลับไว้ตามเดิม",
    ],
  },
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
