import type { Metadata } from "next";
import { StoreLocatorApp } from "./store-locator-app";

export const metadata: Metadata = {
  title: {
    absolute: "ค้นหาสาขา OPPO | Store Locator",
  },
  description: "ค้นหาสาขา OPPO ตามภูมิภาค จังหวัด และชื่อสาขา พร้อมแชทกับสาขาผ่าน LINE",
};

export default function StoreLocatorPage() {
  return <StoreLocatorApp />;
}
