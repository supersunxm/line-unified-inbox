export interface StoreSearchItem {
  id: string;
  name: string;
  code?: string;
  accountName?: string;
  storeMaster?: {
    externalStoreId?: string | null;
    accountName?: string | null;
    storeName?: string | null;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// Filter stores by search keyword (case-insensitive) across store name, account name, and store code.
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
    const code = store.code ?? store.storeMaster?.externalStoreId ?? store.id ?? "";
    const accountName = store.accountName ?? store.storeMaster?.accountName ?? "";
    const storeMasterName = store.storeMaster?.storeName ?? "";

    return (
      rawName.toLowerCase().includes(trimmed) ||
      displayName.toLowerCase().includes(trimmed) ||
      code.toLowerCase().includes(trimmed) ||
      accountName.toLowerCase().includes(trimmed) ||
      storeMasterName.toLowerCase().includes(trimmed)
    );
  });
}
