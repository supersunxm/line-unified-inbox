import type { Metadata } from "next";
import { fetchPublicStoreByIdentifier } from "@/lib/public-stores-api";
import { PublicStoreProfile } from "./public-store-profile";

interface Props {
  params: Promise<{ identifier: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { identifier } = await props.params;
  try {
    const store = await fetchPublicStoreByIdentifier(identifier);
    if (!store) {
      return {
        title: "OPPO Brand Shop Store Directory",
        description: "ค้นหาข้อมูลสาขาและช่องทางติดต่อ OPPO Brand Shop",
      };
    }
    const locationPart = store.province ? ` สาขา${store.province}` : "";
    return {
      title: `${store.name} | OPPO Brand Shop`,
      description: `ข้อมูลการติดต่อ แผนที่ LINE OA และ TikTok ทางการของ ${store.name}${locationPart}`,
    };
  } catch {
    return {
      title: "OPPO Brand Shop",
      description: "ค้นหา OPPO Brand Shop และช่องทางติดต่อของสาขา",
    };
  }
}

export default async function StoreProfilePage(props: Props) {
  const { identifier } = await props.params;
  let initialStore = null;
  try {
    initialStore = await fetchPublicStoreByIdentifier(identifier);
  } catch {
    // Handled gracefully by client component
  }

  return <PublicStoreProfile identifier={identifier} initialStore={initialStore} />;
}
