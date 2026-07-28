import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const database = drizzle({ client: pool });

afterAll(async () => {
  await pool.end();
});

describe("PostgreSQL integration", () => {
  it("executes a query through Drizzle", async () => {
    const result = await database.execute(sql`select 1::int as value`);

    expect(result.rows).toHaveLength(1);
    expect(Number(result.rows[0]?.value)).toBe(1);
  });
});
