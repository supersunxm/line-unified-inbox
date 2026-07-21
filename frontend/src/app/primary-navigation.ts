export type PrimarySection = "dashboard" | "chats" | "stores";

export function primaryNavigationState(section: PrimarySection) {
  return {
    dashboardActive: section === "dashboard",
    chatsActive: section === "chats",
    storesActive: section === "stores",
    showStoreManagementAction: section === "stores",
  };
}
