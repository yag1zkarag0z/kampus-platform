import { describe, expect, it } from "vitest";

import {
  getAuthEnvironment,
  getAuthCoreEnvironment,
  getServerEnvironment,
  InvalidAuthEnvironmentError,
  InvalidServerEnvironmentError,
} from "./env";

describe("getServerEnvironment", () => {
  it.each([
    "postgresql://kampus:secret@127.0.0.1:5432/kampus",
    "postgres://kampus:secret@localhost:5432/kampus",
  ])("accepts a PostgreSQL URL", (databaseUrl) => {
    expect(
      getServerEnvironment({
        DATABASE_URL: databaseUrl,
      }),
    ).toEqual({ DATABASE_URL: databaseUrl });
  });

  it.each([undefined, "", "https://example.com/database", "not-a-url"])(
    "rejects missing or unsupported database URLs",
    (databaseUrl) => {
      expect(() =>
        getServerEnvironment({
          DATABASE_URL: databaseUrl,
        }),
      ).toThrow(InvalidServerEnvironmentError);
    },
  );

  it("does not expose the invalid value in its error message", () => {
    const secret = "postgresql://user:super-secret@example.com";

    expect(() =>
      getServerEnvironment({ DATABASE_URL: secret }),
    ).not.toThrow();

    try {
      getServerEnvironment({ DATABASE_URL: `https://${secret}` });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidServerEnvironmentError);
      expect((error as Error).message).not.toContain("super-secret");
    }
  });
});

describe("getAuthEnvironment", () => {
  const validEnvironment = {
    AUTH_SECRET: "a".repeat(48),
    APP_ORIGIN: "http://localhost:3000",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1025",
    SMTP_SECURE: "false",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    EMAIL_FROM: "KAMPUS <no-reply@kampus.local>",
  };

  it("parses local SMTP and authentication settings", () => {
    expect(getAuthEnvironment(validEnvironment)).toMatchObject({
      AUTH_SECRET: "a".repeat(48),
      APP_ORIGIN: "http://localhost:3000",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: 1025,
      SMTP_SECURE: false,
      SMTP_USER: undefined,
      SMTP_PASSWORD: undefined,
    });
  });

  it.each([
    { ...validEnvironment, AUTH_SECRET: "too-short" },
    { ...validEnvironment, APP_ORIGIN: "not-a-url" },
    { ...validEnvironment, SMTP_PORT: "0" },
    {
      ...validEnvironment,
      SMTP_USER: "smtp-user",
      SMTP_PASSWORD: "",
    },
  ])("rejects an unsafe auth configuration", (environment) => {
    expect(() => getAuthEnvironment(environment)).toThrow(
      InvalidAuthEnvironmentError,
    );
  });

  it("does not expose a rejected secret", () => {
    const secret = "sensitive-but-too-short";

    try {
      getAuthEnvironment({
        ...validEnvironment,
        AUTH_SECRET: secret,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidAuthEnvironmentError);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("parses session authentication without SMTP settings", () => {
    expect(
      getAuthCoreEnvironment({
        AUTH_SECRET: validEnvironment.AUTH_SECRET,
        APP_ORIGIN: validEnvironment.APP_ORIGIN,
      }),
    ).toMatchObject({
      AUTH_SECRET: validEnvironment.AUTH_SECRET,
      APP_ORIGIN: validEnvironment.APP_ORIGIN,
      TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for",
    });
  });

  it("keeps SMTP settings mandatory for email authentication", () => {
    expect(() =>
      getAuthEnvironment({
        AUTH_SECRET: validEnvironment.AUTH_SECRET,
        APP_ORIGIN: validEnvironment.APP_ORIGIN,
      }),
    ).toThrow(InvalidAuthEnvironmentError);
  });

  it("requires an explicit trusted IP header and a random secret in production", () => {
    const productionEnvironment = {
      ...validEnvironment,
      APP_ORIGIN: "https://kampus.example",
      NODE_ENV: "production",
      SMTP_REQUIRE_TLS: "true",
    };

    expect(() => getAuthEnvironment(productionEnvironment)).toThrow(
      InvalidAuthEnvironmentError,
    );
    expect(() =>
      getAuthEnvironment({
        ...productionEnvironment,
        TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for",
      }),
    ).toThrow(InvalidAuthEnvironmentError);

    expect(() =>
      getAuthEnvironment({
        ...productionEnvironment,
        AUTH_SECRET: "C2Yd4aq0x8mUj7RfP1Lz5wBn9Hs3Kv6T",
        TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for",
      }),
    ).not.toThrow();
  });
});
