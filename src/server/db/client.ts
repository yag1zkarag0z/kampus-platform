import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getServerEnvironment } from "@/server/env";
import * as schema from "@/server/db/schema";
import {
  errorLogFields,
  logEvent,
} from "@/server/observability/logger";

function createDatabaseConnection() {
  const { DATABASE_URL } = getServerEnvironment();
  const isProduction = process.env.NODE_ENV === "production";
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: isProduction ? 5 : 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    application_name: "kampus-web",
    ...(isProduction
      ? {
          idle_in_transaction_session_timeout: 10_000,
          query_timeout: 12_000,
          statement_timeout: 10_000,
        }
      : {}),
  });

  pool.on("error", (error) => {
    logEvent("error", "database.idle_client_error", {
      ...errorLogFields(error),
    });
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
