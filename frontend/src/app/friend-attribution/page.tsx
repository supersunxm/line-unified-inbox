import { Metadata } from "next";
import { FriendAttributionView } from "./friend-attribution-view";

export const metadata: Metadata = {
  title: "LINE Friend Attribution | OPPO Unified Inbox",
  description: "Verify LINE OA friend attribution for pilot stores",
};

export default function FriendAttributionPage() {
  return <FriendAttributionView />;
}
