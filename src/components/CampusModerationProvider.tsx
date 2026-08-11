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
  const [remoteReports, setRemoteReports] = useState<ReportSummaryDto[]>(
    [],
  );
  const [remoteManagedUsers, setRemoteManagedUsers] = useState<
    ManagedUserDto[]
  >([]);
  const [remoteModerationHistory, setRemoteModerationHistory] = useState<
    ModerationHistoryEntryDto[]
  >([]);
  const [isModerationHydrated, setIsModerationHydrated] = useState(true);
  const [reportedTargetIds, setReportedTargetIds] = useState<Set<string>>(
    new Set(),
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

  const fetchModerationData = useCallback(async () => {
    const [reportsData, usersData, historyData] = await Promise.all([
      getModerationReports(),
      getManagedUsers(),
      getModerationHistory(),
    ]);

    return { reportsData, usersData, historyData };
  }, []);

  const applyModerationData = useCallback(
    (data: Awaited<ReturnType<typeof fetchModerationData>>) => {
      setRemoteReports(data.reportsData.data);
      setRemoteManagedUsers(data.usersData.data);
      setRemoteModerationHistory(data.historyData.data);
    },
    [],
  );

  const loadModerationData = useCallback(async () => {
    const data = await fetchModerationData();
    applyModerationData(data);
  }, [applyModerationData, fetchModerationData]);

  useEffect(() => {
    let isCancelled = false;
    const canModerate = sessionMode === "member" && accountRole !== "member";

    if (!canModerate) {
      queueMicrotask(() => {
        if (isCancelled) {
          return;
        }

        setRemoteReports([]);
        setRemoteManagedUsers([]);
        setRemoteModerationHistory([]);
        setIsModerationHydrated(true);
      });

      return () => {
        isCancelled = true;
      };
    }

    queueMicrotask(() => {
      if (!isCancelled) {
        setIsModerationHydrated(false);
      }
    });

    fetchModerationData()
      .then((data) => {
        if (!isCancelled) {
          applyModerationData(data);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setIsModerationHydrated(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    accountId,
    accountRole,
    applyModerationData,
    fetchModerationData,
    sessionMode,
  ]);

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

      await loadModerationData().catch(() => undefined);
      return true;
    },
    [accountRole, loadModerationData, sessionMode],
  );

  const setUserRole = useCallback(
    async (userId: string, role: "member" | "moderator" | "admin") => {
      if (sessionMode !== "member" || accountRole !== "admin") {
        return false;
      }

      try {
        await updateUserRole(userId, role);
      } catch {
        return false;
      }

      await loadModerationData().catch(() => undefined);
      return true;
    },
    [accountRole, loadModerationData, sessionMode],
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

      await loadModerationData().catch(() => undefined);
      return true;
    },
    [accountRole, loadModerationData, sessionMode],
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

      await loadModerationData().catch(() => undefined);
      return true;
    },
    [accountRole, loadModerationData, sessionMode],
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
    setRemoteReports([]);
    setRemoteManagedUsers([]);
    setRemoteModerationHistory([]);
    setReportedTargetIds(new Set());

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset still completes in memory.
    }
  }, []);

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
      remoteReports.filter((report) => report.status === "pending")
        .length,
    [remoteReports],
  );

  const value = useMemo<CampusModerationContextValue>(
    () => ({
      blockedUsers: effectiveBlockedUsers,
      blockedAuthorIds,
      reports: remoteReports,
      pendingReportCount,
      managedUsers: remoteManagedUsers,
      moderationHistory: remoteModerationHistory,
      isHydrated: isHydrated && isBlockedListHydrated,
      isModerationHydrated,
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
      pendingReportCount,
      remoteManagedUsers,
      remoteModerationHistory,
      remoteReports,
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
