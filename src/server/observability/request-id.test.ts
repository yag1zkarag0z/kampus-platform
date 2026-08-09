import { describe, expect, it } from "vitest";

import {
  createRequestId,
  normalizeRequestId,
  requestIdFromHeaders,
} from "./request-id";

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe("request ids", () => {
  it("creates RFC 4122 version 4 ids", () => {
    expect(createRequestId()).toMatch(REQUEST_ID_PATTERN);
  });

  it("accepts only normalized version 4 ids", () => {
    const requestId = createRequestId();

    expect(normalizeRequestId(` ${requestId.toUpperCase()} `)).toBe(
      requestId,
    );
    expect(normalizeRequestId("attacker-controlled-value")).toBeNull();
    expect(normalizeRequestId(null)).toBeNull();
  });

  it("reads a valid id from headers", () => {
    const requestId = createRequestId();

    expect(
      requestIdFromHeaders(new Headers({ "X-Request-ID": requestId })),
    ).toBe(requestId);
  });
});
