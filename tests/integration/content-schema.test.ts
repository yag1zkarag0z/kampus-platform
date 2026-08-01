import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { Pool, type PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

let client: PoolClient;
let savepointNumber = 0;

beforeEach(async () => {
  client = await pool.connect();
  await client.query("begin");
});

afterEach(async () => {
  await client.query("rollback");
  client.release();
});

afterAll(async () => {
  await pool.end();
});

async function expectSqlState(
  query: () => Promise<unknown>,
  expectedCode: string,
) {
  savepointNumber += 1;
  const savepoint = `expected_content_error_${savepointNumber}`;

  await client.query(`savepoint ${savepoint}`);

  let caughtError: unknown;

  try {
    await query();
  } catch (error) {
    caughtError = error;
  } finally {
    await client.query(`rollback to savepoint ${savepoint}`);
    await client.query(`release savepoint ${savepoint}`);
  }

  expect(caughtError).toMatchObject({ code: expectedCode });
}

async function insertUser() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const studentNumber = BigInt(`0x${suffix}`).toString();
  const result = await client.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label
    ) values ($1, $2, $3, $4, $5)
    returning id`,
    [
      `${studentNumber}@stu.yasar.edu.tr`,
      `c${suffix}`,
      "İçerik Testi",
      "Yazılım Mühendisliği",
      "2. sınıf",
    ],
  );

  return result.rows[0]!.id;
}

async function insertPost(authorId: string, title = "Test gönderisi") {
  const result = await client.query<{ id: string }>(
    `insert into posts (author_id, category, title)
     values ($1, 'chat', $2)
     returning id`,
    [authorId, title],
  );

  return result.rows[0]!.id;
}

describe("content schema migration", () => {
  it("installs content tables, categories, and cursor indexes", async () => {
    const tablesResult = await client.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name in (
           'comments',
           'listings',
           'post_bookmarks',
           'post_likes',
           'poll_options',
           'poll_votes',
           'polls',
           'posts'
         )
       order by table_name`,
    );
    const enumResult = await client.query<{ enumlabel: string }>(
      `select enum.enumlabel
       from pg_type as type
       join pg_enum as enum on enum.enumtypid = type.oid
       where type.typname = 'post_category'
       order by enum.enumsortorder`,
    );
    const indexResult = await client.query<{ indexname: string }>(
      `select indexname
       from pg_indexes
       where schemaname = 'public'
         and indexname = any($1::text[])
       order by indexname`,
      [
        [
          "comments_active_post_cursor_idx",
          "comments_parent_id_idx",
          "listings_type_price_idx",
          "post_bookmarks_user_created_at_idx",
          "post_likes_user_created_at_idx",
          "posts_active_author_feed_cursor_idx",
          "posts_active_category_feed_cursor_idx",
          "posts_active_feed_cursor_idx",
        ],
      ],
    );

    expect(tablesResult.rows).toEqual([
      { table_name: "comments" },
      { table_name: "listings" },
      { table_name: "poll_options" },
      { table_name: "poll_votes" },
      { table_name: "polls" },
      { table_name: "post_bookmarks" },
      { table_name: "post_likes" },
      { table_name: "posts" },
    ]);
    expect(enumResult.rows.map((row) => row.enumlabel)).toEqual([
      "chat",
      "confession",
      "question",
      "event",
      "lost_found",
      "poll",
      "listing",
    ]);
    expect(indexResult.rows.map((row) => row.indexname)).toEqual([
      "comments_active_post_cursor_idx",
      "comments_parent_id_idx",
      "listings_type_price_idx",
      "post_bookmarks_user_created_at_idx",
      "post_likes_user_created_at_idx",
      "posts_active_author_feed_cursor_idx",
      "posts_active_category_feed_cursor_idx",
      "posts_active_feed_cursor_idx",
    ]);
  });

  it("enforces post content, length, and timestamp invariants", async () => {
    const authorId = await insertUser();
    const result = await client.query<{
      body: string;
      is_anonymous: boolean;
    }>(
      `insert into posts (author_id, category, title)
       values ($1, 'question', $2)
       returning body, is_anonymous`,
      [authorId, "Ders notu olan var mı?"],
    );

    expect(result.rows[0]).toEqual({
      body: "",
      is_anonymous: false,
    });

    await expectSqlState(
      () =>
        client.query(
          `insert into posts (author_id, category, title, body)
           values ($1, 'chat', '   ', '  ')`,
          [authorId],
        ),
      "23514",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into posts (author_id, category, title)
           values ($1, 'chat', $2)`,
          [authorId, "x".repeat(101)],
        ),
      "22001",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into posts (author_id, category, body)
           values ($1, 'chat', $2)`,
          [authorId, "x".repeat(501)],
        ),
      "22001",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into posts (
             author_id,
             category,
             title,
             created_at,
             edited_at
           ) values (
             $1,
             'chat',
             'Zaman sırası',
             now(),
             now() - interval '1 second'
           )`,
          [authorId],
        ),
      "23514",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into posts (author_id, category, title)
           values ($1, 'not_a_category', 'Geçersiz kategori')`,
          [authorId],
        ),
      "22P02",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into posts (author_id, category, title)
           values ($1, 'chat', 'Olmayan yazar')`,
          [randomUUID()],
        ),
      "23503",
    );
  });

  it("enforces listing price rules and cascades with its post", async () => {
    const authorId = await insertUser();
    const postResult = await client.query<{ id: string }>(
      `insert into posts (author_id, category, title, body)
       values ($1, 'listing', 'Kitap', 'Temiz durumda')
       returning id`,
      [authorId],
    );
    const postId = postResult.rows[0]!.id;

    await expectSqlState(
      () =>
        client.query(
          `insert into listings (post_id, type, condition, price)
           values ($1, 'free', 'used', 10)`,
          [postId],
        ),
      "23514",
    );

    await client.query(
      `insert into listings (post_id, type, condition, price)
       values ($1, 'sale', 'lightly_used', 180)`,
      [postId],
    );
    await client.query("delete from posts where id = $1", [postId]);

    const remaining = await client.query(
      "select post_id from listings where post_id = $1",
      [postId],
    );
    expect(remaining.rowCount).toBe(0);
  });

  it("enforces comment body, timestamps, and foreign keys", async () => {
    const authorId = await insertUser();
    const postId = await insertPost(authorId);
    const otherPostId = await insertPost(authorId);
    const rootResult = await client.query<{
      id: string;
      is_anonymous: boolean;
    }>(
      `insert into comments (post_id, author_id, body)
       values ($1, $2, 'Kök yorum')
       returning id, is_anonymous`,
      [postId, authorId],
    );
    const rootComment = rootResult.rows[0]!;
    const replyResult = await client.query<{ parent_id: string }>(
      `insert into comments (post_id, author_id, parent_id, body)
       values ($1, $2, $3, 'Yanıt')
       returning parent_id`,
      [postId, authorId, rootComment.id],
    );

    expect(rootComment.is_anonymous).toBe(false);
    expect(replyResult.rows[0]?.parent_id).toBe(rootComment.id);

    await expectSqlState(
      () =>
        client.query(
          `insert into comments (post_id, author_id, parent_id, body)
           values ($1, $2, $3, 'Başka gönderiye bağlanan yanıt')`,
          [otherPostId, authorId, rootComment.id],
        ),
      "23503",
    );
    const selfReferencingId = randomUUID();

    await expectSqlState(
      () =>
        client.query(
          `insert into comments (
             id,
             post_id,
             author_id,
             parent_id,
             body
           ) values ($1, $2, $3, $1, 'Kendisine yanıt')`,
          [selfReferencingId, postId, authorId],
        ),
      "23514",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (post_id, author_id, body)
           values ($1, $2, '   ')`,
          [postId, authorId],
        ),
      "23514",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (post_id, author_id, body)
           values ($1, $2, $3)`,
          [postId, authorId, "x".repeat(501)],
        ),
      "22001",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (
             post_id,
             author_id,
             body,
             created_at,
             deleted_at
           ) values (
             $1,
             $2,
             'Geçersiz zaman',
             now(),
             now() - interval '1 second'
           )`,
          [postId, authorId],
        ),
      "23514",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (
             post_id,
             author_id,
             parent_id,
             body
           ) values ($1, $2, $3, 'Olmayan üst yorum')`,
          [postId, authorId, randomUUID()],
        ),
      "23503",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (post_id, author_id, body)
           values ($1, $2, 'Olmayan gönderi')`,
          [randomUUID(), authorId],
        ),
      "23503",
    );
    await expectSqlState(
      () =>
        client.query(
          `insert into comments (post_id, author_id, body)
           values ($1, $2, 'Olmayan yazar')`,
          [postId, randomUUID()],
        ),
      "23503",
    );
  });

  it("cascades comments when a post is hard deleted", async () => {
    const authorId = await insertUser();
    const postId = await insertPost(authorId);

    await client.query(
      `insert into comments (post_id, author_id, body)
       values ($1, $2, 'Silinecek yorum')`,
      [postId, authorId],
    );
    await client.query("delete from posts where id = $1", [postId]);

    const result = await client.query<{ count: string }>(
      `select count(*)::text as count
       from comments
       where post_id = $1`,
      [postId],
    );

    expect(result.rows[0]?.count).toBe("0");
  });
});
