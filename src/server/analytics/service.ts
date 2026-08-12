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
  "post_created",
  "comment_created",
  "follow_created",
  "message_sent",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

/**
 * Olayı yazar ama asla kullanıcının işlemini bozmaz.
 *
 * Ölçüm ikincil: veritabanı yazımı düşerse gönderi yine paylaşılmış olmalı.
 * Bu yüzden hata yutuluyor ve yalnızca loga düşüyor. Çağıran taraf da
 * `await` etmek zorunda değil.
 */
export async function recordAnalyticsEvent(
  name: AnalyticsEventName,
  {
    userId,
    props = {},
  }: { userId?: string | null; props?: AnalyticsEventProps } = {},
) {
  try {
    await getDatabase()
      .insert(analyticsEvents)
      .values({
        name,
        subject: userId ? hashAnalyticsSubject(userId) : null,
        props,
      });
  } catch (error) {
    logEvent("warn", "analytics.record_failed", {
      name,
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
  }
}
