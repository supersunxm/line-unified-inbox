import type { ApiStore } from "@/types/api";

export function storeSearchIdentifier(store: ApiStore) {
  return store.storeId || store.code || store.id;
}

export function filterStoreSearchOptions(stores: readonly ApiStore[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...stores];

  return stores.filter((store) =>
    [store.name, store.storeId, store.code, store.id].some((value) =>
      value?.toLocaleLowerCase().includes(normalizedQuery),
    ),
  );
}
