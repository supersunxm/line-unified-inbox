import { MobileChatsController } from "@/components/chats/mobile-chats-controller";
import { ApplicationWorkspace } from "../page";

export default function ChatsPage() {
  return (
    <>
      <ApplicationWorkspace initialSection="chats" />
      <MobileChatsController />
    </>
  );
}
