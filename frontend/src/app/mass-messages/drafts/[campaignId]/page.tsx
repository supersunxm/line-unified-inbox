import { PurchaseBroadcastDraftResponsive } from "./draft-responsive";
import { LegacyI18nBoundary } from "../../../legacy-i18n-boundary";
import { mobileMassMessagesPhrases, mobileMassMessagesTemplates } from "../../../mobile-route-i18n";

interface Props {
  params: Promise<{ campaignId: string }>;
}

export default async function PurchaseBroadcastDraftPage({ params }: Props) {
  const { campaignId } = await params;
  return (
    <LegacyI18nBoundary phrases={mobileMassMessagesPhrases} templates={mobileMassMessagesTemplates} showControl={false}>
      <PurchaseBroadcastDraftResponsive campaignId={campaignId} />
    </LegacyI18nBoundary>
  );
}
