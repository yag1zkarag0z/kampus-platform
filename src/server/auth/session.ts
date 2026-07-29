import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import type {
  AuthenticatedUser,
  AuthRole,
  SessionState,
} from "@/auth/types";
import { getDatabase } from "@/server/db/client";
import {
  sessions,
  userSettings,
  users,
} from "@/server/db/schema";

import {
  MEMBER_SESSION_LIFETIME_MS,
  PRIVILEGED_SESSION_LIFETIME_MS,
} from "./constants";
import {
  createOpaqueSessionToken,
  hashSessionToken,
  verifyGuestToken,
} from "./crypto";

type Database = ReturnType<typeof getDatabase>;
type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type AuthDatabase = Database | DatabaseTransaction;

export type CreatedMemberSession = {
  cookieValue: string;
  expiresAt: Date;
  rawToken: string;
};

export type ResolvedSession = {
  shouldClearCookie: boolean;
  state: SessionState;
};

const signedOutState: SessionState = {
  mode: "signed-out",
  expiresAt: null,
  user: null,
};

function sessionLifetimeForRole(role: AuthRole) {
  return role === "member"
    ? MEMBER_SESSION_LIFETIME_MS
    : PRIVILEGED_SESSION_LIFETIME_MS;
}

export async function createMemberSession(
  database: AuthDatabase,
  {
    now,
    role,
    userId,
  }: {
    now: Date;
    role: AuthRole;
    userId: string;
  },
): Promise<CreatedMemberSession> {
  const expiresAt = new Date(
    now.getTime() + sessionLifetimeForRole(role),
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rawToken = createOpaqueSessionToken();
    const tokenHash = hashSessionToken(rawToken);

    try {
      await database.insert(sessions).values({
        userId,
        tokenHash,
        issuedRole: role,
        createdAt: now,
        expiresAt,
      });

      return {
        cookieValue: `m1.${rawToken}`,
        expiresAt,
        rawToken,
      };
    } catch (error) {
      const isUniqueCollision =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505";

      if (!isUniqueCollision || attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error("Unable to allocate a unique session token.");
}

function toAuthenticatedUser(
  row: {
    userId: string;
    username: string;
    displayName: string;
    department: string;
    yearLabel: string;
    bio: string;
    role: AuthRole;
    createdAt: Date;
    avatarObjectKey: string | null;
    showDepartment: boolean | null;
    notifyReplies: boolean | null;
    notifyLikes: boolean | null;
    notifyAnnouncements: boolean | null;
    emailNotifications: boolean | null;
  },
): AuthenticatedUser {
  return {
    id: row.userId,
    role: row.role,
    profile: {
      username: row.username,
      displayName: row.displayName,
      department: row.department,
      year: row.yearLabel,
      bio: row.bio,
      joinedLabel: new Intl.DateTimeFormat("tr-TR", {
        month: "long",
        year: "numeric",
      }).format(row.createdAt),
    },
    settings: {
      showDepartment: row.showDepartment ?? false,
      notifyReplies: row.notifyReplies ?? true,
      notifyLikes: row.notifyLikes ?? true,
      notifyAnnouncements: row.notifyAnnouncements ?? true,
      emailNotifications: row.emailNotifications ?? true,
    },
  };
}

export async function resolveSessionCookie(
  cookieValue: string | undefined,
  now = new Date(),
): Promise<ResolvedSession> {
  if (!cookieValue) {
    return {
      shouldClearCookie: false,
      state: signedOutState,
    };
  }

  if (cookieValue.startsWith("g1.")) {
    const guestPayload = verifyGuestToken(cookieValue.slice(3), now);

    if (!guestPayload) {
      return {
        shouldClearCookie: true,
        state: signedOutState,
      };
    }

    return {
      shouldClearCookie: false,
      state: {
        mode: "guest",
        expiresAt: new Date(guestPayload.exp).toISOString(),
        user: null,
      },
    };
  }

  if (!cookieValue.startsWith("m1.")) {
    return {
      shouldClearCookie: true,
      state: signedOutState,
    };
  }

  const rawToken = cookieValue.slice(3);

  if (!rawToken) {
    return {
      shouldClearCookie: true,
      state: signedOutState,
    };
  }

  const database = getDatabase();
  const tokenHash = hashSessionToken(rawToken);
  const rows = await database
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      issuedRole: sessions.issuedRole,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      department: users.department,
      yearLabel: users.yearLabel,
      bio: users.bio,
      avatarObjectKey: users.avatarObjectKey,
      role: users.role,
      status: users.status,
      deletedAt: users.deletedAt,
      createdAt: users.createdAt,
      showDepartment: userSettings.showDepartment,
      notifyReplies: userSettings.notifyReplies,
      notifyLikes: userSettings.notifyLikes,
      notifyAnnouncements: userSettings.notifyAnnouncements,
      emailNotifications: userSettings.emailNotifications,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  const row = rows[0];

  if (!row) {
    return {
      shouldClearCookie: true,
      state: signedOutState,
    };
  }

  const isValid =
    row.revokedAt === null &&
    row.expiresAt.getTime() > now.getTime() &&
    row.status === "active" &&
    row.deletedAt === null &&
    row.role === row.issuedRole;

  if (!isValid) {
    if (row.revokedAt === null) {
      await database
        .update(sessions)
        .set({ revokedAt: now })
        .where(
          and(
            eq(sessions.id, row.sessionId),
            isNull(sessions.revokedAt),
          ),
        );
    }

    return {
      shouldClearCookie: true,
      state: signedOutState,
    };
  }

  return {
    shouldClearCookie: false,
    state: {
      mode: "member",
      expiresAt: row.expiresAt.toISOString(),
      user: toAuthenticatedUser(row),
    },
  };
}

export async function revokeMemberSession(
  cookieValue: string | undefined,
  now = new Date(),
) {
  if (!cookieValue?.startsWith("m1.")) {
    return;
  }

  const rawToken = cookieValue.slice(3);

  if (!rawToken) {
    return;
  }

  await getDatabase()
    .update(sessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(rawToken)),
        isNull(sessions.revokedAt),
      ),
    );
}
