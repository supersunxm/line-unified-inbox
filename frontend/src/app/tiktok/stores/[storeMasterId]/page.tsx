import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { fetchTikTokAccountsListFromBackend } from "../../tiktok-api-client";
import { TikTokPublicStoreDetail } from "../../tiktok-public-store-detail";
import { fetchTikTokPublicHistory, fetchTikTokPublicStores } from "../../tiktok-public-api";

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

  // A store that has completed official TikTok OAuth should use the persisted
  // official-account dashboard. Keep public-profile collector analytics as a
  // separate fallback data source when there is no linked OAuth account.
  const accounts = await fetchTikTokAccountsListFromBackend({ sessionToken });
  const linkedAccount = accounts.find(
    (account) => account.storeMasterId === storeMasterId && account.id,
  );
  if (linkedAccount?.id) {
    redirect(`/tiktok/dashboard/${encodeURIComponent(linkedAccount.id)}`);
  }

  try {
    const [stores, history] = await Promise.all([
      fetchTikTokPublicStores({ sessionToken }),
      fetchTikTokPublicHistory(storeMasterId, 30, { sessionToken }),
    ]);
    const store = stores.find((candidate) => candidate.storeMasterId === storeMasterId) ?? null;
    if (!store) notFound();
    return <TikTokPublicStoreDetail store={store} history={history} />;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") redirect("/login");
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  }
}
