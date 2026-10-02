import type { Metadata } from "next";
import { Review15Checker } from "./review-15-checker";

const title = "ตรวจสอบรีวิว 15 คำ | OPPO Brand Shop";
const description =
  "เช็กข้อความรีวิวให้ครบ 15 คำตามกฎ Review KPI ได้ทันที ใช้งานฟรี ไม่ต้องล็อกอิน";

export const metadata: Metadata = {
  title: {
    absolute: title,
  },
  description,
  openGraph: {
    title,
    description,
    url: "https://lineoppo.click/รีวิว15",
    siteName: "OPPO Brand Shop",
    locale: "th_TH",
    type: "website",
    images: [
      {
        url: "https://lineoppo.click/review15/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ตรวจสอบรีวิว 15 คำ | OPPO Brand Shop",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://lineoppo.click/review15/opengraph-image"],
  },
};

export default function Review15Page() {
  return <Review15Checker />;
}
