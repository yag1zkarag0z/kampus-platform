import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthClientError,
  requestApiPayload,
  requestOtpCode,
  updateCurrentProfile,
  updateCurrentSettings,
} from "@/auth/client";

const fetchMock = vi.fn<typeof fetch>();

describe("auth client response validation", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a safe error when an error response has an unexpected shape", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "proxy error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      requestOtpCode("student@stu.yasar.edu.tr", "login"),
    ).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 500,
      message:
        "Sunucudan geçerli bir yanıt alınamadı. Lütfen yeniden dene.",
    } satisfies Partial<AuthClientError>);
  });

  it("rejects a successful response without the expected data envelope", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      requestOtpCode("student@stu.yasar.edu.tr", "login"),
    ).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 502,
    } satisfies Partial<AuthClientError>);
  });

  it("can preserve a valid response envelope with pagination metadata", async () => {
    const payload = {
      data: [{ id: "post-1" }],
      page: {
        nextCursor: "cursor-page-2",
        hasMore: true,
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      requestApiPayload<typeof payload>("/v1/posts"),
    ).resolves.toEqual(payload);
  });

  it("preserves valid structured API error details", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "OTP_INCORRECT",
            message: "Kod eşleşmedi.",
            fieldErrors: { code: ["Kod geçersiz."] },
            attemptsLeft: 2,
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      requestOtpCode("student@stu.yasar.edu.tr", "login"),
    ).rejects.toMatchObject({
      attemptsLeft: 2,
      code: "OTP_INCORRECT",
      fieldErrors: { code: ["Kod geçersiz."] },
      status: 400,
    } satisfies Partial<AuthClientError>);
  });

  it("sends only editable profile fields to the profile endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            mode: "signed-out",
            expiresAt: null,
            user: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const input = {
      username: "kampuslu35",
      displayName: "Kampüslü",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "Merhaba",
    };

    await updateCurrentProfile(input);

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/me/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
        credentials: "same-origin",
      }),
    );
  });

  it("patches only the changed account settings", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            mode: "signed-out",
            expiresAt: null,
            user: null,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await updateCurrentSettings({ notifyLikes: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/me/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ notifyLikes: false }),
        credentials: "same-origin",
      }),
    );
  });
});
