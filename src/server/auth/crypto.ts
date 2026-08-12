import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { getAuthEnvironment } from "@/server/env";

import {
  GUEST_SESSION_LIFETIME_MS,
  REGISTRATION_GRANT_LIFETIME_MS,
  type OtpPurpose,
} from "./constants";

type RegistrationGrantPayload = {
  challengeId: string;
  email: string;
  exp: number;
  kind: "registration";
  v: 1;
};

type GuestTokenPayload = {
  exp: number;
  iat: number;
  jti: string;
  kind: "guest";
  v: 1;
};

function deriveKey(namespace: string) {
  const { AUTH_SECRET } = getAuthEnvironment();

  return createHmac("sha256", AUTH_SECRET)
    .update(`kampus:${namespace}:v1`)
    .digest();
}

function signEncodedPayload(namespace: string, encodedPayload: string) {
  return createHmac("sha256", deriveKey(namespace))
    .update(encodedPayload)
    .digest("base64url");
}

function signaturesMatch(candidate: string, expected: string) {
  try {
    const candidateBuffer = Buffer.from(candidate, "base64url");
    const expectedBuffer = Buffer.from(expected, "base64url");

    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  } catch {
    return false;
  }
}

function createSignedToken(namespace: string, payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = signEncodedPayload(namespace, encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function readSignedToken<T>(
  namespace: string,
  token: string,
): T | null {
  const [encodedPayload, candidateSignature, extraPart] = token.split(".");

  if (!encodedPayload || !candidateSignature || extraPart) {
    return null;
  }

  const expectedSignature = signEncodedPayload(namespace, encodedPayload);

  if (!signaturesMatch(candidateSignature, expectedSignature)) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
}

export function createOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashOtpCode({
  challengeId,
  code,
  email,
  purpose,
}: {
  challengeId: string;
  code: string;
  email: string;
  purpose: OtpPurpose;
}) {
  return createHmac("sha256", deriveKey("otp"))
    .update(
      JSON.stringify({
        challengeId,
        code,
        email,
        purpose,
      }),
    )
    .digest("hex");
}

export function otpHashesMatch(candidateHash: string, storedHash: string) {
  const candidate = Buffer.from(candidateHash, "hex");
  const stored = Buffer.from(storedHash, "hex");

  return (
    candidate.length === stored.length &&
    timingSafeEqual(candidate, stored)
  );
}

export function hashRequestIp(ipAddress: string) {
  return createHmac("sha256", deriveKey("request-ip"))
    .update(ipAddress)
    .digest("hex");
}

/**
 * Ölçüm olaylarının takma kimliği. Aynı kullanıcı için sabit olduğu için
 * retention hesaplanabiliyor; ayrı bir namespace kullandığı için de ölçüm
 * tablosu başka bir hash'le (ör. request-ip) eşleştirilemiyor.
 */
export function hashAnalyticsSubject(userId: string) {
  return createHmac("sha256", deriveKey("analytics-subject"))
    .update(userId)
    .digest("hex")
    .slice(0, 64);
}

export function createOpaqueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRegistrationGrant({
  challengeId,
  email,
  now = new Date(),
}: {
  challengeId: string;
  email: string;
  now?: Date;
}) {
  const expiresAt = new Date(
    now.getTime() + REGISTRATION_GRANT_LIFETIME_MS,
  );
  const payload: RegistrationGrantPayload = {
    challengeId,
    email,
    exp: expiresAt.getTime(),
    kind: "registration",
    v: 1,
  };

  return {
    expiresAt,
    token: createSignedToken("registration-grant", payload),
  };
}

export function verifyRegistrationGrant(
  token: string,
  now = new Date(),
) {
  const payload = readSignedToken<RegistrationGrantPayload>(
    "registration-grant",
    token,
  );

  if (
    !payload ||
    payload.v !== 1 ||
    payload.kind !== "registration" ||
    typeof payload.challengeId !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp <= now.getTime()
  ) {
    return null;
  }

  return payload;
}
export function createGuestToken(now = new Date()) {
  const expiresAt = new Date(now.getTime() + GUEST_SESSION_LIFETIME_MS);
  const payload: GuestTokenPayload = {
    exp: expiresAt.getTime(),
    iat: now.getTime(),
    jti: randomUUID(),
    kind: "guest",
    v: 1,
  };

  return {
    expiresAt,
    token: createSignedToken("guest-session", payload),
  };
}

export function verifyGuestToken(token: string, now = new Date()) {
  const payload = readSignedToken<GuestTokenPayload>(
    "guest-session",
    token,
  );

  if (
    !payload ||
    payload.v !== 1 ||
    payload.kind !== "guest" ||
    typeof payload.jti !== "string" ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number" ||
    payload.iat > now.getTime() ||
    payload.exp <= now.getTime() ||
    payload.exp - payload.iat > GUEST_SESSION_LIFETIME_MS
  ) {
    return null;
  }

  return payload;
}
