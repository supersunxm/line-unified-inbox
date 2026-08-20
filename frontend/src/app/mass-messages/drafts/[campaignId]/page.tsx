import { PurchaseBroadcastDraftResponsive } from "./draft-responsive";

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function PurchaseBroadcastDraftPage({ params }: Props) {
  const { campaignId } = await params;
  return <PurchaseBroadcastDraftResponsive campaignId={campaignId} />;
}
