import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.NODE_ENV === "production" &&
      value.MEDIA_STORAGE_DRIVER !== "s3"
    ) {
      context.addIssue({
        code: "custom",
        message: "Production media storage must use the S3 driver.",
        path: ["MEDIA_STORAGE_DRIVER"],
      });
    }

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

export type StoredObject = {
  body: Buffer;
  contentType: string;
};

export type StoredObjectMetadata = {
  key: string;
  lastModified: Date;
  sizeBytes: number;
};

export type MediaStorage = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
  list(): AsyncIterable<StoredObjectMetadata>;
};

const UUID_FRAGMENT =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const STORAGE_KEY_PATTERN = new RegExp(
  `^(?:images/${UUID_FRAGMENT}/${UUID_FRAGMENT}\\.webp|documents/${UUID_FRAGMENT}/${UUID_FRAGMENT}\\.pdf)$`,
  "iu",
);
const STORAGE_PREFIXES = ["images", "documents"] as const;

export function isManagedStorageKey(key: string) {
  return STORAGE_KEY_PATTERN.test(key);
}

function assertStorageKey(key: string) {
  if (!isManagedStorageKey(key)) {
    throw new Error("Invalid media storage key.");
  }
}

function contentTypeForKey(key: string) {
  return key.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "image/webp";
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function localStorage(
  environment: z.infer<typeof mediaEnvironmentSchema>,
  workingDirectory: string,
): MediaStorage {
  const root = resolve(
    workingDirectory,
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

  async function* walk(directory: string): AsyncIterable<StoredObjectMetadata> {
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }

    for (const entry of entries) {
      const target = resolve(directory, entry.name);

      if (entry.isDirectory()) {
        yield* walk(target);
        continue;
      }

      if (!entry.isFile()) continue;

      const key = relative(root, target).split(sep).join("/");

      // Temporary files and unrelated files are outside the managed keyspace.
      if (!isManagedStorageKey(key)) continue;

      try {
        const metadata = await stat(target);

        yield {
          key,
          lastModified: metadata.mtime,
          sizeBytes: metadata.size,
        };
      } catch (error) {
        // Listing races with deletion; the next reconciliation observes the
        // final state, so a disappeared file is safe to skip.
        if (!isMissingFileError(error)) throw error;
      }
    }
  }

  return {
    async put(key, body) {
      const target = objectPath(key);
      const temporaryTarget = `${target}.${randomUUID()}.tmp`;

      await mkdir(dirname(target), { recursive: true });

      try {
        await writeFile(temporaryTarget, body, { flag: "wx" });
        await rename(temporaryTarget, target);
      } finally {
        await rm(temporaryTarget, { force: true }).catch(() => undefined);
      }
    },
    async get(key) {
      try {
        return {
          body: await readFile(objectPath(key)),
          contentType: contentTypeForKey(key),
        };
      } catch (error) {
        if (isMissingFileError(error)) return null;
        throw error;
      }
    },
    async delete(key) {
      await rm(objectPath(key), { force: true });
    },
    async *list() {
      for (const prefix of STORAGE_PREFIXES) {
        yield* walk(resolve(root, prefix));
      }
    },
  };
}

function s3Storage(
  environment: z.infer<typeof mediaEnvironmentSchema>,
): MediaStorage {
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
          contentType: result.ContentType ?? contentTypeForKey(key),
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
    async *list() {
      for (const prefix of STORAGE_PREFIXES) {
        let continuationToken: string | undefined;

        do {
          const page = await client.send(
            new ListObjectsV2Command({
              Bucket: bucket,
              Prefix: `${prefix}/`,
              ContinuationToken: continuationToken,
            }),
          );

          for (const object of page.Contents ?? []) {
            if (
              !object.Key ||
              !object.LastModified ||
              !isManagedStorageKey(object.Key)
            ) {
              continue;
            }

            yield {
              key: object.Key,
              lastModified: object.LastModified,
              sizeBytes: object.Size ?? 0,
            };
          }

          continuationToken = page.IsTruncated
            ? page.NextContinuationToken
            : undefined;
        } while (continuationToken);
      }
    },
  };
}

export function createMediaStorage(
  source: Readonly<Record<string, string | undefined>> = process.env,
  { workingDirectory = process.cwd() }: { workingDirectory?: string } = {},
): MediaStorage {
  const environment = mediaEnvironmentSchema.parse(source);

  return environment.MEDIA_STORAGE_DRIVER === "s3"
    ? s3Storage(environment)
    : localStorage(environment, workingDirectory);
}
