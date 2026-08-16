import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthClientError,
  getCurrentSession,
  logoutCurrentSession,
  removeCurrentAvatar,
  setCurrentAvatarPreset,
  updateCurrentProfile,
  updateCurrentSettings,
  uploadCurrentAvatar,
} from "@/auth/client";
import {
  CampusAccountProvider,
  useCampusAccount,
} from "@/components/CampusAccountProvider";

vi.mock("@/auth/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/auth/client")>(
      "@/auth/client",
    );

  return {
    ...actual,
    getCurrentSession: vi.fn(),
    logoutCurrentSession: vi.fn(),
    removeCurrentAvatar: vi.fn(),
    setCurrentAvatarPreset: vi.fn(),
    updateCurrentProfile: vi.fn(),
    updateCurrentSettings: vi.fn(),
    uploadCurrentAvatar: vi.fn(),
  };
});

const mockedGetCurrentSession = vi.mocked(getCurrentSession);
const mockedLogoutCurrentSession = vi.mocked(logoutCurrentSession);
const mockedUpdateCurrentProfile = vi.mocked(updateCurrentProfile);
const mockedUpdateCurrentSettings = vi.mocked(updateCurrentSettings);
const mockedUploadCurrentAvatar = vi.mocked(uploadCurrentAvatar);
const mockedRemoveCurrentAvatar = vi.mocked(removeCurrentAvatar);
const mockedSetCurrentAvatarPreset = vi.mocked(setCurrentAvatarPreset);

const memberSession = {
  mode: "member" as const,
  expiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
  user: {
    id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
    role: "member" as const,
    profile: {
      username: "kampuslu35",
      displayName: "Kampüslü",
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
};

function AccountConsumer() {
  const {
    accountId,
    isHydrated,
    profile,
    role,
    sessionError,
    sessionExpired,
    sessionMode,
    retrySession,
    signOut,
    settings,
    removeAvatar,
    updateAvatar,
    updateAvatarPreset,
    updateProfile,
    updateSettings,
  } = useCampusAccount();
  const [mutationError, setMutationError] = useState("");

  return (
    <div>
      <span>{isHydrated ? "hydrated" : "loading"}</span>
      <span>{sessionMode}</span>
      <span>{profile.username}</span>
      <span data-testid="account-id">{accountId ?? "no-account"}</span>
      <span data-testid="session-expired">
        {sessionExpired ? "session-expired" : "session-active"}
      </span>
      <span>{profile.avatarUrl ?? "no-avatar"}</span>
      <span>{settings.showDepartment ? "department-visible" : "department-hidden"}</span>
      <span>{role}</span>
      <span>{sessionError ?? "no-session-error"}</span>
      <span>{mutationError || "no-mutation-error"}</span>
      <button type="button" onClick={() => void retrySession()}>
        Oturumu yeniden kontrol et
      </button>
      <button type="button" onClick={() => void signOut()}>
        Çıkış
      </button>
      <button
        type="button"
        onClick={() => {
          void updateAvatarPreset("deniz").catch((error: unknown) => {
            setMutationError(
              error instanceof Error ? error.message : "mutation failed",
            );
          });
        }}
      >
        Hazır avatar seç
      </button>
      <button
        type="button"
        onClick={() => {
          void updateProfile({
            username: "yenikullanici",
            displayName: "Yeni Kullanıcı",
            department: "Bilgisayar Mühendisliği",
            year: "3. sınıf",
            bio: "Yeni biyografi",
          }).catch((error: unknown) => {
            setMutationError(
              error instanceof Error ? error.message : "mutation failed",
            );
          });
        }}
      >
        Profili güncelle
      </button>
      <button
        type="button"
        onClick={() => {
          void updateSettings({ showDepartment: true }).catch(
            (error: unknown) => {
              setMutationError(
                error instanceof Error
                  ? error.message
                  : "mutation failed",
              );
            },
          );
        }}
      >
        Bölümü göster
      </button>
      <button
        type="button"
        onClick={() => {
          void updateAvatar(
            new Blob(["fake-avatar"], { type: "image/webp" }),
          ).catch((error: unknown) => {
            setMutationError(
              error instanceof Error ? error.message : "mutation failed",
            );
          });
        }}
      >
        Avatar ekle
      </button>
      <button
        type="button"
        onClick={() => {
          void removeAvatar().catch((error: unknown) => {
            setMutationError(
              error instanceof Error ? error.message : "mutation failed",
            );
          });
        }}
      >
        Avatar kaldır
      </button>
    </div>
  );
}

describe("CampusAccountProvider", () => {
  beforeEach(() => {
    mockedLogoutCurrentSession.mockReset().mockResolvedValue(undefined);
    mockedGetCurrentSession.mockReset();
    mockedUpdateCurrentProfile.mockReset();
    mockedUpdateCurrentSettings.mockReset();
    mockedUploadCurrentAvatar.mockReset();
    mockedRemoveCurrentAvatar.mockReset();
    mockedSetCurrentAvatarPreset.mockReset();
  });

  it("hydrates a member only from the server session", async () => {
    mockedGetCurrentSession.mockResolvedValue({
      mode: "member",
      expiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
      user: {
        id: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
        role: "member",
        profile: {
          username: "kampuslu35",
          displayName: "Kampüslü",
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

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    expect(await screen.findByText("hydrated")).toBeInTheDocument();
    expect(screen.getAllByText("member")).toHaveLength(2);
    expect(screen.getByText("kampuslu35")).toBeInTheDocument();
    expect(screen.queryByText("admin")).not.toBeInTheDocument();
    expect(localStorage.getItem("kampus-session-v1")).toBeNull();
  });

  it("updates profile through the API and applies the returned session", async () => {
    const updatedSession = {
      ...memberSession,
      user: {
        ...memberSession.user,
        profile: {
          ...memberSession.user.profile,
          username: "yenikullanici",
          displayName: "Yeni Kullanıcı",
          department: "Bilgisayar Mühendisliği",
          year: "3. sınıf",
          bio: "Yeni biyografi",
        },
      },
    };
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUpdateCurrentProfile.mockResolvedValue(updatedSession);
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("kampuslu35");
    await user.click(
      screen.getByRole("button", { name: "Profili güncelle" }),
    );

    expect(await screen.findByText("yenikullanici")).toBeInTheDocument();
    expect(mockedUpdateCurrentProfile).toHaveBeenCalledWith({
      username: "yenikullanici",
      displayName: "Yeni Kullanıcı",
      department: "Bilgisayar Mühendisliği",
      year: "3. sınıf",
      bio: "Yeni biyografi",
    });
  });

  it("fully expires the current account after a profile mutation returns 401", async () => {
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUpdateCurrentProfile.mockRejectedValue(
      new AuthClientError(401, {
        code: "AUTHENTICATION_REQUIRED",
        message: "Oturum sona erdi.",
        fieldErrors: {},
      }),
    );
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("kampuslu35");
    await user.click(
      screen.getByRole("button", { name: "Profili güncelle" }),
    );

    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("kampuslu")).toBeInTheDocument();
    expect(screen.getByTestId("account-id")).toHaveTextContent(
      "no-account",
    );
    expect(screen.getByTestId("session-expired")).toHaveTextContent(
      "session-expired",
    );

    await user.click(
      screen.getByRole("button", { name: "Profili güncelle" }),
    );
    expect(mockedUpdateCurrentProfile).toHaveBeenCalledOnce();
  });

  it("fully expires the current account after a settings mutation returns 401", async () => {
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUpdateCurrentSettings.mockRejectedValue(
      new AuthClientError(401, {
        code: "AUTHENTICATION_REQUIRED",
        message: "Oturum sona erdi.",
        fieldErrors: {},
      }),
    );
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("department-hidden");
    await user.click(
      screen.getByRole("button", { name: "Bölümü göster" }),
    );

    expect(await screen.findByText("signed-out")).toBeInTheDocument();
    expect(screen.getByText("department-hidden")).toBeInTheDocument();
    expect(screen.getByTestId("account-id")).toHaveTextContent(
      "no-account",
    );
    expect(screen.getByTestId("session-expired")).toHaveTextContent(
      "session-expired",
    );
  });

  it("does not expire a newly switched account when an old mutation later returns 401", async () => {
    const nextSession = {
      ...memberSession,
      user: {
        ...memberSession.user,
        id: "97840cab-04e9-431e-8b81-bbb8483ebbc5",
        profile: {
          ...memberSession.user.profile,
          username: "ikincihesap",
        },
      },
    };
    let rejectOldProfile:
      | ((reason?: unknown) => void)
      | undefined;
    mockedGetCurrentSession
      .mockResolvedValueOnce(memberSession)
      .mockResolvedValueOnce(nextSession);
    mockedUpdateCurrentProfile.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectOldProfile = reject;
        }),
    );
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("hydrated");
    await user.click(
      screen.getByRole("button", { name: "Profili güncelle" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Oturumu yeniden kontrol et",
      }),
    );
    expect(await screen.findByText("ikincihesap")).toBeInTheDocument();

    act(() => {
      rejectOldProfile?.(
        new AuthClientError(401, {
          code: "AUTHENTICATION_REQUIRED",
          message: "Eski oturum sona erdi.",
          fieldErrors: {},
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("ikincihesap")).toBeInTheDocument();
      expect(screen.getAllByText("member")).toHaveLength(2);
      expect(screen.getByTestId("account-id")).toHaveTextContent(
        nextSession.user.id,
      );
      expect(screen.getByTestId("session-expired")).toHaveTextContent(
        "session-active",
      );
    });
  });

  it("clears profile, settings and role when the session timer has already expired", async () => {
    mockedGetCurrentSession.mockResolvedValue({
      ...memberSession,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      user: {
        ...memberSession.user,
        role: "admin",
        settings: {
          ...memberSession.user.settings,
          showDepartment: true,
        },
      },
    });

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("hydrated");
    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
      expect(screen.getByText("kampuslu")).toBeInTheDocument();
      expect(screen.getByText("department-hidden")).toBeInTheDocument();
      expect(screen.queryByText("admin")).not.toBeInTheDocument();
      expect(screen.getByTestId("session-expired")).toHaveTextContent(
        "session-expired",
      );
    });
  });

  it("optimistically updates settings and rolls back a rejected save", async () => {
    let rejectSettingsRequest: ((reason?: unknown) => void) | undefined;
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUpdateCurrentSettings.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectSettingsRequest = reject;
        }),
    );
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("department-hidden");
    await user.click(
      screen.getByRole("button", { name: "Bölümü göster" }),
    );
    expect(
      await screen.findByText("department-visible"),
    ).toBeInTheDocument();

    act(() => {
      rejectSettingsRequest?.(new Error("settings unavailable"));
    });

    expect(await screen.findByText("department-hidden")).toBeInTheDocument();
    expect(
      await screen.findByText("settings unavailable"),
    ).toBeInTheDocument();
  });

  it("uploads a new avatar through the API and applies the returned session", async () => {
    const updatedSession = {
      ...memberSession,
      user: {
        ...memberSession.user,
        profile: {
          ...memberSession.user.profile,
          avatarUrl: "/v1/users/kampuslu35/avatar",
        },
      },
    };
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUploadCurrentAvatar.mockResolvedValue(updatedSession);
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("no-avatar");
    await user.click(screen.getByRole("button", { name: "Avatar ekle" }));

    expect(
      await screen.findByText("/v1/users/kampuslu35/avatar"),
    ).toBeInTheDocument();
    expect(mockedUploadCurrentAvatar).toHaveBeenCalledOnce();
  });

  it("surfaces an avatar upload failure without signing the user out", async () => {
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedUploadCurrentAvatar.mockRejectedValue(
      new AuthClientError(400, {
        code: "INVALID_REQUEST",
        message: "Görsel işlenemedi.",
        fieldErrors: {},
      }),
    );
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("no-avatar");
    await user.click(screen.getByRole("button", { name: "Avatar ekle" }));

    expect(await screen.findByText("Görsel işlenemedi.")).toBeInTheDocument();
    expect(screen.getAllByText("member")).toHaveLength(2);
    expect(screen.getByText("no-avatar")).toBeInTheDocument();
  });

  it("applies a ready avatar preset returned by the API", async () => {
    const updatedSession = {
      ...memberSession,
      user: {
        ...memberSession.user,
        profile: {
          ...memberSession.user.profile,
          avatarUrl: "/v1/users/kampuslu35/avatar",
        },
      },
    };
    mockedGetCurrentSession.mockResolvedValue(memberSession);
    mockedSetCurrentAvatarPreset.mockResolvedValue(updatedSession);
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("no-avatar");
    await user.click(
      screen.getByRole("button", { name: "Hazır avatar seç" }),
    );

    expect(
      await screen.findByText("/v1/users/kampuslu35/avatar"),
    ).toBeInTheDocument();
    expect(mockedSetCurrentAvatarPreset).toHaveBeenCalledWith("deniz");
  });

  it("removes the current avatar through the API", async () => {
    const sessionWithAvatar = {
      ...memberSession,
      user: {
        ...memberSession.user,
        profile: {
          ...memberSession.user.profile,
          avatarUrl: "/v1/users/kampuslu35/avatar",
        },
      },
    };
    mockedGetCurrentSession.mockResolvedValue(sessionWithAvatar);
    mockedRemoveCurrentAvatar.mockResolvedValue(memberSession);
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("/v1/users/kampuslu35/avatar");
    await user.click(screen.getByRole("button", { name: "Avatar kaldır" }));

    expect(await screen.findByText("no-avatar")).toBeInTheDocument();
    expect(mockedRemoveCurrentAvatar).toHaveBeenCalledOnce();
  });

  it("hydrates the read-only guest returned by the API", async () => {
    mockedGetCurrentSession.mockResolvedValue({
      mode: "guest",
      expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
      user: null,
    });

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    expect(await screen.findByText("guest")).toBeInTheDocument();
    expect(screen.getByText("isimsiz")).toBeInTheDocument();
  });

  it("revokes the server session while signing out", async () => {
    mockedGetCurrentSession.mockResolvedValue({
      mode: "guest",
      expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
      user: null,
    });
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    await screen.findByText("guest");
    await user.click(screen.getByRole("button", { name: "Çıkış" }));

    await waitFor(() => {
      expect(mockedLogoutCurrentSession).toHaveBeenCalledOnce();
      expect(screen.getByText("signed-out")).toBeInTheDocument();
    });
  });

  it("keeps a failed session check recoverable instead of signing out", async () => {
    mockedGetCurrentSession
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce({
        mode: "guest",
        expiresAt: new Date(Date.now() + 7_200_000).toISOString(),
        user: null,
      });
    const user = userEvent.setup();

    render(
      <CampusAccountProvider>
        <AccountConsumer />
      </CampusAccountProvider>,
    );

    expect(
      await screen.findByText(
        "Oturumun kontrol edilemedi. Bağlantını kontrol edip yeniden dene.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("signed-out")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Oturumu yeniden kontrol et",
      }),
    );

    await waitFor(() => {
      expect(mockedGetCurrentSession).toHaveBeenCalledTimes(2);
      expect(screen.getByText("guest")).toBeInTheDocument();
      expect(screen.getByText("no-session-error")).toBeInTheDocument();
    });
  });
});
