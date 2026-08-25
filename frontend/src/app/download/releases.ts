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
