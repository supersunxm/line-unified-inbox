export type PrimarySection = "dashboard" | "chats" | "stores" | "follower-insights";

export function primaryNavigationState(section: PrimarySection) {
  return {
    dashboardActive: section === "dashboard",
    chatsActive: section === "chats",
    storesActive: section === "stores",
    followerInsightsActive: section === "follower-insights",
    showStoreManagementAction: section === "stores",
  };
}
