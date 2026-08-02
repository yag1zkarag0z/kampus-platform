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

  try {
    const result = await pool.query<{
      id: string;
      username: string;
      role: string;
    }>(
      `update users
       set role = 'admin'
       where email = $1 and deleted_at is null
       returning id, username, role`,
      [email],
    );

    if (result.rowCount === 0) {
      console.error(
        `"${email}" e-postasıyla aktif bir hesap bulunamadı.`,
      );
      process.exitCode = 1;
      return;
    }

    const user = result.rows[0]!;
    console.log(
      `@${user.username} (${user.id}) artık "${user.role}" rolünde.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
