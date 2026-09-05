"use client";

import { AuthorizedSection } from "../../authorized-workspace";
import { LineChatHealthView } from "./line-chat-health-view";

export default function LineChatHealthPage() {
  return <AuthorizedSection section="line-chat-health"><LineChatHealthView /></AuthorizedSection>;
}

