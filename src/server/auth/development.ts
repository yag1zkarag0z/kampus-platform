import "server-only";

import { eq } from "drizzle-orm";

import type { SessionState } from "@/auth/types";
import { getDatabase } from "@/server/db/client";
import { userSettings, users } from "@/server/db/schema";

import { createMemberSession, resolveSessionCookie } from "./session";

const DEVELOPMENT_ACCOUNT = {
  email: "999999999@stu.yasar.edu.tr",
  username: "yagizdev",
  displayName: "Yağız Test",
  department: "Yazılım Mühendisliği",
  yearLabel: "2. sınıf",
  bio: "KAMPÜS yerel geliştirme hesabı",
} as const;

export type DevelopmentLoginResult = {
  cookieValue: string;
  expiresAt: Date;
  state: SessionState;
};

export async function createDevelopmentLogin(): Promise<DevelopmentLoginResult> {
  const now = new Date();
  const session = await getDatabase().transaction(async (transaction) => {
    const [existingUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, DEVELOPMENT_ACCOUNT.email))
      .limit(1);

    let userId = existingUser?.id;

    if (userId) {
      await transaction
        .update(users)
        .set({
          username: DEVELOPMENT_ACCOUNT.username,
          displayName: DEVELOPMENT_ACCOUNT.displayName,
          department: DEVELOPMENT_ACCOUNT.department,
          yearLabel: DEVELOPMENT_ACCOUNT.yearLabel,
          bio: DEVELOPMENT_ACCOUNT.bio,
          role: "member",
          status: "active",
          suspendedAt: null,
          deletedAt: null,
        })
        .where(eq(users.id, userId));
    } else {
      const [createdUser] = await transaction
        .insert(users)
        .values({ ...DEVELOPMENT_ACCOUNT, role: "member", status: "active" })
        .returning({ id: users.id });

      if (!createdUser) throw new Error("Development account could not be created.");
      userId = createdUser.id;
    }

    await transaction
      .insert(userSettings)
      .values({ userId, showDepartment: true })
      .onConflictDoNothing({ target: userSettings.userId });

    return createMemberSession(transaction, {
      now,
      role: "member",
      userId,
    });
  });

  const resolved = await resolveSessionCookie(session.cookieValue, now);
  if (resolved.state.mode !== "member") {
    throw new Error("Development session could not be resolved.");
  }

  return {
    cookieValue: session.cookieValue,
    expiresAt: session.expiresAt,
    state: resolved.state,
  };
}
