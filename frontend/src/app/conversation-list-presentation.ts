export type ConversationListSection = "dashboard" | "incoming" | "followUp" | "reminded";

type ConversationListLabels = {
  conversations: string;
  incoming: string;
  followUp: string;
  reminded: string;
  status: (value: string) => string;
};

export function getConversationListTitle(
  sidebarView: string,
  statusFilter: string,
  labels: ConversationListLabels,
) {
  if (sidebarView === "followUp") return labels.followUp;
  if (sidebarView === "reminded") return labels.reminded;
  if (statusFilter !== "all") return labels.status(statusFilter);
  if (sidebarView === "incoming") return labels.incoming;
  return labels.conversations;
}

export type ConversationListTag = {
  kind: "priority" | "status" | "product" | "topic";
  label: string;
};

type ConversationTagInput = {
  priority: "High" | "Normal";
  priorityLabel: string;
  statusLabel: string;
  product: string;
  topic: string;
};

export function getConversationListTags(input: ConversationTagInput) {
  const tags: ConversationListTag[] = [];
  if (input.priority === "High") {
    tags.push({ kind: "priority", label: input.priorityLabel });
  }
  if (input.statusLabel) {
    tags.push({ kind: "status", label: input.statusLabel });
  }
  if (input.product && input.product !== "—") {
    tags.push({ kind: "product", label: input.product });
  }
  for (const topic of input.topic.split(" · ").filter(Boolean)) {
    tags.push({ kind: "topic", label: topic });
  }

  return {
    visible: tags.slice(0, 3),
    hidden: tags.slice(3),
  };
}
