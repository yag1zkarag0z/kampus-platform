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
} from "@/auth/client";
import type {
  AuthProfile,
  AuthSettings,
  SessionState,
} from "@/auth/types";
import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import type { CampusAdminRole } from "@/data/campusAdmin";

const ACCOUNT_DRAFT_KEY = "kampus-account-draft-v2";

export type CampusProfile = AuthProfile;
export type CampusAccountSettings = AuthSettings;
export type CampusSessionMode = "member" | "guest" | "signed-out";

type StoredAccountDraft = {
  userId: string;
  profile: CampusProfile;
  settings: CampusAccountSettings;
};

type CampusAccountContextValue = {
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
  updateProfile: (updates: Partial<CampusProfile>) => void;
  updateSettings: (updates: Partial<CampusAccountSettings>) => void;
  removeAvatar: () => void;
  resetAccount: () => void;
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

const CampusAccountContext = createContext<
  CampusAccountContextValue | undefined
>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringWithin(
  value: unknown,
  maximumLength: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maximumLength &&
    (allowEmpty || value.trim().length > 0)
  );
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

function isStoredProfile(value: unknown): value is CampusProfile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.username === "string" &&
    campusUsernamePattern.test(value.username) &&
    !reservedCampusUsernames.has(value.username) &&
    isStringWithin(value.displayName, 40) &&
    isStringWithin(value.department, 60, true) &&
    isStringWithin(value.year, 30, true) &&
    isStringWithin(value.bio, 160, true) &&
    isStringWithin(value.joinedLabel, 40, true) &&
    (value.avatarDataUrl === undefined ||
      isValidAvatarDataUrl(value.avatarDataUrl))
  );
}

function isStoredSettings(
  value: unknown,
): value is CampusAccountSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.showDepartment === "boolean" &&
    typeof value.notifyReplies === "boolean" &&
    typeof value.notifyLikes === "boolean" &&
    typeof value.notifyAnnouncements === "boolean" &&
    typeof value.emailNotifications === "boolean"
  );
}

function getSessionErrorMessage(error: unknown) {
  return error instanceof AuthClientError
    ? error.message
    : "Oturumun kontrol edilemedi. Bağlantını kontrol edip yeniden dene.";
}

function readAccountDraft(userId: string) {
  try {
    const rawValue = window.localStorage.getItem(ACCOUNT_DRAFT_KEY);

    if (!rawValue) {
      return null;
    }

    const value: unknown = JSON.parse(rawValue);

    if (
      !isRecord(value) ||
      value.userId !== userId ||
      !isStoredProfile(value.profile) ||
      !isStoredSettings(value.settings)
    ) {
      return null;
    }

    return {
      userId,
      profile: value.profile,
      settings: value.settings,
    } satisfies StoredAccountDraft;
  } catch {
    return null;
  }
}

export function CampusAccountProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CampusProfile>(defaultProfile);
  const [settings, setSettings] =
    useState<CampusAccountSettings>(defaultSettings);
  const [role, setRole] = useState<CampusAdminRole>("member");
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] =
    useState<CampusSessionMode>("signed-out");
  const [sessionExpiresAt, setSessionExpiresAt] =
    useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const sessionRequestRef = useRef<Promise<void> | null>(null);
  const isSignedIn = sessionMode !== "signed-out";
  const isGuest = sessionMode === "guest";

  const applySession = useCallback((session: SessionState) => {
    setSessionMode(session.mode);
    setSessionExpired(false);
    setSessionExpiresAt(
      session.expiresAt ? new Date(session.expiresAt).getTime() : null,
    );

    if (session.mode === "member") {
      const localDraft = readAccountDraft(session.user.id);

      setUserId(session.user.id);
      setProfile(localDraft?.profile ?? session.user.profile);
      setSettings(localDraft?.settings ?? session.user.settings);
      setRole(session.user.role);
      return;
    }

    setUserId(null);
    setRole("member");
    setProfile(
      session.mode === "guest" ? guestProfile : defaultProfile,
    );
    setSettings(
      session.mode === "guest"
        ? { ...defaultSettings, showDepartment: false }
        : defaultSettings,
    );
  }, []);

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
    if (!isHydrated || sessionMode !== "member" || !userId) {
      return;
    }

    try {
      window.localStorage.setItem(
        ACCOUNT_DRAFT_KEY,
        JSON.stringify({ userId, profile, settings }),
      );
    } catch {
      // Profile drafts can continue in memory if browser storage is unavailable.
    }
  }, [isHydrated, profile, sessionMode, settings, userId]);

  useEffect(() => {
    if (!isHydrated || !sessionExpiresAt) {
      return;
    }

    const checkExpiration = () => {
      if (sessionExpiresAt > Date.now()) {
        return;
      }

      setSessionExpired(true);
      setSessionMode("signed-out");
      setUserId(null);
    };

    checkExpiration();
    const timer = window.setInterval(checkExpiration, 60_000);

    return () => window.clearInterval(timer);
  }, [isHydrated, sessionExpiresAt]);

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
    (updates: Partial<CampusProfile>) => {
      if (sessionMode !== "member") {
        return;
      }

      setProfile((current) => ({ ...current, ...updates }));
    },
    [sessionMode],
  );

  const updateSettings = useCallback(
    (updates: Partial<CampusAccountSettings>) => {
      if (sessionMode !== "member") {
        return;
      }

      setSettings((current) => ({ ...current, ...updates }));
    },
    [sessionMode],
  );

  const removeAvatar = useCallback(() => {
    if (sessionMode !== "member") {
      return;
    }

    setProfile((current) => ({
      ...current,
      avatarDataUrl: undefined,
    }));
  }, [sessionMode]);

  const resetAccount = useCallback(() => {
    if (sessionMode !== "member") {
      return;
    }

    try {
      window.localStorage.removeItem(ACCOUNT_DRAFT_KEY);
    } catch {
      // The in-memory reset still completes.
    }

    setProfile(defaultProfile);
    setSettings(defaultSettings);
  }, [sessionMode]);

  const signOut = useCallback(async () => {
    await logoutCurrentSession();
    applySession({
      mode: "signed-out",
      expiresAt: null,
      user: null,
    });

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("kampus-auth");
      channel.postMessage("signed-out");
      channel.close();
    }
  }, [applySession]);

  const value = useMemo<CampusAccountContextValue>(
    () => ({
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
      removeAvatar,
      resetAccount,
      signOut,
    }),
    [
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
