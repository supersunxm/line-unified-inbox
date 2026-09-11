export const STORE_360_BOOTSTRAP_TIMEOUT_MS = 15_000;

export function resolveAuthorizedStoreId<T extends { id: string }>(requestedStoreId: string, stores: readonly T[]): string {
  if (requestedStoreId && stores.some(({ id }) => id === requestedStoreId)) return requestedStoreId;
  return stores[0]?.id ?? "";
}

export function withStore360Timeout<T>(promise: Promise<T>, timeoutMs = STORE_360_BOOTSTRAP_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Store 360 took too long to load authorized stores. Please try again.")), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (reason) => { clearTimeout(timer); reject(reason); },
    );
  });
}
