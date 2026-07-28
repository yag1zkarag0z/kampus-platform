import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginFlow from "@/components/LoginFlow";
import { demoVerificationCode } from "@/components/AuthVerificationCode";

const loginMocks = vi.hoisted(() => ({
  activateMember: vi.fn(() => true),
  activateGuest: vi.fn(() => true),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: loginMocks.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  activateCampusSession: loginMocks.activateMember,
  activateCampusGuestSession: loginMocks.activateGuest,
}));

describe("LoginFlow", () => {
  beforeEach(() => {
    loginMocks.activateMember.mockReset().mockReturnValue(true);
    loginMocks.activateGuest.mockReset().mockReturnValue(true);
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
        name: "Demo giriş kodunu hazırla",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "@stu.yasar.edu.tr",
    );
    expect(screen.queryByLabelText("Giriş kodu")).not.toBeInTheDocument();
  });

  it("completes the demo verification flow", async () => {
    const user = userEvent.setup();
    render(<LoginFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "student@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Demo giriş kodunu hazırla",
      }),
    );
    await user.type(
      screen.getByLabelText("Giriş kodu"),
      demoVerificationCode,
    );
    await user.click(
      screen.getByRole("button", { name: "Giriş yap" }),
    );

    expect(loginMocks.activateMember).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "Giriş tamamlandı." }),
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

    expect(loginMocks.activateGuest).toHaveBeenCalledOnce();
    expect(loginMocks.push).toHaveBeenCalledWith("/akis");
  });
});
