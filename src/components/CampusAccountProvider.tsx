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

import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import type { CampusAdminRole } from "@/data/campusAdmin";

const STORAGE_KEY = "kampus-account-v1";
const SESSION_KEY = "kampus-session-v1";
const SESSION_EXPIRES_KEY = "kampus-session-expires-v1";
const MEMBER_SESSION_DURATION = 8 * 60 * 60 * 1000;
const GUEST_SESSION_DURATION = 2 * 60 * 60 * 1000;

export type CampusProfile = {
  username: string;
  displayName: string;
  department: string;
  year: string;
  bio: string;
  avatarDataUrl?: string;
  joinedLabel: string;
};

export type CampusAccountSettings = {
  showDepartment: boolean;
  notifyReplies: boolean;
  notifyLikes: boolean;
  notifyAnnouncements: boolean;
  emailNotifications: boolean;
};

type StoredCampusAccount = {
  profile: CampusProfile;
  settings: CampusAccountSettings;
  role?: CampusAdminRole;
};

export type CampusSessionMode = "member" | "guest" | "signed-out";

type CampusAccountContextValue = StoredCampusAccount & {
  role: CampusAdminRole;
  isHydrated: boolean;
  isSignedIn: boolean;
  isGuest: boolean;
  sessionExpired: boolean;
  sessionMode: CampusSessionMode;
  updateProfile: (updates: Partial<CampusProfile>) => void;
  updateSettings: (updates: Partial<CampusAccountSettings>) => void;
  removeAvatar: () => void;
  resetAccount: () => void;
  signOut: () => void;
};

const defaultProfile: CampusProfile = {
  username: "yagizkaragoz",
  displayName: "Yağız Karagöz",
  department: "Yazılım Mühendisliği",
  year: "2. sınıf",
  bio: "Frontend geliştiriyorum; kampüs hayatı ve yeni fikirlerle ilgileniyorum.",
  joinedLabel: "Temmuz 2026",
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
  showDepartment: true,
  notifyReplies: true,
  notifyLikes: true,
  notifyAnnouncements: true,
  emailNotifications: true,
};

const demoOwnerUsernames = new Set([
  "yagizkaragoz",
  "yag1zkarag0z",
]);

function isDemoOwnerProfile(profile: CampusProfile) {
  const normalizedUsername = profile.username
    .trim()
    .toLocaleLowerCase("tr-TR");
  const normalizedDisplayName = profile.displayName
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ğ", "g")
    .replaceAll("ı", "i")
    .replace(/\s+/g, " ");

  return (
    demoOwnerUsernames.has(normalizedUsername) ||
    normalizedDisplayName === "yagiz karagoz"
  );
}

const CampusAccountContext = createContext<
  CampusAccountContextValue | undefined
>(undefined);

function getDefaultAccount(): StoredCampusAccount {
  return {
    profile: { ...defaultProfile },
    settings: { ...defaultSettings },
    role: "admin",
  };
}

export function activateCampusSession() {
  try {
    window.localStorage.setItem(SESSION_KEY, "member");
    window.localStorage.setItem(
      SESSION_EXPIRES_KEY,
      String(Date.now() + MEMBER_SESSION_DURATION),
    );
    return true;
  } catch {
    return false;
  }
}

export function activateCampusGuestSession() {
  try {
    window.localStorage.setItem(SESSION_KEY, "guest");
    window.localStorage.setItem(
      SESSION_EXPIRES_KEY,
      String(Date.now() + GUEST_SESSION_DURATION),
    );
    return true;
  } catch {
    return false;
  }
}

export function persistRegisteredCampusAccount({
  username,
  displayName,
  department,
  year,
  bio,
  showDepartment,
}: {
  username: string;
  displayName: string;
  department: string;
  year: string;
  bio: string;
  showDepartment: boolean;
}) {
  const normalizedDisplayName = displayName.trim();
  const normalizedDepartment = department.trim();
  const normalizedYear = year.trim();
  const normalizedBio = bio.trim();

  if (
    !campusUsernamePattern.test(username) ||
    reservedCampusUsernames.has(username) ||
    normalizedDisplayName.length > 40 ||
    normalizedDepartment.length === 0 ||
    normalizedDepartment.length > 60 ||
    normalizedYear.length === 0 ||
    normalizedYear.length > 30 ||
    normalizedBio.length > 160
  ) {
    return false;
  }

  const account = getDefaultAccount();

  account.profile = {
    ...account.profile,
    username,
    displayName: normalizedDisplayName || username,
    department: normalizedDepartment,
    year: normalizedYear,
    bio: normalizedBio,
    joinedLabel: new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(new Date()),
  };
  account.settings = {
    ...account.settings,
    showDepartment,
  };
  account.role = "member";

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    return activateCampusSession();
  } catch {
    return false;
  }
}

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
    isStringWithin(value.department, 60) &&
    isStringWithin(value.year, 30) &&
    isStringWithin(value.bio, 160, true) &&
    isStringWithin(value.joinedLabel, 40) &&
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

function isStoredAccount(value: unknown): value is StoredCampusAccount {
  return (
    isRecord(value) &&
    isStoredProfile(value.profile) &&
    isStoredSettings(value.settings) &&
    (value.role === undefined ||
      value.role === "admin" ||
      value.role === "moderator" ||
      value.role === "member")
  );
}

export function CampusAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<StoredCampusAccount>(
    getDefaultAccount,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [sessionMode, setSessionMode] =
    useState<CampusSessionMode>("signed-out");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionStorageRevision, setSessionStorageRevision] = useState(0);
  const isSignedIn = sessionMode !== "signed-out";
  const isGuest = sessionMode === "guest";

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        const storedSession = window.localStorage.getItem(SESSION_KEY);
        const normalizedSession =
          storedSession === "member" || storedSession === "active"
            ? "member"
            : storedSession === "guest"
              ? "guest"
              : "signed-out";
        const storedExpiration = Number(
          window.localStorage.getItem(SESSION_EXPIRES_KEY),
        );
        const hasExpired =
          normalizedSession !== "signed-out" &&
          Number.isFinite(storedExpiration) &&
          storedExpiration > 0 &&
          storedExpiration <= Date.now();

        if (hasExpired) {
          setSessionMode("signed-out");
          setSessionExpired(true);
          window.localStorage.setItem(SESSION_KEY, "signed-out");
          window.localStorage.removeItem(SESSION_EXPIRES_KEY);
        } else {
          setSessionMode(normalizedSession);
          setSessionExpired(false);

          if (
            normalizedSession !== "signed-out" &&
            (!Number.isFinite(storedExpiration) || storedExpiration <= 0)
          ) {
            window.localStorage.setItem(
              SESSION_EXPIRES_KEY,
              String(
                Date.now() +
                  (normalizedSession === "guest"
                    ? GUEST_SESSION_DURATION
                    : MEMBER_SESSION_DURATION),
              ),
            );
          }
        }
        const storedValue = window.localStorage.getItem(STORAGE_KEY);

        if (storedValue) {
          const parsedValue: unknown = JSON.parse(storedValue);

          if (isStoredAccount(parsedValue)) {
            setAccount({
              profile: { ...parsedValue.profile },
              settings: { ...parsedValue.settings },
              role:
                parsedValue.role ??
                (parsedValue.profile.username === defaultProfile.username
                  ? "admin"
                  : "member"),
            });
          }
        }
      } catch {
        setSessionMode("signed-out");
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } catch {
      // Account changes should still work in memory when storage is unavailable.
    }
  }, [account, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const synchronizeStoredSession = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key === STORAGE_KEY) {
        if (!event.newValue) {
          setAccount(getDefaultAccount());
          return;
        }

        try {
          const parsedValue: unknown = JSON.parse(event.newValue);

          if (isStoredAccount(parsedValue)) {
            setAccount({
              profile: { ...parsedValue.profile },
              settings: { ...parsedValue.settings },
              role:
                parsedValue.role ??
                (parsedValue.profile.username === defaultProfile.username
                  ? "admin"
                  : "member"),
            });
          }
        } catch {
          // Ignore malformed changes from another tab.
        }
        return;
      }

      if (
        event.key !== SESSION_KEY &&
        event.key !== SESSION_EXPIRES_KEY
      ) {
        return;
      }

      const storedSession = window.localStorage.getItem(SESSION_KEY);
      const nextSessionMode: CampusSessionMode =
        storedSession === "member" || storedSession === "active"
          ? "member"
          : storedSession === "guest"
            ? "guest"
            : "signed-out";
      const storedExpiration = Number(
        window.localStorage.getItem(SESSION_EXPIRES_KEY),
      );
      const hasExpired =
        nextSessionMode !== "signed-out" &&
        Number.isFinite(storedExpiration) &&
        storedExpiration > 0 &&
        storedExpiration <= Date.now();

      setSessionExpired(hasExpired);
      setSessionMode(hasExpired ? "signed-out" : nextSessionMode);
      setSessionStorageRevision((current) => current + 1);
    };

    window.addEventListener("storage", synchronizeStoredSession);

    return () =>
      window.removeEventListener("storage", synchronizeStoredSession);
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated || sessionMode === "signed-out") {
      return;
    }

    const storedExpiration = Number(
      window.localStorage.getItem(SESSION_EXPIRES_KEY),
    );

    if (!Number.isFinite(storedExpiration) || storedExpiration <= 0) {
      return;
    }

    const expireSession = () => {
      try {
        window.localStorage.setItem(SESSION_KEY, "signed-out");
        window.localStorage.removeItem(SESSION_EXPIRES_KEY);
      } catch {
        // The in-memory session can still expire when storage is unavailable.
      }

      setSessionExpired(true);
      setSessionMode("signed-out");
    };
    const remainingDuration = storedExpiration - Date.now();

    if (remainingDuration <= 0) {
      const expirationTimer = window.setTimeout(expireSession, 0);
      return () => window.clearTimeout(expirationTimer);
    }

    const expirationTimer = window.setTimeout(
      expireSession,
      remainingDuration,
    );

    return () => window.clearTimeout(expirationTimer);
  }, [isHydrated, sessionMode, sessionStorageRevision]);

  const updateProfile = useCallback((updates: Partial<CampusProfile>) => {
    if (sessionMode !== "member") {
      return;
    }

    setAccount((currentAccount) => ({
      ...currentAccount,
      profile: {
        ...currentAccount.profile,
        ...updates,
      },
    }));
  }, [sessionMode]);

  const updateSettings = useCallback(
    (updates: Partial<CampusAccountSettings>) => {
      if (sessionMode !== "member") {
        return;
      }

      setAccount((currentAccount) => ({
        ...currentAccount,
        settings: {
          ...currentAccount.settings,
          ...updates,
        },
      }));
    },
    [sessionMode],
  );

  const removeAvatar = useCallback(() => {
    if (sessionMode !== "member") {
      return;
    }

    setAccount((currentAccount) => ({
      ...currentAccount,
      profile: {
        ...currentAccount.profile,
        avatarDataUrl: undefined,
      },
    }));
  }, [sessionMode]);

  const resetAccount = useCallback(() => {
    if (sessionMode !== "member") {
      return;
    }

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset should still complete in memory when storage is unavailable.
    }

    setAccount(getDefaultAccount());
  }, [sessionMode]);

  const signOut = useCallback(() => {
    try {
      window.localStorage.setItem(SESSION_KEY, "signed-out");
      window.localStorage.removeItem(SESSION_EXPIRES_KEY);
    } catch {
      // The current screen should still sign out when storage is unavailable.
    }

    setSessionExpired(false);
    setSessionMode("signed-out");
  }, []);

  const value = useMemo<CampusAccountContextValue>(
    () => ({
      profile: isGuest ? guestProfile : account.profile,
      settings: isGuest
        ? { ...defaultSettings, showDepartment: false }
        : account.settings,
      role: isGuest
        ? "member"
        : isDemoOwnerProfile(account.profile)
          ? "admin"
          : (account.role ?? "member"),
      isHydrated,
      isSignedIn,
      isGuest,
      sessionExpired,
      sessionMode,
      updateProfile,
      updateSettings,
      removeAvatar,
      resetAccount,
      signOut,
    }),
    [
      account.profile,
      account.settings,
      account.role,
      isHydrated,
      isGuest,
      isSignedIn,
      sessionExpired,
      sessionMode,
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
