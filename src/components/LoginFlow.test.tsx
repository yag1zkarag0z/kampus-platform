import {
  act,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestOtpCode,
  startGuestSession,
  verifyOtpCode,
} from "@/auth/client";
import LoginFlow from "@/components/LoginFlow";

const loginMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: loginMocks.push }),
}));

vi.mock("@/auth/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/auth/client")>(
      "@/auth/client",
    );

  return {
    ...actual,
    requestOtpCode: vi.fn(),
    verifyOtpCode: vi.fn(),
    startGuestSession: vi.fn(),
  };
});

const mockedRequestOtpCode = vi.mocked(requestOtpCode);
const mockedVerifyOtpCode = vi.mocked(verifyOtpCode);
const mockedStartGuestSession = vi.mocked(startGuestSession);

describe("LoginFlow", () => {
  beforeEach(() => {
    mockedRequestOtpCode.mockReset().mockResolvedValue({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      attemptsLeft: 3,
    });
    mockedVerifyOtpCode.mockReset().mockResolvedValue({
      mode: "member",
      expiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
      user: {
        id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
        role: "member",
        profile: {
          username: "student",
          displayName: "Student",
          department: "Yazılım Mühendisliği",
          year: "2. sınıf",
          bio: "",
          joinedLabel: "Temmuz 2026",
        },
        settings: {
          showDepartment: false,
          notifyReplies: true,
          notifyLikes: true,
          notifyAnnouncements: true,
          emailNotifications: true,
        },
      },
    });
    mockedStartGuestSession.mockReset().mockResolvedValue({
      mode: "guest",
      expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
      user: null,
    });
    loginMocks.push.mockReset();
    window.history.replaceState({}, "", "/giris");
  });

  it("rejects an email outside the Yaşar student domain", async () => {
    const user = userEvent.setup();
    render(<LoginFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "student@example.com",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Giriş kodu gönder",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "@stu.yasar.edu.tr",
    );
    expect(mockedRequestOtpCode).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Giriş kodu")).not.toBeInTheDocument();
  });

  it("completes the real API verification flow", async () => {
    const user = userEvent.setup();
    render(<LoginFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "student@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", { name: "Giriş kodu gönder" }),
    );
    await user.type(screen.getByLabelText("Giriş kodu"), "482951");
    await user.click(
      screen.getByRole("button", { name: "Giriş yap" }),
    );

    expect(mockedVerifyOtpCode).toHaveBeenCalledWith({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      code: "482951",
      purpose: "login",
    });
    expect(
      await screen.findByRole("heading", {
        name: "Giriş tamamlandı.",
      }),
    ).toBeInTheDocument();
  });

  it("starts a guest session and opens the feed", async () => {
    const user = userEvent.setup();
    render(<LoginFlow />);

    await user.click(
      screen.getByRole("button", {
        name: "Misafir olarak göz at",
      }),
    );

    expect(mockedStartGuestSession).toHaveBeenCalledOnce();
    expect(loginMocks.push).toHaveBeenCalledWith("/akis");
  });

  it("prevents duplicate guest-session requests while one is pending", async () => {
    let resolveGuestSession:
      | ((session: Awaited<ReturnType<typeof startGuestSession>>) => void)
      | undefined;
    mockedStartGuestSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGuestSession = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<LoginFlow />);

    const guestButton = screen.getByRole("button", {
      name: "Misafir olarak göz at",
    });
    await user.click(guestButton);

    expect(
      screen.getByRole("button", {
        name: "Misafir görünümü açılıyor…",
      }),
    ).toBeDisabled();
    expect(mockedStartGuestSession).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole("button", {
        name: "Misafir görünümü açılıyor…",
      }),
    );
    expect(mockedStartGuestSession).toHaveBeenCalledOnce();

    await act(async () => {
      resolveGuestSession?.({
        mode: "guest",
        expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
        user: null,
      });
    });
    await waitFor(() => {
      expect(loginMocks.push).toHaveBeenCalledWith("/akis");
    });
  });

  it("allows server verification when only the client countdown looks expired", async () => {
    mockedRequestOtpCode.mockResolvedValueOnce({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      resendAvailableAt: new Date(Date.now() - 1_000).toISOString(),
      attemptsLeft: 3,
    });
    const user = userEvent.setup();
    render(<LoginFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "student@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", { name: "Giriş kodu gönder" }),
    );

    const codeInput = await screen.findByLabelText("Giriş kodu");
    expect(codeInput).toBeEnabled();
    await user.type(codeInput, "482951");
    await user.click(
      screen.getByRole("button", { name: "Giriş yap" }),
    );

    expect(mockedVerifyOtpCode).toHaveBeenCalledOnce();
  });
});
