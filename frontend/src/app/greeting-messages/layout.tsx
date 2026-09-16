import type { ReactNode } from "react";
import { GreetingModeNav } from "./greeting-mode-nav";

export default function GreetingMessagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GreetingModeNav />
      {children}
    </>
  );
}
