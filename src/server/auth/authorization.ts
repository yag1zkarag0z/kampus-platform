import "server-only";

import type { NextRequest } from "next/server";

import type { SessionState } from "@/auth/types";

import {
  RECENT_AUTHENTICATION_WINDOW_MS,
  SESSION_COOKIE_NAME,
} from "./constants";
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
): Promise<{
  authenticatedAt: Date | null;
  state: MemberSessionState;
}> {
  const resolved = await resolveSessionCookie(cookieValue);

  if (resolved.state.mode !== "member") {
    throw authenticationRequiredError();
  }

  return {
    authenticatedAt: resolved.authenticatedAt ?? null,
    state: resolved.state,
  };
}

export async function requireActiveMember(request: NextRequest) {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!cookieValue) {
    throw authenticationRequiredError();
  }

  const resolved = await resolveActiveMemberCookie(cookieValue);

  return {
    ...(resolved.authenticatedAt
      ? { authenticatedAt: resolved.authenticatedAt }
      : {}),
    cookieValue,
    state: resolved.state,
    userId: resolved.state.user.id,
  };
}

export async function refreshActiveMemberSession(cookieValue: string) {
  return (await resolveActiveMemberCookie(cookieValue)).state;
}

export async function requireRecentActiveMember(
  request: NextRequest,
  now = new Date(),
) {
  const member = await requireActiveMember(request);
  const authenticatedAt = member.authenticatedAt;

  if (
    !authenticatedAt ||
    now.getTime() - authenticatedAt.getTime() >
      RECENT_AUTHENTICATION_WINDOW_MS
  ) {
    throw new AuthError(
      "RECENT_AUTHENTICATION_REQUIRED",
      "Güvenliğin için çıkış yapıp yeniden giriş yaptıktan sonra hesabını silebilirsin.",
      { status: 403 },
    );
  }

  return member;
}

export async function requireRecentActiveAdmin(
  request: NextRequest,
  now = new Date(),
) {
  const admin = await requireActiveAdmin(request);
  const authenticatedAt = admin.authenticatedAt;

  if (
    !authenticatedAt ||
    now.getTime() - authenticatedAt.getTime() >
      RECENT_AUTHENTICATION_WINDOW_MS
  ) {
    throw new AuthError(
      "RECENT_AUTHENTICATION_REQUIRED",
      "Rol değiştirmek için çıkış yapıp yeniden giriş yapmalısın.",
      { status: 403 },
    );
  }

  return admin;
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
