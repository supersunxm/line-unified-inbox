import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { TikTokPublicStoreDetail } from "../../tiktok-public-store-detail";
import { fetchTikTokPublicHistory, fetchTikTokPublicStore } from "../../tiktok-public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TikTok Store Analytics | OPPO Retail Operations",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ storeMasterId: string }> };

export default async function TikTokPublicStorePage({ params }: Props) {
  const { storeMasterId } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("oppo_session")?.value?.trim();
  if (!sessionToken) redirect("/login");

  try {
    const [store, history] = await Promise.all([
      fetchTikTokPublicStore(storeMasterId, { sessionToken }),
      fetchTikTokPublicHistory(storeMasterId, 30, { sessionToken }),
    ]);
    if (!store) notFound();
    return <TikTokPublicStoreDetail store={store} history={history} />;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/login");
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  }
}
