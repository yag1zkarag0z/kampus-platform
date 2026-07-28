import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  demoVerificationCode,
  formatVerificationTime,
  useDemoVerificationCode,
} from "@/components/AuthVerificationCode";

describe("verification time formatting", () => {
  it.each([
    [0, "0:00"],
    [65, "1:05"],
    [300, "5:00"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatVerificationTime(seconds)).toBe(expected);
  });
});

describe("demo verification code", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues a code with a five-minute lifetime and cooldown", () => {
    const { result } = renderHook(() => useDemoVerificationCode());

    act(() => result.current.issueCode());

    expect(result.current.expiresInSeconds).toBe(300);
    expect(result.current.resendInSeconds).toBe(30);
    expect(result.current.attemptsLeft).toBe(3);
    expect(result.current.issueCount).toBe(1);
  });

  it("accepts the demo code while it is valid", () => {
    const { result } = renderHook(() => useDemoVerificationCode());

    act(() => result.current.issueCode());

    expect(result.current.verifyCode(demoVerificationCode)).toEqual({
      status: "valid",
    });
  });

  it("locks after three incorrect attempts", () => {
    const { result } = renderHook(() => useDemoVerificationCode());
    let verificationResult:
      | ReturnType<typeof result.current.verifyCode>
      | undefined;

    act(() => result.current.issueCode());

    act(() => {
      verificationResult = result.current.verifyCode("000000");
    });
    expect(verificationResult).toEqual({
      status: "incorrect",
      attemptsLeft: 2,
    });
    act(() => {
      verificationResult = result.current.verifyCode("000000");
    });
    expect(verificationResult).toEqual({
      status: "incorrect",
      attemptsLeft: 1,
    });
    act(() => {
      verificationResult = result.current.verifyCode("000000");
    });
    expect(verificationResult).toEqual({
      status: "locked",
    });
    expect(result.current.isLocked).toBe(true);
  });

  it("expires after five minutes", () => {
    const { result } = renderHook(() => useDemoVerificationCode());

    act(() => result.current.issueCode());
    act(() => vi.advanceTimersByTime(301_000));

    let verificationResult:
      | ReturnType<typeof result.current.verifyCode>
      | undefined;
    act(() => {
      verificationResult =
        result.current.verifyCode(demoVerificationCode);
    });
    expect(verificationResult).toEqual({
      status: "expired",
    });
    expect(result.current.isExpired).toBe(true);
  });
});
