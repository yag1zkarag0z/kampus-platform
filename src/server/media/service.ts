import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, count, eq, gte, isNull, notExists, sql } from "drizzle-orm";
import sharp from "sharp";

import {
  DOCUMENT_UPLOAD_MAX_BYTES,
  IMAGE_UPLOAD_MAX_BYTES,
} from "@/lib/upload-limits";
import { AuthError } from "@/server/auth/errors";
import { postVisibleToViewer } from "@/server/content/visibility";
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

const MAX_OUTPUT_BYTES = IMAGE_UPLOAD_MAX_BYTES;
const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 20_000_000;
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
type MediaDatabase = ReturnType<typeof getDatabase>;
type MediaTransaction = Parameters<
  Parameters<MediaDatabase["transaction"]>[0]
>[0];

async function assertUploadAllowed(
  transaction: MediaTransaction,
  userId: string,
  now: Date,
) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1_000);
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
    .for("share")
    .limit(1);

  if (!activeUser) {
    throw new AuthError(
      "AUTHENTICATION_REQUIRED",
      "Dosya yüklemek için öğrenci hesabınla giriş yapmalısın.",
      { status: 401 },
    );
  }

  const [hourlyImageUsage] = await transaction
    .select({ total: count() })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.ownerId, userId),
        gte(mediaAssets.createdAt, oneHourAgo),
      ),
    );
  const [hourlyDocumentUsage] = await transaction
    .select({ total: count() })
    .from(documentAssets)
    .where(
      and(
        eq(documentAssets.ownerId, userId),
        gte(documentAssets.createdAt, oneHourAgo),
      ),
    );
  const [unattachedImageUsage] = await transaction
    .select({ total: count() })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.ownerId, userId),
        notExists(
          transaction
            .select({ assetId: postImages.assetId })
            .from(postImages)
            .where(eq(postImages.assetId, mediaAssets.id)),
        ),
      ),
    );
  const [unattachedDocumentUsage] = await transaction
    .select({ total: count() })
    .from(documentAssets)
    .where(
      and(
        eq(documentAssets.ownerId, userId),
        notExists(
          transaction
            .select({ assetId: postDocuments.assetId })
            .from(postDocuments)
            .where(eq(postDocuments.assetId, documentAssets.id)),
        ),
      ),
    );

  const hourlyTotal =
    (hourlyImageUsage?.total ?? 0) + (hourlyDocumentUsage?.total ?? 0);
  const unattachedTotal =
    (unattachedImageUsage?.total ?? 0) +
    (unattachedDocumentUsage?.total ?? 0);

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

async function reserveUpload(
  userId: string,
  createdAt: Date,
  insertReservation: (transaction: MediaTransaction) => Promise<void>,
) {
  await getDatabase().transaction(async (transaction) => {
    // Images and documents share one quota. The per-user transaction lock
    // serializes the final count-and-insert step across all application nodes.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(
        hashtextextended(${`media-upload:${userId}`}, 0)
      )`,
    );
    await assertUploadAllowed(transaction, userId, createdAt);
    await insertReservation(transaction);
  });
}

export async function processImage(file: File) {
  if (file.size < 1 || file.size > IMAGE_UPLOAD_MAX_BYTES) {
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

/** Only accepts SVG generated from the application's fixed avatar presets. */
export async function processTrustedAvatarSvg(svg: string) {
  const result = await sharp(Buffer.from(svg), {
    density: 144,
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .resize(512, 512, { fit: "cover" })
    .webp({ effort: 4, quality: 84 })
    .toBuffer({ resolveWithObject: true });

  if (
    result.info.width !== 512 ||
    result.info.height !== 512 ||
    result.data.length > MAX_OUTPUT_BYTES
  ) {
    throw invalidImageError("Hazır avatar güvenli boyutlara dönüştürülemedi.");
  }

  return { body: result.data, width: 512, height: 512 };
}

export async function uploadContentImage(userId: string, file: File) {
  const processed = await processImage(file);
  const assetId = randomUUID();
  const storageKey = `images/${userId}/${assetId}.webp`;
  const createdAt = new Date();
  const checksum = createHash("sha256")
    .update(processed.body)
    .digest("hex");
  const storage = getMediaStorage();

  await reserveUpload(userId, createdAt, async (transaction) => {
    await transaction.insert(mediaAssets).values({
      id: assetId,
      ownerId: userId,
      storageKey,
      mimeType: "image/webp",
      sizeBytes: processed.body.length,
      width: processed.width,
      height: processed.height,
      checksum,
      createdAt,
    });
  });

  try {
    await storage.put(storageKey, processed.body, "image/webp");
  } catch (error) {
    await getDatabase()
      .delete(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, assetId),
          eq(mediaAssets.ownerId, userId),
        ),
      )
      .catch(() => undefined);
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
  if (file.size < 1 || file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    throw invalidDocumentError("Doküman en fazla 8 MB olabilir.");
  }

  const input = Buffer.from(await file.arrayBuffer());

  if (!input.subarray(0, PDF_MAGIC_BYTES.length).equals(PDF_MAGIC_BYTES)) {
    throw invalidDocumentError("Dosya geçerli bir PDF değil.");
  }

  return { body: input, fileName: sanitizeDocumentFileName(file.name) };
}

export async function uploadContentDocument(userId: string, file: File) {
  const processed = await processDocument(file);
  const assetId = randomUUID();
  const storageKey = `documents/${userId}/${assetId}.pdf`;
  const createdAt = new Date();
  const checksum = createHash("sha256")
    .update(processed.body)
    .digest("hex");
  const storage = getMediaStorage();

  await reserveUpload(userId, createdAt, async (transaction) => {
    await transaction.insert(documentAssets).values({
      id: assetId,
      ownerId: userId,
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: processed.body.length,
      fileName: processed.fileName,
      checksum,
      createdAt,
    });
  });

  try {
    await storage.put(storageKey, processed.body, "application/pdf");
  } catch (error) {
    await getDatabase()
      .delete(documentAssets)
      .where(
        and(
          eq(documentAssets.id, assetId),
          eq(documentAssets.ownerId, userId),
        ),
      )
      .catch(() => undefined);
    throw error;
  }

  return {
    id: assetId,
    name: processed.fileName,
    sizeBytes: processed.body.length,
    src: `/v1/media/documents/${assetId}`,
  };
}

export async function getVisibleContentImage(
  viewerId: string,
  assetId: string,
) {
  assertMediaId(assetId);
  const [asset] = await getDatabase()
    .select({
      storageKey: mediaAssets.storageKey,
      mimeType: mediaAssets.mimeType,
    })
    .from(mediaAssets)
    .innerJoin(postImages, eq(postImages.assetId, mediaAssets.id))
    .innerJoin(posts, eq(posts.id, postImages.postId))
    .where(
      and(
        eq(mediaAssets.id, assetId),
        postVisibleToViewer(viewerId),
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

export async function getVisibleContentDocument(
  viewerId: string,
  assetId: string,
) {
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
    .where(
      and(
        eq(documentAssets.id, assetId),
        postVisibleToViewer(viewerId),
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
