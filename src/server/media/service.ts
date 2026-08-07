import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, count, eq, gte, isNull, notExists } from "drizzle-orm";
import sharp from "sharp";

import { AuthError } from "@/server/auth/errors";
import { getDatabase } from "@/server/db/client";
import {
  documentAssets,
  mediaAssets,
  postDocuments,
  postImages,
  posts,
  users,
} from "@/server/db/schema";

import { getMediaStorage } from "./storage";

const MAX_UPLOAD_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 20_000_000;
const MAX_DOCUMENT_UPLOAD_BYTES = 8 * 1024 * 1024;
const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "ascii");
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

function invalidDocumentError(message: string) {
  return new AuthError("INVALID_REQUEST", message, {
    fieldErrors: { document: [message] },
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

function documentNotFoundError() {
  return new AuthError(
    "MEDIA_NOT_FOUND",
    "Doküman bulunamadı veya artık görüntülenemiyor.",
    { status: 404 },
  );
}

/** Yol ayraçlarını ve kontrol karakterlerini atar; .pdf uzantısını garantiler. */
function sanitizeDocumentFileName(rawName: string) {
  const base = rawName.split(/[/\\]/u).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f\x7f]/gu, "").trim();
  const withExtension = cleaned.toLocaleLowerCase("tr-TR").endsWith(".pdf")
    ? cleaned
    : `${cleaned || "belge"}.pdf`;

  return withExtension.slice(0, 160);
}

function assertMediaId(assetId: string) {
  if (!UUID_PATTERN.test(assetId)) throw mediaNotFoundError();
}

/**
 * Görsel ve doküman yüklemeleri aynı saatlik/asılı-kalan kotayı paylaşır;
 * ayrı sayaçlar olsaydı kullanıcı iki dosya türünü karıştırarak toplam
 * kotayı ikiye katlayabilirdi.
 */
async function assertUploadAllowed(userId: string) {
  const database = getDatabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1_000);
  const [
    activeUser,
    hourlyImageUsage,
    hourlyDocumentUsage,
    unattachedImageUsage,
    unattachedDocumentUsage,
  ] = await Promise.all([
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
      .from(documentAssets)
      .where(
        and(
          eq(documentAssets.ownerId, userId),
          gte(documentAssets.createdAt, oneHourAgo),
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
    database
      .select({ total: count() })
      .from(documentAssets)
      .where(
        and(
          eq(documentAssets.ownerId, userId),
          notExists(
            database
              .select({ assetId: postDocuments.assetId })
              .from(postDocuments)
              .where(eq(postDocuments.assetId, documentAssets.id)),
          ),
        ),
      ),
  ]);

  if (!activeUser[0]) {
    throw new AuthError(
      "AUTHENTICATION_REQUIRED",
      "Dosya yüklemek için öğrenci hesabınla giriş yapmalısın.",
      { status: 401 },
    );
  }

  const hourlyTotal =
    (hourlyImageUsage[0]?.total ?? 0) + (hourlyDocumentUsage[0]?.total ?? 0);
  const unattachedTotal =
    (unattachedImageUsage[0]?.total ?? 0) +
    (unattachedDocumentUsage[0]?.total ?? 0);

  if (
    hourlyTotal >= HOURLY_UPLOAD_LIMIT ||
    unattachedTotal >= UNATTACHED_UPLOAD_LIMIT
  ) {
    throw new AuthError(
      "CONTENT_RATE_LIMITED",
      "Çok fazla dosya yükledin. Kullanmadıklarını kaldırıp yeniden dene.",
      { retryAfterSeconds: 60 * 60, status: 429 },
    );
  }
}

export async function processImage(file: File) {
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

/**
 * Görsel işlem hattının aksine burada yeniden kodlama yok: PDF'i sunucuda
 * ayrıştırmak (önizleme/rasterize için) bir render kütüphanesi çalıştırmak
 * anlamına gelir ve bu gerçek bir RCE yüzeyi olurdu. v1'de dosya yalnızca
 * imza baytından (magic number) doğrulanıp olduğu gibi saklanıyor.
 */
export async function processDocument(file: File) {
  if (file.size < 1 || file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw invalidDocumentError("Doküman en fazla 8 MB olabilir.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  if (!input.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    throw invalidDocumentError("Dosya geçerli bir PDF değil.");
  }

  return { body: input, fileName: sanitizeDocumentFileName(file.name) };
}

export async function uploadContentDocument(userId: string, file: File) {
  await assertUploadAllowed(userId);
  const processed = await processDocument(file);
  const assetId = randomUUID();
  const storageKey = `documents/${userId}/${assetId}.pdf`;
  const checksum = createHash("sha256")
    .update(processed.body)
    .digest("hex");
  const storage = getMediaStorage();

  await storage.put(storageKey, processed.body, "application/pdf");

  try {
    await getDatabase().insert(documentAssets).values({
      id: assetId,
      ownerId: userId,
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: processed.body.length,
      fileName: processed.fileName,
      checksum,
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }

  return {
    id: assetId,
    name: processed.fileName,
    sizeBytes: processed.body.length,
    src: `/v1/media/documents/${assetId}`,
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

export async function getVisibleContentDocument(assetId: string) {
  assertMediaId(assetId);
  const [asset] = await getDatabase()
    .select({
      storageKey: documentAssets.storageKey,
      mimeType: documentAssets.mimeType,
      fileName: documentAssets.fileName,
    })
    .from(documentAssets)
    .innerJoin(postDocuments, eq(postDocuments.assetId, documentAssets.id))
    .innerJoin(posts, eq(posts.id, postDocuments.postId))
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        eq(documentAssets.id, assetId),
        isNull(posts.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (!asset) throw documentNotFoundError();

  const stored = await getMediaStorage().get(asset.storageKey);

  if (!stored) throw documentNotFoundError();
  return { ...stored, fileName: asset.fileName };
}

export async function deleteUnattachedContentDocument(
  userId: string,
  assetId: string,
) {
  assertMediaId(assetId);
  const deleted = await getDatabase().transaction(async (transaction) => {
    const [asset] = await transaction
      .select({ storageKey: documentAssets.storageKey })
      .from(documentAssets)
      .where(
        and(
          eq(documentAssets.id, assetId),
          eq(documentAssets.ownerId, userId),
        ),
      )
      .for("update")
      .limit(1);

    if (!asset) return null;

    const [attached] = await transaction
      .select({ assetId: postDocuments.assetId })
      .from(postDocuments)
      .where(eq(postDocuments.assetId, assetId))
      .limit(1);

    if (attached) {
      throw new AuthError(
        "CONTENT_FORBIDDEN",
        "Gönderiye bağlı bir doküman ayrı olarak silinemez.",
        { status: 403 },
      );
    }

    await transaction
      .delete(documentAssets)
      .where(eq(documentAssets.id, assetId));

    return asset;
  });

  if (deleted) {
    await getMediaStorage().delete(deleted.storageKey);
  }
}
