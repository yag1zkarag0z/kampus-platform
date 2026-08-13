import "server-only";

import { hashAnalyticsSubject } from "@/server/auth/crypto";
import { getDatabase } from "@/server/db/client";
import {
  analyticsEvents,
  type AnalyticsEventProps,
} from "@/server/db/schema";
import { logEvent } from "@/server/observability/logger";

/**
 * Ölçülen olaylar. Liste kapalı bir birlik: serbest metin olay adı, üç ay
 * sonra hangi adın ne anlama geldiğini kimsenin bilmediği bir tabloya
 * dönüşüyor.
 *
 * Seçim ölçütü "ilgi çekici mi" değil, "bir karara etki eder mi":
 * - `account_registered` / `session_started` → büyüme ve geri dönüş (D1/D7)
 * - `post_created` / `comment_created` → üretim, ve kaç kişi hiç üretmiyor
 * - `follow_created` → sosyal grafik kuruluyor mu (soğuk başlangıcın ölçüsü)
 * - `message_sent` → akıştan özele geçiş oluyor mu
 */
export const ANALYTICS_EVENT_NAMES = [
  "account_registered",
  "session_started",
  "user_active_day",
  "post_created",
  "comment_created",
  "follow_created",
  "message_sent",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsActionEventName = Exclude<
  AnalyticsEventName,
  "user_active_day"
>;

const campusDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function campusDateBucket(now: Date) {
  const parts = Object.fromEntries(
    campusDateFormatter
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function writeAnalyticsEvent({
  name,
  userId,
  props,
  activityDate,
}: {
  name: AnalyticsEventName;
  userId?: string | null;
  props: AnalyticsEventProps;
  activityDate?: string;
}) {
  try {
    await getDatabase()
      .insert(analyticsEvents)
      .values({
        name,
        subject: userId ? hashAnalyticsSubject(userId) : null,
        activityDate,
        props,
      })
      .onConflictDoNothing();
  } catch (error) {
    logEvent("warn", "analytics.record_failed", {
      name,
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  }
}

/**
 * Olayı yazar ama asla kullanıcının işlemini bozmaz.
 *
 * Ölçüm ikincil: veritabanı yazımı düşerse gönderi yine paylaşılmış olmalı.
 * Bu yüzden hata yutuluyor ve yalnızca loga düşüyor. Çağıran taraf da
 * `await` etmek zorunda değil.
 */
export async function recordAnalyticsEvent(
  name: AnalyticsActionEventName,
  {
    userId,
    props = {},
  }: { userId?: string | null; props?: AnalyticsEventProps } = {},
) {
  await writeAnalyticsEvent({ name, userId, props });
}

/**
 * D1/D7 gibi geri dönüş metrikleri için kullanıcının aktif olduğu UTC gününü
 * tekilleştirir. Aynı gün uygulama kaç kez açılsa da yalnızca bir satır kalır.
 */
export async function recordDailyActiveUser(
  userId: string,
  now = new Date(),
) {
  await writeAnalyticsEvent({
    name: "user_active_day",
    userId,
    props: {},
    activityDate: campusDateBucket(now),
  });
}
