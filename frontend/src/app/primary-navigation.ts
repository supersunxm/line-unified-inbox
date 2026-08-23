export type PrimarySection = "home" | "dashboard" | "chats" | "stores" | "admin-registrations" | "purchase-analytics" | "classification-insights" | "follower-insights" | "friend-source-links" | "mass-messages" | "coupons";

export function primaryNavigationState(section: PrimarySection) {
  return {
    homeActive: section === "home",
    dashboardActive: section === "dashboard",
    chatsActive: section === "chats",
    storesActive: section === "stores",
    classificationInsightsActive: section === "classification-insights",
    followerInsightsActive: section === "follower-insights",
    friendSourceLinksActive: section === "friend-source-links",
    showStoreManagementAction: section === "stores",
  };
}
