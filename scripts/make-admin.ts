import "dotenv/config";

import { Pool } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    console.error("Kullanım: npm run db:make-admin -- <ogrenci@stu.yasar.edu.tr>");
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    console.error(
      "DATABASE_URL tanımlı değil. .env dosyasını kontrol et.",
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("begin");
    const result = await client.query<{
      id: string;
      username: string;
      role: string;
    }>(
      `select id, username, role
       from users
       where email = $1
         and status = 'active'
         and deleted_at is null
       for update`,
      [email],
    );

    if (result.rowCount === 0) {
      console.error(
        `"${email}" e-postasıyla aktif bir hesap bulunamadı.`,
      );
      process.exitCode = 1;
      await client.query("rollback");
      return;
    }

    const user = result.rows[0]!;

    if (user.role === "admin") {
      await client.query("commit");
      console.log(`@${user.username} zaten "admin" rolünde.`);
      return;
    }

    const now = new Date();

    await client.query("update users set role = 'admin' where id = $1", [
      user.id,
    ]);
    await client.query(
      `update sessions
       set revoked_at = $2
       where user_id = $1 and revoked_at is null`,
      [user.id, now],
    );
    await client.query(
      `insert into moderation_actions (
         actor_id,
         action,
         target_user_id,
         note,
         created_at
       ) values ($1, 'role_changed', $1, $2, $3)`,
      [user.id, `${user.role} → admin · CLI bootstrap`, now],
    );
    await client.query("commit");

    console.log(
      `@${user.username} (${user.id}) artık "admin" rolünde. Açık oturumları kapatıldı ve işlem audit kaydına yazıldı.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
