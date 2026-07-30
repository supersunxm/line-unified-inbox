export type PrimarySection = "dashboard" | "chats" | "stores" | "classification-insights" | "follower-insights" | "friend-source-links";

export function primaryNavigationState(section: PrimarySection) {
  return {
    dashboardActive: section === "dashboard",
    chatsActive: section === "chats",
    storesActive: section === "stores",
    classificationInsightsActive: section === "classification-insights",
    followerInsightsActive: section === "follower-insights",
    friendSourceLinksActive: section === "friend-source-links",
    showStoreManagementAction: section === "stores",
  };
}
