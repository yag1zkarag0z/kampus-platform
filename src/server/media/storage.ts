import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const booleanValue = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
}, z.boolean());

const mediaEnvironmentSchema = z
  .object({
    MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    MEDIA_LOCAL_DIRECTORY: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]*$/iu)
      .default("media"),
    AWS_REGION: z.string().trim().min(1).optional(),
    AWS_S3_BUCKET: z.string().trim().min(3).optional(),
    AWS_S3_ENDPOINT: z.url().optional(),
    AWS_S3_FORCE_PATH_STYLE: booleanValue.default(false),
  })
  .superRefine((value, context) => {
    if (value.MEDIA_STORAGE_DRIVER !== "s3") return;

    if (!value.AWS_REGION) {
      context.addIssue({
        code: "custom",
        message: "AWS_REGION is required for S3 media storage.",
        path: ["AWS_REGION"],
      });
    }

    if (!value.AWS_S3_BUCKET) {
      context.addIssue({
        code: "custom",
        message: "AWS_S3_BUCKET is required for S3 media storage.",
        path: ["AWS_S3_BUCKET"],
      });
    }
  });

type StoredObject = {
  body: Buffer;
  contentType: string;
};

export type MediaStorage = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
};

const UUID_FRAGMENT =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STORAGE_KEY_PATTERN = new RegExp(
  `^images/${UUID_FRAGMENT}/${UUID_FRAGMENT}\\.webp$`,
  "iu",
);

function assertStorageKey(key: string) {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error("Invalid media storage key.");
  }
}

function localStorage(): MediaStorage {
  const environment = mediaEnvironmentSchema.parse(process.env);
  const root = resolve(
    process.cwd(),
    ".data",
    environment.MEDIA_LOCAL_DIRECTORY,
  );

  function objectPath(key: string) {
    assertStorageKey(key);
    const target = resolve(root, key);
    const pathFromRoot = relative(root, target);

    if (
      pathFromRoot.startsWith(`..${sep}`) ||
      pathFromRoot === ".." ||
      isAbsolute(pathFromRoot)
    ) {
      throw new Error("Media path escaped the configured storage root.");
    }

    return target;
  }

  return {
    async put(key, body) {
      const target = objectPath(key);
      const temporaryTarget = `${target}.${randomUUID()}.tmp`;

      await mkdir(dirname(target), { recursive: true });
      await writeFile(temporaryTarget, body, { flag: "wx" });
      await rename(temporaryTarget, target);
    },
    async get(key) {
      try {
        return {
          body: await readFile(objectPath(key)),
          contentType: "image/webp",
        };
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return null;
        }
        throw error;
      }
    },
    async delete(key) {
      await rm(objectPath(key), { force: true });
    },
  };
}

function s3Storage(): MediaStorage {
  const environment = mediaEnvironmentSchema.parse(process.env);
  const client = new S3Client({
    region: environment.AWS_REGION!,
    endpoint: environment.AWS_S3_ENDPOINT,
    forcePathStyle: environment.AWS_S3_FORCE_PATH_STYLE,
  });
  const bucket = environment.AWS_S3_BUCKET!;

  return {
    async put(key, body, contentType) {
      assertStorageKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=3600",
        }),
      );
    },
    async get(key) {
      assertStorageKey(key);

      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );

        if (!result.Body) return null;

        return {
          body: Buffer.from(await result.Body.transformToByteArray()),
          contentType: result.ContentType ?? "image/webp",
        };
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "NoSuchKey" || error.name === "NotFound")
        ) {
          return null;
        }
        throw error;
      }
    },
    async delete(key) {
      assertStorageKey(key);
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    },
  };
}

const globalForMediaStorage = globalThis as typeof globalThis & {
  __kampusMediaStorage?: MediaStorage;
};

export function getMediaStorage() {
  if (globalForMediaStorage.__kampusMediaStorage) {
    return globalForMediaStorage.__kampusMediaStorage;
  }

  const environment = mediaEnvironmentSchema.parse(process.env);
  const storage =
    environment.MEDIA_STORAGE_DRIVER === "s3"
      ? s3Storage()
      : localStorage();

  globalForMediaStorage.__kampusMediaStorage = storage;
  return storage;
}
