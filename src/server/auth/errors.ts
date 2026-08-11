export type AuthErrorCode =
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_NOT_FOUND"
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_REQUIRED"
  | "AUTH_CONFIGURATION_ERROR"
  | "AVATAR_NOT_FOUND"
  | "COMMENT_NOT_FOUND"
  | "CONVERSATION_NOT_FOUND"
  | "CONTENT_FORBIDDEN"
  | "CONTENT_LIMIT_REACHED"
  | "CONTENT_RATE_LIMITED"
  | "EMAIL_ALREADY_REGISTERED"
  | "EMAIL_DELIVERY_FAILED"
  | "FEEDBACK_NOT_FOUND"
  | "INVALID_ORIGIN"
  | "INVALID_REGISTRATION_GRANT"
  | "INVALID_REQUEST"
  | "MEDIA_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "NOTIFICATION_NOT_FOUND"
  | "OTP_COOLDOWN"
  | "OTP_EXPIRED"
  | "OTP_INCORRECT"
  | "OTP_LOCKED"
  | "OTP_NOT_FOUND"
  | "OTP_NOT_READY"
  | "OTP_RATE_LIMITED"
  | "OTP_USED"
  | "POST_NOT_FOUND"
  | "SESSION_REVOCATION_FAILED"
  | "USER_NOT_FOUND"
  | "USERNAME_TAKEN";

type AuthErrorOptions = {
  attemptsLeft?: number;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
  status?: number;
};

export class AuthError extends Error {
  readonly attemptsLeft?: number;
  readonly code: AuthErrorCode;
  readonly fieldErrors: Record<string, string[]>;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(
    code: AuthErrorCode,
    message: string,
    {
      attemptsLeft,
      fieldErrors = {},
      retryAfterSeconds,
      status = 400,
    }: AuthErrorOptions = {},
  ) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.attemptsLeft = attemptsLeft;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
