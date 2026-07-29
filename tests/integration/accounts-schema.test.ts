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

function createUserFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);

  return {
    email: `student.${suffix}@stu.yasar.edu.tr`,
    username: `u${suffix}`,
  };
}

async function insertUser(
  overrides: Partial<ReturnType<typeof createUserFixture>> = {},
) {
  const fixture = {
    ...createUserFixture(),
    ...overrides,
  };
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
      fixture.email,
      fixture.username,
      "Test Kullanıcısı",
      "Yazılım Mühendisliği",
      "2. sınıf",
    ],
  );

  return {
    ...fixture,
    id: result.rows[0]!.id,
  };
}

async function expectSqlState(
  query: () => Promise<unknown>,
  expectedCode: string,
) {
  savepointNumber += 1;
  const savepoint = `expected_error_${savepointNumber}`;
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

describe("account schema migration", () => {
  it("installs the account tables, enums, and CITEXT extension", async () => {
    const tablesResult = await client.query<{ table_name: string }>(
      `select table_name
       from information_schema.tables
       where table_schema = 'public'
         and table_name = any($1::text[])
       order by table_name`,
      [
        [
          "__drizzle_migrations",
          "otp_challenges",
          "sessions",
          "terms_acceptances",
          "user_settings",
          "users",
        ],
      ],
    );
    const columnTypesResult = await client.query<{
      column_name: string;
      udt_name: string;
    }>(
      `select column_name, udt_name
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'users'
         and column_name in ('email', 'username')
       order by column_name`,
    );
    const extensionResult = await client.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'citext'",
    );
    const enumResult = await client.query<{
      enumlabel: string;
      typname: string;
    }>(
      `select type.typname, enum.enumlabel
       from pg_type as type
       join pg_enum as enum on enum.enumtypid = type.oid
       where type.typname in (
         'account_status',
         'otp_delivery_status',
         'user_role'
       )
       order by type.typname, enum.enumsortorder`,
    );
    const migrationResult = await client.query<{ count: string }>(
      "select count(*)::text as count from __drizzle_migrations",
    );

    expect(tablesResult.rows.map((row) => row.table_name)).toEqual([
      "__drizzle_migrations",
      "otp_challenges",
      "sessions",
      "terms_acceptances",
      "user_settings",
      "users",
    ]);
    expect(columnTypesResult.rows).toEqual([
      { column_name: "email", udt_name: "citext" },
      { column_name: "username", udt_name: "citext" },
    ]);
    expect(extensionResult.rows).toEqual([{ extname: "citext" }]);
    expect(enumResult.rows).toEqual([
      { typname: "account_status", enumlabel: "active" },
      { typname: "account_status", enumlabel: "suspended" },
      { typname: "otp_delivery_status", enumlabel: "pending" },
      { typname: "otp_delivery_status", enumlabel: "delivered" },
      { typname: "otp_delivery_status", enumlabel: "failed" },
      { typname: "user_role", enumlabel: "member" },
      { typname: "user_role", enumlabel: "moderator" },
      { typname: "user_role", enumlabel: "admin" },
    ]);
    expect(Number(migrationResult.rows[0]?.count)).toBeGreaterThanOrEqual(1);
  });

  it("enforces case-insensitive account uniqueness", async () => {
    const user = await insertUser();
    const differentUsername = createUserFixture().username;

    await expectSqlState(
      () =>
        client.query(
          `insert into users (
            email,
            username,
            display_name,
            department,
            year_label
          ) values ($1, $2, $3, $4, $5)`,
          [
            user.email.toUpperCase(),
            differentUsername,
            "Başka Kullanıcı",
            "Yazılım Mühendisliği",
            "2. sınıf",
          ],
        ),
      "23505",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into users (
            email,
            username,
            display_name,
            department,
            year_label
          ) values ($1, $2, $3, $4, $5)`,
          [
            createUserFixture().email,
            user.username,
            "Başka Kullanıcı",
            "Yazılım Mühendisliği",
            "2. sınıf",
          ],
        ),
      "23505",
    );
  });

  it("rejects invalid and reserved usernames", async () => {
    await expectSqlState(
      () => insertUser({ username: "Invalid-Name" }),
      "23514",
    );
    await expectSqlState(
      () => insertUser({ username: "admin" }),
      "23514",
    );
  });

  it("cascades account-owned records when a user is hard deleted", async () => {
    const user = await insertUser();

    await client.query("insert into user_settings (user_id) values ($1)", [
      user.id,
    ]);
    await client.query(
      `insert into terms_acceptances (
        user_id,
        terms_version,
        ip_hash
      ) values ($1, $2, $3)`,
      [user.id, "2026-07-27.v1", "i".repeat(64)],
    );
    await client.query(
      `insert into sessions (
        user_id,
        token_hash,
        issued_role,
        expires_at
      ) values ($1, $2, 'member', now() + interval '30 days')`,
      [user.id, "s".repeat(64)],
    );

    await client.query("delete from users where id = $1", [user.id]);

    const result = await client.query<{
      sessions: string;
      settings: string;
      terms: string;
    }>(
      `select
        (select count(*) from user_settings where user_id = $1)::text
          as settings,
        (select count(*) from terms_acceptances where user_id = $1)::text
          as terms,
        (select count(*) from sessions where user_id = $1)::text
          as sessions`,
      [user.id],
    );

    expect(result.rows[0]).toEqual({
      settings: "0",
      terms: "0",
      sessions: "0",
    });
  });

  it("enforces OTP and session safety constraints", async () => {
    const user = await insertUser();
    const validOtpValues = [
      createUserFixture().email,
      "registration",
      "c".repeat(64),
      "i".repeat(64),
    ];

    await client.query(
      `insert into otp_challenges (
        email,
        purpose,
        code_hash,
        request_ip_hash,
        expires_at,
        resend_available_at
      ) values (
        $1,
        $2,
        $3,
        $4,
        now() + interval '5 minutes',
        now() + interval '30 seconds'
      )`,
      validOtpValues,
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into otp_challenges (
            email,
            purpose,
            code_hash,
            request_ip_hash,
            expires_at,
            resend_available_at,
            attempt_count
          ) values (
            $1,
            $2,
            $3,
            $4,
            now() + interval '5 minutes',
            now() + interval '30 seconds',
            4
          )`,
          validOtpValues,
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into otp_challenges (
            email,
            purpose,
            code_hash,
            request_ip_hash,
            expires_at,
            resend_available_at
          ) values (
            $1,
            $2,
            $3,
            $4,
            now() + interval '5 minutes 1 second',
            now() + interval '30 seconds'
          )`,
          validOtpValues,
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into otp_challenges (
            email,
            purpose,
            code_hash,
            request_ip_hash,
            expires_at,
            resend_available_at
          ) values (
            $1,
            $2,
            $3,
            $4,
            now() + interval '5 minutes',
            now() + interval '29 seconds'
          )`,
          validOtpValues,
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into sessions (
            user_id,
            token_hash,
            issued_role,
            expires_at
          ) values ($1, $2, 'member', now() - interval '1 second')`,
          [user.id, "t".repeat(64)],
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into sessions (
            user_id,
            token_hash,
            issued_role,
            expires_at
          ) values ($1, $2, 'member', now() + interval '30 days 1 second')`,
          [user.id, "u".repeat(64)],
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into sessions (
            user_id,
            token_hash,
            issued_role,
            expires_at
          ) values ($1, $2, 'admin', now() + interval '8 hours 1 second')`,
          [user.id, "v".repeat(64)],
        ),
      "23514",
    );

    await expectSqlState(
      () =>
        client.query(
          `insert into sessions (
            user_id,
            token_hash,
            issued_role,
            expires_at
          ) values ($1, $2, 'member', now() + interval '30 days')`,
          [randomUUID(), "x".repeat(64)],
        ),
      "23503",
    );
  });
});
