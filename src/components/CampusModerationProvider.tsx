"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCursorList } from "@/components/useCursorList";
import {
  blockMember,
  getMyBlockedUsers,
  getManagedUsers,
  getModerationHistory,
  getModerationReports,
  resolveModerationReport,
  submitReport,
  unblockMember,
  updateUserRole,
  updateUserStatus,
  type ManagedUserDto,
  type ModerationHistoryEntryDto,
  type ReportReasonDto,
  type ReportResolutionDto,
  type ReportSummaryDto,
} from "@/moderation/client";

const STORAGE_KEY = "kampus-moderation-v1";

export type CampusReportReason = ReportReasonDto;
export type CampusModerationResolution = ReportResolutionDto;
export type CampusModerationTargetType = "post" | "comment" | "message";

export type BlockedCampusUser = {
  authorId: string;
  author: string;
  avatarUrl?: string | null;
};

type StoredModerationState = {
  blockedUsers: BlockedCampusUser[];
};

type CampusModerationContextValue = {
  blockedUsers: BlockedCampusUser[];
  blockedAuthorIds: ReadonlySet<string>;
  reports: ReportSummaryDto[];
  pendingReportCount: number;
  managedUsers: ManagedUserDto[];
  moderationHistory: ModerationHistoryEntryDto[];
  isHydrated: boolean;
  isModerationHydrated: boolean;
  moderationLoadFailed: boolean;
  hasMoreReports: boolean;
  hasMoreManagedUsers: boolean;
  hasMoreModerationHistory: boolean;
  isLoadingMoreReports: boolean;
  isLoadingMoreManagedUsers: boolean;
  isLoadingMoreModerationHistory: boolean;
  loadMoreReports: () => Promise<void>;
  loadMoreManagedUsers: () => Promise<void>;
  loadMoreModerationHistory: () => Promise<void>;
  reloadModeration: () => void;
  hasReportedPost: (postId: string) => boolean;
  hasReportedComment: (commentId: string) => boolean;
  reportPost: (
    postId: string,
    reason: CampusReportReason,
    detail?: string,
  ) => Promise<boolean>;
  reportComment: (
    commentId: string,
    postId: string,
    reason: CampusReportReason,
    detail?: string,
  ) => Promise<boolean>;
  resolveReport: (
    reportId: string,
    resolution: CampusModerationResolution,
    note: string,
  ) => Promise<boolean>;
  setUserRole: (
    userId: string,
    role: "member" | "moderator" | "admin",
    note: string,
  ) => Promise<boolean>;
  suspendUser: (userId: string, note: string) => Promise<boolean>;
  restoreUser: (userId: string, note: string) => Promise<boolean>;
  blockUser: (authorId: string, author: string) => Promise<boolean>;
  unblockUser: (authorId: string) => Promise<boolean>;
  resetModeration: () => void;
};

const CampusModerationContext = createContext<
  CampusModerationContextValue | undefined
>(undefined);

function getInitialState(): StoredModerationState {
  return { blockedUsers: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBlockedUser(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.authorId !== "string" ||
    !value.authorId.trim() ||
    typeof value.author !== "string" ||
    !value.author.trim()
  ) {
    return null;
  }

  return {
    authorId: value.authorId.trim().slice(0, 100),
    author: value.author.trim().slice(0, 80),
  } satisfies BlockedCampusUser;
}

function normalizeStoredModerationState(
  value: unknown,
): StoredModerationState | null {
  if (!isRecord(value) || !Array.isArray(value.blockedUsers)) {
    return null;
  }

  const blockedUsers = value.blockedUsers
    .map(normalizeBlockedUser)
    .filter((user): user is BlockedCampusUser => user !== null);

  return { blockedUsers };
}

export function CampusModerationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { accountId, sessionMode, role: accountRole } = useCampusAccount();
  const [state, setState] =
    useState<StoredModerationState>(getInitialState);
  const [isHydrated, setIsHydrated] = useState(false);
  const [remoteBlockedUsers, setRemoteBlockedUsers] = useState<
    BlockedCampusUser[]
  >([]);
  const [isRemoteBlockedHydrated, setIsRemoteBlockedHydrated] =
    useState(false);
  const [reportedTargetIds, setReportedTargetIds] = useState<Set<string>>(
    new Set(),
  );
  const canModerate = sessionMode === "member" && accountRole !== "member";
  const fetchReportPage = useCallback(
    (cursor?: string) => getModerationReports(undefined, cursor),
    [],
  );
  const fetchManagedUserPage = useCallback(
    (cursor?: string) => getManagedUsers(cursor),
    [],
  );
  const fetchModerationHistoryPage = useCallback(
    (cursor?: string) => getModerationHistory(cursor),
    [],
  );
  const reportList = useCursorList(fetchReportPage, {
    enabled: canModerate,
  });
  const managedUserList = useCursorList(fetchManagedUserPage, {
    enabled: canModerate,
  });
  const moderationHistoryList = useCursorList(
    fetchModerationHistoryPage,
    { enabled: canModerate },
  );

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);

        if (storedValue) {
          const parsedValue: unknown = JSON.parse(storedValue);
          const normalizedState =
            normalizeStoredModerationState(parsedValue);

          if (normalizedState && !isCancelled) {
            setState(normalizedState);
          }
        }
      } catch {
        // Keep the initial moderation state when browser storage is unavailable.
      } finally {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The in-memory moderation state remains usable without persistence.
    }
  }, [isHydrated, state]);

  useEffect(() => {
    let isCancelled = false;

    if (sessionMode !== "member") {
      queueMicrotask(() => {
        if (isCancelled) {
          return;
        }

        setIsRemoteBlockedHydrated(false);
        setRemoteBlockedUsers([]);
      });

      return () => {
        isCancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsRemoteBlockedHydrated(false);
      }
    });

    getMyBlockedUsers()
      .then((rows) => {
        if (isCancelled) {
          return;
        }

        setRemoteBlockedUsers(
          rows.data.map((row) => ({
            authorId: row.id,
            author: `@${row.username}`,
            avatarUrl: row.avatarUrl,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setIsRemoteBlockedHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accountId, sessionMode]);

  const reloadModeration = useCallback(() => {
    reportList.reload();
    managedUserList.reload();
    moderationHistoryList.reload();
  }, [managedUserList, moderationHistoryList, reportList]);

  const hasReportedPost = useCallback(
    (postId: string) => reportedTargetIds.has(postId),
    [reportedTargetIds],
  );
  const hasReportedComment = useCallback(
    (commentId: string) => reportedTargetIds.has(commentId),
    [reportedTargetIds],
  );

  const reportPost = useCallback(
    async (
      postId: string,
      reason: CampusReportReason,
      detail = "",
    ) => {
      if (sessionMode !== "member") {
        return false;
      }

      try {
        const result = await submitReport({
          targetType: "post",
          targetId: postId,
          reason,
          detail,
        });

        if (result.created) {
          setReportedTargetIds((current) => new Set(current).add(postId));
        }

        return result.created;
      } catch {
        return false;
      }
    },
    [sessionMode],
  );

  const reportComment = useCallback(
    async (
      commentId: string,
      _postId: string,
      reason: CampusReportReason,
      detail = "",
    ) => {
      if (sessionMode !== "member") {
        return false;
      }

      try {
        const result = await submitReport({
          targetType: "comment",
          targetId: commentId,
          reason,
          detail,
        });

        if (result.created) {
          setReportedTargetIds((current) =>
            new Set(current).add(commentId),
          );
        }

        return result.created;
      } catch {
        return false;
      }
    },
    [sessionMode],
  );

  const resolveReport = useCallback(
    async (
      reportId: string,
      resolution: CampusModerationResolution,
      note: string,
    ) => {
      if (sessionMode !== "member" || accountRole === "member") {
        return false;
      }

      try {
        await resolveModerationReport(reportId, { resolution, note });
      } catch {
        return false;
      }

      reloadModeration();
      return true;
    },
    [accountRole, reloadModeration, sessionMode],
  );

  const setUserRole = useCallback(
    async (
      userId: string,
      role: "member" | "moderator" | "admin",
      note: string,
    ) => {
      if (sessionMode !== "member" || accountRole !== "admin") {
        return false;
      }

      try {
        await updateUserRole(userId, role, note);
      } catch {
        return false;
      }

      reloadModeration();
      return true;
    },
    [accountRole, reloadModeration, sessionMode],
  );

  const suspendUser = useCallback(
    async (userId: string, note: string) => {
      if (sessionMode !== "member" || accountRole === "member") {
        return false;
      }

      try {
        await updateUserStatus(userId, { status: "suspended", note });
      } catch {
        return false;
      }

      reloadModeration();
      return true;
    },
    [accountRole, reloadModeration, sessionMode],
  );

  const restoreUser = useCallback(
    async (userId: string, note: string) => {
      if (sessionMode !== "member" || accountRole === "member") {
        return false;
      }

      try {
        await updateUserStatus(userId, { status: "active", note });
      } catch {
        return false;
      }

      reloadModeration();
      return true;
    },
    [accountRole, reloadModeration, sessionMode],
  );

  const blockUser = useCallback(
    async (authorId: string, author: string) => {
      if (
        sessionMode !== "member" ||
        !authorId.trim() ||
        !author.trim()
      ) {
        return false;
      }

      if (
        remoteBlockedUsers.some((user) => user.authorId === authorId)
      ) {
        return false;
      }

      const username = author.trim().replace(/^@/, "");

      try {
        await blockMember(username);
      } catch {
        return false;
      }

      setRemoteBlockedUsers((current) => {
        if (current.some((user) => user.authorId === authorId)) {
          return current;
        }

        return [...current, { authorId, author }];
      });

      return true;
    },
    [remoteBlockedUsers, sessionMode],
  );

  const unblockUser = useCallback(
    async (authorId: string) => {
      if (sessionMode !== "member") {
        return false;
      }

      const target = remoteBlockedUsers.find(
        (user) => user.authorId === authorId,
      );

      if (!target) {
        return false;
      }

      const username = target.author.trim().replace(/^@/, "");

      try {
        await unblockMember(username);
      } catch {
        return false;
      }

      setRemoteBlockedUsers((current) =>
        current.filter((user) => user.authorId !== authorId),
      );

      return true;
    },
    [remoteBlockedUsers, sessionMode],
  );

  const resetModeration = useCallback(() => {
    setState(getInitialState());
    setRemoteBlockedUsers([]);
    reportList.setItems(() => []);
    managedUserList.setItems(() => []);
    moderationHistoryList.setItems(() => []);
    setReportedTargetIds(new Set());

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset still completes in memory.
    }
  }, [managedUserList, moderationHistoryList, reportList]);

  const effectiveBlockedUsers =
    sessionMode === "member" ? remoteBlockedUsers : state.blockedUsers;
  const blockedAuthorIds = useMemo(
    () => new Set(effectiveBlockedUsers.map((user) => user.authorId)),
    [effectiveBlockedUsers],
  );
  const isBlockedListHydrated =
    sessionMode === "member" ? isRemoteBlockedHydrated : true;
  const pendingReportCount = useMemo(
    () =>
      reportList.items.filter((report) => report.status === "pending")
        .length,
    [reportList.items],
  );
  const isModerationHydrated =
    !reportList.isLoading &&
    !managedUserList.isLoading &&
    !moderationHistoryList.isLoading;
  const moderationLoadFailed =
    reportList.hasFailed ||
    managedUserList.hasFailed ||
    moderationHistoryList.hasFailed;

  const value = useMemo<CampusModerationContextValue>(
    () => ({
      blockedUsers: effectiveBlockedUsers,
      blockedAuthorIds,
      reports: reportList.items,
      pendingReportCount,
      managedUsers: managedUserList.items,
      moderationHistory: moderationHistoryList.items,
      isHydrated: isHydrated && isBlockedListHydrated,
      isModerationHydrated,
      moderationLoadFailed,
      hasMoreReports: reportList.hasMore,
      hasMoreManagedUsers: managedUserList.hasMore,
      hasMoreModerationHistory: moderationHistoryList.hasMore,
      isLoadingMoreReports: reportList.isLoadingMore,
      isLoadingMoreManagedUsers: managedUserList.isLoadingMore,
      isLoadingMoreModerationHistory: moderationHistoryList.isLoadingMore,
      loadMoreReports: reportList.loadMore,
      loadMoreManagedUsers: managedUserList.loadMore,
      loadMoreModerationHistory: moderationHistoryList.loadMore,
      reloadModeration,
      hasReportedPost,
      hasReportedComment,
      reportPost,
      reportComment,
      resolveReport,
      setUserRole,
      suspendUser,
      restoreUser,
      blockUser,
      unblockUser,
      resetModeration,
    }),
    [
      blockUser,
      blockedAuthorIds,
      effectiveBlockedUsers,
      hasReportedComment,
      hasReportedPost,
      isBlockedListHydrated,
      isHydrated,
      isModerationHydrated,
      managedUserList.hasMore,
      managedUserList.isLoadingMore,
      managedUserList.items,
      managedUserList.loadMore,
      moderationHistoryList.hasMore,
      moderationHistoryList.isLoadingMore,
      moderationHistoryList.items,
      moderationHistoryList.loadMore,
      moderationLoadFailed,
      pendingReportCount,
      reloadModeration,
      reportList.hasMore,
      reportList.isLoadingMore,
      reportList.items,
      reportList.loadMore,
      reportComment,
      reportPost,
      resetModeration,
      resolveReport,
      restoreUser,
      setUserRole,
      suspendUser,
      unblockUser,
    ],
  );

  return (
    <CampusModerationContext.Provider value={value}>
      {children}
    </CampusModerationContext.Provider>
  );
}

export function useCampusModeration() {
  const context = useContext(CampusModerationContext);

  if (!context) {
    throw new Error(
      "useCampusModeration must be used within CampusModerationProvider.",
    );
  }

  return context;
}
