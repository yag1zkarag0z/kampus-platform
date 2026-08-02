export type AuthRole = "member" | "moderator" | "admin";

export type AuthProfile = {
  username: string;
  displayName: string;
  department: string;
  year: string;
  bio: string;
  avatarUrl: string | null;
  joinedLabel: string;
};

export type AuthSettings = {
  showDepartment: boolean;
  notifyReplies: boolean;
  notifyLikes: boolean;
  notifyAnnouncements: boolean;
  emailNotifications: boolean;
};

export type AuthenticatedUser = {
  id: string;
  profile: AuthProfile;
  settings: AuthSettings;
  role: AuthRole;
};

export type SessionState =
  | {
      mode: "signed-out";
      expiresAt: null;
      user: null;
    }
  | {
      mode: "guest";
      expiresAt: string;
      user: null;
    }
  | {
      mode: "member";
      expiresAt: string;
      user: AuthenticatedUser;
    };

export type AuthApiError = {
  error: {
    code: string;
    message: string;
    fieldErrors: Record<string, string[]>;
    attemptsLeft?: number;
    retryAfterSeconds?: number;
  };
};

export type OtpChallengeResponse = {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
  attemptsLeft: number;
};
