import "server-only";

import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  type AvatarPresetId,
} from "@/avatar/presets";
import { renderAvatarPresetSvg } from "@/avatar/render";
import { reservedCampusUsernames } from "@/data/campusAccountRules";
import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  otpChallenges,
  productFeedback,
  sessions,
  userSettings,
  users,
} from "@/server/db/schema";
import {
  processImage,
  processTrustedAvatarSvg,
} from "@/server/media/service";
import { getMediaStorage } from "@/server/media/storage";
import { logEvent } from "@/server/observability/logger";
import {
  consumeRateLimit,
  consumeRateLimitForUser,
} from "@/server/rate-limit/service";
import { viewerIsNotBlockedBy } from "@/server/social/blocking";

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

function avatarNotFoundError() {
  return new AuthError(
    "AVATAR_NOT_FOUND",
    "Profil fotoğrafı bulunamadı veya artık görüntülenemiyor.",
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

function tombstoneEmail() {
  return `${Date.now()}${randomInt(100_000, 999_999)}@stu.yasar.edu.tr`;
}

function tombstoneUsername() {
  return `silinmis.${randomBytes(6).toString("hex")}`;
}

function avatarUrlFor(
  username: string,
  avatarObjectKey: string | null,
) {
  return avatarObjectKey ? `/v1/users/${username}/avatar` : null;
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
          username: users.username,
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

      if (
        normalizedUsername !== undefined &&
        normalizedUsername !== activeUser.username
      ) {
        await consumeRateLimit(transaction, userId, "username_change");
      } else {
        await consumeRateLimit(transaction, userId, "profile_update");
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

    await consumeRateLimit(transaction, userId, "profile_update");

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
      avatarObjectKey: users.avatarObjectKey,
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
    avatarUrl: avatarUrlFor(profile.username, profile.avatarObjectKey),
    joinedLabel: formatJoinedLabel(profile.createdAt),
    department: showDepartment ? profile.department : null,
    year: showDepartment ? profile.year : null,
  };
}

export async function deleteAccount(userId: string, now = new Date()) {
  const database = getDatabase();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let previousAvatarObjectKey: string | null = null;

    try {
      await database.transaction(async (transaction) => {
        const [activeUser] = await transaction
          .select({
            id: users.id,
            avatarObjectKey: users.avatarObjectKey,
            email: users.email,
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

        await consumeRateLimit(transaction, userId, "account_update", now);

        previousAvatarObjectKey = activeUser.avatarObjectKey;

        // Geri bildirim metni ürün geliştirme kaydı olarak kalır; hesapla olan
        // bağlantı silme anında koparılır ve gönderici anonimleşir.
        await transaction
          .update(productFeedback)
          .set({ userId: null, updatedAt: now })
          .where(eq(productFeedback.userId, userId));

        // Aynı e-postaya ait henüz kullanılmamış kodlar hesap silindikten
        // sonra yeni veya yeniden açılmış bir hesaba taşınmamalı.
        await transaction
          .update(otpChallenges)
          .set({ invalidatedAt: now })
          .where(
            and(
              eq(otpChallenges.email, activeUser.email),
              isNull(otpChallenges.invalidatedAt),
              isNull(otpChallenges.consumedAt),
            ),
          );

        await transaction
          .update(users)
          .set({
            email: tombstoneEmail(),
            username: tombstoneUsername(),
            displayName: "Silinmiş kullanıcı",
            department: "Belirtilmedi",
            yearLabel: "Belirtilmedi",
            bio: "",
            avatarObjectKey: null,
            deletedAt: now,
          })
          .where(eq(users.id, userId));

        await transaction
          .update(sessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(sessions.userId, userId),
              isNull(sessions.revokedAt),
            ),
          );
      });

      if (previousAvatarObjectKey) {
        try {
          await getMediaStorage().delete(previousAvatarObjectKey);
        } catch (error) {
          // Veritabanındaki anonimleştirme ve oturum iptali kesin sonuçtur.
          // Storage hatası kullanıcıya sahte bir "silinemedi" cevabı vermemeli;
          // reconciliation worker orphan objeyi daha sonra temizler.
          logEvent("warn", "account.avatar_cleanup_deferred", {
            errorMessage:
              error instanceof Error ? error.message : "unknown",
          });
        }
      }

      return;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      const postgresError = findPostgresError(error);
      const isTombstoneCollision =
        postgresError?.code === "23505" &&
        (postgresError.constraint === "users_email_unique" ||
          postgresError.constraint === "users_username_unique");

      if (!isTombstoneCollision || attempt === 2) {
        throw error;
      }
    }
  }
}

async function replaceAccountAvatar(userId: string, body: Buffer) {
  const storageKey = `images/${userId}/${randomUUID()}.webp`;
  const storage = getMediaStorage();

  await storage.put(storageKey, body, "image/webp");

  let previousAvatarObjectKey: string | null = null;

  try {
    await getDatabase().transaction(async (transaction) => {
      const [activeUser] = await transaction
        .select({ avatarObjectKey: users.avatarObjectKey })
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

      previousAvatarObjectKey = activeUser.avatarObjectKey;

      await transaction
        .update(users)
        .set({ avatarObjectKey: storageKey })
        .where(eq(users.id, userId));
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  if (previousAvatarObjectKey) {
    await storage.delete(previousAvatarObjectKey);
  }
}

export async function uploadAccountAvatar(userId: string, file: File) {
  // İşleme/depolama maliyetine girmeden önce kontrol edilir: moderasyon
  // yakalamadan önce uygunsuz bir görseli kısaca gösterip hemen değiştirmeyi
  // zorlaştırır.
  await consumeRateLimitForUser(userId, "avatar_upload");
  const processed = await processImage(file);
  await replaceAccountAvatar(userId, processed.body);
}

export async function setAccountAvatarPreset(
  userId: string,
  presetId: AvatarPresetId,
) {
  await consumeRateLimitForUser(userId, "avatar_preset");
  const processed = await processTrustedAvatarSvg(
    renderAvatarPresetSvg(presetId),
  );
  await replaceAccountAvatar(userId, processed.body);
}

export async function removeAccountAvatar(userId: string) {
  const previousAvatarObjectKey = await getDatabase().transaction(
    async (transaction) => {
      const [activeUser] = await transaction
        .select({ avatarObjectKey: users.avatarObjectKey })
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

      if (!activeUser.avatarObjectKey) {
        return null;
      }

      await consumeRateLimit(transaction, userId, "profile_update");

      await transaction
        .update(users)
        .set({ avatarObjectKey: null })
        .where(eq(users.id, userId));

      return activeUser.avatarObjectKey;
    },
  );

  if (previousAvatarObjectKey) {
    await getMediaStorage().delete(previousAvatarObjectKey);
  }
}

export async function getAccountAvatar(viewerId: string, username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  const [user] = await getDatabase()
    .select({ avatarObjectKey: users.avatarObjectKey })
    .from(users)
    .where(
      and(
        eq(users.username, normalizedUsername),
        eq(users.status, "active"),
        isNull(users.deletedAt),
        viewerIsNotBlockedBy(viewerId, users.id),
      ),
    )
    .limit(1);

  if (!user?.avatarObjectKey) {
    throw avatarNotFoundError();
  }

  const stored = await getMediaStorage().get(user.avatarObjectKey);

  if (!stored) {
    throw avatarNotFoundError();
  }

  return stored;
}
