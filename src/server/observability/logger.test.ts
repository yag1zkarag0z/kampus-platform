import { describe, expect, it } from "vitest";

import { createLogRecord, errorLogFields } from "./logger";

describe("structured logger", () => {
  it("creates stable JSON-safe records without undefined values", () => {
    const record = createLogRecord(
      "info",
      "test.completed",
      {
        requestId: "request-1",
        ignored: undefined,
        invalidNumber: Number.NaN,
      },
      new Date("2026-08-09T12:00:00.000Z"),
    );

    expect(record).toMatchObject({
      timestamp: "2026-08-09T12:00:00.000Z",
      level: "info",
      service: "kampus-web",
      event: "test.completed",
      requestId: "request-1",
    });
    expect(record).not.toHaveProperty("ignored");
    expect(record).not.toHaveProperty("invalidNumber");
    expect(() => JSON.stringify(record)).not.toThrow();
  });

  it("serializes errors without traversing arbitrary properties", () => {
    const fields = errorLogFields(new Error("Database unavailable"));

    expect(fields).toMatchObject({
      errorName: "Error",
      errorMessage: "Database unavailable",
    });
    expect(fields.errorStack).toContain("Database unavailable");
  });
});
