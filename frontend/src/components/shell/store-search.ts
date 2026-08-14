export interface StoreSearchItem {
  id: string;
  storeId?: string | null;
  name: string;
  code?: string | null;
  accountName?: string | null;
  externalStoreId?: string | null;
  masterStoreId?: string | null;
  storeMaster?: {
    externalStoreId?: string | null;
    accountName?: string | null;
    storeName?: string | null;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Filter stores by search keyword (case-insensitive) across store name, Store ID, account name, and store code.
export function filterStoresBySearch<T extends StoreSearchItem>(
  stores: T[],
  keyword: string,
  getStoreDisplayName: (name: string) => string = (name) => name,
): T[] {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return stores;

  return stores.filter((store) => {
    const rawName = store.name ?? "";
    const displayName = getStoreDisplayName(rawName);
    const code = store.code ?? "";
    const storeId = store.storeId ?? store.masterStoreId ?? store.externalStoreId ?? store.storeMaster?.externalStoreId ?? "";
    const accountName = store.accountName ?? store.storeMaster?.accountName ?? "";
    const storeMasterName = store.storeMaster?.storeName ?? "";

    return (
      rawName.toLowerCase().includes(trimmed) ||
      displayName.toLowerCase().includes(trimmed) ||
      (Boolean(storeId) && String(storeId).toLowerCase().includes(trimmed)) ||
      (Boolean(code) && String(code).toLowerCase().includes(trimmed)) ||
      (Boolean(accountName) && String(accountName).toLowerCase().includes(trimmed)) ||
      (Boolean(storeMasterName) && String(storeMasterName).toLowerCase().includes(trimmed))
    );
  });
}
