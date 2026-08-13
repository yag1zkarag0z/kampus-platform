"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CursorPage<TItem> = {
  data: TItem[];
  page: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type CursorListFetcher<TItem> = (
  cursor?: string,
) => Promise<CursorPage<TItem>>;

function usableNextCursor(page: CursorPage<unknown>["page"]) {
  return page.hasMore &&
    typeof page.nextCursor === "string" &&
    page.nextCursor.length > 0
    ? page.nextCursor
    : null;
}

/**
 * Cursor'lı liste endpoint'lerini tüketen ortak hook. `fetchPage`
 * referansı değiştiğinde liste baştan yüklenir; bu yüzden çağıran taraf
 * onu `useCallback` ile sabitlemeli.
 */
export function useCursorList<TItem>(
  fetchPage: CursorListFetcher<TItem>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [items, setItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasFailed, setHasFailed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const itemsRef = useRef(items);
  const requestVersionRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const replaceItems = useCallback((nextItems: TItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!enabled) {
      queueMicrotask(() => {
        if (!isCancelled) {
          replaceItems([]);
          setNextCursor(null);
          setIsLoading(false);
        }
      });

      return () => {
        isCancelled = true;
      };
    }

    const requestVersion = ++requestVersionRef.current;
    isLoadingMoreRef.current = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsLoading(true);
        setHasFailed(false);
        setNextCursor(null);
        setIsLoadingMore(false);
      }
    });

    fetchPage()
      .then((result) => {
        if (isCancelled || requestVersion !== requestVersionRef.current) {
          return;
        }

        replaceItems(result.data);
        setNextCursor(usableNextCursor(result.page));
      })
      .catch(() => {
        if (isCancelled || requestVersion !== requestVersionRef.current) {
          return;
        }

        replaceItems([]);
        setNextCursor(null);
        setHasFailed(true);
      })
      .finally(() => {
        if (!isCancelled && requestVersion === requestVersionRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled, fetchPage, reloadToken, replaceItems]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMoreRef.current) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const result = await fetchPage(nextCursor);

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      replaceItems([...itemsRef.current, ...result.data]);
      setNextCursor(usableNextCursor(result.page));
      setHasFailed(false);
    } catch {
      if (requestVersion === requestVersionRef.current) {
        setHasFailed(true);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [fetchPage, nextCursor, replaceItems]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const setItemsDirectly = useCallback(
    (updater: (current: TItem[]) => TItem[]) => {
      replaceItems(updater(itemsRef.current));
    },
    [replaceItems],
  );

  return {
    items,
    isLoading,
    hasFailed,
    hasMore: nextCursor !== null,
    isLoadingMore,
    loadMore,
    reload,
    setItems: setItemsDirectly,
  };
}
