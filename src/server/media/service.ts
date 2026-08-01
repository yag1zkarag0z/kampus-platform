import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, count, eq, gte, isNull, notExists } from "drizzle-orm";
import sharp from "sharp";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  mediaAssets,
  postImages,
  posts,
  users,
} from "@/server/db/schema";

import { getMediaStorage } from "./storage";

const MAX_UPLOAD_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 20_000_000;
const HOURLY_UPLOAD_LIMIT = 20;
const UNATTACHED_UPLOAD_LIMIT = 5;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function invalidImageError(message: string) {
  return new AuthError("INVALID_REQUEST", message, {
    fieldErrors: { image: [message] },
    status: 400,
  });
}

function mediaNotFoundError() {
  return new AuthError(
    "MEDIA_NOT_FOUND",
    "Görsel bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

function assertMediaId(assetId: string) {
  if (!UUID_PATTERN.test(assetId)) throw mediaNotFoundError();
}

async function assertUploadAllowed(userId: string) {
  const database = getDatabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000);
  const [activeUser, hourlyUsage, unattachedUsage] = await Promise.all([
    database
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.status, "active"),
          isNull(users.deletedAt),
        ),
      )
      .limit(1),
    database
      .select({ total: count() })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerId, userId),
          gte(mediaAssets.createdAt, oneHourAgo),
        ),
      ),
    database
      .select({ total: count() })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.ownerId, userId),
          notExists(
            database
              .select({ assetId: postImages.assetId })
              .from(postImages)
              .where(eq(postImages.assetId, mediaAssets.id)),
          ),
        ),
      ),
  ]);

  if (!activeUser[0]) {
    throw new AuthError(
      "AUTHENTICATION_REQUIRED",
      "Görsel yüklemek için öğrenci hesabınla giriş yapmalısın.",
      { status: 401 },
    );
  }

  if (
    (hourlyUsage[0]?.total ?? 0) >= HOURLY_UPLOAD_LIMIT ||
    (unattachedUsage[0]?.total ?? 0) >= UNATTACHED_UPLOAD_LIMIT
  ) {
    throw new AuthError(
      "CONTENT_RATE_LIMITED",
      "Çok fazla görsel yükledin. Kullanmadığın görselleri kaldırıp yeniden dene.",
      { retryAfterSeconds: 60 * 60, status: 429 },
    );
  }
}

async function processImage(file: File) {
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    throw invalidImageError("İşlenmiş görsel en fazla 1 MB olabilir.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const pipeline = sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      });
    let result = await pipeline
      .clone()
      .webp({ effort: 4, quality: 80 })
      .toBuffer({ resolveWithObject: true });

    if (result.data.length > MAX_OUTPUT_BYTES) {
      result = await pipeline
        .clone()
        .webp({ effort: 5, quality: 65 })
        .toBuffer({ resolveWithObject: true });
    }

    const { height, width } = result.info;

    if (
      !width ||
      !height ||
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION ||
      result.data.length > MAX_OUTPUT_BYTES
    ) {
      throw invalidImageError("Görsel güvenli boyutlara indirilemedi.");
    }

    return { body: result.data, width, height };
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw invalidImageError("Dosya geçerli bir JPEG, PNG veya WebP görseli değil.");
  }
}

export async function uploadContentImage(userId: string, file: File) {
  await assertUploadAllowed(userId);
  const processed = await processImage(file);
  const assetId = randomUUID();
  const storageKey = `images/${userId}/${assetId}.webp`;
  const checksum = createHash("sha256")
    .update(processed.body)
    .digest("hex");
  const storage = getMediaStorage();

  await storage.put(storageKey, processed.body, "image/webp");

  try {
    await getDatabase().insert(mediaAssets).values({
      id: assetId,
      ownerId: userId,
      storageKey,
      mimeType: "image/webp",
      sizeBytes: processed.body.length,
      width: processed.width,
      height: processed.height,
      checksum,
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  return {
    id: assetId,
    src: `/v1/media/${assetId}`,
    width: processed.width,
    height: processed.height,
  };
}

export async function getVisibleContentImage(assetId: string) {
  assertMediaId(assetId);
  const [asset] = await getDatabase()
    .select({
      storageKey: mediaAssets.storageKey,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .innerJoin(postImages, eq(postImages.assetId, mediaAssets.id))
    .innerJoin(posts, eq(posts.id, postImages.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(mediaAssets.id, assetId),
        isNull(posts.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!asset) throw mediaNotFoundError();

  const stored = await getMediaStorage().get(asset.storageKey);

  if (!stored) throw mediaNotFoundError();
  return stored;
}

export async function deleteUnattachedContentImage(
  userId: string,
  assetId: string,
) {
  assertMediaId(assetId);
  const deleted = await getDatabase().transaction(async (transaction) => {
    const [asset] = await transaction
      .select({ storageKey: mediaAssets.storageKey })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, userId),
        ),
      )
      .for("update")
      .limit(1);

    if (!asset) return null;

    const [attached] = await transaction
      .select({ assetId: postImages.assetId })
      .from(postImages)
      .where(eq(postImages.assetId, assetId))
      .limit(1);

    if (attached) {
      throw new AuthError(
        "CONTENT_FORBIDDEN",
        "Gönderiye bağlı bir görsel ayrı olarak silinemez.",
        { status: 403 },
      );
    }

    await transaction
      .delete(mediaAssets)
      .where(eq(mediaAssets.id, assetId));

    return asset;
  });

  if (deleted) {
    await getMediaStorage().delete(deleted.storageKey);
  }
}
