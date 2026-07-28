import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampusSessionGate from "@/components/CampusSessionGate";

const gateState = vi.hoisted(() => ({
  pathname: "/akis",
  replace: vi.fn(),
  account: {
    isHydrated: true,
    isSignedIn: true,
    isGuest: false,
    sessionExpired: false,
    role: "member" as "member" | "moderator" | "admin",
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => gateState.pathname,
  useRouter: () => ({ replace: gateState.replace }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => gateState.account,
}));

describe("CampusSessionGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gateState.pathname = "/akis";
    gateState.replace.mockReset();
    Object.assign(gateState.account, {
      isHydrated: true,
      isSignedIn: true,
      isGuest: false,
      sessionExpired: false,
      role: "member",
    });
  });

  it("redirects a signed-out visitor to login", () => {
    Object.assign(gateState.account, {
      isSignedIn: false,
    });

    render(
      <CampusSessionGate>
        <p>Özel içerik</p>
      </CampusSessionGate>,
    );

    expect(gateState.replace).toHaveBeenCalledWith("/giris");
    expect(screen.queryByText("Özel içerik")).not.toBeInTheDocument();
  });

  it("keeps the session-expired reason in the redirect", () => {
    Object.assign(gateState.account, {
      isSignedIn: false,
      sessionExpired: true,
    });

    render(
      <CampusSessionGate>
        <p>Özel içerik</p>
      </CampusSessionGate>,
    );

    expect(gateState.replace).toHaveBeenCalledWith(
      "/giris?reason=session-expired",
    );
  });

  it.each(["/konu-olustur", "/ayarlar", "/admin", "/profil/duzenle"])(
    "returns a guest from %s to the feed",
    (pathname) => {
      gateState.pathname = pathname;
      Object.assign(gateState.account, {
        isSignedIn: true,
        isGuest: true,
      });

      render(
        <CampusSessionGate>
          <p>Özel içerik</p>
        </CampusSessionGate>,
      );

      expect(gateState.replace).toHaveBeenCalledWith("/akis");
      expect(screen.queryByText("Özel içerik")).not.toBeInTheDocument();
    },
  );

  it("does not let a regular member open the admin panel", () => {
    gateState.pathname = "/admin";

    render(
      <CampusSessionGate>
        <p>Yönetim</p>
      </CampusSessionGate>,
    );

    expect(gateState.replace).toHaveBeenCalledWith("/akis");
  });

  it("reveals an allowed route after the short intro", () => {
    render(
      <CampusSessionGate>
        <p>Akış hazır</p>
      </CampusSessionGate>,
    );

    expect(screen.queryByText("Akış hazır")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_280));

    expect(screen.getByText("Akış hazır")).toBeInTheDocument();
    expect(gateState.replace).not.toHaveBeenCalled();
  });
});
