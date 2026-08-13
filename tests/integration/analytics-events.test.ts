import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

import {
  recordAnalyticsEvent,
  recordDailyActiveUser,
} from "@/server/analytics/service";
import { hashAnalyticsSubject } from "@/server/auth/crypto";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});

afterAll(async () => {
  await pool.end();
});

describe("analytics events with PostgreSQL", () => {
  it("persists action events and deduplicates daily activity", async () => {
    const userId = randomUUID();
    const subject = hashAnalyticsSubject(userId);

    try {
      await recordAnalyticsEvent("post_created", {
        userId,
        props: { category: "Soru", isAnonymous: false },
      });
      await recordDailyActiveUser(
        userId,
        new Date("2026-08-13T01:00:00.000Z"),
      );
      await recordDailyActiveUser(
        userId,
        new Date("2026-08-13T23:00:00.000Z"),
      );
      await recordDailyActiveUser(
        userId,
        new Date("2026-08-14T00:00:00.000Z"),
      );

      const stored = await pool.query<{
        name: string;
        activity_date: string | null;
        props: Record<string, unknown>;
      }>(
        `select name, activity_date::text, props
         from analytics_events
         where subject = $1
         order by activity_date nulls first`,
        [subject],
      );

      expect(stored.rows).toHaveLength(3);
      expect(stored.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "post_created",
            activity_date: null,
            props: { category: "Soru", isAnonymous: false },
          }),
          expect.objectContaining({
            name: "user_active_day",
            activity_date: "2026-08-13",
          }),
          expect.objectContaining({
            name: "user_active_day",
            activity_date: "2026-08-14",
          }),
        ]),
      );
    } finally {
      await pool.query("delete from analytics_events where subject = $1", [
        subject,
      ]);
    }
  });
});
