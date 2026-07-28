import { describe, expect, it } from "vitest";

import {
  getServerEnvironment,
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
