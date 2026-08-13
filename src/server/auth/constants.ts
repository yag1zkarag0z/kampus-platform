export const OTP_LIFETIME_MS = 5 * 60 * 1_000;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1_000;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_EMAIL_HOURLY_LIMIT = 5;
export const OTP_IP_HOURLY_LIMIT = 200;
export const REGISTRATION_GRANT_LIFETIME_MS = 15 * 60 * 1_000;
export const RECENT_AUTHENTICATION_WINDOW_MS = 30 * 60 * 1_000;

export const MEMBER_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
export const PRIVILEGED_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1_000;
export const GUEST_SESSION_LIFETIME_MS = 2 * 60 * 60 * 1_000;

export const SESSION_COOKIE_NAME = "kampus_session";
export const CURRENT_TERMS_VERSION = "2026-08-12.v1";

export const OTP_PURPOSES = ["registration", "login"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];
