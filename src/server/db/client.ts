import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getServerEnvironment } from "@/server/env";
import * as schema from "@/server/db/schema";

function createDatabaseConnection() {
  const { DATABASE_URL } = getServerEnvironment();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    application_name: "kampus-web",
  });

  pool.on("error", () => {
    console.error("[database] Unexpected error on an idle PostgreSQL client.");
  });

  return {
    database: drizzle({ client: pool, schema }),
    pool,
  };
}

type DatabaseConnection = ReturnType<typeof createDatabaseConnection>;

const globalForDatabase = globalThis as typeof globalThis & {
  __kampusDatabaseConnection?: DatabaseConnection;
};

export function getDatabaseConnection(): DatabaseConnection {
  if (!globalForDatabase.__kampusDatabaseConnection) {
    globalForDatabase.__kampusDatabaseConnection = createDatabaseConnection();
  }

  return globalForDatabase.__kampusDatabaseConnection;
}

export function getDatabase() {
  return getDatabaseConnection().database;
}
