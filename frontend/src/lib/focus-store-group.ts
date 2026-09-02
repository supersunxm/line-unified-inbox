export const FOCUS_STORE_GROUP_ID = "focus-seven-store-group";
export const FOCUS_STORE_GROUP_ROUTE_PARAM = "focusGroup";
export const FOCUS_STORE_GROUP_ROUTE_VALUE = "priority-seven";
export const FOCUS_STORE_GROUP_SIZE = 7;

export type FocusStoreGroupLanguage = "th" | "en" | "zh";

const COPY: Record<FocusStoreGroupLanguage, { label: string; subtitle: string }> = {
  th: {
    label: "กลุ่มโฟกัส 7 ร้าน",
    subtitle: "รวมแชท 7 ร้านที่ต้องโฟกัสเป็นพิเศษ",
  },
  en: {
    label: "Focus group · 7 stores",
    subtitle: "Combined chats from 7 priority stores",
  },
  zh: {
    label: "重点 7 家门店",
    subtitle: "汇总 7 家重点门店的聊天",
  },
};

export function getFocusStoreGroupCopy(language: FocusStoreGroupLanguage) {
  return COPY[language];
}
