import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  activateCampusGuestSession,
  activateCampusSession,
  persistRegisteredCampusAccount,
} from "@/components/CampusAccountProvider";

describe("campus account persistence helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts an expiring member session", () => {
    expect(activateCampusSession()).toBe(true);
    expect(localStorage.getItem("kampus-session-v1")).toBe("member");
    expect(
      Number(localStorage.getItem("kampus-session-expires-v1")),
    ).toBeGreaterThan(Date.now());
  });

  it("starts an expiring guest session", () => {
    expect(activateCampusGuestSession()).toBe(true);
    expect(localStorage.getItem("kampus-session-v1")).toBe("guest");
    expect(
      Number(localStorage.getItem("kampus-session-expires-v1")),
    ).toBeGreaterThan(Date.now());
  });

  it("rejects reserved or malformed registration data", () => {
    expect(
      persistRegisteredCampusAccount({
        username: "admin",
        displayName: "Admin",
        department: "Yazılım Mühendisliği",
        year: "2. sınıf",
        bio: "",
        showDepartment: true,
      }),
    ).toBe(false);
    expect(localStorage.getItem("kampus-account-v1")).toBeNull();
  });

  it("normalizes and persists a valid member registration", () => {
    expect(
      persistRegisteredCampusAccount({
        username: "kampuslu35",
        displayName: "  Kampüslü  ",
        department: " Yazılım Mühendisliği ",
        year: " 2. sınıf ",
        bio: "  Frontend geliştiriyorum. ",
        showDepartment: false,
      }),
    ).toBe(true);

    const account = JSON.parse(
      localStorage.getItem("kampus-account-v1") ?? "{}",
    ) as {
      role: string;
      profile: Record<string, string>;
      settings: { showDepartment: boolean };
    };

    expect(account.role).toBe("member");
    expect(account.profile).toMatchObject({
      username: "kampuslu35",
      displayName: "Kampüslü",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "Frontend geliştiriyorum.",
    });
    expect(account.settings.showDepartment).toBe(false);
    expect(localStorage.getItem("kampus-session-v1")).toBe("member");
  });
});
