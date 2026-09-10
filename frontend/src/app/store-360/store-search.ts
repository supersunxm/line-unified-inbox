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

export function getActiveOptionScrollTop(
  currentScrollTop: number,
  containerTop: number,
  containerBottom: number,
  optionTop: number,
  optionBottom: number,
) {
  if (optionTop < containerTop) return currentScrollTop - (containerTop - optionTop);
  if (optionBottom > containerBottom) return currentScrollTop + (optionBottom - containerBottom);
  return currentScrollTop;
}
