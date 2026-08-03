import "server-only";

import { Buffer } from "node:buffer";

import { z } from "zod";

import { AuthError } from "@/server/auth/errors";
import { readQueryParams } from "@/server/auth/request";
import { parseAuthInput } from "@/server/auth/validation";

/**
 * Zaman sıralı listeler için ortak cursor. Gönderi akışının kendi cursor'ı
 * sıralama puanı da taşıdığı için ayrı duruyor; buradaki biçim
 * `(createdAt, id)` ikilisiyle çalışan bütün listeler için geçerli.
 *
 * `scope` cursor'ı üretildiği sorguya bağlar: farklı bir filtreyle ya da
 * başka bir listede kullanılmaya çalışılırsa reddedilir.
 */

const CURSOR_VERSION = 1;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type TimelineCursor = {
  createdAt: Date;
  id: string;
};

export function invalidCursorError() {
  return new AuthError("INVALID_REQUEST", "Sayfalama anahtarı geçersiz.", {
    fieldErrors: {
      cursor: ["Listeyi baştan yükleyip yeniden dene."],
    },
    status: 400,
  });
}

export function encodeTimelineCursor(
  scope: string,
  row: TimelineCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      version: CURSOR_VERSION,
      scope,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
    }),
    "utf8",
  ).toString("base64url");
}

export function decodeTimelineCursor(
  scope: string,
  value: string,
): TimelineCursor {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as unknown;

    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("version" in decoded) ||
      decoded.version !== CURSOR_VERSION ||
      !("scope" in decoded) ||
      decoded.scope !== scope ||
      !("createdAt" in decoded) ||
      typeof decoded.createdAt !== "string" ||
      !("id" in decoded) ||
      typeof decoded.id !== "string" ||
      !UUID_PATTERN.test(decoded.id)
    ) {
      throw invalidCursorError();
    }

    const createdAt = new Date(decoded.createdAt);

    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== decoded.createdAt
    ) {
      throw invalidCursorError();
    }

    return { createdAt, id: decoded.id };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw invalidCursorError();
  }
}

/**
 * `limit + 1` satır çekildiği varsayımıyla sayfayı böler; böylece fazladan
 * bir sayım sorgusu olmadan `hasMore` belirlenir.
 */
export function sliceCursorPage<TRow>(rows: TRow[], limit: number) {
  const hasMore = rows.length > limit;

  return {
    visibleRows: hasMore ? rows.slice(0, limit) : rows,
    hasMore,
  };
}

export function buildCursorPage<TRow extends TimelineCursor, TDto>(options: {
  rows: TRow[];
  limit: number;
  scope: string;
  toDto: (row: TRow) => TDto;
}) {
  const { visibleRows, hasMore } = sliceCursorPage(options.rows, options.limit);
  const lastVisibleRow = visibleRows.at(-1);

  return {
    data: visibleRows.map(options.toDto),
    page: {
      nextCursor:
        hasMore && lastVisibleRow
          ? encodeTimelineCursor(options.scope, lastVisibleRow)
          : null,
      hasMore,
    },
  };
}

/** Sadece cursor ve limit alan listeler için ortak sorgu ayrıştırması. */
export function parseTimelineQuery(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  return parseAuthInput(
    z
      .object({
        cursor: cursorFieldSchema.optional(),
        limit: limitFieldSchema(options),
      })
      .strict(),
    readQueryParams(searchParams),
  );
}

export const cursorFieldSchema = z
  .string({ error: "Sayfalama anahtarı geçersiz." })
  .trim()
  .min(1, "Sayfalama anahtarı boş olamaz.")
  .max(512, "Sayfalama anahtarı çok uzun.")
  .regex(/^[A-Za-z0-9_-]+$/, "Sayfalama anahtarı geçersiz.");

export function limitFieldSchema({
  defaultLimit = 20,
  maxLimit = 50,
}: { defaultLimit?: number; maxLimit?: number } = {}) {
  return z.coerce
    .number({ error: "Limit bir sayı olmalıdır." })
    .int("Limit tam sayı olmalıdır.")
    .min(1, "Limit en az 1 olmalıdır.")
    .max(maxLimit, `Limit en fazla ${maxLimit} olabilir.`)
    .default(defaultLimit);
}
