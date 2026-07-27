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

const STORAGE_KEY = "kampus-account-v1";
const SESSION_KEY = "kampus-session-v1";

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
};

type CampusAccountContextValue = StoredCampusAccount & {
  isHydrated: boolean;
  isSignedIn: boolean;
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

const defaultSettings: CampusAccountSettings = {
  showDepartment: true,
  notifyReplies: true,
  notifyLikes: true,
  notifyAnnouncements: true,
  emailNotifications: true,
};

const CampusAccountContext = createContext<
  CampusAccountContextValue | undefined
>(undefined);

function getDefaultAccount(): StoredCampusAccount {
  return {
    profile: { ...defaultProfile },
    settings: { ...defaultSettings },
  };
}

export function activateCampusSession() {
  try {
    window.localStorage.setItem(SESSION_KEY, "active");
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
    isStoredSettings(value.settings)
  );
}

export function CampusAccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<StoredCampusAccount>(
    getDefaultAccount,
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        setIsSignedIn(
          window.localStorage.getItem(SESSION_KEY) !== "signed-out",
        );
        const storedValue = window.localStorage.getItem(STORAGE_KEY);

        if (storedValue) {
          const parsedValue: unknown = JSON.parse(storedValue);

          if (isStoredAccount(parsedValue)) {
            setAccount({
              profile: { ...parsedValue.profile },
              settings: { ...parsedValue.settings },
            });
          }
        }
      } catch {
        // Keep the demo account when storage is unavailable or invalid.
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

  const updateProfile = useCallback((updates: Partial<CampusProfile>) => {
    setAccount((currentAccount) => ({
      ...currentAccount,
      profile: {
        ...currentAccount.profile,
        ...updates,
      },
    }));
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<CampusAccountSettings>) => {
      setAccount((currentAccount) => ({
        ...currentAccount,
        settings: {
          ...currentAccount.settings,
          ...updates,
        },
      }));
    },
    [],
  );

  const removeAvatar = useCallback(() => {
    setAccount((currentAccount) => ({
      ...currentAccount,
      profile: {
        ...currentAccount.profile,
        avatarDataUrl: undefined,
      },
    }));
  }, []);

  const resetAccount = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset should still complete in memory when storage is unavailable.
    }

    setAccount(getDefaultAccount());
  }, []);

  const signOut = useCallback(() => {
    try {
      window.localStorage.setItem(SESSION_KEY, "signed-out");
    } catch {
      // The current screen should still sign out when storage is unavailable.
    }

    setIsSignedIn(false);
  }, []);

  const value = useMemo<CampusAccountContextValue>(
    () => ({
      profile: account.profile,
      settings: account.settings,
      isHydrated,
      isSignedIn,
      updateProfile,
      updateSettings,
      removeAvatar,
      resetAccount,
      signOut,
    }),
    [
      account.profile,
      account.settings,
      isHydrated,
      isSignedIn,
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
