import { randomUUID } from "node:crypto";

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  createContentPost,
  listContentPosts,
} from "@/server/content/service";
import type { FeedQueryInput } from "@/server/content/validation";
import { AuthError, type AuthErrorCode } from "@/server/auth/errors";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

const testUserIds = new Set<string>();

function searchFeed(
  overrides: Partial<FeedQueryInput> = {},
): FeedQueryInput {
  return {
    limit: 20,
    sort: "newest",
    scope: "global",
    ...overrides,
  };
}

async function insertUser(label = "Search User") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email, username, display_name, department, year_label
    ) values ($1, $2, $3, $4, $5)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `s${suffix}`,
      label,
      "Software Engineering",
      "2. sinif",
    ],
  );
  const id = result.rows[0]!.id;

  testUserIds.add(id);

  return { id, username: `s${suffix}` };
}

async function createPost(
  authorId: string,
  title: string,
  body = "",
  category: FeedQueryInput["category"] = "chat",
) {
  return createContentPost(authorId, {
    category: category ?? "chat",
    title,
    body,
    isAnonymous: false,
  });
}

async function expectAuthError(
  action: () => Promise<unknown>,
  code: AuthErrorCode,
  status: number,
) {
  let caughtError: unknown;

  try {
    await action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({ code, status });
}

afterEach(async () => {
  if (testUserIds.size === 0) {
    return;
  }

  const userIds = [...testUserIds];

  await pool.query(
    `delete from comments
     where author_id = any($1::uuid[])
        or post_id in (select id from posts where author_id = any($1::uuid[]))`,
    [userIds],
  );
  await pool.query("delete from posts where author_id = any($1::uuid[])", [
    userIds,
  ]);
  await pool.query("delete from users where id = any($1::uuid[])", [userIds]);
  testUserIds.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("gönderi araması PostgreSQL üzerinde", () => {
  it("başlık ve gövdede arar, eşleşmeyeni döndürmez", async () => {
    const author = await insertUser("Search Author");
    const titleMatch = await createPost(
      author.id,
      "Kütüphane çalışma saatleri",
    );
    const bodyMatch = await createPost(
      author.id,
      "Duyuru",
      "Yeni kütüphane katı açıldı.",
    );
    const unrelated = await createPost(author.id, "Otopark doldu");

    const result = await listContentPosts(
      author.id,
      searchFeed({ q: "kütüphane" }),
    );
    const ids = result.data.map((post) => post.id);

    expect(ids).toContain(titleMatch.id);
    expect(ids).toContain(bodyMatch.id);
    expect(ids).not.toContain(unrelated.id);
  });

  it("Türkçe büyük/küçük harf ve aksan farkını yok sayar", async () => {
    const author = await insertUser("Turkish Search Author");
    const post = await createPost(
      author.id,
      "IŞIK Fakültesi çağrısı",
      "Öğrenciler için İstanbul gezisi düzenleniyor.",
    );

    for (const term of ["ışık", "ISIK", "isik", "cagri", "istanbul"]) {
      const result = await listContentPosts(
        author.id,
        searchFeed({ q: term }),
      );

      expect(
        result.data.map((item) => item.id),
        `"${term}" araması eşleşmeli`,
      ).toContain(post.id);
    }
  });

  it("LIKE joker karakterlerini düz metin olarak arar", async () => {
    const author = await insertUser("Wildcard Author");
    const literal = await createPost(author.id, "İndirim %50 oldu");
    const other = await createPost(author.id, "Alakasız gönderi");

    const wildcardOnly = await listContentPosts(
      author.id,
      searchFeed({ q: "%%" }),
    );
    const literalMatch = await listContentPosts(
      author.id,
      searchFeed({ q: "%50" }),
    );

    // "%" joker olarak yorumlansaydı her gönderi eşleşirdi.
    expect(wildcardOnly.data.map((item) => item.id)).not.toContain(other.id);
    expect(literalMatch.data.map((item) => item.id)).toContain(literal.id);
    expect(literalMatch.data.map((item) => item.id)).not.toContain(other.id);
  });

  it("arama ile kategori ve yazar filtrelerini birlikte uygular", async () => {
    const author = await insertUser("Combined Author");
    const other = await insertUser("Combined Other");
    const wanted = await createPost(
      author.id,
      "Kayıp kulaklık",
      "",
      "lost_found",
    );
    const wrongCategory = await createPost(
      author.id,
      "Kulaklık sohbeti",
      "",
      "chat",
    );
    const wrongAuthor = await createPost(
      other.id,
      "Kayıp kulaklık ilanı",
      "",
      "lost_found",
    );

    const result = await listContentPosts(
      author.id,
      searchFeed({
        q: "kulaklık",
        category: "lost_found",
        author: author.username,
      }),
    );
    const ids = result.data.map((post) => post.id);

    expect(ids).toEqual([wanted.id]);
    expect(ids).not.toContain(wrongCategory.id);
    expect(ids).not.toContain(wrongAuthor.id);
  });

  it("arama sonuçlarını cursor ile sayfalar ve cursor'ı sorguya bağlar", async () => {
    const author = await insertUser("Search Pagination Author");
    const createdIds: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      const post = await createPost(
        author.id,
        `Bisiklet ilanı ${index}`,
      );

      createdIds.push(post.id);
    }

    const query = searchFeed({ q: "bisiklet", limit: 2 });
    const firstPage = await listContentPosts(author.id, query);

    expect(firstPage.data).toHaveLength(2);
    expect(firstPage.page.hasMore).toBe(true);

    const cursor = firstPage.page.nextCursor;

    if (!cursor) {
      throw new Error("Arama için cursor bekleniyordu.");
    }

    // Cursor başka bir arama metniyle kullanılamaz.
    await expectAuthError(
      () =>
        listContentPosts(author.id, {
          ...query,
          q: "otopark",
          cursor,
        }),
      "INVALID_REQUEST",
      400,
    );

    const seenIds = firstPage.data.map((post) => post.id);
    let nextCursor: string | null = cursor;
    let pageCount = 1;

    while (nextCursor) {
      const page = await listContentPosts(author.id, {
        ...query,
        cursor: nextCursor,
      });

      seenIds.push(...page.data.map((post) => post.id));
      nextCursor = page.page.nextCursor;
      pageCount += 1;

      if (pageCount > 4) {
        throw new Error("Arama sayfalaması sonlanmadı.");
      }
    }

    expect(seenIds).toHaveLength(createdIds.length);
    expect(new Set(seenIds).size).toBe(seenIds.length);
    expect([...seenIds].sort()).toEqual([...createdIds].sort());
  });

  it("silinen gönderiyi ve engellenen yazarı arama dışında bırakır", async () => {
    const viewer = await insertUser("Search Viewer");
    const blocked = await insertUser("Search Blocked");
    const visible = await createPost(viewer.id, "Termos arıyorum");
    const hidden = await createPost(blocked.id, "Termos satıyorum");
    const deleted = await createPost(viewer.id, "Termos bulundu");

    await pool.query("update posts set deleted_at = now() where id = $1", [
      deleted.id,
    ]);
    await pool.query(
      "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
      [blocked.id, viewer.id],
    );

    const result = await listContentPosts(
      viewer.id,
      searchFeed({ q: "termos" }),
    );
    const ids = result.data.map((post) => post.id);

    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(hidden.id);
    expect(ids).not.toContain(deleted.id);
  });
});
