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
  seedCampusManagedUsers,
  type CampusAdminRole,
  type CampusManagedUser,
} from "@/data/campusAdmin";
import {
  blockMember,
  getMyBlockedUsers,
  unblockMember,
} from "@/moderation/client";

const STORAGE_KEY = "kampus-moderation-v1";
const MAX_REPORT_DETAIL_LENGTH = 300;
const MAX_HISTORY_NOTE_LENGTH = 240;

export type CampusReportReason =
  | "spam"
  | "harassment"
  | "personal-information"
  | "misleading"
  | "other";

export type CampusModerationTargetType = "post" | "comment";
export type CampusReportStatus = "pending" | "resolved";
export type CampusModerationResolution =
  | "dismissed"
  | "content-removed"
  | "user-suspended";
export type CampusModerationHistoryAction =
  | CampusModerationResolution
  | "user-restored"
  | "role-changed";

export type BlockedCampusUser = {
  authorId: string;
  author: string;
  avatarUrl?: string | null;
};

export type CampusContentReport = {
  id: string;
  targetType: CampusModerationTargetType;
  targetId: string;
  postId: string;
  reason: CampusReportReason;
  detail: string;
  reportedAt: number;
  status: CampusReportStatus;
  resolvedAt?: number;
  resolution?: CampusModerationResolution;
  resolutionNote?: string;
};

export type CampusModerationHistoryEntry = {
  id: string;
  action: CampusModerationHistoryAction;
  createdAt: number;
  moderator: string;
  reportId?: string;
  targetType?: CampusModerationTargetType;
  targetId?: string;
  postId?: string;
  authorId?: string;
  author?: string;
  note?: string;
};

export type ResolveCampusReportOptions = {
  note?: string;
  authorId?: string;
  author?: string;
};

type StoredModerationState = {
  blockedUsers: BlockedCampusUser[];
  reports: CampusContentReport[];
  managedUsers: CampusManagedUser[];
  moderationHistory: CampusModerationHistoryEntry[];
};

type CampusModerationContextValue = {
  blockedUsers: BlockedCampusUser[];
  blockedAuthorIds: ReadonlySet<string>;
  reports: CampusContentReport[];
  pendingReportCount: number;
  managedUsers: CampusManagedUser[];
  moderationHistory: CampusModerationHistoryEntry[];
  isHydrated: boolean;
  hasReportedPost: (postId: string) => boolean;
  hasReportedComment: (commentId: string) => boolean;
  reportPost: (
    postId: string,
    reason: CampusReportReason,
    detail?: string,
  ) => boolean;
  reportComment: (
    commentId: string,
    postId: string,
    reason: CampusReportReason,
    detail?: string,
  ) => boolean;
  resolveReport: (
    reportId: string,
    resolution: CampusModerationResolution,
    options?: ResolveCampusReportOptions,
  ) => boolean;
  setUserRole: (authorId: string, role: CampusAdminRole) => boolean;
  suspendUser: (authorId: string) => boolean;
  restoreUser: (authorId: string) => boolean;
  blockUser: (authorId: string, author: string) => Promise<boolean>;
  unblockUser: (authorId: string) => Promise<boolean>;
  resetModeration: () => void;
};

const CampusModerationContext = createContext<
  CampusModerationContextValue | undefined
>(undefined);

function getInitialState(): StoredModerationState {
  return {
    blockedUsers: [],
    reports: [],
    managedUsers: seedCampusManagedUsers.map((user) => ({ ...user })),
    moderationHistory: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportReason(value: unknown): value is CampusReportReason {
  return (
    value === "spam" ||
    value === "harassment" ||
    value === "personal-information" ||
    value === "misleading" ||
    value === "other"
  );
}

function isTargetType(
  value: unknown,
): value is CampusModerationTargetType {
  return value === "post" || value === "comment";
}

function isResolution(
  value: unknown,
): value is CampusModerationResolution {
  return (
    value === "dismissed" ||
    value === "content-removed" ||
    value === "user-suspended"
  );
}

function isHistoryAction(
  value: unknown,
): value is CampusModerationHistoryAction {
  return (
    isResolution(value) ||
    value === "user-restored" ||
    value === "role-changed"
  );
}

function isAdminRole(value: unknown): value is CampusAdminRole {
  return value === "admin" || value === "moderator" || value === "member";
}

function isAccountStatus(
  value: unknown,
): value is CampusManagedUser["status"] {
  return value === "active" || value === "suspended";
}

function readOptionalString(
  value: unknown,
  maximumLength: number,
) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : undefined;
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

function normalizeReport(
  value: unknown,
  index: number,
): CampusContentReport | null {
  if (
    !isRecord(value) ||
    typeof value.postId !== "string" ||
    !value.postId.trim() ||
    !isReportReason(value.reason) ||
    typeof value.reportedAt !== "number" ||
    !Number.isFinite(value.reportedAt)
  ) {
    return null;
  }

  const targetType = isTargetType(value.targetType)
    ? value.targetType
    : "post";
  const legacyTargetId =
    targetType === "post" ? value.postId : undefined;
  const targetId =
    typeof value.targetId === "string" && value.targetId.trim()
      ? value.targetId.trim()
      : legacyTargetId;

  if (!targetId) {
    return null;
  }

  const resolution = isResolution(value.resolution)
    ? value.resolution
    : undefined;
  const status: CampusReportStatus =
    value.status === "resolved" && resolution ? "resolved" : "pending";
  const reportedAt = value.reportedAt;
  const storedId =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `legacy-${targetType}-${targetId}-${reportedAt}-${index}`;

  return {
    id: storedId.slice(0, 180),
    targetType,
    targetId: targetId.slice(0, 140),
    postId: value.postId.trim().slice(0, 140),
    reason: value.reason,
    detail:
      typeof value.detail === "string"
        ? value.detail.trim().slice(0, MAX_REPORT_DETAIL_LENGTH)
        : "",
    reportedAt,
    status,
    resolvedAt:
      status === "resolved" &&
      typeof value.resolvedAt === "number" &&
      Number.isFinite(value.resolvedAt)
        ? value.resolvedAt
        : undefined,
    resolution: status === "resolved" ? resolution : undefined,
    resolutionNote:
      status === "resolved"
        ? readOptionalString(value.resolutionNote, MAX_HISTORY_NOTE_LENGTH)
        : undefined,
  };
}

function normalizeManagedUser(value: unknown): CampusManagedUser | null {
  if (
    !isRecord(value) ||
    typeof value.authorId !== "string" ||
    !value.authorId.trim() ||
    typeof value.author !== "string" ||
    !value.author.trim() ||
    typeof value.displayName !== "string" ||
    !value.displayName.trim() ||
    typeof value.department !== "string" ||
    typeof value.joinedLabel !== "string" ||
    !isAdminRole(value.role) ||
    !isAccountStatus(value.status)
  ) {
    return null;
  }

  return {
    authorId: value.authorId.trim().slice(0, 100),
    author: value.author.trim().slice(0, 80),
    displayName: value.displayName.trim().slice(0, 80),
    department: value.department.trim().slice(0, 100),
    joinedLabel: value.joinedLabel.trim().slice(0, 60),
    role: value.role,
    status: value.status,
    suspendedAt:
      typeof value.suspendedAt === "number" &&
      Number.isFinite(value.suspendedAt)
        ? value.suspendedAt
        : undefined,
  };
}

function normalizeHistoryEntry(
  value: unknown,
): CampusModerationHistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id.trim() ||
    !isHistoryAction(value.action) ||
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    typeof value.moderator !== "string" ||
    !value.moderator.trim()
  ) {
    return null;
  }

  return {
    id: value.id.trim().slice(0, 180),
    action: value.action,
    createdAt: value.createdAt,
    moderator: value.moderator.trim().slice(0, 80),
    reportId: readOptionalString(value.reportId, 180),
    targetType: isTargetType(value.targetType)
      ? value.targetType
      : undefined,
    targetId: readOptionalString(value.targetId, 140),
    postId: readOptionalString(value.postId, 140),
    authorId: readOptionalString(value.authorId, 100),
    author: readOptionalString(value.author, 80),
    note: readOptionalString(value.note, MAX_HISTORY_NOTE_LENGTH),
  };
}

function normalizeStoredModerationState(
  value: unknown,
): StoredModerationState | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.blockedUsers) ||
    !Array.isArray(value.reports)
  ) {
    return null;
  }

  const blockedUsers = value.blockedUsers
    .map(normalizeBlockedUser)
    .filter((user): user is BlockedCampusUser => user !== null);
  const reports = value.reports
    .map(normalizeReport)
    .filter((report): report is CampusContentReport => report !== null);
  const storedUsers = Array.isArray(value.managedUsers)
    ? value.managedUsers
        .map(normalizeManagedUser)
        .filter((user): user is CampusManagedUser => user !== null)
    : [];
  const storedUsersById = new Map(
    storedUsers.map((user) => [user.authorId, user]),
  );
  const seededIds = new Set(
    seedCampusManagedUsers.map((user) => user.authorId),
  );
  const managedUsers = [
    ...seedCampusManagedUsers.map((user) => ({
      ...user,
      ...storedUsersById.get(user.authorId),
    })),
    ...storedUsers.filter((user) => !seededIds.has(user.authorId)),
  ];
  const moderationHistory = Array.isArray(value.moderationHistory)
    ? value.moderationHistory
        .map(normalizeHistoryEntry)
        .filter(
          (entry): entry is CampusModerationHistoryEntry =>
            entry !== null,
        )
    : [];

  return {
    blockedUsers,
    reports,
    managedUsers,
    moderationHistory,
  };
}

function createId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function createManagedUser(
  authorId: string,
  author: string,
): CampusManagedUser {
  return {
    authorId,
    author,
    displayName: author.replace(/^@/, "") || "Kullanıcı",
    department: "Bölüm bilgisi yok",
    joinedLabel: "Yerel hesap",
    role: "member",
    status: "active",
  };
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
          rows.map((row) => ({
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

  const reportContent = useCallback(
    (
      targetType: CampusModerationTargetType,
      targetId: string,
      postId: string,
      reason: CampusReportReason,
      detail = "",
    ) => {
      if (
        sessionMode !== "member" ||
        !targetId.trim() ||
        !postId.trim()
      ) {
        return false;
      }

      if (
        state.reports.some(
          (report) =>
            report.targetType === targetType &&
            report.targetId === targetId,
        )
      ) {
        return false;
      }

      const report: CampusContentReport = {
        id: createId("report"),
        targetType,
        targetId: targetId.trim(),
        postId: postId.trim(),
        reason,
        detail: detail.trim().slice(0, MAX_REPORT_DETAIL_LENGTH),
        reportedAt: Date.now(),
        status: "pending",
      };

      setState((currentState) => {
        if (
          currentState.reports.some(
            (currentReport) =>
              currentReport.targetType === targetType &&
              currentReport.targetId === targetId,
          )
        ) {
          return currentState;
        }

        return {
          ...currentState,
          reports: [...currentState.reports, report],
        };
      });

      return true;
    },
    [sessionMode, state.reports],
  );

  const reportPost = useCallback(
    (
      postId: string,
      reason: CampusReportReason,
      detail = "",
    ) => reportContent("post", postId, postId, reason, detail),
    [reportContent],
  );

  const reportComment = useCallback(
    (
      commentId: string,
      postId: string,
      reason: CampusReportReason,
      detail = "",
    ) => reportContent("comment", commentId, postId, reason, detail),
    [reportContent],
  );

  const resolveReport = useCallback(
    (
      reportId: string,
      resolution: CampusModerationResolution,
      options: ResolveCampusReportOptions = {},
    ) => {
      if (
        sessionMode !== "member" ||
        accountRole === "member"
      ) {
        return false;
      }

      const report = state.reports.find(
        (item) => item.id === reportId && item.status === "pending",
      );

      if (!report) {
        return false;
      }

      const resolvedAt = Date.now();
      const note = options.note
        ?.trim()
        .slice(0, MAX_HISTORY_NOTE_LENGTH);

      setState((currentState) => {
        const currentReport = currentState.reports.find(
          (item) => item.id === reportId && item.status === "pending",
        );

        if (!currentReport) {
          return currentState;
        }

        const managedUsers =
          resolution === "user-suspended" && options.authorId
            ? currentState.managedUsers.some(
                (user) => user.authorId === options.authorId,
              )
              ? currentState.managedUsers.map((user) =>
                  user.authorId === options.authorId
                    ? {
                        ...user,
                        status: "suspended" as const,
                        suspendedAt: resolvedAt,
                      }
                    : user,
                )
              : [
                  ...currentState.managedUsers,
                  {
                    ...createManagedUser(
                      options.authorId,
                      options.author ?? "@kullanici",
                    ),
                    status: "suspended" as const,
                    suspendedAt: resolvedAt,
                  },
                ]
            : currentState.managedUsers;
        const historyItem: CampusModerationHistoryEntry = {
          id: createId("moderation"),
          action: resolution,
          createdAt: resolvedAt,
          moderator: "@yagizkaragoz",
          reportId,
          targetType: currentReport.targetType,
          targetId: currentReport.targetId,
          postId: currentReport.postId,
          authorId: options.authorId,
          author: options.author,
          note,
        };

        return {
          ...currentState,
          reports: currentState.reports.map((item) =>
            item.id === reportId
              ? {
                  ...item,
                  status: "resolved" as const,
                  resolvedAt,
                  resolution,
                  resolutionNote: note,
                }
              : item,
          ),
          managedUsers,
          moderationHistory: [
            historyItem,
            ...currentState.moderationHistory,
          ].slice(0, 200),
        };
      });

      return true;
    },
    [accountRole, sessionMode, state.reports],
  );

  const setUserRole = useCallback(
    (authorId: string, role: CampusAdminRole) => {
      if (
        sessionMode !== "member" ||
        accountRole !== "admin" ||
        authorId === "local-current-account"
      ) {
        return false;
      }

      const currentUser = state.managedUsers.find(
        (user) => user.authorId === authorId,
      );

      if (!currentUser || currentUser.role === role) {
        return false;
      }

      const createdAt = Date.now();
      const historyItem: CampusModerationHistoryEntry = {
        id: createId("moderation"),
        action: "role-changed",
        createdAt,
        moderator: "@yagizkaragoz",
        authorId,
        author: currentUser.author,
        note: `${currentUser.role} → ${role}`,
      };

      setState((currentState) => ({
        ...currentState,
        managedUsers: currentState.managedUsers.map((user) =>
          user.authorId === authorId ? { ...user, role } : user,
        ),
        moderationHistory: [
          historyItem,
          ...currentState.moderationHistory,
        ].slice(0, 200),
      }));

      return true;
    },
    [accountRole, sessionMode, state.managedUsers],
  );

  const suspendUser = useCallback(
    (authorId: string) => {
      if (
        sessionMode !== "member" ||
        accountRole === "member" ||
        authorId === "local-current-account"
      ) {
        return false;
      }

      const currentUser = state.managedUsers.find(
        (user) =>
          user.authorId === authorId && user.status === "active",
      );

      if (!currentUser) {
        return false;
      }

      const createdAt = Date.now();
      const historyItem: CampusModerationHistoryEntry = {
        id: createId("moderation"),
        action: "user-suspended",
        createdAt,
        moderator: "@yagizkaragoz",
        authorId,
        author: currentUser.author,
        note: "Kullanıcı yönetiminden askıya alındı.",
      };

      setState((currentState) => ({
        ...currentState,
        managedUsers: currentState.managedUsers.map((user) =>
          user.authorId === authorId
            ? {
                ...user,
                status: "suspended" as const,
                suspendedAt: createdAt,
              }
            : user,
        ),
        moderationHistory: [
          historyItem,
          ...currentState.moderationHistory,
        ].slice(0, 200),
      }));

      return true;
    },
    [accountRole, sessionMode, state.managedUsers],
  );

  const restoreUser = useCallback(
    (authorId: string) => {
      if (
        sessionMode !== "member" ||
        accountRole === "member"
      ) {
        return false;
      }

      const currentUser = state.managedUsers.find(
        (user) =>
          user.authorId === authorId && user.status === "suspended",
      );

      if (!currentUser) {
        return false;
      }

      const createdAt = Date.now();
      const historyItem: CampusModerationHistoryEntry = {
        id: createId("moderation"),
        action: "user-restored",
        createdAt,
        moderator: "@yagizkaragoz",
        authorId,
        author: currentUser.author,
      };

      setState((currentState) => ({
        ...currentState,
        managedUsers: currentState.managedUsers.map((user) =>
          user.authorId === authorId
            ? {
                ...user,
                status: "active" as const,
                suspendedAt: undefined,
              }
            : user,
        ),
        moderationHistory: [
          historyItem,
          ...currentState.moderationHistory,
        ].slice(0, 200),
      }));

      return true;
    },
    [accountRole, sessionMode, state.managedUsers],
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

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset still completes in memory.
    }
  }, []);

  const reportedPostIds = useMemo(
    () =>
      new Set(
        state.reports
          .filter((report) => report.targetType === "post")
          .map((report) => report.targetId),
      ),
    [state.reports],
  );
  const reportedCommentIds = useMemo(
    () =>
      new Set(
        state.reports
          .filter((report) => report.targetType === "comment")
          .map((report) => report.targetId),
      ),
    [state.reports],
  );
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
      state.reports.filter((report) => report.status === "pending")
        .length,
    [state.reports],
  );
  const hasReportedPost = useCallback(
    (postId: string) => reportedPostIds.has(postId),
    [reportedPostIds],
  );
  const hasReportedComment = useCallback(
    (commentId: string) => reportedCommentIds.has(commentId),
    [reportedCommentIds],
  );

  const value = useMemo<CampusModerationContextValue>(
    () => ({
      blockedUsers: effectiveBlockedUsers,
      blockedAuthorIds,
      reports: state.reports,
      pendingReportCount,
      managedUsers: state.managedUsers,
      moderationHistory: state.moderationHistory,
      isHydrated: isHydrated && isBlockedListHydrated,
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
      pendingReportCount,
      reportComment,
      reportPost,
      resetModeration,
      resolveReport,
      restoreUser,
      setUserRole,
      suspendUser,
      state.managedUsers,
      state.moderationHistory,
      state.reports,
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
