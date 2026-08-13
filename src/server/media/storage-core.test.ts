import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { createMediaStorage } from "./storage-core";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local media storage", () => {
  it("rejects local storage in production", () => {
    expect(() =>
      createMediaStorage({
        MEDIA_STORAGE_DRIVER: "local",
        NODE_ENV: "production",
      }),
    ).toThrow();
  });

  it("lists managed object metadata without returning temporary files", async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), "kampus-storage-"),
    );
    temporaryDirectories.push(workingDirectory);
    const storage = createMediaStorage(
      {
        MEDIA_STORAGE_DRIVER: "local",
        MEDIA_LOCAL_DIRECTORY: "test-media",
      },
      { workingDirectory },
    );
    const userId = randomUUID();
    const assetId = randomUUID();
    const key = `images/${userId}/${assetId}.webp`;
    const body = Buffer.from("managed-object");

    await storage.put(key, body, "image/webp");

    const unmanagedDirectory = join(
      workingDirectory,
      ".data",
      "test-media",
      "images",
      userId,
    );
    await mkdir(unmanagedDirectory, { recursive: true });
    await writeFile(join(unmanagedDirectory, "interrupted.tmp"), "stale");

    const objects = [];
    for await (const object of storage.list()) objects.push(object);

    expect(objects).toHaveLength(1);
    expect(objects[0]).toMatchObject({
      key,
      sizeBytes: body.length,
      lastModified: expect.any(Date),
    });
    await expect(storage.get(key)).resolves.toMatchObject({ body });

    await storage.delete(key);
    await expect(storage.get(key)).resolves.toBeNull();
  });

  it("rejects keys outside the managed image/document namespace", async () => {
    const workingDirectory = await mkdtemp(
      join(tmpdir(), "kampus-storage-"),
    );
    temporaryDirectories.push(workingDirectory);
    const storage = createMediaStorage(
      {
        MEDIA_STORAGE_DRIVER: "local",
        MEDIA_LOCAL_DIRECTORY: "test-media",
      },
      { workingDirectory },
    );

    await expect(
      storage.put("../outside.webp", Buffer.from("x"), "image/webp"),
    ).rejects.toThrow("Invalid media storage key");
    await expect(storage.delete("images/not-a-uuid/file.webp")).rejects.toThrow(
      "Invalid media storage key",
    );
  });
});
