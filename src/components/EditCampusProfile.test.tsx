import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditCampusProfile from "@/components/EditCampusProfile";

const profileMocks = vi.hoisted(() => ({
  push: vi.fn(),
  removeAvatar: vi.fn(),
  renameAuthoredContent: vi.fn(),
  updateAvatar: vi.fn(),
  updateAvatarPreset: vi.fn(),
  updateProfile: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: profileMocks.push }),
}));

vi.mock("@/components/CampusAccountProvider", () => ({
  useCampusAccount: () => ({
    accountId: "2aebba61-4a8f-43b6-8c5f-0962250b6340",
    profile: {
      username: "kampuslu35",
      displayName: "Kampüslü",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
      bio: "",
      avatarUrl: null,
      joinedLabel: "Temmuz 2026",
    },
    settings: { showDepartment: false },
    isHydrated: true,
    updateProfile: profileMocks.updateProfile,
    updateSettings: profileMocks.updateSettings,
    updateAvatar: profileMocks.updateAvatar,
    updateAvatarPreset: profileMocks.updateAvatarPreset,
    removeAvatar: profileMocks.removeAvatar,
  }),
}));

vi.mock("@/components/CampusDataProvider", () => ({
  useCampusData: () => ({
    renameAuthoredContent: profileMocks.renameAuthoredContent,
  }),
}));

describe("EditCampusProfile", () => {
  beforeEach(() => {
    Object.values(profileMocks).forEach((mock) => mock.mockReset());
    profileMocks.updateProfile.mockResolvedValue(undefined);
    profileMocks.updateSettings.mockResolvedValue(undefined);
    profileMocks.updateAvatar.mockResolvedValue(undefined);
    profileMocks.updateAvatarPreset.mockResolvedValue(undefined);
    profileMocks.removeAvatar.mockResolvedValue(undefined);
  });

  it("saves a selected registration avatar from profile settings", async () => {
    const user = userEvent.setup();
    render(<EditCampusProfile />);

    await user.click(
      screen.getByRole("radio", { name: "Avatar 2 avatarı" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" }),
    );

    await waitFor(() => {
      expect(profileMocks.updateAvatarPreset).toHaveBeenCalledWith("deniz");
    });
    expect(profileMocks.updateAvatar).not.toHaveBeenCalled();
    expect(profileMocks.removeAvatar).not.toHaveBeenCalled();
    expect(profileMocks.push).toHaveBeenCalledWith("/profil");
  });
});
