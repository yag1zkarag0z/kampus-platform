import {
  index,
  jsonb,
  pgTable,
  timestamp,
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
  ],
);
