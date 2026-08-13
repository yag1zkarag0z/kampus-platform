import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseState = vi.hoisted(() => ({
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: () => ({
    insert: () => ({
      values: (...args: unknown[]) => {
        databaseState.values(...args);
        return {
          onConflictDoNothing: databaseState.onConflictDoNothing,
        };
      },
    }),
  }),
}));

const memberId = "0ebc5296-4cc7-494f-91a9-ae1b195b5109";
const otherMemberId = "650e1d64-2b2e-42dd-b9bd-ea268e91588e";

function configureEnvironment() {
  process.env.AUTH_SECRET =
    "kampus-test-secret-that-is-at-least-32-characters";
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = "1025";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASSWORD = "";
  process.env.EMAIL_FROM = "KAMPUS Test <no-reply@kampus.local>";
}

const { recordAnalyticsEvent, recordDailyActiveUser } = await import(
  "./service"
);

describe("recordAnalyticsEvent", () => {
  beforeEach(() => {
    configureEnvironment();
    databaseState.values.mockReset();
    databaseState.onConflictDoNothing
      .mockReset()
      .mockResolvedValue(undefined);
  });

  it("never stores the raw user id", async () => {
    await recordAnalyticsEvent("post_created", { userId: memberId });

    const row = databaseState.values.mock.calls[0]![0];

    expect(row.subject).not.toBe(memberId);
    expect(row.subject).toHaveLength(64);
  });

  it("keeps the subject stable so retention can be computed", async () => {
    await recordAnalyticsEvent("session_started", { userId: memberId });
    await recordAnalyticsEvent("session_started", { userId: memberId });

    const [first] = databaseState.values.mock.calls[0]!;
    const [second] = databaseState.values.mock.calls[1]!;

    expect(first.subject).toBe(second.subject);
  });

  it("gives different members different subjects", async () => {
    await recordAnalyticsEvent("session_started", { userId: memberId });
    await recordAnalyticsEvent("session_started", { userId: otherMemberId });

    const [first] = databaseState.values.mock.calls[0]!;
    const [second] = databaseState.values.mock.calls[1]!;

    expect(first.subject).not.toBe(second.subject);
  });

  it("records a null subject for anonymous traffic", async () => {
    await recordAnalyticsEvent("session_started");

    expect(databaseState.values.mock.calls[0]![0].subject).toBeNull();
  });

  it("keeps the declared props", async () => {
    await recordAnalyticsEvent("post_created", {
      userId: memberId,
      props: { category: "Soru", isAnonymous: true },
    });

    expect(databaseState.values.mock.calls[0]![0].props).toEqual({
      category: "Soru",
      isAnonymous: true,
    });
  });

  it("records a deduplicated Europe/Istanbul activity day", async () => {
    await recordDailyActiveUser(
      memberId,
      new Date("2026-08-13T20:59:59.000Z"),
    );

    expect(databaseState.values.mock.calls[0]![0]).toMatchObject({
      name: "user_active_day",
      activityDate: "2026-08-13",
      props: {},
    });
    expect(databaseState.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("starts a new campus day at Istanbul midnight", async () => {
    await recordDailyActiveUser(
      memberId,
      new Date("2026-08-13T21:00:00.000Z"),
    );

    expect(databaseState.values.mock.calls[0]![0]).toMatchObject({
      activityDate: "2026-08-14",
    });
  });

  it("never breaks the user action when the write fails", async () => {
    databaseState.onConflictDoNothing.mockRejectedValue(
      new Error("db down"),
    );

    // Ölçüm ikincil: gönderi paylaşıldıysa paylaşılmıştır.
    await expect(
      recordAnalyticsEvent("post_created", { userId: memberId }),
    ).resolves.toBeUndefined();
  });
});
