export const FOCUS_STORE_GROUP_ID = "focus-seven-store-group";

export const FOCUS_STORE_CODES = [
  "28375",
  "25610",
  "27627",
  "25391",
  "24804",
  "27789",
  "3791",
] as const;

const FOCUS_STORE_CODE_SET = new Set<string>(FOCUS_STORE_CODES);
const FOCUS_STORE_NAME_TOKENS = [
  "robinson chonburi",
  "central world",
  "bangkapi",
  "central westgate",
  "ngamwongwan",
  "mkv suwannaphum",
  "central khonkaen",
] as const;

export type FocusStoreReference = {
  name: string;
  code?: string | null;
  storeMaster?: { externalStoreId?: string | null } | null;
};

function containsFocusCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return (value.match(/\d+/g) ?? []).some((part) => FOCUS_STORE_CODE_SET.has(part));
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isFocusStoreReference(store: FocusStoreReference): boolean {
  if (containsFocusCode(store.code) || containsFocusCode(store.storeMaster?.externalStoreId) || containsFocusCode(store.name)) {
    return true;
  }

  const normalizedName = normalizeName(store.name);
  return FOCUS_STORE_NAME_TOKENS.some((token) => normalizedName.includes(token));
}
