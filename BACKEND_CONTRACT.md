# KAMPÜS Backend Sözleşmesi

Bu belge mevcut frontend davranışını PostgreSQL tabanlı gerçek backend’e
taşırken kullanılacak veri modelini, API sınırlarını ve yetki kurallarını
sabitler. Frontend’deki `localStorage` anahtarları production veri kaynağı
değildir.

## 1. Temel kararlar

- Kimlikler UUID olmalı.
- Bütün tarihler UTC olarak `timestamptz` saklanmalı.
- Liste endpoint’leri cursor pagination kullanmalı.
- Gönderi, yorum ve kullanıcı silme işlemleri soft-delete olmalı.
- Görsel dosyaları veritabanına Base64 olarak yazılmamalı; object storage
  kullanılmalı.
- Kullanıcı rolü, sahiplik, sayaçlar ve oluşturulma zamanı istemciden kabul
  edilmemeli.
- Anonim içerik gerçek `author_id` değerini veritabanında korumalı ancak
  standart API yanıtında bunu açığa çıkarmamalı.

## 2. Enum değerleri

- `user_role`: `member | moderator | admin`
- `account_status`: `active | suspended`
- `post_category`:
  `chat | confession | question | event | lost_found | poll | listing`
- `listing_type`: `sale | wanted | free`
- `listing_condition`: `new | lightly_used | used`
- `notification_kind`:
  `like | comment | reply | mention | follow | announcement`
- `report_reason`:
  `spam | harassment | personal_information | misleading | other`
- `report_status`: `pending | resolved`
- `report_resolution`: `dismissed | content_removed | user_suspended`

## 3. PostgreSQL tabloları

### Hesap ve oturum

`users`

- `id uuid primary key`
- `email citext unique not null`
- `username citext unique not null`
- `display_name varchar(40) not null`
- `department varchar(60) not null`
- `year_label varchar(30) not null`
- `bio varchar(160) not null default ''`
- `avatar_object_key text`
- `role user_role not null default 'member'`
- `status account_status not null default 'active'`
- `suspended_at timestamptz`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz`

Kullanıcı adı:
`^(?=.{3,24}$)[a-z0-9]+(?:[._][a-z0-9]+)*$`.
`anonim`, `sen`, `admin`, `moderator`, `kampus` ve `destek` ayrılmıştır.

`user_settings`

- `user_id uuid primary key references users(id)`
- `show_department boolean`
- `notify_replies boolean`
- `notify_likes boolean`
- `notify_announcements boolean`
- `email_notifications boolean`

`terms_acceptances`

- `user_id uuid references users(id)`
- `terms_version text`
- `accepted_at timestamptz`
- `ip_hash text`
- Primary key: `(user_id, terms_version)`

`otp_challenges`

- `id uuid primary key`
- `email citext`
- `purpose text`
- `code_hash text`
- `expires_at timestamptz`
- `attempt_count smallint`
- `resend_available_at timestamptz`
- `consumed_at timestamptz`

Kod altı haneli, beş dakika geçerli, yeniden gönderme beklemesi 30 saniye ve
maksimum deneme sayısı üç olmalıdır.

`sessions`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `token_hash text unique`
- `expires_at timestamptz`
- `revoked_at timestamptz`
- `created_at timestamptz`

Üye oturumu sekiz saat geçerlidir. Misafir erişimi için kullanıcı kaydı
oluşturulmaz; iki saatlik imzalı guest token yeterlidir.

### İçerik

`posts`

- `id uuid primary key`
- `author_id uuid references users(id)`
- `category post_category`
- `is_anonymous boolean`
- `title varchar(100) not null default ''`
- `body varchar(500) not null default ''`
- `created_at timestamptz`
- `edited_at timestamptz`
- `deleted_at timestamptz`

`post_media`

- `id uuid primary key`
- `post_id uuid references posts(id)`
- `object_key text`
- `width integer`
- `height integer`
- `alt varchar(180)`

`comments`

- `id uuid primary key`
- `post_id uuid references posts(id)`
- `author_id uuid references users(id)`
- `parent_id uuid references comments(id)`
- `is_anonymous boolean`
- `body varchar(500)`
- `created_at timestamptz`
- `edited_at timestamptz`
- `deleted_at timestamptz`

Yanıtın `parent_id` değeri aynı gönderide bulunan kök yorumu göstermelidir.

`post_likes` ve `post_bookmarks`

- `user_id uuid`
- `post_id uuid`
- `created_at timestamptz`
- Bileşik primary key: `(user_id, post_id)`

`polls`, `poll_options`, `poll_votes`

- Bir ankette iki ile dört seçenek bulunabilir.
- Seçenek metni en fazla 60 karakterdir.
- `(poll_id, voter_id)` unique olmalıdır.
- Oy değiştirme yeni satır açmak yerine mevcut seçimi günceller.

`listings`

- `post_id uuid primary key references posts(id)`
- `type listing_type`
- `condition listing_condition`
- `price numeric(12,2)`

İlan anonim veya anket olamaz. `free` fiyatı sıfır, diğer tiplerin fiyatı
`1..1_000_000` aralığında olmalıdır.

### Sosyal ve güvenlik

`follows`

- `follower_id uuid`
- `followed_id uuid`
- `created_at timestamptz`
- Primary key: `(follower_id, followed_id)`
- `check (follower_id <> followed_id)`

`blocks`

- `blocker_id uuid`
- `blocked_id uuid`
- `created_at timestamptz`
- Primary key: `(blocker_id, blocked_id)`

Engelleme transaction’ı iki yöndeki takip ilişkilerini de silmelidir.

`notifications`

- `id uuid primary key`
- `recipient_id uuid`
- `actor_id uuid`
- `kind notification_kind`
- `post_id uuid`
- `comment_id uuid`
- `preview varchar(240)`
- `created_at timestamptz`
- `read_at timestamptz`

`reports`

- `id uuid primary key`
- `reporter_id uuid`
- `post_id uuid`
- `comment_id uuid`
- `reason report_reason`
- `detail varchar(300)`
- `status report_status`
- `resolution report_resolution`
- `resolution_note varchar(240)`
- `resolved_by uuid`
- `reported_at timestamptz`
- `resolved_at timestamptz`

Aynı kullanıcının aynı post veya yorumu açık durumdayken tekrar şikâyet
etmesini engelleyen partial unique index bulunmalıdır.

`moderation_audit`

- `id uuid primary key`
- `actor_id uuid`
- `action text`
- `target_user_id uuid`
- `post_id uuid`
- `comment_id uuid`
- `note varchar(240)`
- `metadata jsonb`
- `created_at timestamptz`

Bu tablo append-only olmalıdır.

## 4. API endpoint’leri

### Authentication

- `POST /v1/auth/code/request`
- `POST /v1/auth/code/verify`
- `POST /v1/auth/register`
- `GET /v1/session`
- `POST /v1/auth/logout`

### Profil

- `GET /v1/users/:username`
- `PATCH /v1/me/profile`
- `PATCH /v1/me/settings`
- `POST /v1/me/avatar/upload-url`
- `DELETE /v1/me/avatar`

### Gönderi ve yorum

- `GET /v1/posts?category=&sort=&author=&cursor=`
- `POST /v1/posts`
- `GET /v1/posts/:id`
- `PATCH /v1/posts/:id`
- `DELETE /v1/posts/:id`
- `POST /v1/posts/:id/comments`
- `PATCH /v1/comments/:id`
- `DELETE /v1/comments/:id`
- `PUT /v1/posts/:id/like`
- `DELETE /v1/posts/:id/like`
- `PUT /v1/posts/:id/bookmark`
- `DELETE /v1/posts/:id/bookmark`
- `PUT /v1/polls/:pollId/vote`
- `GET /v1/me/bookmarks`

### Takip ve engelleme

- `GET /v1/users/:id/followers?cursor=`
- `GET /v1/users/:id/following?cursor=`
- `PUT /v1/users/:id/follow`
- `DELETE /v1/users/:id/follow`
- `PUT /v1/users/:id/block`
- `DELETE /v1/users/:id/block`

### Bildirim ve moderasyon

- `GET /v1/notifications?cursor=&unread=`
- `PATCH /v1/notifications/:id/read`
- `POST /v1/notifications/read-all`
- `POST /v1/reports`
- `GET /v1/admin/reports?status=&cursor=`
- `PATCH /v1/admin/reports/:id/resolve`
- `PATCH /v1/admin/users/:id/status`
- `PATCH /v1/admin/users/:id/role`
- `GET /v1/admin/audit?cursor=`

## 5. Ortak yanıt biçimleri

Liste yanıtı:

```json
{
  "data": [],
  "page": {
    "nextCursor": "opaque-or-null",
    "hasMore": false
  }
}
```

Hata yanıtı:

```json
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Gönderi bulunamadı.",
    "fieldErrors": {}
  }
}
```

Post DTO’su sayaçları ve kullanıcıya özel durumu ayrı taşımalıdır:

```json
{
  "likeCount": 42,
  "commentCount": 8,
  "viewerState": {
    "liked": false,
    "bookmarked": true,
    "selectedPollOptionId": null
  }
}
```

## 6. Yetki matrisi

- Guest: yalnızca filtrelenmiş public okuma.
- Active member: kendi profil ve içeriğini düzenleme, etkileşim, takip,
  engelleme ve şikâyet.
- Moderator: üye yetkileri, şikâyet çözme, içerik kaldırma ve member hesaplarını
  askıya alma.
- Admin: moderator yetkileri ve rol yönetimi.
- Suspended kullanıcı: bütün yazma işlemleri reddedilir ve aktif oturumları
  iptal edilir.

Kullanıcı kendi rolünü değiştiremez. Son admin düşürülemez. Moderator admin
hesabını yönetemez.

## 7. Güvenlik kuralları

- OTP yalnızca `@stu.yasar.edu.tr` adresine gönderilmeli.
- OTP kodu hash’lenmeli; e-posta ve IP bazlı rate limit uygulanmalı.
- Session token yalnızca `httpOnly`, `secure`, `sameSite=lax` cookie ile
  taşınmalı.
- CSRF koruması bütün state-changing cookie endpoint’lerinde uygulanmalı.
- Sahiplik ve rol kontrolleri servis katmanı ile PostgreSQL policy/RLS
  katmanında birlikte yapılmalı.
- Upload MIME değeri sunucuda doğrulanmalı ve görsel yeniden kodlanmalı.
- Post görseli kaynak limiti 5 MB, avatar kaynak limiti 2 MB olmalı.
- Like, bookmark, follow, block ve vote endpoint’leri idempotent olmalı.
- Moderasyon hareketleri değiştirilemez audit kaydı üretmeli.

## 8. Uygulama sırası

1. PostgreSQL migration ve seed verisi
2. Auth/OTP/session
3. Profil ve ayarlar
4. Gönderi/yorum CRUD
5. Like, bookmark, poll ve ilan
6. Follow, block ve report
7. Notifications
8. Admin/moderation
9. Upload/object storage
10. Frontend provider’larını API client ile değiştirme
11. Entegrasyon ve E2E testlerinin gerçek backend’e geçirilmesi
