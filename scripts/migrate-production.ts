import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { getServerEnvironment } from "@/server/env";
import { applyPlatformEnvironmentDefaults } from "@/server/platform-environment";

async function main() {
  loadEnvConfig(process.cwd(), false);
  const source = applyPlatformEnvironmentDefaults();
  const { DATABASE_URL } = getServerEnvironment(source);
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
    application_name: "kampus-migrator",
  });

  try {
    const database = drizzle({ client: pool });
    await migrate(database, {
      migrationsFolder: "drizzle",
      migrationsSchema: "public",
      migrationsTable: "__drizzle_migrations",
    });
    console.log("KAMPÜS database migrations completed.");
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
