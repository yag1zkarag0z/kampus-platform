import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireActiveModerator } from "@/server/auth/authorization";
import { AuthError } from "@/server/auth/errors";
import { resolveReport } from "@/server/moderation/service";

import { POST } from "./route";

vi.mock("@/server/moderation/service", () => ({
  resolveReport: vi.fn(),
}));

vi.mock("@/server/auth/authorization", () => ({
  requireActiveModerator: vi.fn(),
}));

const appOrigin = "http://localhost:3000";
const moderatorId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const reportId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";
const mockedRequireActiveModerator = vi.mocked(requireActiveModerator);
const mockedResolveReport = vi.mocked(resolveReport);

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
  body: unknown = { resolution: "dismissed", note: "İhlal bulunamadı." },
  origin = appOrigin,
) {
  return new NextRequest(
    `${appOrigin}/v1/moderation/reports/${reportId}/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "kampus_session=m1.raw-token",
        Origin: origin,
      },
      body: JSON.stringify(body),
    },
  );
}

function context() {
  return { params: Promise.resolve({ id: reportId }) };
}

describe("POST /v1/moderation/reports/[id]/resolve", () => {
  beforeEach(() => {
    configureEnvironment();
    mockedRequireActiveModerator.mockReset().mockResolvedValue({
      cookieValue: "m1.raw-token",
      state: {} as never,
      userId: moderatorId,
    });
    mockedResolveReport.mockReset().mockResolvedValue(undefined);
  });

  it("resolves the report with the given resolution", async () => {
    const response = await POST(createRequest(), context());

    expect(mockedResolveReport).toHaveBeenCalledWith(
      moderatorId,
      reportId,
      "dismissed",
      "İhlal bulunamadı.",
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("forwards the decision note", async () => {
    await POST(
      createRequest({ resolution: "content_removed", note: "Kurallara aykırı." }),
      context(),
    );

    expect(mockedResolveReport).toHaveBeenCalledWith(
      moderatorId,
      reportId,
      "content_removed",
      "Kurallara aykırı.",
    );
  });

  it("requires an audit note for every resolution", async () => {
    const response = await POST(
      createRequest({ resolution: "content_removed" }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(mockedResolveReport).not.toHaveBeenCalled();
  });

  it("rejects malformed input and cross-origin requests", async () => {
    const malformed = await POST(
      createRequest({ resolution: "invalid" }),
      context(),
    );
    const crossOrigin = await POST(
      createRequest(undefined, "https://attacker.example"),
      context(),
    );

    expect(malformed.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(mockedResolveReport).not.toHaveBeenCalled();
  });

  it("rejects a non-moderator caller", async () => {
    mockedRequireActiveModerator.mockRejectedValueOnce(
      new AuthError("AUTHORIZATION_REQUIRED", "Bu işlem için yetkin yok.", {
        status: 403,
      }),
    );

    const response = await POST(createRequest(), context());

    expect(response.status).toBe(403);
    expect(mockedResolveReport).not.toHaveBeenCalled();
  });
});
