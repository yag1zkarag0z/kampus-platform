import { describe, expect, it } from "vitest";

import {
  getCampusAuthorProfileHref,
  normalizeCampusProfileUsername,
} from "@/components/CampusAuthorProfileLink";
import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  LOCAL_ACCOUNT_OWNER_ID,
} from "@/data/campusPosts";

describe("campus author profile links", () => {
  it("normalizes a visible username", () => {
    expect(normalizeCampusProfileUsername("  @Yagiz.Karagoz ")).toBe(
      "yagiz.karagoz",
    );
  });

  it("does not expose a profile link for anonymous content", () => {
    expect(
      getCampusAuthorProfileHref({
        author: "Anonim",
        isAnonymous: true,
      }),
    ).toBeNull();
  });

  it("routes the local and official accounts to their canonical profiles", () => {
    expect(
      getCampusAuthorProfileHref({
        author: "@yagizkaragoz",
        authorId: LOCAL_ACCOUNT_OWNER_ID,
      }),
    ).toBe("/profil");
    expect(
      getCampusAuthorProfileHref({
        author: "KAMPÜS",
        authorId: CAMPUS_OFFICIAL_AUTHOR_ID,
      }),
    ).toBe("/profil/kampus");
  });

  it("builds a safe profile route and rejects invalid handles", () => {
    expect(getCampusAuthorProfileHref({ author: "@ecearslan" })).toBe(
      "/profil/ecearslan",
    );
    expect(getCampusAuthorProfileHref({ author: "Ece Arslan" })).toBeNull();
  });
});
