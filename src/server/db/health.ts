import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "./client";

export type DatabaseHealthStatus = "up" | "down";

type DatabaseHealthOptions = {
  query?: () => Promise<unknown>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 3_000;

export async function checkDatabaseHealth({
  query = () => getDatabase().execute(sql`select 1 as health`),
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: DatabaseHealthOptions = {}): Promise<DatabaseHealthStatus> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      query(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Database health check timed out.")),
          Math.max(1, timeoutMs),
        );
      }),
    ]);

    return "up";
  } catch {
    return "down";
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
