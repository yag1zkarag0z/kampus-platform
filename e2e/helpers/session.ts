import { randomUUID } from "node:crypto";

import type { APIResponse, Page } from "@playwright/test";

import { E2E_APP_ORIGIN } from "./environment";
import { waitForOtpEmail } from "./mailpit";

const SESSION_COOKIE_NAME = "kampus_session";
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

type ApiEnvelope<T> = {
  data: T;
};

type SessionState =
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
      user: {
        id: string;
        role: "member" | "moderator" | "admin";
        profile: {
          username: string;
          displayName: string;
          department: string;
          year: string;
          bio: string;
          joinedLabel: string;
        };
        settings: {
          showDepartment: boolean;
          notifyReplies: boolean;
          notifyLikes: boolean;
          notifyAnnouncements: boolean;
          emailNotifications: boolean;
        };
      };
    };

export type E2eStudentIdentity = {
  displayName: string;
  email: string;
  requestIp: string;
  username: string;
};

function authHeaders(requestIp: string) {
  return {
    Origin: E2E_APP_ORIGIN,
    "X-Forwarded-For": requestIp,
  };
}

async function readSuccessfulResponse<T>(
  response: APIResponse,
  operation: string,
) {
  const body = await response.text();

  if (!response.ok()) {
    throw new Error(
      `${operation} failed with status ${response.status()}: ${body}`,
    );
  }

  return JSON.parse(body) as ApiEnvelope<T>;
}

export function createUniqueStudentIdentity(
  prefix = "member",
): E2eStudentIdentity {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = `99${BigInt(`0x${suffix}`).toString()}`;
  const ipPartOne = suffix.slice(0, 4);
  const ipPartTwo = suffix.slice(4, 8);

  return {
    displayName: `E2E ${prefix}`,
    email: `${studentNumber}@stu.yasar.edu.tr`,
    requestIp: `2001:db8:${ipPartOne}:${ipPartTwo}::1`,
    username: `e2e_${suffix}`,
  };
}

async function requestCode(
  page: Page,
  identity: E2eStudentIdentity,
  purpose: "registration" | "login",
) {
  const response = await page.request.post("/v1/auth/code/request", {
    data: {
      email: identity.email,
      purpose,
    },
    headers: authHeaders(identity.requestIp),
  });
  const payload = await readSuccessfulResponse<{
    challengeId: string;
  }>(response, `Requesting a ${purpose} OTP`);

  return payload.data.challengeId;
}

async function verifyCode(
  page: Page,
  identity: E2eStudentIdentity,
  challengeId: string,
  purpose: "registration" | "login",
) {
  const code = await waitForOtpEmail(identity.email, purpose);
  const response = await page.request.post("/v1/auth/code/verify", {
    data: {
      challengeId,
      code,
      purpose,
    },
    headers: authHeaders(identity.requestIp),
  });

  return readSuccessfulResponse<
    | SessionState
    | {
        registrationToken: string;
        registrationExpiresAt: string;
      }
  >(response, `Verifying a ${purpose} OTP`);
}

export async function getSessionState(page: Page) {
  const response = await page.request.get("/v1/session", {
    headers: authHeaders("2001:db8::1"),
  });
  const payload = await readSuccessfulResponse<SessionState>(
    response,
    "Reading the current session",
  );

  return payload.data;
}

export async function logoutSession(
  page: Page,
  requestIp = "2001:db8::1",
) {
  const response = await page.request.post("/v1/auth/logout", {
    headers: authHeaders(requestIp),
  });

  if (response.status() !== 204) {
    throw new Error(
      `Logging out failed with status ${response.status()}: ${await response.text()}`,
    );
  }
}

export async function seedMemberSession(
  page: Page,
  identity = createUniqueStudentIdentity(),
) {
  const challengeId = await requestCode(
    page,
    identity,
    "registration",
  );
  const verification = await verifyCode(
    page,
    identity,
    challengeId,
    "registration",
  );

  if (!("registrationToken" in verification.data)) {
    throw new Error(
      "Registration OTP verification did not return a registration token.",
    );
  }

  const response = await page.request.post("/v1/auth/register", {
    data: {
      registrationToken: verification.data.registrationToken,
      username: identity.username,
      displayName: identity.displayName,
      department: "Yazılım Mühendisliği",
      yearLabel: "2. sınıf",
      bio: "Playwright tarafından oluşturulan test hesabı.",
      showDepartment: true,
      termsAccepted: true,
    },
    headers: authHeaders(identity.requestIp),
  });
  const registration = await readSuccessfulResponse<SessionState>(
    response,
    "Registering an E2E member",
  );

  if (registration.data.mode !== "member") {
    throw new Error("Registration did not create a member session.");
  }

  const cookie = (await page.context().cookies()).find(
    (item) => item.name === SESSION_COOKIE_NAME,
  );

  if (
    !cookie ||
    !cookie.httpOnly ||
    cookie.sameSite !== "Lax" ||
    cookie.expires < Date.now() / 1_000 + THIRTY_DAYS_IN_SECONDS - 120
  ) {
    throw new Error(
      "Registration did not create the expected persistent HttpOnly session cookie.",
    );
  }

  return identity;
}
