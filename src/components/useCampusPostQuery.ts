"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AuthClientError } from "@/auth/client";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  appendUniqueCampusPosts,
  getUsablePageCursor,
  toCampusPost,
} from "@/content/adapter";
import {
  listContentPosts,
  type ContentPostSort,
  type CoreContentPostCategory,
} from "@/content/client";
import type { CampusPost } from "@/data/campusPosts";

export type CampusPostQueryInput = {
  q?: string;
  category?: CoreContentPostCategory;
  author?: string;
  sort?: ContentPostSort;
  limit?: number;
  /** Girdi hazır değilken (ör. kullanıcı adı çözülmemişken) istek atma. */
  enabled?: boolean;
};

/**
 * Sunucu tarafı gönderi sorgusunu cursor'la yükler. Keşfet ve profil aynı
 * davranışa ihtiyaç duyduğu için tek yerde toplandı; sayfalar artık genel
 * akışa yüklenmiş gönderileri filtrelemiyor.
 */
export function useCampusPostQuery({
  q,
  category,
  author,
  sort = "newest",
  limit = 20,
  enabled = true,
}: CampusPostQueryInput) {
  const { retrySession } = useCampusAccount();
  const [posts, setPostsState] = useState<CampusPost[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasFailed, setHasFailed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const postsRef = useRef(posts);
  const requestVersionRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  const replacePosts = useCallback((nextPosts: CampusPost[]) => {
    postsRef.current = nextPosts;
    setPostsState(nextPosts);
  }, []);
  const handleExpiredSession = useCallback(
    (error: unknown) => {
      if (error instanceof AuthClientError && error.status === 401) {
        void retrySession();
      }
    },
    [retrySession],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!enabled) {
      queueMicrotask(() => {
        if (!isCancelled) {
          replacePosts([]);
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

    listContentPosts({ q, category, author, sort, limit })
      .then((response) => {
        if (isCancelled || requestVersion !== requestVersionRef.current) {
          return;
        }

        replacePosts(response.data.map(toCampusPost));
        setNextCursor(getUsablePageCursor(response.page));
      })
      .catch((error: unknown) => {
        if (isCancelled || requestVersion !== requestVersionRef.current) {
          return;
        }

        replacePosts([]);
        setNextCursor(null);
        setHasFailed(true);
        handleExpiredSession(error);
      })
      .finally(() => {
        if (!isCancelled && requestVersion === requestVersionRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    author,
    category,
    enabled,
    handleExpiredSession,
    limit,
    q,
    reloadToken,
    replacePosts,
    sort,
  ]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMoreRef.current) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await listContentPosts({
        q,
        category,
        author,
        sort,
        limit,
        cursor: nextCursor,
      });

      if (requestVersion !== requestVersionRef.current) {
        return;
      }

      replacePosts(
        appendUniqueCampusPosts(
          postsRef.current,
          response.data.map(toCampusPost),
        ),
      );
      setNextCursor(getUsablePageCursor(response.page));
    } catch (error) {
      handleExpiredSession(error);
      throw error;
    } finally {
      if (requestVersion === requestVersionRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    author,
    category,
    handleExpiredSession,
    limit,
    nextCursor,
    q,
    replacePosts,
    sort,
  ]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    posts,
    isLoading,
    hasFailed,
    hasMore: nextCursor !== null,
    isLoadingMore,
    loadMore,
    reload,
  };
}

/** Her tuş vuruşunda istek atmamak için arama metnini geciktirir. */
export function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs);

    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
}
