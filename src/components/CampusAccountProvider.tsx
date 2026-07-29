"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  AuthClientError,
  getCurrentSession,
  logoutCurrentSession,
  updateCurrentProfile,
  updateCurrentSettings,
  type UpdateCampusProfileInput,
} from "@/auth/client";
import type {
  AuthProfile,
  AuthSettings,
  SessionState,
} from "@/auth/types";
import type { CampusAdminRole } from "@/data/campusAdmin";

const LEGACY_ACCOUNT_DRAFT_KEY = "kampus-account-draft-v2";
const AVATAR_DRAFT_KEY_PREFIX = "kampus-avatar-draft-v1:";

export type CampusProfile = AuthProfile;
export type CampusAccountSettings = AuthSettings;
export type CampusSessionMode = "member" | "guest" | "signed-out";

type CampusAccountContextValue = {
  accountId: string | null;
  profile: CampusProfile;
  settings: CampusAccountSettings;
  role: CampusAdminRole;
  isHydrated: boolean;
  isSignedIn: boolean;
  isGuest: boolean;
  isSessionLoading: boolean;
  sessionError: string | null;
  sessionExpired: boolean;
  sessionMode: CampusSessionMode;
  retrySession: () => Promise<void>;
  updateProfile: (updates: UpdateCampusProfileInput) => Promise<void>;
  updateSettings: (
    updates: Partial<CampusAccountSettings>,
  ) => Promise<void>;
  updateAvatar: (avatarDataUrl: string) => boolean;
  removeAvatar: () => boolean;
  resetAccount: (targetAccountId?: string) => boolean;
  signOut: () => Promise<void>;
};

const defaultProfile: CampusProfile = {
  username: "kampuslu",
  displayName: "KAMPÜS Kullanıcısı",
  department: "",
  year: "",
  bio: "",
  joinedLabel: "",
};

const guestProfile: CampusProfile = {
  username: "isimsiz",
  displayName: "İsimsiz Kullanıcı",
  department: "",
  year: "",
  bio: "KAMPÜS’ü misafir olarak görüntülüyorsun.",
  joinedLabel: "Misafir hesap",
};

const defaultSettings: CampusAccountSettings = {
  showDepartment: false,
  notifyReplies: true,
  notifyLikes: true,
  notifyAnnouncements: true,
  emailNotifications: true,
};

const signedOutSession = {
  mode: "signed-out",
  expiresAt: null,
  user: null,
} satisfies SessionState;

const CampusAccountContext = createContext<
  CampusAccountContextValue | undefined
>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidAvatarDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 1_000_000 &&
    /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i.test(
      value,
    )
  );
}

function getAvatarDraftKey(userId: string) {
  return `${AVATAR_DRAFT_KEY_PREFIX}${userId}`;
}

function getSessionErrorMessage(error: unknown) {
  return error instanceof AuthClientError
    ? error.message
    : "Oturumun kontrol edilemedi. Bağlantını kontrol edip yeniden dene.";
}

function readAvatarDraft(userId: string) {
  try {
    const storedAvatar = window.localStorage.getItem(
      getAvatarDraftKey(userId),
    );
    const legacyRawValue = window.localStorage.getItem(
      LEGACY_ACCOUNT_DRAFT_KEY,
    );
    window.localStorage.removeItem(LEGACY_ACCOUNT_DRAFT_KEY);

    if (storedAvatar && isValidAvatarDataUrl(storedAvatar)) {
      return storedAvatar;
    }

    if (storedAvatar) {
      window.localStorage.removeItem(getAvatarDraftKey(userId));
    }

    if (!legacyRawValue) {
      return undefined;
    }

    const legacyValue: unknown = JSON.parse(legacyRawValue);

    if (
      !isRecord(legacyValue) ||
      legacyValue.userId !== userId ||
      !isRecord(legacyValue.profile) ||
      !isValidAvatarDataUrl(legacyValue.profile.avatarDataUrl)
    ) {
      return undefined;
    }

    window.localStorage.setItem(
      getAvatarDraftKey(userId),
      legacyValue.profile.avatarDataUrl,
    );
    return legacyValue.profile.avatarDataUrl;
  } catch {
    return undefined;
  }
}

function writeAvatarDraft(
  userId: string,
  avatarDataUrl: string | undefined,
) {
  try {
    if (avatarDataUrl) {
      window.localStorage.setItem(
        getAvatarDraftKey(userId),
        avatarDataUrl,
      );
      return true;
    }

    window.localStorage.removeItem(getAvatarDraftKey(userId));
    return true;
  } catch {
    // The avatar can continue in memory if browser storage is unavailable.
    return false;
  }
}

function createMemberSessionRequiredError() {
  return new AuthClientError(401, {
    code: "MEMBER_SESSION_REQUIRED",
    message: "Bu değişikliği kaydetmek için yeniden giriş yapmalısın.",
    fieldErrors: {},
  });
}

function assertMemberMutationSession(
  session: SessionState,
  expectedUserId: string,
) {
  if (
    session.mode !== "member" ||
    session.user.id !== expectedUserId
  ) {
    throw createMemberSessionRequiredError();
  }
}

export function CampusAccountProvider({ children }: { children: ReactNode }) {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CampusProfile>(defaultProfile);
  const [settings, setSettings] =
    useState<CampusAccountSettings>(defaultSettings);
  const [role, setRole] = useState<CampusAdminRole>("member");
  const [sessionMode, setSessionMode] =
    useState<CampusSessionMode>("signed-out");
  const [sessionExpiresAt, setSessionExpiresAt] =
    useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const avatarDraftRef = useRef<string | undefined>(undefined);
  const sessionRequestRef = useRef<Promise<void> | null>(null);
  const settingsQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef<CampusAccountSettings>(defaultSettings);
  const sessionModeRef =
    useRef<CampusSessionMode>("signed-out");
  const userIdRef = useRef<string | null>(null);
  const isSignedIn = sessionMode !== "signed-out";
  const isGuest = sessionMode === "guest";

  const applySession = useCallback((session: SessionState) => {
    sessionModeRef.current = session.mode;
    setSessionMode(session.mode);
    setSessionExpired(false);
    setSessionExpiresAt(
      session.expiresAt ? new Date(session.expiresAt).getTime() : null,
    );

    if (session.mode === "member") {
      const avatarDataUrl =
        userIdRef.current === session.user.id
          ? avatarDraftRef.current
          : readAvatarDraft(session.user.id);
      const nextProfile = {
        ...session.user.profile,
        ...(avatarDataUrl ? { avatarDataUrl } : {}),
      };

      avatarDraftRef.current = avatarDataUrl;
      userIdRef.current = session.user.id;
      setAccountId(session.user.id);
      setProfile(nextProfile);
      settingsRef.current = session.user.settings;
      setSettings(session.user.settings);
      setRole(session.user.role);
      return;
    }

    avatarDraftRef.current = undefined;
    userIdRef.current = null;
    setAccountId(null);
    setRole("member");
    setProfile(
      session.mode === "guest" ? guestProfile : defaultProfile,
    );
    const nextSettings =
      session.mode === "guest"
        ? { ...defaultSettings, showDepartment: false }
        : defaultSettings;
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
  }, []);

  const expireSession = useCallback(() => {
    applySession(signedOutSession);
    setSessionExpired(true);
    setSessionError(null);
  }, [applySession]);

  const handleMutationError = useCallback(
    (error: unknown, expectedUserId: string) => {
      if (
        error instanceof AuthClientError &&
        error.status === 401 &&
        isMountedRef.current &&
        sessionModeRef.current === "member" &&
        userIdRef.current === expectedUserId
      ) {
        expireSession();
      }
    },
    [expireSession],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const retrySession = useCallback(() => {
    if (sessionRequestRef.current) {
      return sessionRequestRef.current;
    }

    setIsSessionLoading(true);

    const request = getCurrentSession()
      .then((session) => {
        if (isMountedRef.current) {
          applySession(session);
          setSessionError(null);
        }
      })
      .catch((error: unknown) => {
        if (isMountedRef.current) {
          setSessionError(getSessionErrorMessage(error));
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsHydrated(true);
          setIsSessionLoading(false);
        }

        sessionRequestRef.current = null;
      });

    sessionRequestRef.current = request;
    return request;
  }, [applySession]);

  useEffect(() => {
    void retrySession();
  }, [retrySession]);

  useEffect(() => {
    if (!isHydrated || !sessionExpiresAt) {
      return;
    }

    const checkExpiration = () => {
      if (sessionExpiresAt > Date.now()) {
        return;
      }

      expireSession();
    };

    checkExpiration();
    const timer = window.setInterval(checkExpiration, 60_000);

    return () => window.clearInterval(timer);
  }, [expireSession, isHydrated, sessionExpiresAt]);

  useEffect(() => {
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("kampus-auth");

    if (!channel) {
      return;
    }

    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data !== "signed-out") {
        return;
      }

      applySession({
        mode: "signed-out",
        expiresAt: null,
        user: null,
      });
    };

    return () => channel.close();
  }, [applySession]);

  const updateProfile = useCallback(
    async (updates: UpdateCampusProfileInput) => {
      const expectedUserId = userIdRef.current;

      if (
        sessionModeRef.current !== "member" ||
        !expectedUserId
      ) {
        throw createMemberSessionRequiredError();
      }

      try {
        const session = await updateCurrentProfile(updates);
        assertMemberMutationSession(session, expectedUserId);

        if (
          sessionModeRef.current !== "member" ||
          userIdRef.current !== expectedUserId
        ) {
          throw createMemberSessionRequiredError();
        }

        applySession(session);
      } catch (error) {
        handleMutationError(error, expectedUserId);
        throw error;
      }
    },
    [applySession, handleMutationError],
  );

  const updateSettings = useCallback(
    (updates: Partial<CampusAccountSettings>) => {
      const executeUpdate = async () => {
        const expectedUserId = userIdRef.current;

        if (
          sessionModeRef.current !== "member" ||
          !expectedUserId
        ) {
          throw createMemberSessionRequiredError();
        }

        const previousSettings = settingsRef.current;
        const optimisticSettings = {
          ...previousSettings,
          ...updates,
        };
        settingsRef.current = optimisticSettings;
        setSettings(optimisticSettings);

        try {
          const session = await updateCurrentSettings(updates);
          assertMemberMutationSession(session, expectedUserId);

          if (
            sessionModeRef.current !== "member" ||
            userIdRef.current !== expectedUserId
          ) {
            throw createMemberSessionRequiredError();
          }

          applySession(session);
        } catch (error) {
          handleMutationError(error, expectedUserId);

          if (
            sessionModeRef.current === "member" &&
            userIdRef.current === expectedUserId
          ) {
            settingsRef.current = previousSettings;
            setSettings(previousSettings);
          }

          throw error;
        }
      };

      const request = settingsQueueRef.current
        .catch(() => undefined)
        .then(executeUpdate);
      settingsQueueRef.current = request.then(
        () => undefined,
        () => undefined,
      );
      return request;
    },
    [applySession, handleMutationError],
  );

  const updateAvatar = useCallback((avatarDataUrl: string) => {
    const currentUserId = userIdRef.current;

    if (
      sessionModeRef.current !== "member" ||
      !currentUserId ||
      !isValidAvatarDataUrl(avatarDataUrl)
    ) {
      return false;
    }

    const wasStored = writeAvatarDraft(currentUserId, avatarDataUrl);

    if (!wasStored) {
      return false;
    }

    avatarDraftRef.current = avatarDataUrl;
    setProfile((current) => ({
      ...current,
      avatarDataUrl,
    }));
    return wasStored;
  }, []);

  const removeAvatar = useCallback(() => {
    const currentUserId = userIdRef.current;

    if (
      sessionModeRef.current !== "member" ||
      !currentUserId
    ) {
      return false;
    }

    const wasRemoved = writeAvatarDraft(currentUserId, undefined);

    if (!wasRemoved) {
      return false;
    }

    avatarDraftRef.current = undefined;
    setProfile((current) => ({
      ...current,
      avatarDataUrl: undefined,
    }));
    return wasRemoved;
  }, []);

  const resetAccount = useCallback((targetAccountId?: string) => {
    const currentUserId = targetAccountId ?? userIdRef.current;

    if (!currentUserId) {
      return false;
    }

    let legacyDraftWasRemoved = true;

    try {
      window.localStorage.removeItem(LEGACY_ACCOUNT_DRAFT_KEY);
    } catch {
      // The in-memory reset still completes.
      legacyDraftWasRemoved = false;
    }

    const avatarWasRemoved = writeAvatarDraft(currentUserId, undefined);

    if (userIdRef.current === currentUserId) {
      avatarDraftRef.current = undefined;
      setProfile((current) => ({
        ...current,
        avatarDataUrl: undefined,
      }));
    }

    return legacyDraftWasRemoved && avatarWasRemoved;
  }, []);

  const signOut = useCallback(async () => {
    await logoutCurrentSession();
    applySession(signedOutSession);

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("kampus-auth");
      channel.postMessage("signed-out");
      channel.close();
    }
  }, [applySession]);

  const value = useMemo<CampusAccountContextValue>(
    () => ({
      accountId,
      profile,
      settings,
      role,
      isHydrated,
      isSignedIn,
      isGuest,
      isSessionLoading,
      sessionError,
      sessionExpired,
      sessionMode,
      retrySession,
      updateProfile,
      updateSettings,
      updateAvatar,
      removeAvatar,
      resetAccount,
      signOut,
    }),
    [
      profile,
      accountId,
      settings,
      role,
      isHydrated,
      isSignedIn,
      isGuest,
      isSessionLoading,
      sessionError,
      sessionExpired,
      sessionMode,
      retrySession,
      updateProfile,
      updateSettings,
      updateAvatar,
      removeAvatar,
      resetAccount,
      signOut,
    ],
  );

  return (
    <CampusAccountContext.Provider value={value}>
      {children}
    </CampusAccountContext.Provider>
  );
}

export function useCampusAccount() {
  const context = useContext(CampusAccountContext);

  if (!context) {
    throw new Error(
      "useCampusAccount must be used within CampusAccountProvider.",
    );
  }

  return context;
}
