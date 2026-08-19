import Link from "next/link";
import { PurchaseBroadcastComposer } from "../../purchase-broadcast-composer";

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function PurchaseBroadcastDraftPage({ params }: Props) {
  const { campaignId } = await params;
  return (
    <>
      <PurchaseBroadcastComposer campaignId={campaignId} />
      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href={`/mass-messages/drafts/${encodeURIComponent(campaignId)}/review`}
          className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-red-700"
        >
          Review &amp; Send
        </Link>
      </div>
    </>
  );
}
