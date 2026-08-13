import { describe, expect, it } from "vitest";

import { withPlatformEnvironmentDefaults } from "./platform-environment";

describe("platform environment defaults", () => {
  it("derives safe Railway web defaults", () => {
    expect(
      withPlatformEnvironmentDefaults({
        RAILWAY_PROJECT_ID: "project-id",
        RAILWAY_PUBLIC_DOMAIN: "kampus-production.up.railway.app",
        APP_ORIGIN: "http://localhost:3000",
      }),
    ).toMatchObject({
      APP_ORIGIN: "https://kampus-production.up.railway.app",
      TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for",
    });
  });

  it("does not replace an explicit non-loopback origin", () => {
    expect(
      withPlatformEnvironmentDefaults({
        RAILWAY_PUBLIC_DOMAIN: "preview.up.railway.app",
        APP_ORIGIN: "https://kampus.example",
      }).APP_ORIGIN,
    ).toBe("https://kampus.example");
  });

  it("accepts an alternate database URL or complete PG variables", () => {
    expect(
      withPlatformEnvironmentDefaults({
        DATABASE_PRIVATE_URL: "postgresql://private/database",
      }).DATABASE_URL,
    ).toBe("postgresql://private/database");

    expect(
      withPlatformEnvironmentDefaults({
        PGHOST: "postgres.railway.internal",
        PGPORT: "5432",
        PGUSER: "kampus user",
        PGPASSWORD: "secret/value",
        PGDATABASE: "railway",
      }).DATABASE_URL,
    ).toBe(
      "postgresql://kampus%20user:secret%2Fvalue@postgres.railway.internal:5432/railway",
    );
  });

  it("maps auto-injected Railway Bucket credentials to S3 settings", () => {
    expect(
      withPlatformEnvironmentDefaults({
        BUCKET: "kampus-media-abc123",
        ENDPOINT: "https://storage.railway.app",
        REGION: "auto",
        ACCESS_KEY_ID: "bucket-key",
        SECRET_ACCESS_KEY: "bucket-secret",
      }),
    ).toMatchObject({
      MEDIA_STORAGE_DRIVER: "s3",
      AWS_S3_BUCKET: "kampus-media-abc123",
      AWS_S3_ENDPOINT: "https://storage.railway.app",
      AWS_S3_REGION: "auto",
      AWS_S3_ACCESS_KEY_ID: "bucket-key",
      AWS_S3_SECRET_ACCESS_KEY: "bucket-secret",
    });
  });
});
