import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthClientError,
  requestOtpCode,
  verifyOtpCode,
} from "@/auth/client";
import {
  formatVerificationTime,
  useVerificationCode,
  VerificationCodePanel,
} from "@/components/AuthVerificationCode";

vi.mock("@/auth/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/auth/client")>(
      "@/auth/client",
    );

  return {
    ...actual,
    requestOtpCode: vi.fn(),
    verifyOtpCode: vi.fn(),
  };
});

const mockedRequestOtpCode = vi.mocked(requestOtpCode);
const mockedVerifyOtpCode = vi.mocked(verifyOtpCode);

describe("verification time formatting", () => {
  it.each([
    [0, "0:00"],
    [65, "1:05"],
    [300, "5:00"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatVerificationTime(seconds)).toBe(expected);
  });

  it("keeps the changing countdown outside live announcements", () => {
    render(
      <VerificationCodePanel
        attemptsLeft={3}
        canResend={false}
        expiresInSeconds={299}
        inputId="verification-code"
        isExpired={false}
        isLocked={false}
        isResending={false}
        issueCount={1}
        resendInSeconds={29}
        onResend={vi.fn()}
      />,
    );

    expect(screen.getByText(/Kod etkin ·/)).toHaveAttribute(
      "aria-live",
      "off",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Doğrulama kodu e-postana gönderildi.",
    );
  });
});

describe("server-backed verification code", () => {
  beforeEach(() => {
    mockedRequestOtpCode.mockReset().mockResolvedValue({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      attemptsLeft: 3,
    });
    mockedVerifyOtpCode.mockReset().mockResolvedValue({
      mode: "signed-out",
      expiresAt: null,
      user: null,
    });
  });

  it("uses timing metadata returned by the server", async () => {
    const { result } = renderHook(() => useVerificationCode("login"));

    await act(async () => {
      await result.current.issueCode("student@stu.yasar.edu.tr");
    });

    expect(mockedRequestOtpCode).toHaveBeenCalledWith(
      "student@stu.yasar.edu.tr",
      "login",
    );
    expect(result.current.expiresInSeconds).toBeGreaterThanOrEqual(299);
    expect(result.current.resendInSeconds).toBeGreaterThanOrEqual(29);
    expect(result.current.attemptsLeft).toBe(3);
    expect(result.current.issueCount).toBe(1);
  });

  it("sends the server challenge id while verifying", async () => {
    const { result } = renderHook(() => useVerificationCode("login"));

    await act(async () => {
      await result.current.issueCode("student@stu.yasar.edu.tr");
    });
    await act(async () => {
      await result.current.verifyCode("482951");
    });

    expect(mockedVerifyOtpCode).toHaveBeenCalledWith({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      code: "482951",
      purpose: "login",
    });
  });

  it("uses the server's remaining-attempt count", async () => {
    mockedVerifyOtpCode.mockRejectedValueOnce(
      new AuthClientError(400, {
        code: "OTP_INCORRECT",
        message: "Kod eşleşmedi.",
        fieldErrors: {},
        attemptsLeft: 2,
      }),
    );
    const { result } = renderHook(() => useVerificationCode("login"));

    await act(async () => {
      await result.current.issueCode("student@stu.yasar.edu.tr");
    });
    let caughtError: unknown;

    await act(async () => {
      try {
        await result.current.verifyCode("000000");
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeInstanceOf(AuthClientError);
    await waitFor(() => {
      expect(result.current.attemptsLeft).toBe(2);
    });
  });
});
