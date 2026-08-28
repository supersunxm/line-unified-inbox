export type PrimarySection = "home" | "dashboard" | "chats" | "main-oa" | "stores" | "admin-registrations" | "purchase-analytics" | "follower-insights" | "friend-source-links" | "mass-messages" | "coupons" | "rich-menus" | "auto-responses" | "greeting-messages";

export function primaryNavigationState(section: PrimarySection) {
  return {
    homeActive: section === "home",
    dashboardActive: section === "dashboard",
    chatsActive: section === "chats",
    storesActive: section === "stores",
    followerInsightsActive: section === "follower-insights",
    friendSourceLinksActive: section === "friend-source-links",
    showStoreManagementAction: section === "stores",
  };
}
