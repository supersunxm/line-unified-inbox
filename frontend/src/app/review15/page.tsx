import type { Metadata } from "next";
import { Review15Checker } from "./review-15-checker";

export const metadata: Metadata = {
  title: {
    absolute: "ตรวจสอบรีวิว 15 คำ | OPPO Brand Shop",
  },
  description: "เครื่องมือสาธารณะสำหรับตรวจจำนวนคำในข้อความรีวิวตามกฎ Review KPI",
};

export default function Review15Page() {
  return <Review15Checker />;
}
