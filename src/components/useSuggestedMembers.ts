"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCampusFollow } from "@/components/CampusFollowProvider";
import {
  toEntryFromDto,
  toEntryFromMock,
  type SuggestionEntry,
} from "@/components/followSuggestionEntry";
import { campusFollowMembers } from "@/data/campusFollows";
import { getSuggestedFollows } from "@/social/client";

export type CampusSessionMode = "member" | "guest" | "signed-out";

/** Misafir gerçek üye grafiğini görmez; tohum veriden okur. */
export function useGuestSuggestedMembers(limit: number) {
  const { isHydrated, followingAuthorIds } = useCampusFollow();

  const suggestions = useMemo(
    () =>
      campusFollowMembers
        .filter((member) => !followingAuthorIds.has(member.authorId))
        .slice(0, limit)
        .map(toEntryFromMock),
    [followingAuthorIds, limit],
  );

  return { isHydrated, suggestions };
}

export function useRealSuggestedMembers(
  limit: number,
  sessionMode: CampusSessionMode,
) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (sessionMode !== "member") {
      return;
    }

    let isCancelled = false;
    const isRefresh = refreshCount > 0;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      // Yenilemede iskelete dönülmüyor: liste yerinde durup yalnızca ikon
      // dönüyor, aksi hâlde blok her tıklamada boşalıp doluyordu.
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsHydrated(false);
      }
    });

    getSuggestedFollows(limit)
      .then((rows) => {
        if (!isCancelled) {
          setSuggestions(rows.slice(0, limit).map(toEntryFromDto));
        }
      })
      .catch(() => {
        if (!isCancelled && !isRefresh) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHydrated(true);
          setIsRefreshing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [limit, refreshCount, sessionMode]);

  const reload = useCallback(() => {
    setRefreshCount((current) => current + 1);
  }, []);

  return { isHydrated, isRefreshing, suggestions, reload };
}
