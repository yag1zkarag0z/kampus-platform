import "server-only";

import { randomUUID } from "node:crypto";

import {
  and,
  count,
  desc,
  eq,
  gte,
  isNull,
  ne,
  sql,
} from "drizzle-orm";

import type { SessionState } from "@/auth/types";
import { reservedCampusUsernames } from "@/data/campusAccountRules";
import {
  recordAnalyticsEvent,
  recordDailyActiveUser,
} from "@/server/analytics/service";
import { getDatabase } from "@/server/db/client";
import {
  otpChallenges,
  termsAcceptances,
  userSettings,
  users,
} from "@/server/db/schema";

import {
  CURRENT_TERMS_VERSION,
  OTP_EMAIL_HOURLY_LIMIT,
  OTP_IP_HOURLY_LIMIT,
  OTP_LIFETIME_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  REGISTRATION_GRANT_LIFETIME_MS,
  type OtpPurpose,
} from "./constants";
import {
  createOtpCode,
  createRegistrationGrant,
  hashOtpCode,
  hashRequestIp,
  otpHashesMatch,
  verifyRegistrationGrant,
} from "./crypto";
import { AuthError } from "./errors";
import {
  smtpOtpMailer,
  type OtpMailer,
} from "./mailer";
import {
  createMemberSession,
  resolveSessionCookie,
  type CreatedMemberSession,
} from "./session";

type RequestCodeInput = {
  email: string;
  ipAddress: string;
  purpose: OtpPurpose;
};

type VerifyCodeInput = {
  challengeId: string;
  code: string;
  purpose: OtpPurpose;
};

type RegisterAccountInput = {
  bio: string;
  department: string;
  displayName: string;
  ipAddress: string;
  registrationToken: string;
  showDepartment: boolean;
  termsAccepted: true;
  username: string;
  yearLabel: string;
};

type RequestCodeDependencies = {
  mailer?: OtpMailer;
  now?: Date;
};

type AuthTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

type VerificationTransactionResult =
  | {
      kind: "error";
      error: AuthError;
    }
  | {
      kind: "registration";
      registrationToken: string;
      registrationExpiresAt: Date;
    }
  | {
      kind: "login";
      session: CreatedMemberSession;
      /** Yalnızca ölçüm için; fonksiyonun dışarıya döndürdüğü şekle girmiyor. */
      userId: string;
    };

type RegistrationTransactionResult =
  | {
      kind: "error";
      error: AuthError;
    }
  | {
      kind: "success";
      session: CreatedMemberSession;
      userId: string;
    };

function secondsUntil(timestamp: Date, now: Date) {
  return Math.max(
    1,
    Math.ceil((timestamp.getTime() - now.getTime()) / 1_000),
  );
}

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

async function lockTransaction(
  database: AuthTransaction,
  lockKey: string,
) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
  );
}

async function lockTransactionKeys(
  database: AuthTransaction,
  lockKeys: string[],
) {
  const orderedKeys = [...new Set(lockKeys)].sort();

  for (const lockKey of orderedKeys) {
    await lockTransaction(database, lockKey);
  }
}

function otpCutoverLockKey(email: string, purpose: string) {
  return `otp-cutover:${email}:${purpose}`;
}

async function finalizeOtpDelivery({
  challengeId,
  completedAt,
  outcome,
}: {
  challengeId: string;
  completedAt: Date;
  outcome: "delivered" | "failed";
}) {
  const database = getDatabase();

  await database.transaction(async (transaction) => {
    const [identity] = await transaction
      .select({
        email: otpChallenges.email,
        purpose: otpChallenges.purpose,
      })
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);

    if (!identity) {
      throw new Error("Reserved OTP challenge was not found.");
    }

    await lockTransaction(
      transaction,
      otpCutoverLockKey(identity.email, identity.purpose),
    );

    const [challenge] = await transaction
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);

    if (!challenge || challenge.deliveryStatus !== "pending") {
      return;
    }

    if (outcome === "failed") {
      await transaction
        .update(otpChallenges)
        .set({
          deliveryStatus: "failed",
          deliveryFailedAt: completedAt,
        })
        .where(
          and(
            eq(otpChallenges.id, challenge.id),
            eq(otpChallenges.deliveryStatus, "pending"),
          ),
        );
      return;
    }

    await transaction
      .update(otpChallenges)
      .set({
        deliveryStatus: "delivered",
        deliveredAt: completedAt,
      })
      .where(
        and(
          eq(otpChallenges.id, challenge.id),
          eq(otpChallenges.deliveryStatus, "pending"),
        ),
      );

    if (challenge.invalidatedAt) {
      return;
    }

    const [newerActiveChallenge] = await transaction
      .select({ id: otpChallenges.id })
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.email, challenge.email),
          eq(otpChallenges.purpose, challenge.purpose),
          eq(otpChallenges.deliveryStatus, "delivered"),
          isNull(otpChallenges.invalidatedAt),
          isNull(otpChallenges.consumedAt),
          ne(otpChallenges.id, challenge.id),
          sql`(${otpChallenges.createdAt}, ${otpChallenges.id})
            > (${challenge.createdAt}, ${challenge.id}::uuid)`,
        ),
      )
      .limit(1);

    if (newerActiveChallenge) {
      await transaction
        .update(otpChallenges)
        .set({ invalidatedAt: completedAt })
        .where(
          and(
            eq(otpChallenges.id, challenge.id),
            isNull(otpChallenges.invalidatedAt),
          ),
        );
      return;
    }

    await transaction
      .update(otpChallenges)
      .set({ invalidatedAt: completedAt })
      .where(
        and(
          eq(otpChallenges.email, challenge.email),
          eq(otpChallenges.purpose, challenge.purpose),
          eq(otpChallenges.deliveryStatus, "delivered"),
          ne(otpChallenges.id, challenge.id),
          isNull(otpChallenges.invalidatedAt),
          isNull(otpChallenges.consumedAt),
          sql`(${otpChallenges.createdAt}, ${otpChallenges.id})
            < (${challenge.createdAt}, ${challenge.id}::uuid)`,
        ),
      );
  });
}

export async function requestOtpCode(
  { email, ipAddress, purpose }: RequestCodeInput,
  {
    mailer = smtpOtpMailer,
    now,
  }: RequestCodeDependencies = {},
) {
  const database = getDatabase();
  const requestIpHash = hashRequestIp(ipAddress);
  const requestedAt = now ?? new Date();
  const oneHourAgo = new Date(
    requestedAt.getTime() - 60 * 60 * 1_000,
  );
  const reservation = await database.transaction(
    async (transaction) => {
      await lockTransactionKeys(transaction, [
        `otp-rate:email:${email}`,
        `otp-rate:ip:${requestIpHash}`,
      ]);

      const [latestChallenge] = await transaction
        .select({
          resendAvailableAt: otpChallenges.resendAvailableAt,
        })
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.email, email),
            eq(otpChallenges.purpose, purpose),
          ),
        )
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1);

      if (
        latestChallenge &&
        latestChallenge.resendAvailableAt.getTime() >
          requestedAt.getTime()
      ) {
        throw new AuthError(
          "OTP_COOLDOWN",
          "Yeni kod istemeden önce kısa bir süre beklemelisin.",
          {
            retryAfterSeconds: secondsUntil(
              latestChallenge.resendAvailableAt,
              requestedAt,
            ),
            status: 429,
          },
        );
      }

      const emailUsage = await transaction
        .select({ total: count() })
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.email, email),
            gte(otpChallenges.createdAt, oneHourAgo),
          ),
        );
      const ipUsage = await transaction
        .select({ total: count() })
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.requestIpHash, requestIpHash),
            gte(otpChallenges.createdAt, oneHourAgo),
          ),
        );

      if (
        (emailUsage[0]?.total ?? 0) >= OTP_EMAIL_HOURLY_LIMIT ||
        (ipUsage[0]?.total ?? 0) >= OTP_IP_HOURLY_LIMIT
      ) {
        throw new AuthError(
          "OTP_RATE_LIMITED",
          "Çok fazla kod istendi. Bir süre sonra yeniden deneyebilirsin.",
          {
            retryAfterSeconds: 60 * 60,
            status: 429,
          },
        );
      }

      const challengeId = randomUUID();
      const code = createOtpCode();
      const expiresAt = new Date(
        requestedAt.getTime() + OTP_LIFETIME_MS,
      );
      const resendAvailableAt = new Date(
        requestedAt.getTime() + OTP_RESEND_COOLDOWN_MS,
      );

      await transaction.insert(otpChallenges).values({
        id: challengeId,
        email,
        purpose,
        codeHash: hashOtpCode({
          challengeId,
          code,
          email,
          purpose,
        }),
        requestIpHash,
        deliveryStatus: "pending",
        createdAt: requestedAt,
        expiresAt,
        resendAvailableAt,
      });

      return {
        challengeId,
        code,
        expiresAt,
        resendAvailableAt,
      };
    },
  );

  try {
    await mailer.sendCode({
      code: reservation.code,
      email,
      purpose,
    });
  } catch {
    await finalizeOtpDelivery({
      challengeId: reservation.challengeId,
      completedAt: now ?? new Date(),
      outcome: "failed",
    });

    throw new AuthError(
      "EMAIL_DELIVERY_FAILED",
      "Doğrulama e-postası gönderilemedi. Lütfen yeniden dene.",
      { status: 503 },
    );
  }

  await finalizeOtpDelivery({
    challengeId: reservation.challengeId,
    completedAt: now ?? new Date(),
    outcome: "delivered",
  });

  return {
    challengeId: reservation.challengeId,
    expiresAt: reservation.expiresAt,
    resendAvailableAt: reservation.resendAvailableAt,
    attemptsLeft: OTP_MAX_ATTEMPTS,
  };
}

export async function verifyOtpCode(
  { challengeId, code, purpose }: VerifyCodeInput,
  now = new Date(),
) {
  const database = getDatabase();
  const transactionResult = await database.transaction(
    async (transaction): Promise<VerificationTransactionResult> => {
      const [identity] = await transaction
        .select({
          email: otpChallenges.email,
          purpose: otpChallenges.purpose,
        })
        .from(otpChallenges)
        .where(eq(otpChallenges.id, challengeId))
        .limit(1);

      if (!identity || identity.purpose !== purpose) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_NOT_FOUND",
            "Doğrulama isteği bulunamadı. Yeni bir kod isteyebilirsin.",
            { status: 404 },
          ),
        };
      }

      await lockTransaction(
        transaction,
        otpCutoverLockKey(identity.email, identity.purpose),
      );

      const [challenge] = await transaction
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.id, challengeId))
        .limit(1);

      if (!challenge || challenge.purpose !== purpose) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_NOT_FOUND",
            "Doğrulama isteği bulunamadı. Yeni bir kod isteyebilirsin.",
            { status: 404 },
          ),
        };
      }

      if (challenge.invalidatedAt || challenge.consumedAt) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_USED",
            "Bu doğrulama kodu artık kullanılamaz. Yeni bir kod iste.",
          ),
        };
      }

      if (challenge.verifiedAt) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_USED",
            "Bu doğrulama kodu daha önce kullanıldı.",
          ),
        };
      }

      if (challenge.deliveryStatus !== "delivered") {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_NOT_READY",
            "Doğrulama kodu teslim edilmedi. Yeni bir kod isteyebilirsin.",
            { status: 409 },
          ),
        };
      }

      if (challenge.expiresAt.getTime() <= now.getTime()) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_EXPIRED",
            "Bu doğrulama kodunun süresi doldu. Yeni bir kod isteyebilirsin.",
          ),
        };
      }

      if (challenge.attemptCount >= OTP_MAX_ATTEMPTS) {
        return {
          kind: "error",
          error: new AuthError(
            "OTP_LOCKED",
            "Deneme hakkın doldu. Yeni bir kod istemelisin.",
            { attemptsLeft: 0 },
          ),
        };
      }

      const candidateHash = hashOtpCode({
        challengeId,
        code,
        email: challenge.email,
        purpose,
      });

      if (!otpHashesMatch(candidateHash, challenge.codeHash)) {
        const nextAttemptCount = challenge.attemptCount + 1;
        const attemptsLeft = Math.max(
          0,
          OTP_MAX_ATTEMPTS - nextAttemptCount,
        );

        await transaction
          .update(otpChallenges)
          .set({ attemptCount: nextAttemptCount })
          .where(eq(otpChallenges.id, challenge.id));

        return {
          kind: "error",
          error:
            attemptsLeft === 0
              ? new AuthError(
                  "OTP_LOCKED",
                  "Deneme hakkın doldu. Yeni bir kod istemelisin.",
                  { attemptsLeft: 0 },
                )
              : new AuthError(
                  "OTP_INCORRECT",
                  `Kod eşleşmedi. ${attemptsLeft} deneme hakkın kaldı.`,
                  { attemptsLeft },
                ),
        };
      }

      if (purpose === "registration") {
        const grant = createRegistrationGrant({
          challengeId,
          email: challenge.email,
          now,
        });

        await transaction
          .update(otpChallenges)
          .set({ verifiedAt: now })
          .where(eq(otpChallenges.id, challenge.id));

        return {
          kind: "registration",
          registrationToken: grant.token,
          registrationExpiresAt: grant.expiresAt,
        };
      }

      const [user] = await transaction
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.email, challenge.email))
        .limit(1);

      if (!user) {
        await transaction
          .update(otpChallenges)
          .set({ verifiedAt: now, consumedAt: now })
          .where(eq(otpChallenges.id, challenge.id));

        return {
          kind: "error",
          error: new AuthError(
            "ACCOUNT_NOT_FOUND",
            "Bu e-posta ile oluşturulmuş bir hesap bulunamadı.",
            { status: 404 },
          ),
        };
      }

      if (user.status !== "active" || user.deletedAt) {
        await transaction
          .update(otpChallenges)
          .set({ verifiedAt: now, consumedAt: now })
          .where(eq(otpChallenges.id, challenge.id));

        return {
          kind: "error",
          error: new AuthError(
            "ACCOUNT_INACTIVE",
            "Bu hesap şu anda kullanılamıyor.",
            { status: 403 },
          ),
        };
      }

      const session = await createMemberSession(transaction, {
        userId: user.id,
        role: user.role,
        now,
      });

      await transaction
        .update(otpChallenges)
        .set({ verifiedAt: now, consumedAt: now })
        .where(eq(otpChallenges.id, challenge.id));

      return {
        kind: "login",
        session,
        userId: user.id,
      };
    },
  );

  if (transactionResult.kind === "error") {
    throw transactionResult.error;
  }

  if (transactionResult.kind === "registration") {
    return transactionResult;
  }

  // Ölçüm yazımı hata yutsa da tamamlanması beklenir; response döndükten sonra
  // yarım kalan bir Promise'e güvenilmez. Günlük aktiflik ayrı ve tekildir.
  await Promise.all([
    recordAnalyticsEvent("session_started", {
      userId: transactionResult.userId,
    }),
    recordDailyActiveUser(transactionResult.userId, now),
  ]);

  const resolvedSession = await resolveSessionCookie(
    transactionResult.session.cookieValue,
    now,
  );

  if (resolvedSession.state.mode !== "member") {
    throw new AuthError(
      "AUTH_CONFIGURATION_ERROR",
      "Oturum oluşturulamadı. Lütfen yeniden dene.",
      { status: 500 },
    );
  }

  return {
    kind: "login" as const,
    session: transactionResult.session,
    state: resolvedSession.state,
  };
}

export async function registerAccount(
  input: RegisterAccountInput,
  now = new Date(),
) {
  const grant = verifyRegistrationGrant(
    input.registrationToken,
    now,
  );

  if (!grant) {
    throw new AuthError(
      "INVALID_REGISTRATION_GRANT",
      "Kayıt doğrulamasının süresi dolmuş veya geçersiz. Yeni kod iste.",
    );
  }

  if (reservedCampusUsernames.has(input.username)) {
    throw new AuthError(
      "USERNAME_TAKEN",
      "Bu kullanıcı adı KAMPÜS tarafından ayrılmış.",
      {
        fieldErrors: { username: ["Bu kullanıcı adı kullanılamaz."] },
        status: 409,
      },
    );
  }

  const database = getDatabase();
  let registrationResult: RegistrationTransactionResult;

  try {
    registrationResult = await database.transaction(
      async (transaction): Promise<RegistrationTransactionResult> => {
      await lockTransaction(
        transaction,
        `registration:${grant.challengeId}`,
      );

      const [identity] = await transaction
        .select({
          email: otpChallenges.email,
          purpose: otpChallenges.purpose,
        })
        .from(otpChallenges)
        .where(eq(otpChallenges.id, grant.challengeId))
        .limit(1);

      if (identity) {
        await lockTransaction(
          transaction,
          otpCutoverLockKey(identity.email, identity.purpose),
        );
      }

      const [challenge] = await transaction
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.id, grant.challengeId))
        .limit(1);

      const registrationDeadline = challenge?.verifiedAt
        ? new Date(
            challenge.verifiedAt.getTime() +
              REGISTRATION_GRANT_LIFETIME_MS,
          )
        : null;
      const isChallengeValid =
        challenge?.purpose === "registration" &&
        challenge.email === grant.email &&
        challenge.deliveryStatus === "delivered" &&
        challenge.verifiedAt !== null &&
        challenge.invalidatedAt === null &&
        challenge.consumedAt === null &&
        registrationDeadline !== null &&
        registrationDeadline.getTime() > now.getTime();

      if (!isChallengeValid) {
        return {
          kind: "error",
          error: new AuthError(
            "INVALID_REGISTRATION_GRANT",
            "Kayıt doğrulamasının süresi dolmuş veya daha önce kullanılmış.",
          ),
        };
      }

      const emailOwner = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, grant.email))
        .limit(1);
      const usernameOwner = await transaction
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (emailOwner[0]) {
        return {
          kind: "error",
          error: new AuthError(
            "EMAIL_ALREADY_REGISTERED",
            "Bu öğrenci e-postasıyla daha önce hesap oluşturulmuş.",
            {
              fieldErrors: {
                email: ["Bu e-posta zaten kayıtlı."],
              },
              status: 409,
            },
          ),
        };
      }

      if (usernameOwner[0]) {
        return {
          kind: "error",
          error: new AuthError(
            "USERNAME_TAKEN",
            "Bu kullanıcı adı başka biri tarafından kullanılıyor.",
            {
              fieldErrors: {
                username: ["Farklı bir kullanıcı adı seç."],
              },
              status: 409,
            },
          ),
        };
      }

      const [user] = await transaction
        .insert(users)
        .values({
          email: grant.email,
          username: input.username,
          displayName: input.displayName || input.username,
          department: input.department,
          yearLabel: input.yearLabel,
          bio: input.bio,
          role: "member",
          status: "active",
          createdAt: now,
        })
        .returning({
          id: users.id,
          role: users.role,
        });

      if (!user) {
        throw new Error("User insert returned no record.");
      }

      await transaction.insert(userSettings).values({
        userId: user.id,
        showDepartment: input.showDepartment,
      });
      await transaction.insert(termsAcceptances).values({
        userId: user.id,
        termsVersion: CURRENT_TERMS_VERSION,
        acceptedAt: now,
        ipHash: hashRequestIp(input.ipAddress),
      });
      await transaction
        .update(otpChallenges)
        .set({ consumedAt: now })
        .where(eq(otpChallenges.id, challenge.id));

      const session = await createMemberSession(transaction, {
        userId: user.id,
        role: user.role,
        now,
      });

      return {
        kind: "success",
        session,
        userId: user.id,
      };
      },
    );
  } catch (error) {
    const postgresError = findPostgresError(error);

    if (
      postgresError?.code === "23505" &&
      postgresError.constraint === "users_email_unique"
    ) {
      throw new AuthError(
        "EMAIL_ALREADY_REGISTERED",
        "Bu öğrenci e-postasıyla daha önce hesap oluşturulmuş.",
        {
          fieldErrors: {
            email: ["Bu e-posta zaten kayıtlı."],
          },
          status: 409,
        },
      );
    }

    if (
      postgresError?.code === "23505" &&
      postgresError.constraint === "users_username_unique"
    ) {
      throw new AuthError(
        "USERNAME_TAKEN",
        "Bu kullanıcı adı başka biri tarafından kullanılıyor.",
        {
          fieldErrors: {
            username: ["Farklı bir kullanıcı adı seç."],
          },
          status: 409,
        },
      );
    }

    throw error;
  }

  if (registrationResult.kind === "error") {
    throw registrationResult.error;
  }

  // Kayıt ayrıca oturum da başlatıyor. Günlük aktiflik aynı gün tekrar
  // yazılmaya çalışılsa bile veritabanında tekilleştirilir.
  await Promise.all([
    recordAnalyticsEvent("account_registered", {
      userId: registrationResult.userId,
    }),
    recordAnalyticsEvent("session_started", {
      userId: registrationResult.userId,
    }),
    recordDailyActiveUser(registrationResult.userId, now),
  ]);

  const resolvedSession = await resolveSessionCookie(
    registrationResult.session.cookieValue,
    now,
  );

  if (resolvedSession.state.mode !== "member") {
    throw new AuthError(
      "AUTH_CONFIGURATION_ERROR",
      "Kayıt tamamlandı ancak oturum başlatılamadı.",
      { status: 500 },
    );
  }

  return {
    session: registrationResult.session,
    state: resolvedSession.state satisfies SessionState,
  };
}
