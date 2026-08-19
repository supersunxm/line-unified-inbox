import { ApplicationWorkspace } from "../page";
import { PurchaseBroadcastDraftBanner } from "./purchase-broadcast-draft-banner";

export default function MassMessagesPage() {
  return (
    <>
      <ApplicationWorkspace initialSection="mass-messages" />
      <PurchaseBroadcastDraftBanner />
    </>
  );
}
