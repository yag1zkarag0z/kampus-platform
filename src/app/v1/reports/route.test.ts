import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveMember } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { submitReport } from "@/server/moderation/service";

import { POST } from "./route";

vi.mock("@/server/moderation/service", () => ({
  submitReport: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveMember: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const targetId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveMember = vi.mocked(requireActiveMember);
const mockedSubmitReport = vi.mocked(submitReport);

function configureEnvironment() {
  process.env.AUTH_SECRET =
    "kampus-test-secret-that-is-at-least-32-characters";
  process.env.APP_ORIGIN = appOrigin;
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1025";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
}

function createRequest(
  body: unknown = { targetType: "post", targetId, reason: "spam" },
  origin = appOrigin,
) {
  return new NextRequest(`${appOrigin}/v1/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: "kampus_session=m1.raw-token",
      Origin: origin,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /v1/reports", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveMember.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: memberId,
    });
    mockedSubmitReport.mockReset().mockResolvedValue({ created: true });
  });

  it("submits a report for the target content", async () => {
    const response = await POST(createRequest());

    expect(mockedSubmitReport).toHaveBeenCalledWith(memberId, {
      targetType: "post",
      targetId,
      reason: "spam",
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      data: { created: true },
    });
  });

  it("returns the shared error envelope for a self-report attempt", async () => {
    mockedSubmitReport.mockRejectedValueOnce(
      new AuthError("INVALID_REQUEST", "Kendi içeriğini şikâyet edemezsin.", {
        status: 400,
      }),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(400);
  });

  it("rejects malformed input and cross-origin requests", async () => {
    const malformed = await POST(
      createRequest({ targetType: "post", targetId, reason: "invalid" }),
    );
    const crossOrigin = await POST(
      createRequest(undefined, "https://attacker.example"),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mockedSubmitReport).not.toHaveBeenCalled();
  });

  it("requires an active member session", async () => {
    mockedRequireActiveMember.mockRejectedValueOnce(
      new AuthError(
        "AUTHENTICATION_REQUIRED",
        "Devam etmek için giriş yapmalısın.",
        { status: 401 },
      ),
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect(mockedSubmitReport).not.toHaveBeenCalled();
  });
});
