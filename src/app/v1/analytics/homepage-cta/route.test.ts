import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function createRequest(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(
    "http://localhost:3000/v1/analytics/homepage-cta",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /v1/analytics/homepage-cta", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET =
      "kampus-test-secret-that-is-at-least-32-characters";
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";
    process.env.SMTP_SECURE = "false";
    process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
  });

  it("accepts a privacy-minimal homepage CTA event", async () => {
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const response = await POST(
      createRequest({
        event: "homepage_cta_click",
        source: "hero_register",
        target: "register",
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      data: { accepted: true },
    });
    expect(consoleInfo).toHaveBeenCalledOnce();

    const loggedEvent = JSON.parse(
      String(consoleInfo.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(loggedEvent).toMatchObject({
      type: "analytics_event",
      name: "homepage_cta_click",
      source: "hero_register",
      target: "register",
    });
    expect(loggedEvent).not.toHaveProperty("ip");
    expect(loggedEvent).not.toHaveProperty("userAgent");
  });

  it("rejects unknown event values", async () => {
    const response = await POST(
      createRequest({
        event: "homepage_cta_click",
        source: "unknown",
        target: "register",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects cross-origin events", async () => {
    const response = await POST(
      createRequest(
        {
          event: "homepage_cta_click",
          source: "hero_guest",
          target: "guest",
        },
        "https://attacker.example",
      ),
    );

    expect(response.status).toBe(403);
  });
});
