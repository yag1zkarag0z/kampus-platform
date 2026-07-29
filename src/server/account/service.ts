import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { reservedCampusUsernames } from "@/data/campusAccountRules";
import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import { userSettings, users } from "@/server/db/schema";

import {
  getCampusAcademicIssues,
  toCampusAcademicFieldErrors,
} from "./academic-validation";
import type {
  UpdateProfileInput,
  UpdateSettingsInput,
} from "./validation";

function findPostgresError(error: unknown) {
  let current = error;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return null;
    }

    const candidate = current as {
      cause?: unknown;
      code?: unknown;
      constraint?: unknown;
    };

    if (typeof candidate.code === "string") {
      return {
        code: candidate.code,
        constraint:
          typeof candidate.constraint === "string"
            ? candidate.constraint
            : undefined,
      };
    }

    current = candidate.cause;
  }

  return null;
}

function authenticationRequiredError() {
  return new AuthError(
    "AUTHENTICATION_REQUIRED",
    "Devam etmek için öğrenci hesabınla giriş yapmalısın.",
    { status: 401 },
  );
}

function userNotFoundError() {
  return new AuthError(
    "USER_NOT_FOUND",
    "Bu kullanıcı adıyla görüntülenebilecek bir profil bulunamadı.",
    { status: 404 },
  );
}

function usernameTakenError(message: string) {
  return new AuthError("USERNAME_TAKEN", message, {
    fieldErrors: {
      username: ["Farklı bir kullanıcı adı seç."],
    },
    status: 409,
  });
}

function invalidAcademicDetailsError(
  issues: ReturnType<typeof getCampusAcademicIssues>,
) {
  return new AuthError(
    "INVALID_REQUEST",
    "Bölüm ve sınıf bilgilerini kontrol edip yeniden dene.",
    {
      fieldErrors: toCampusAcademicFieldErrors(issues),
      status: 400,
    },
  );
}

function formatJoinedLabel(createdAt: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(createdAt);
}

export async function updateAccountProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const normalizedUsername = input.username?.trim().toLowerCase();

  if (
    normalizedUsername !== undefined &&
    reservedCampusUsernames.has(normalizedUsername)
  ) {
    throw usernameTakenError(
      "Bu kullanıcı adı KAMPÜS tarafından ayrılmış.",
    );
  }

  const values = {
    ...(normalizedUsername === undefined
      ? {}
      : { username: normalizedUsername }),
    ...(input.displayName === undefined
      ? {}
      : { displayName: input.displayName }),
    ...(input.department === undefined
      ? {}
      : { department: input.department }),
    ...(input.year === undefined ? {} : { yearLabel: input.year }),
    ...(input.bio === undefined ? {} : { bio: input.bio }),
  };

  try {
    await getDatabase().transaction(async (transaction) => {
      const [activeUser] = await transaction
        .select({
          department: users.department,
          id: users.id,
          year: users.yearLabel,
        })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.status, "active"),
            isNull(users.deletedAt),
          ),
        )
        .for("update")
        .limit(1);

      if (!activeUser) {
        throw authenticationRequiredError();
      }

      if (input.department !== undefined || input.year !== undefined) {
        const academicIssues = getCampusAcademicIssues({
          department: input.department ?? activeUser.department,
          year: input.year ?? activeUser.year,
        });

        if (academicIssues.length > 0) {
          throw invalidAcademicDetailsError(academicIssues);
        }
      }

      const [updatedUser] = await transaction
        .update(users)
        .set(values)
        .where(
          and(
            eq(users.id, userId),
            eq(users.status, "active"),
            isNull(users.deletedAt),
          ),
        )
        .returning({ id: users.id });

      if (!updatedUser) {
        throw authenticationRequiredError();
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    const postgresError = findPostgresError(error);

    if (
      postgresError?.code === "23505" &&
      postgresError.constraint === "users_username_unique"
    ) {
      throw usernameTakenError(
        "Bu kullanıcı adı başka biri tarafından kullanılıyor.",
      );
    }

    throw error;
  }
}

export async function updateAccountSettings(
  userId: string,
  input: UpdateSettingsInput,
) {
  await getDatabase().transaction(async (transaction) => {
    const [activeUser] = await transaction
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.status, "active"),
          isNull(users.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!activeUser) {
      throw authenticationRequiredError();
    }

    await transaction
      .insert(userSettings)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: input,
      });
  });
}

export async function getPublicAccountProfile(username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  if (
    !/^[a-z0-9]+(?:[._][a-z0-9]+)*$/.test(normalizedUsername) ||
    normalizedUsername.length < 3 ||
    normalizedUsername.length > 24
  ) {
    throw userNotFoundError();
  }

  const [profile] = await getDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      department: users.department,
      year: users.yearLabel,
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt,
      showDepartment: userSettings.showDepartment,
    })
    .from(users)
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(
      and(
        eq(users.username, normalizedUsername),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!profile) {
    throw userNotFoundError();
  }

  const showDepartment = profile.showDepartment ?? false;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    role: profile.role,
    joinedLabel: formatJoinedLabel(profile.createdAt),
    department: showDepartment ? profile.department : null,
    year: showDepartment ? profile.year : null,
  };
}
