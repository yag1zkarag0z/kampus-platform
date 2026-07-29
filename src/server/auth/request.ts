import "server-only";

import { isIP } from "node:net";

import { NextResponse } from "next/server";

import { getAuthEnvironment } from "@/server/env";

import { SESSION_COOKIE_NAME } from "./constants";
import { AuthError } from "./errors";

export const noStoreHeaders = {
  "Cache-Control": "no-store",
};

const MAX_JSON_BODY_BYTES = 16_384;

function invalidOriginError() {
  return new AuthError(
    "INVALID_ORIGIN",
    "İstek kaynağı doğrulanamadı.",
    { status: 403 },
  );
}

function canonicalizeIpAddress(candidate: string) {
  const version = isIP(candidate);

  if (version === 4) {
    return candidate;
  }

  if (version === 6 && !candidate.includes("%")) {
    const hostname = new URL(`http://[${candidate}]/`).hostname;

    return hostname.slice(1, -1).toLowerCase();
  }

  throw new AuthError(
    "INVALID_REQUEST",
    "İstemci ağ adresi doğrulanamadı.",
    { status: 400 },
  );
}

export function getRequestIp(request: Request) {
  const { TRUSTED_CLIENT_IP_HEADER } = getAuthEnvironment();
  const headerValue = request.headers.get(TRUSTED_CLIENT_IP_HEADER);

  if (!headerValue) {
    if (process.env.NODE_ENV !== "production") {
      return "127.0.0.1";
    }

    throw new AuthError(
      "INVALID_REQUEST",
      "İstemci ağ adresi doğrulanamadı.",
      { status: 400 },
    );
  }

  const candidate = headerValue.split(",")[0]?.trim() ?? "";

  return canonicalizeIpAddress(candidate);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    throw invalidOriginError();
  }

  let normalizedOrigin: string;

  try {
    const parsedOrigin = new URL(origin);

    if (origin !== parsedOrigin.origin) {
      throw invalidOriginError();
    }

    normalizedOrigin = parsedOrigin.origin;
  } catch {
    throw invalidOriginError();
  }

  const configuredOrigin = new URL(
    getAuthEnvironment().APP_ORIGIN,
  ).origin;

  if (normalizedOrigin !== configuredOrigin) {
    throw new AuthError("INVALID_ORIGIN", "İstek kaynağı geçersiz.", {
      status: 403,
    });
  }
}

export async function readJsonBody(request: Request) {
  const contentType =
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();

  if (contentType !== "application/json") {
    throw new AuthError(
      "INVALID_REQUEST",
      "Content-Type application/json olmalı.",
      { status: 415 },
    );
  }

  const contentLengthHeader = request.headers.get("content-length");

  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);

    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0
    ) {
      throw new AuthError(
        "INVALID_REQUEST",
        "Content-Length değeri geçersiz.",
      );
    }

    if (contentLength > MAX_JSON_BODY_BYTES) {
      throw new AuthError(
        "INVALID_REQUEST",
        "İstek gövdesi çok büyük.",
        { status: 413 },
      );
    }
  }

  if (!request.body) {
    throw new AuthError(
      "INVALID_REQUEST",
      "Geçerli bir JSON gövdesi gerekli.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_JSON_BODY_BYTES) {
        await reader.cancel();

        throw new AuthError(
          "INVALID_REQUEST",
          "İstek gövdesi çok büyük.",
          { status: 413 },
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

    return JSON.parse(text) as unknown;
  } catch {
    throw new AuthError(
      "INVALID_REQUEST",
      "Geçerli bir JSON gövdesi gerekli.",
      { status: 400 },
    );
  }
}

export function authErrorResponse(error: unknown) {
  const normalizedError =
    error instanceof AuthError
      ? error
      : new AuthError(
          "AUTH_CONFIGURATION_ERROR",
          "İşlem şu anda tamamlanamıyor. Lütfen daha sonra yeniden dene.",
          { status: 500 },
        );
  const headers = new Headers(noStoreHeaders);

  if (normalizedError.retryAfterSeconds !== undefined) {
    headers.set(
      "Retry-After",
      String(Math.max(1, normalizedError.retryAfterSeconds)),
    );
  }

  return NextResponse.json(
    {
      error: {
        code: normalizedError.code,
        message: normalizedError.message,
        fieldErrors: normalizedError.fieldErrors,
        ...(normalizedError.attemptsLeft === undefined
          ? {}
          : { attemptsLeft: normalizedError.attemptsLeft }),
        ...(normalizedError.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: normalizedError.retryAfterSeconds }),
      },
    },
    {
      status: normalizedError.status,
      headers,
    },
  );
}

export function setSessionCookie(
  response: NextResponse,
  value: string,
  expiresAt: Date,
) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value,
    expires: expiresAt,
    httpOnly: true,
    maxAge: Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1_000),
    ),
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
