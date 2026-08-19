import { PurchaseBroadcastComposer } from "../../purchase-broadcast-composer";

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function PurchaseBroadcastDraftPage({ params }: Props) {
  const { campaignId } = await params;
  return <PurchaseBroadcastComposer campaignId={campaignId} />;
}
