// Page through /conversations?replyState=NOT_REPLIED&sort=latest-desc with bounded
// concurrency, stopping once a page reaches chats older than the cutoff. Pure: the fetch
// is injected, so node --test can drive it with a mock.

export type PageResult<T> = { items: T[]; total: number };

export type PagingOutcome<T> = {
  items: T[];
  /** Highest page number whose items were kept. */
  pagesUsed: number;
  /** Requests started, including in-flight pages discarded after the stop. */
  requestsStarted: number;
  /** True when maxPages was reached before the cutoff or the end. */
  truncated: boolean;
};

/**
 * Fetches pages 1, 2, … with at most `concurrency` requests in flight. A page ends the
 * paging when it is short (the end), when `pastCutoff` says its last item is already too
 * old (newest-first order, so every later page is older), or at `maxPages`. Pages after
 * the stopping page are never started once the stop is known; ones already in flight are
 * discarded. Items keep page order.
 */
export async function fetchPagesUntil<T>(input: {
  fetchPage: (page: number) => Promise<PageResult<T>>;
  pageSize: number;
  concurrency: number;
  maxPages: number;
  pastCutoff: (lastItem: T) => boolean;
}): Promise<PagingOutcome<T>> {
  const { fetchPage, pageSize, concurrency, maxPages, pastCutoff } = input;
  const pages = new Map<number, T[]>();
  let next = 1;
  let stopAt = maxPages;
  let reachedEnd = false;
  let requestsStarted = 0;

  async function worker() {
    while (next <= stopAt) {
      const page = next;
      next += 1;
      requestsStarted += 1;
      const result = await fetchPage(page);
      if (page > stopAt) continue; // a page before it already ended the paging
      pages.set(page, result.items);
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      const last = result.items[result.items.length - 1];
      if (result.items.length < pageSize || page >= lastPage || (last !== undefined && pastCutoff(last))) {
        stopAt = Math.min(stopAt, page);
        reachedEnd = true;
      } else if (lastPage < stopAt) {
        stopAt = lastPage;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  const items: T[] = [];
  for (let page = 1; page <= stopAt; page += 1) items.push(...(pages.get(page) ?? []));
  return { items, pagesUsed: stopAt, requestsStarted, truncated: !reachedEnd && stopAt === maxPages };
}
