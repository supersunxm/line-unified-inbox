export type Language = "th" | "en" | "zh";

export type ChatsPaginationBounds = {
  safePage: number;
  totalPages: number;
  startRecord: number;
  endRecord: number;
};

export function calculatePaginationBounds(
  total: number,
  page: number,
  pageSize: number
): ChatsPaginationBounds {
  const safeTotal = Math.max(0, total);
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));

  if (safeTotal === 0) {
    return {
      safePage: 1,
      totalPages: 1,
      startRecord: 0,
      endRecord: 0,
    };
  }

  const startRecord = (safePage - 1) * safePageSize + 1;
  const endRecord = Math.min(safeTotal, safePage * safePageSize);

  return {
    safePage,
    totalPages,
    startRecord,
    endRecord,
  };
}

export function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const maxButtons = 5;
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  let start = Math.max(1, currentPage - 2);
  let end = start + maxButtons - 1;

  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxButtons + 1);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export type ChatsPaginationTranslations = {
  showingRangeText: (start: number, end: number, total: number) => string;
  previous: string;
  next: string;
  itemsPerPage: string;
  pageOfTotal: (page: number, totalPages: number) => string;
  newChatsAvailable: string;
  refreshPage1: string;
  failedToLoadConversations: string;
};

export const chatsPaginationTranslations: Record<Language, ChatsPaginationTranslations> = {
  th: {
    showingRangeText: (start, end, total) => `แสดง ${start}–${end} จากทั้งหมด ${total} แชท`,
    previous: "ก่อนหน้า",
    next: "ถัดไป",
    itemsPerPage: "รายการต่อหน้า",
    pageOfTotal: (page, totalPages) => `หน้า ${page} จาก ${totalPages}`,
    newChatsAvailable: "มีแชทใหม่",
    refreshPage1: "กลับไปหน้า 1",
    failedToLoadConversations: "โหลดบทสนทนาล้มเหลว",
  },
  en: {
    showingRangeText: (start, end, total) => `Showing ${start}–${end} of ${total} chats`,
    previous: "Previous",
    next: "Next",
    itemsPerPage: "Items per page",
    pageOfTotal: (page, totalPages) => `Page ${page} of ${totalPages}`,
    newChatsAvailable: "New chats available",
    refreshPage1: "Go to page 1",
    failedToLoadConversations: "Failed to load conversations",
  },
  zh: {
    showingRangeText: (start, end, total) => `显示第 ${start}–${end} 条，共 ${total} 个会话`,
    previous: "上一页",
    next: "下一页",
    itemsPerPage: "每页数量",
    pageOfTotal: (page, totalPages) => `第 ${page} 页，共 ${totalPages} 页`,
    newChatsAvailable: "有新会话",
    refreshPage1: "返回第 1 页",
    failedToLoadConversations: "加载会话失败",
  },
};

export function getChatsPaginationText(language: Language = "en"): ChatsPaginationTranslations {
  if (language === "th") return chatsPaginationTranslations.th;
  if (language === "zh") return chatsPaginationTranslations.zh;
  return chatsPaginationTranslations.en;
}
