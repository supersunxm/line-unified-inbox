import { PurchaseBroadcastSafeSend } from "../../../purchase-broadcast-safe-send";

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function PurchaseBroadcastReviewPage({ params }: Props) {
  const { campaignId } = await params;
  return <PurchaseBroadcastSafeSend campaignId={campaignId} />;
}
