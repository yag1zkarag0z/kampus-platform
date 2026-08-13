import { describe, expect, it } from "vitest";

import {
  checkRuntimeConfiguration,
  validateRuntimeConfiguration,
} from "./runtime-configuration";

const localEnvironment = {
  DATABASE_URL: "postgresql://kampus:secret@127.0.0.1:5432/kampus",
  AUTH_SECRET: "local-runtime-configuration-secret-value",
  APP_ORIGIN: "http://localhost:3000",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  EMAIL_FROM: "KAMPUS <no-reply@kampus.local>",
  NODE_ENV: "development",
} as const;

describe("runtime configuration", () => {
  it("accepts the explicit local development fallbacks", () => {
    expect(validateRuntimeConfiguration(localEnvironment)).toMatchObject({
      auth: { APP_ORIGIN: "http://localhost:3000" },
      server: { DATABASE_URL: localEnvironment.DATABASE_URL },
    });
    expect(checkRuntimeConfiguration(localEnvironment)).toBe("up");
  });

  it("reports an invalid configuration without leaking its cause", () => {
    expect(
      checkRuntimeConfiguration({
        ...localEnvironment,
        DATABASE_URL: "not-a-database-url",
      }),
    ).toBe("down");
  });
});
