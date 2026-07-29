export type AuthErrorCode =
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_NOT_FOUND"
  | "AUTHENTICATION_REQUIRED"
  | "AUTH_CONFIGURATION_ERROR"
  | "EMAIL_ALREADY_REGISTERED"
  | "EMAIL_DELIVERY_FAILED"
  | "INVALID_ORIGIN"
  | "INVALID_REGISTRATION_GRANT"
  | "INVALID_REQUEST"
  | "OTP_COOLDOWN"
  | "OTP_EXPIRED"
  | "OTP_INCORRECT"
  | "OTP_LOCKED"
  | "OTP_NOT_FOUND"
  | "OTP_NOT_READY"
  | "OTP_RATE_LIMITED"
  | "OTP_USED"
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
