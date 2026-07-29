import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentSession,
  logoutCurrentSession,
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
  };
});

const mockedGetCurrentSession = vi.mocked(getCurrentSession);
const mockedLogoutCurrentSession = vi.mocked(logoutCurrentSession);

function AccountConsumer() {
  const {
    isHydrated,
    profile,
    role,
    sessionError,
    sessionMode,
    retrySession,
    signOut,
  } = useCampusAccount();

  return (
    <div>
      <span>{isHydrated ? "hydrated" : "loading"}</span>
      <span>{sessionMode}</span>
      <span>{profile.username}</span>
      <span>{role}</span>
      <span>{sessionError ?? "no-session-error"}</span>
      <button type="button" onClick={() => void retrySession()}>
        Oturumu yeniden kontrol et
      </button>
      <button type="button" onClick={() => void signOut()}>
        Çıkış
      </button>
    </div>
  );
}

describe("CampusAccountProvider", () => {
  beforeEach(() => {
    mockedLogoutCurrentSession.mockReset().mockResolvedValue(undefined);
    mockedGetCurrentSession.mockReset();
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
