import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerCampusAccount,
  requestOtpCode,
  setCurrentAvatarPreset,
  verifyOtpCode,
} from "@/auth/client";
import RegisterFlow from "@/components/RegisterFlow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    registerCampusAccount: vi.fn(),
    setCurrentAvatarPreset: vi.fn(),
  };
});

const mockedRequestOtpCode = vi.mocked(requestOtpCode);
const mockedVerifyOtpCode = vi.mocked(verifyOtpCode);
const mockedRegisterCampusAccount = vi.mocked(registerCampusAccount);
const mockedSetCurrentAvatarPreset = vi.mocked(setCurrentAvatarPreset);

describe("RegisterFlow", () => {
  beforeEach(() => {
    mockedRequestOtpCode.mockReset().mockResolvedValue({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      attemptsLeft: 3,
    });
    mockedVerifyOtpCode.mockReset().mockResolvedValue({
      registrationToken: "signed-registration-grant",
      registrationExpiresAt: new Date(
        Date.now() + 900_000,
      ).toISOString(),
    });
    mockedRegisterCampusAccount.mockReset().mockResolvedValue({
      mode: "member",
      expiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
      user: {
        id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
        role: "member",
        profile: {
          username: "kampuslu35",
          displayName: "kampuslu35",
          department: "Yazılım Mühendisliği",
          year: "2. sınıf",
          bio: "",
          avatarUrl: null,
          joinedLabel: "Temmuz 2026",
        },
        settings: {
          showDepartment: false,
          notifyReplies: true,
          notifyLikes: true,
          notifyAnnouncements: true,
          notifyComments: true,
          notifyFollows: true,
          notifyMentions: true,
          emailNotifications: true,
        },
      },
    });
    mockedSetCurrentAvatarPreset.mockReset().mockResolvedValue({
      mode: "member",
      expiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
      user: {
        id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
        role: "member",
        profile: {
          username: "kampuslu35",
          displayName: "kampuslu35",
          department: "Yazılım Mühendisliği",
          year: "2. sınıf",
          bio: "",
          avatarUrl: "/v1/users/kampuslu35/avatar",
          joinedLabel: "Temmuz 2026",
        },
        settings: {
          showDepartment: false,
          notifyReplies: true,
          notifyLikes: true,
          notifyAnnouncements: true,
          notifyComments: true,
          notifyFollows: true,
          notifyMentions: true,
          emailNotifications: true,
        },
      },
    });
  });

  it("shows the KVKK disclosure before collecting the registration email", () => {
    render(<RegisterFlow />);

    expect(
      screen.getByRole("link", {
        name: /KVKK aydınlatma metnini oku/,
      }),
    ).toHaveAttribute("href", "/kvkk");
    expect(screen.getByText(/hesap oluşturma ve güvenlik/)).toBeVisible();
  });

  it("rejects an email that does not start with a student number", async () => {
    const user = userEvent.setup();
    render(<RegisterFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "student@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Doğrulama kodu gönder",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Öğrenci numaranla",
    );
    expect(mockedRequestOtpCode).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Doğrulama kodu"),
    ).not.toBeInTheDocument();
  });

  it("verifies the email, consumes the grant, and registers the profile", async () => {
    const user = userEvent.setup();
    render(<RegisterFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "202612345@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Doğrulama kodu gönder",
      }),
    );
    await user.type(
      screen.getByLabelText("Doğrulama kodu"),
      "482951",
    );
    await user.click(
      screen.getByRole("button", { name: "Kodu doğrula" }),
    );

    const profileHeading = await screen.findByRole("heading", {
      name: "Kampüs profilini oluştur.",
    });
    await waitFor(() => {
      expect(profileHeading).toHaveFocus();
    });
    expect(
      screen.getByText("Kayıt adımı 3: Kampüs profilini oluştur."),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Kullanıcı adı"),
      "kampuslu35",
    );
    await user.selectOptions(
      screen.getByLabelText("Bölüm"),
      "Yazılım Mühendisliği",
    );
    await user.selectOptions(
      screen.getByLabelText("Sınıf"),
      "2. sınıf",
    );
    expect(
      screen.getByRole("link", {
        name: /KVKK aydınlatma metnini oku/,
      }),
    ).toHaveAttribute("href", "/kvkk");
    await user.click(
      screen.getByLabelText(
        /Kullanım ve Topluluk Sözleşmesi’ni okudum/,
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Kaydı tamamla" }),
    );

    expect(mockedVerifyOtpCode).toHaveBeenCalledWith({
      challengeId: "36ac7e65-60a6-4d47-b4ba-75d99060e2a4",
      code: "482951",
      purpose: "registration",
    });
    expect(mockedRegisterCampusAccount).toHaveBeenCalledWith({
      registrationToken: "signed-registration-grant",
      username: "kampuslu35",
      displayName: "",
      department: "Yazılım Mühendisliği",
      yearLabel: "2. sınıf",
      bio: "",
      showDepartment: false,
      termsAccepted: true,
    });
    expect(
      await screen.findByRole("heading", { name: "Avatarını seç." }),
    ).toBeInTheDocument();

    const avatarOptions = screen.getAllByRole("radio");
    await user.click(avatarOptions[1]);
    await user.click(
      screen.getByRole("button", { name: "Bu avatarı kullan" }),
    );

    expect(mockedSetCurrentAvatarPreset).toHaveBeenCalledWith("deniz");
    expect(
      await screen.findByRole("heading", {
        name: "Aramıza hoş geldin.",
      }),
    ).toBeInTheDocument();
  });

  it("opens the avatar step directly in development preview mode", async () => {
    const user = userEvent.setup();
    render(<RegisterFlow previewAvatarStep />);

    expect(
      screen.getByRole("heading", { name: "Avatarını seç." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Önizleme")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Geç" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Bu avatarı kullan" }),
    );

    expect(mockedSetCurrentAvatarPreset).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("heading", {
        name: "Aramıza hoş geldin.",
      }),
    ).toBeInTheDocument();
  });

  it("restarts verification instead of returning to a consumed challenge", async () => {
    const user = userEvent.setup();
    render(<RegisterFlow />);

    await user.type(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
      "202612345@stu.yasar.edu.tr",
    );
    await user.click(
      screen.getByRole("button", {
        name: "Doğrulama kodu gönder",
      }),
    );
    await user.type(
      screen.getByLabelText("Doğrulama kodu"),
      "482951",
    );
    await user.click(
      screen.getByRole("button", { name: "Kodu doğrula" }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "E-posta doğrulamasını yeniden başlat",
      }),
    );

    expect(
      screen.getByLabelText("Yaşar öğrenci e-postan"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Doğrulama kodu"),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Doğrulama kodu gönder",
      }),
    );
    expect(mockedRequestOtpCode).toHaveBeenCalledTimes(2);
  });
});
