import "server-only";

import type { NextRequest } from "next/server";

import type { SessionState } from "@/auth/types";

import { SESSION_COOKIE_NAME } from "./constants";
import { AuthError } from "./errors";
import { resolveSessionCookie } from "./session";

type MemberSessionState = Extract<SessionState, { mode: "member" }>;

function authenticationRequiredError() {
  return new AuthError(
    "AUTHENTICATION_REQUIRED",
    "Devam etmek için öğrenci hesabınla giriş yapmalısın.",
    { status: 401 },
  );
}

function authorizationRequiredError() {
  return new AuthError(
    "AUTHORIZATION_REQUIRED",
    "Bu işlem için yetkin yok.",
    { status: 403 },
  );
}

async function resolveActiveMemberCookie(
  cookieValue: string | undefined,
): Promise<MemberSessionState> {
  const resolved = await resolveSessionCookie(cookieValue);

  if (resolved.state.mode !== "member") {
    throw authenticationRequiredError();
  }

  return resolved.state;
}

export async function requireActiveMember(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieValue) {
    throw authenticationRequiredError();
  }

  const state = await resolveActiveMemberCookie(cookieValue);

  return {
    cookieValue,
    state,
    userId: state.user.id,
  };
}

export function refreshActiveMemberSession(cookieValue: string) {
  return resolveActiveMemberCookie(cookieValue);
}

export async function requireActiveModerator(request: NextRequest) {
  const member = await requireActiveMember(request);

  if (member.state.user.role === "member") {
    throw authorizationRequiredError();
  }

  return member;
}

export async function requireActiveAdmin(request: NextRequest) {
  const member = await requireActiveMember(request);

  if (member.state.user.role !== "admin") {
    throw authorizationRequiredError();
  }

  return member;
}
