"use client";

import type {
  AuthApiError,
  AuthSettings,
  OtpChallengeResponse,
  SessionState,
} from "./types";

export type OtpPurpose = "registration" | "login";

export type UpdateCampusProfileInput = {
  username: string;
  displayName: string;
  department: string;
  year: string;
  bio: string;
};

export type ApiEnvelope<T> = {
  data: T;
};

type ParsedApiResponse =
  | {
      kind: "empty";
    }
  | {
      kind: "payload";
      payload: Record<string, unknown> & ApiEnvelope<unknown>;
    };

const fallbackApiError: AuthApiError["error"] = {
  code: "UNEXPECTED_RESPONSE",
  message: "Sunucudan geçerli bir yanıt alınamadı. Lütfen yeniden dene.",
  fieldErrors: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFieldErrors(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([field, messages]) => {
      if (!Array.isArray(messages)) {
        return [];
      }

      const normalizedMessages = messages.filter(
        (message): message is string => typeof message === "string",
      );

      return normalizedMessages.length > 0
        ? [[field, normalizedMessages] as const]
        : [];
    }),
  );
}

function normalizeApiError(value: unknown): AuthApiError["error"] {
  if (
    !isRecord(value) ||
    !isRecord(value.error) ||
    typeof value.error.code !== "string" ||
    typeof value.error.message !== "string"
  ) {
    return fallbackApiError;
  }

  return {
    code: value.error.code,
    message: value.error.message,
    fieldErrors: normalizeFieldErrors(value.error.fieldErrors),
    ...(typeof value.error.attemptsLeft === "number" &&
    Number.isFinite(value.error.attemptsLeft)
      ? { attemptsLeft: value.error.attemptsLeft }
      : {}),
    ...(typeof value.error.retryAfterSeconds === "number" &&
    Number.isFinite(value.error.retryAfterSeconds)
      ? { retryAfterSeconds: value.error.retryAfterSeconds }
      : {}),
  };
}

export class AuthClientError extends Error {
  readonly attemptsLeft?: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly retryAfterSeconds?: number;
  readonly status: number;

  constructor(status: number, payload: AuthApiError["error"]) {
    super(payload.message);
    this.name = "AuthClientError";
    this.status = status;
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors;
    this.attemptsLeft = payload.attemptsLeft;
    this.retryAfterSeconds = payload.retryAfterSeconds;
  }
}

async function requestApiResponse(
  path: string,
  init?: RequestInit,
): Promise<ParsedApiResponse> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new AuthClientError(
      response.status,
      normalizeApiError(payload),
    );
  }

  if (response.status === 204) {
    return { kind: "empty" };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new AuthClientError(502, fallbackApiError);
  }

  if (!isRecord(payload) || !("data" in payload)) {
    throw new AuthClientError(502, fallbackApiError);
  }

  return {
    kind: "payload",
    payload: payload as Record<string, unknown> & ApiEnvelope<unknown>,
  };
}

export async function requestApiPayload<
  TPayload extends ApiEnvelope<unknown>,
>(
  path: string,
  init?: RequestInit,
): Promise<TPayload> {
  const response = await requestApiResponse(path, init);

  if (response.kind === "empty") {
    throw new AuthClientError(502, fallbackApiError);
  }

  return response.payload as TPayload;
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await requestApiResponse(path, init);

  if (response.kind === "empty") {
    return undefined as T;
  }

  return response.payload.data as T;
}

export function requestOtpCode(email: string, purpose: OtpPurpose) {
  return requestApi<OtpChallengeResponse>("/v1/auth/code/request", {
    method: "POST",
    body: JSON.stringify({ email, purpose }),
  });
}

export async function verifyOtpCode({
  challengeId,
  code,
  purpose,
}: {
  challengeId: string;
  code: string;
  purpose: OtpPurpose;
}) {
  if (purpose === "registration") {
    return requestApi<{
      registrationToken: string;
      registrationExpiresAt: string;
    }>("/v1/auth/code/verify", {
      method: "POST",
      body: JSON.stringify({ challengeId, code, purpose }),
    });
  }

  return requestApi<SessionState>("/v1/auth/code/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, code, purpose }),
  });
}

export function registerCampusAccount(input: {
  registrationToken: string;
  username: string;
  displayName: string;
  department: string;
  yearLabel: string;
  bio: string;
  showDepartment: boolean;
  termsAccepted: true;
}) {
  return requestApi<SessionState>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startGuestSession() {
  return requestApi<SessionState>("/v1/auth/guest", {
    method: "POST",
  });
}

export function startDevelopmentSession() {
  return requestApi<SessionState>("/v1/auth/development", {
    method: "POST",
  });
}

export function getCurrentSession() {
  return requestApi<SessionState>("/v1/session", {
    method: "GET",
    cache: "no-store",
  });
}

export function updateCurrentProfile(input: UpdateCampusProfileInput) {
  return requestApi<SessionState>("/v1/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateCurrentSettings(input: Partial<AuthSettings>) {
  return requestApi<SessionState>("/v1/me/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function logoutCurrentSession() {
  return requestApi<void>("/v1/auth/logout", {
    method: "POST",
  });
}
