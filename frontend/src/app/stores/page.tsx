import type { Metadata } from "next";
import { PublicStoresDirectory } from "./public-stores-directory";

export const metadata: Metadata = {
  title: {
    absolute: "ค้นหา OPPO Brand Shop | Store Directory",
  },
  description: "ค้นหา OPPO Brand Shop และช่องทางติดต่อของสาขา",
};

export default function StoresDirectoryPage() {
  return <PublicStoresDirectory />;
}
