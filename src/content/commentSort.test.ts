import { describe, expect, it } from "vitest";

import { sortCampusComments } from "@/content/commentSort";
import type { CampusComment } from "@/data/campusPosts";

function createComment(
  id: string,
  overrides: Partial<CampusComment> = {},
): CampusComment {
  return {
    id,
    author: "@ogrenci",
    isAnonymous: false,
    body: `${id} gövdesi`,
    time: "1 sa",
    ...overrides,
  };
}

/** Sunucu yorumları her zaman createdAt artan sırada döndürür. */
const root1 = createComment("root1", { createdAt: 100, likes: 1 });
const root1Reply = createComment("root1-reply", {
  parentId: "root1",
  createdAt: 150,
  likes: 99,
});
const root2 = createComment("root2", { createdAt: 200, likes: 5 });
const root2ReplyA = createComment("root2-reply-a", {
  parentId: "root2",
  createdAt: 250,
});
const root2ReplyB = createComment("root2-reply-b", {
  parentId: "root2",
  createdAt: 300,
});
const root3 = createComment("root3", { createdAt: 400, likes: 5 });

const chronological = [
  root1,
  root1Reply,
  root2,
  root2ReplyA,
  root2ReplyB,
  root3,
];

const ids = (comments: CampusComment[]) =>
  comments.map((comment) => comment.id);

describe("sortCampusComments", () => {
  it("leaves the server order untouched when sorting by oldest", () => {
    expect(ids(sortCampusComments(chronological, "oldest"))).toEqual([
      "root1",
      "root1-reply",
      "root2",
      "root2-reply-a",
      "root2-reply-b",
      "root3",
    ]);
  });

  it("reverses roots but keeps replies under their own root", () => {
    expect(ids(sortCampusComments(chronological, "newest"))).toEqual([
      "root3",
      "root2",
      "root2-reply-a",
      "root2-reply-b",
      "root1",
      "root1-reply",
    ]);
  });

  it("orders roots by likes without promoting a highly liked reply", () => {
    // root1-reply'in 99 beğenisi var ama yanıt olduğu için başa geçmemeli.
    expect(ids(sortCampusComments(chronological, "liked"))).toEqual([
      "root2",
      "root2-reply-a",
      "root2-reply-b",
      "root3",
      "root1",
      "root1-reply",
    ]);
  });

  it("falls back to chronology when likes are equal", () => {
    // root2 ve root3'ün ikisi de 5 beğenili; eski olan önce gelmeli.
    const ordered = sortCampusComments(chronological, "liked");
    const root2Index = ids(ordered).indexOf("root2");
    const root3Index = ids(ordered).indexOf("root3");

    expect(root2Index).toBeLessThan(root3Index);
  });

  it("keeps a reply visible when its parent is missing", () => {
    // Ebeveyn engelleme veya silinme yüzünden listede olmayabilir.
    const orphan = createComment("orphan", {
      parentId: "gorunmeyen",
      createdAt: 500,
    });

    expect(ids(sortCampusComments([root1, orphan], "oldest"))).toEqual([
      "root1",
      "orphan",
    ]);
  });

  it("never drops or duplicates a comment in any order", () => {
    for (const sort of ["oldest", "newest", "liked"] as const) {
      const ordered = sortCampusComments(chronological, sort);

      expect(ordered).toHaveLength(chronological.length);
      expect(new Set(ids(ordered))).toEqual(new Set(ids(chronological)));
    }
  });

  it("treats a missing createdAt as the oldest possible value", () => {
    const undated = createComment("undated");

    expect(
      ids(sortCampusComments([undated, root2], "newest")),
    ).toEqual(["root2", "undated"]);
  });

  it("returns an empty list for no comments", () => {
    expect(sortCampusComments([], "liked")).toEqual([]);
  });
});
