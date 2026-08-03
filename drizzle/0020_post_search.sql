CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
-- Türkçe için PostgreSQL'de stemmer yok; arama karşılaştırması bu yüzden
-- küçük harfe indirgenmiş ve aksanı sadeleştirilmiş metin üzerinden yapılır.
-- Fonksiyon IMMUTABLE olmak zorunda, çünkü ifade indeksinde kullanılıyor:
-- gövdesi değişirse indeksin yeniden oluşturulması gerekir.
CREATE OR REPLACE FUNCTION kampus_search_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
AS $$
  SELECT translate(
    lower(value),
    'ÇĞİIÖŞÜçğıöşü',
    'cgiiosucgiosu'
  )
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "posts_search_trgm_idx"
  ON "posts"
  USING gin (
    kampus_search_text("title" || ' ' || "body") gin_trgm_ops
  )
  WHERE "deleted_at" IS NULL;
