import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date", precision: 3 });

export type AnalyticsEventProps = Record<string, string | number | boolean>;

/**
 * Ürün ölçümü.
 *
 * Tek amacı "kaç kişi ertesi gün geri geldi" sınıfı sorulara cevap vermek;
 * bunun için olayların aynı kişiye ait olduğunun bilinmesi gerekiyor ama
 * kimin olduğunun bilinmesi gerekmiyor. Bu yüzden `subject` kullanıcı
 * kimliğinin kendisi değil, HMAC'lı takma karşılığı: olaylar arasında sabit,
 * geriye çevrilemez. Misafirlerde null.
 *
 * `users` tablosuna foreign key yok. Kasıtlı: hesap silindiğinde ölçüm
 * geçmişinin çökmesi istenmiyor, zaten takma kimlik kimseyi işaret etmiyor.
 * Sonsuza kadar da büyümesin diye saklama süresi
 * `DATA_RETENTION_POLICY.analyticsEventMs` ile sınırlı.
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subject: varchar("subject", { length: 64 }),
    name: varchar("name", { length: 48 }).notNull(),
    activityDate: date("activity_date", { mode: "string" }),
    props: jsonb("props").$type<AnalyticsEventProps>().notNull().default({}),
    createdAt: timestampWithTimezone("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Huni ve hacim sorguları olay adına göre daralıyor.
    index("analytics_events_name_created_at_idx").on(
      table.name,
      table.createdAt,
    ),
    // Retention sorgusu aynı takma kimliğin günlerini yan yana getiriyor.
    index("analytics_events_subject_created_at_idx").on(
      table.subject,
      table.createdAt,
    ),
    // Bir kullanıcının aynı kampüs günündeki birden fazla sayfa açılışı tek aktif
    // gün sayılır. Diğer olaylarda activityDate null olduğu için etkilenmez.
    uniqueIndex("analytics_events_daily_activity_unique")
      .on(table.subject, table.name, table.activityDate)
      .where(sql`${table.activityDate} is not null`),
    check(
      "analytics_events_name_check",
      sql`${table.name} in (
        'account_registered', 'session_started', 'user_active_day',
        'post_created', 'comment_created', 'follow_created', 'message_sent'
      )`,
    ),
    check(
      "analytics_events_activity_shape_check",
      sql`(
        ${table.name} = 'user_active_day'
        and ${table.subject} is not null
        and ${table.activityDate} is not null
      ) or (
        ${table.name} <> 'user_active_day'
        and ${table.activityDate} is null
      )`,
    ),
  ],
);
