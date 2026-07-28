import { describe, expect, it } from "vitest";

import {
  campusUsernamePattern,
  reservedCampusUsernames,
} from "@/data/campusAccountRules";
import {
  CAMPUS_POST_BODY_MAX_LENGTH,
  CAMPUS_POST_TITLE_MAX_LENGTH,
} from "@/data/campusContentRules";
import {
  getCampusYearOptions,
  isListedYasarDepartment,
} from "@/data/yasarDepartments";

describe("campus account and content rules", () => {
  it.each(["yagiz", "yagiz.karagoz", "yagiz_35", "student2026"])(
    "accepts a valid username: %s",
    (username) => {
      expect(campusUsernamePattern.test(username)).toBe(true);
    },
  );

  it.each(["Yağız", "ab", "name-", "_name", "name..test"])(
    "rejects an invalid username: %s",
    (username) => {
      expect(campusUsernamePattern.test(username)).toBe(false);
    },
  );

  it("keeps privileged and anonymous usernames reserved", () => {
    expect(reservedCampusUsernames).toEqual(
      expect.objectContaining({
        has: expect.any(Function),
      }),
    );
    expect(reservedCampusUsernames.has("admin")).toBe(true);
    expect(reservedCampusUsernames.has("anonim")).toBe(true);
    expect(reservedCampusUsernames.has("kampus")).toBe(true);
  });

  it("exposes the post limits used by the forms and provider", () => {
    expect(CAMPUS_POST_TITLE_MAX_LENGTH).toBe(100);
    expect(CAMPUS_POST_BODY_MAX_LENGTH).toBe(500);
  });
});

describe("Yaşar department rules", () => {
  it("returns graduate-only year options for a graduate program", () => {
    expect(getCampusYearOptions("Lisansüstü program")).toEqual([
      "Lisansüstü",
    ]);
  });

  it("returns the regular year list for an undergraduate program", () => {
    expect(getCampusYearOptions("Yazılım Mühendisliği")).toContain(
      "4. sınıf",
    );
  });

  it("recognizes listed departments and rejects arbitrary values", () => {
    expect(isListedYasarDepartment("Yazılım Mühendisliği")).toBe(true);
    expect(isListedYasarDepartment("Hayalî Bölüm")).toBe(false);
  });
});
