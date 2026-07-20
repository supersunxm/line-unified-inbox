import type { CreateLineOaInput, StoreMasterSuggestion } from "@/types/api";

type DebouncedStoreMasterSearchOptions = {
  query: string;
  delay?: number;
  search: (query: string) => Promise<StoreMasterSuggestion[]>;
  onLoading: () => void;
  onSuccess: (query: string, results: StoreMasterSuggestion[]) => void;
  onError: (error: unknown) => void;
};

export function startDebouncedStoreMasterSearch({
  query,
  delay = 300,
  search,
  onLoading,
  onSuccess,
  onError,
}: DebouncedStoreMasterSearchOptions): () => void {
  let active = true;
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return () => { active = false; };

  const timer = setTimeout(() => {
    if (!active) return;
    onLoading();
    void search(normalizedQuery)
      .then((results) => {
        if (active) onSuccess(normalizedQuery, results);
      })
      .catch((error: unknown) => {
        if (active) onError(error);
      });
  }, delay);

  return () => {
    active = false;
    clearTimeout(timer);
  };
}

export function applyStoreMasterSelection(
  form: CreateLineOaInput,
  master: StoreMasterSuggestion,
): CreateLineOaInput {
  return {
    ...form,
    storeMasterId: master.id,
    storeId: master.existingStore?.id,
    name: master.accountName,
    basicId: master.lineId ?? "",
    newStore: undefined,
  };
}

export function clearStoreMasterSelection(form: CreateLineOaInput): CreateLineOaInput {
  return { ...form, storeMasterId: undefined, storeId: undefined };
}

export function shouldShowNoMasterMatch(options: {
  query: string;
  completedQuery: string | null;
  loading: boolean;
  hasSelection: boolean;
  resultCount: number;
  hasError: boolean;
}): boolean {
  const normalizedQuery = options.query.trim();
  return normalizedQuery.length > 0
    && options.completedQuery === normalizedQuery
    && !options.loading
    && !options.hasSelection
    && options.resultCount === 0
    && !options.hasError;
}

export function synchronizedStoreMasterData(master: StoreMasterSuggestion) {
  return {
    storeId: master.externalStoreId ?? "-",
    storeName: master.storeName || "-",
    accountName: master.accountName || "-",
    lineId: master.lineId ?? "-",
    province: master.province ?? "-",
    region: master.region ?? "-",
    lineOaLink: master.lineOaLink,
    lineManagerUrl: master.lineManagerUrl,
  };
}
