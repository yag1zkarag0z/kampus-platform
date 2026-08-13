import { Client } from "pg";

export const DEFAULT_E2E_DATABASE_URL =
  "postgresql://kampus_test:kampus_test_local@127.0.0.1:5433/kampus_test";

function databaseNameFromUrl(databaseUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("The E2E database URL is invalid.");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error("E2E cleanup requires a PostgreSQL database URL.");
  }

  return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
}

export function assertTestDatabaseUrl(databaseUrl: string) {
  const databaseName = databaseNameFromUrl(databaseUrl);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing E2E cleanup for non-test database "${databaseName}".`,
    );
  }

  return databaseUrl;
}

export function getE2eDatabaseUrl() {
  return assertTestDatabaseUrl(
    process.env.TEST_DATABASE_URL ?? DEFAULT_E2E_DATABASE_URL,
  );
}

export async function cleanupE2eAuthData() {
  const databaseUrl = getE2eDatabaseUrl();
  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
  });

  await client.connect();

  try {
    await client.query("set lock_timeout = '5s'");
    await client.query("set statement_timeout = '30s'");

    const databaseResult = await client.query<{
      database_name: string;
    }>("select current_database() as database_name");
    const databaseName = databaseResult.rows[0]?.database_name ?? "";

    if (!databaseName.endsWith("_test")) {
      throw new Error(
        `Refusing E2E cleanup for connected database "${databaseName}".`,
      );
    }

    await client.query("begin");

    try {
      const emailPattern = "99%@stu.yasar.edu.tr";

      await client.query(
        `delete from product_feedback
         where session_mode = 'guest'
            or user_id in (
              select id from users where lower(email::text) like $1
            )`,
        [emailPattern],
      );

      await client.query(
        "delete from otp_challenges where lower(email::text) like $1",
        [emailPattern],
      );
      await client.query(
        `delete from moderation_actions action
         where action.actor_id in (
           select id from users where lower(email::text) like $1
         )
         or action.target_user_id in (
           select id from users where lower(email::text) like $1
         )
         or action.message_id in (
           select message.id
           from direct_messages message
           join users sender on sender.id = message.sender_id
           where lower(sender.email::text) like $1
         )
         or action.post_id in (
           select post.id
           from posts post
           join users author on author.id = post.author_id
           where lower(author.email::text) like $1
         )
         or action.report_id in (
           select report.id
           from reports report
           left join direct_messages message on message.id = report.message_id
           left join posts post on post.id = report.post_id
           left join users message_sender on message_sender.id = message.sender_id
           left join users post_author on post_author.id = post.author_id
           where report.reporter_id in (
             select id from users where lower(email::text) like $1
           )
           or report.resolved_by in (
             select id from users where lower(email::text) like $1
           )
           or lower(message_sender.email::text) like $1
           or lower(post_author.email::text) like $1
         )`,
        [emailPattern],
      );
      await client.query(
        `delete from reports report
         where report.reporter_id in (
           select id from users where lower(email::text) like $1
         )
         or report.resolved_by in (
           select id from users where lower(email::text) like $1
         )
         or report.message_id in (
           select message.id
           from direct_messages message
           join users sender on sender.id = message.sender_id
           where lower(sender.email::text) like $1
         )
         or report.post_id in (
           select post.id
           from posts post
           join users author on author.id = post.author_id
           where lower(author.email::text) like $1
         )`,
        [emailPattern],
      );
      await client.query(
        `delete from comments
         where author_id in (
           select id from users where lower(email::text) like $1
         )
         or post_id in (
           select content_post.id
           from posts as content_post
           join users as author on author.id = content_post.author_id
           where lower(author.email::text) like $1
         )`,
        [emailPattern],
      );
      await client.query(
        `delete from posts
         where author_id in (
           select id from users where lower(email::text) like $1
         )`,
        [emailPattern],
      );
      await client.query(
        "delete from users where lower(email::text) like $1",
        [emailPattern],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

export async function deleteE2eUserById(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("E2E user id must be a UUID.");
  }

  const client = new Client({
    connectionString: getE2eDatabaseUrl(),
    connectionTimeoutMillis: 5_000,
  });

  await client.connect();

  try {
    await client.query("delete from users where id = $1", [userId]);
  } finally {
    await client.end();
  }
}

export async function promoteE2eUserToAdmin(email: string) {
  if (!/^99\d+@stu\.yasar\.edu\.tr$/i.test(email)) {
    throw new Error("Only an E2E student account can be promoted.");
  }

  const client = new Client({
    connectionString: getE2eDatabaseUrl(),
    connectionTimeoutMillis: 5_000,
  });

  await client.connect();

  try {
    await client.query("begin");
    const result = await client.query<{
      id: string;
      role: "member" | "moderator" | "admin";
    }>(
      `select id, role
       from users
       where email = $1 and status = 'active' and deleted_at is null
       for update`,
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      throw new Error("E2E admin candidate was not found.");
    }

    const now = new Date();
    await client.query("update users set role = 'admin' where id = $1", [
      user.id,
    ]);
    await client.query(
      "update sessions set revoked_at = $2 where user_id = $1 and revoked_at is null",
      [user.id, now],
    );
    await client.query(
      `insert into moderation_actions (
         actor_id, action, target_user_id, note, created_at
       ) values ($1, 'role_changed', $1, $2, $3)`,
      [user.id, `${user.role} → admin · E2E bootstrap`, now],
    );
    await client.query("commit");

    return user.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
