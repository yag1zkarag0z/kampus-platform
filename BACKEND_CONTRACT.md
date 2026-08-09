# KAMPÜS Backend Sözleşmesi

Bu belge KAMPÜS backend'inin veri modelini, API sınırlarını, hata biçimlerini
ve yetki kurallarını tanımlar. İçerik koddan türetilmiştir; kod ile belge
çeliştiğinde kod esastır ve belge güncellenmelidir.

Üye oturumunda bütün veri PostgreSQL'den gelir. Frontend'deki `localStorage`
kullanımı yalnızca misafir görünümüne aittir ve production veri kaynağı
değildir.

## 0. Güncel uygulama durumu

Bu bölüm dışındaki tablolar, endpoint'ler ve kurallar **uygulanmış durumu**
tarif eder; belge koddan türetilmiştir. Henüz tamamlanmamış işler bu bölümün
sonunda ayrıca listelenir.

Şu anda PostgreSQL'e bağlı olan kapsam:

- `posts` ve `comments` tabloları, indeksleri ve migration'ları
- Üye akışını listeleme, gönderi detayını yorumlarıyla okuma
- Gönderi ve yorum oluşturma, sahibinin düzenlemesi ve soft-delete ile silmesi
- En yeni gönderiler için kategori/yazar filtreli, sorguya bağlı opaque cursor
  pagination
- Aynı gönderideki kök yoruma yanıt verme ve silinen yorumları tombstone olarak
  koruma
- Aktif üye, sahiplik, same-origin, katı istek doğrulama ve içerikte URL
  engelleme kontrolleri
- Yorum oluşturmada üye başına dakikada 20 istek sınırı ve bir gönderide
  soft-delete kayıtları dahil en fazla 500 yorum sınırı
- Yanıtın üst yorumuyla aynı gönderiye ait olmasını ve yorumun kendisine yanıt
  verememesini PostgreSQL seviyesinde doğrulayan bütünlük kuralları
- Anonim gönderi ve yorumlarda `author_id` değerini standart API yanıtından
  gizleme; anonim gönderileri yazar filtresine dahil etmeme
- Kullanıcı başına idempotent beğeni ve kaydetme işlemleri; gerçek beğeni
  sayaçları ve beğeni sayısına göre cursor tabanlı popüler akış
- Bütün liste endpoint'lerinde cursor pagination: bildirimler, takipçi/takip,
  engellenenler, moderasyon şikâyetleri, moderasyon kullanıcıları ve moderasyon
  geçmişi. Ortak biçim `server/pagination/cursor.ts` içinde tanımlıdır;
  cursor `(createdAt, id)` ikilisini taşır ve üretildiği sorguya bağlanır
  (ör. bekleyen şikâyet cursor'ı çözülmüş listede reddedilir). Varsayılan
  sayfa boyutu 20, en fazla 50.
- Gönderi araması: `GET /v1/posts?q=` başlık ve gövdede arar. Karşılaştırma
  `kampus_search_text()` ile küçük harfe indirgenmiş ve Türkçe aksanı
  sadeleştirilmiş metin üzerinde yapılır; aynı ifade `posts_search_trgm_idx`
  (pg_trgm GIN) indeksinde tanımlıdır. Arama metni 2-80 karakter olmalı, LIKE
  joker karakterleri düz metin olarak aranır ve cursor sorguya bağlanır.
  Kategori ve yazar filtreleriyle birlikte çalışır.
- `sort=trending`: son 7 gündeki gönderileri `beğeni * 3 + yorum * 2`
  etkileşim puanına göre sıralar. Cursor puanı da taşır.
- Çift yönlü engelleme görünürlüğü: engelleyen ve engellenen taraf birbirinin
  içeriğini akışta, kaydedilenlerde, gönderi detayında, yorum ve yanıtlarda,
  profil ile profil gönderilerinde, takipçi/takip listelerinde ve
  bildirimlerde göremez. Doğrudan URL ile açılan gönderi de "bulunamadı"
  döner; engelli çift arasında like, comment, reply, mention ve follow
  bildirimi hiç üretilmez. Kural `server/social/blocking.ts` içinde tek
  yerde tanımlıdır.
- Profil görünürlüğü engelin yönüne göre asimetriktir: engelleyen taraf
  profili `blockedByViewer: true` ile açar (sayaçlar sıfır, içerik ve sosyal
  grafik gizli), engellenen taraf ise `USER_NOT_FOUND` alır ve profilin
  varlığını öğrenemez.
- Kaydedilenler listesi: kaydetme zamanına göre azalan sıralı, opaque cursor
  pagination'lı `GET /v1/me/bookmarks`. Silinmiş gönderiler ile silinmiş,
  askıya alınmış veya engellenmiş yazarların gönderileri listeden düşer;
  kayıt satırı veritabanında korunur.
- Anket ve oy: iki ile dört seçenek, oy değiştirme mevcut satırı günceller,
  `(poll_id, user_id)` tekildir.
- İlan: `sale | wanted | free` tipi, durum ve fiyat doğrulaması. İlan anonim
  olamaz, başlık ve açıklama zorunludur.
- Medya: sunucuda yeniden kodlanan WebP görseller, `media_assets` +
  `post_images` tabloları, S3 uyumlu object storage ve `GET /v1/media/:id`
  üzerinden yetki kontrollü servis.
- Takip, engelleme, şikâyet, bildirim ve admin/moderasyon akışlarının tamamı
  PostgreSQL'e bağlıdır; moderasyon hareketleri `moderation_actions` tablosuna
  yazılır.
- Kötüye kullanım koruması: ortak hız sınırı katmanı (`rate_limit_hits`) ve
  görselli gönderiler için otomatik gizleme eşiği. Ayrıntı §7'de.

Kalıcı gönderi oluşturma yedi kategorinin tamamını destekler:
`chat | confession | question | event | lost_found | poll | listing`.

Misafir görünümü üye içerik API'sini çağırmaz. Yalnızca frontend paketindeki
salt okunur, seçilmiş 20 KAMPÜS gönderisini gösterir; PostgreSQL'deki gerçek üye
akışı misafire açılmaz. Bu bilinçli bir tasarım tercihidir, geçici bir durum
değildir.

Henüz tamamlanmamış kapsam:

- Yüklenen görsellerde otomatik NSFW taraması (AWS Rekognition planlı)
- E-posta bildirimi gönderimi: `user_settings.email_notifications` alanı
  saklanıyor ancak arkasında çalışan bir worker yok
- Süresi dolmuş OTP, session, bağlanmamış medya ve eski `rate_limit_hits`
  kayıtları için temizlik görevleri
- Least-privileged PostgreSQL rolü ve RLS politikaları

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
- `report_target_type`: `post | comment`
- `report_status`: `pending | resolved`
- `report_resolution`: `dismissed | content_removed | user_suspended`
- `moderation_action_type`:
  `report_dismissed | content_removed | content_hidden | content_restored |
  user_suspended | user_restored | role_changed`
- `otp_delivery_status`: `pending | delivered | failed`

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
- `show_department boolean not null default false`
- `notify_replies boolean not null default true`
- `notify_likes boolean not null default true`
- `notify_announcements boolean not null default true`
- `notify_comments boolean not null default true`
- `notify_follows boolean not null default true`
- `notify_mentions boolean not null default true`
- `email_notifications boolean not null default true`

`email_notifications` şu anda yalnızca saklanır; e-posta gönderen bir worker
bulunmadığı için davranışa etkisi yoktur.

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
- `request_ip_hash text`
- `delivery_status otp_delivery_status`
- `delivered_at timestamptz`
- `delivery_failed_at timestamptz`
- `expires_at timestamptz`
- `attempt_count smallint`
- `resend_available_at timestamptz`
- `verified_at timestamptz`
- `invalidated_at timestamptz`
- `consumed_at timestamptz`
- `created_at timestamptz`

Kod altı haneli, beş dakika geçerli, yeniden gönderme beklemesi 30 saniye ve
maksimum deneme sayısı üç olmalıdır.
`purpose` yalnızca `registration | login` olabilir. IP tabanlı hız sınırı için
ham IP yerine `request_ip_hash` saklanır.
Bir e-posta adresi saatte en fazla beş, bir IP özeti saatte en fazla yirmi kod
isteyebilir. Yeni kod başarıyla gönderildiğinde aynı e-posta ve amaç için önceki
aktif kod geçersiz kılınır. Kayıt kodu doğrulandığında `verified_at` yazılır ve
15 dakika geçerli, imzalı, tek kullanımlık bir kayıt bileti verilir;
`consumed_at` ancak kayıt transaction'ı tamamlandığında yazılır.
Kod isteği önce kısa bir transaction ile `pending` olarak ayrılır. SMTP gönderimi
veritabanı transaction'ı dışında yapılır; ardından kod atomik olarak `delivered`
veya `failed` durumuna geçirilir. Başarısız gönderimler de hız sınırında sayılır
ve doğrulamada kullanılamaz.

`sessions`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `token_hash text unique`
- `issued_role user_role`
- `expires_at timestamptz`
- `revoked_at timestamptz`
- `created_at timestamptz`

Member oturumu 30 gün, moderator ve admin oturumu sekiz saat geçerlidir.
Session oluşturulurken rol `issued_role` alanına sabitlenir; kullanıcının güncel
rolü bu değerle uyuşmuyorsa session geçersizdir. Misafir erişimi için kullanıcı
kaydı oluşturulmaz; iki saatlik imzalı guest token yeterlidir.

### İçerik

`posts`

- `id uuid primary key`
- `author_id uuid references users(id)`
- `category post_category`
- `is_anonymous boolean`
- `title varchar(100) not null default ''`
- `body varchar(500) not null default ''`
- `gif_id varchar(80)`, `gif_url varchar(2048)`, `gif_width integer`,
  `gif_height integer`, `gif_alt varchar(160)`
- `created_at timestamptz`
- `edited_at timestamptz`
- `hidden_at timestamptz`
- `deleted_at timestamptz`

Başlık veya gövdeden en az biri boş olmayacak şekilde check kısıtı vardır.
GIF alanları ya tamamen boş ya da tamamı dolu olmalıdır. `hidden_at` otomatik
gizlemeyi taşır ve silme değildir; §7'ye bakınız.

`media_assets`

- `id uuid primary key`
- `owner_id uuid references users(id)`
- `storage_key varchar(255) unique`
- `mime_type varchar(32)` — yalnızca `image/webp`
- `size_bytes integer`, `width integer`, `height integer`
- `checksum varchar(64)`
- `created_at timestamptz`

`post_images`

- `post_id uuid primary key references posts(id)`
- `asset_id uuid unique references media_assets(id)`
- `alt varchar(160) not null`
- `created_at timestamptz`

Bir gönderiye en fazla bir görsel bağlanır ve bir görsel yalnızca tek gönderide
kullanılabilir. Dosyanın kendisi object storage'da tutulur, veritabanında
yalnızca `storage_key` saklanır.

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

- `post_id uuid`
- `user_id uuid`
- `created_at timestamptz`
- Bileşik primary key: `(post_id, user_id)`
- `(user_id, created_at desc)` indeksi kaydedilenler sayfalamasını besler.

`polls`, `poll_options`, `poll_votes`

- Bir ankette iki ile dört seçenek bulunabilir (`position` 0..3).
- Seçenek metni en fazla 60 karakterdir.
- `poll_votes` primary key `(poll_id, user_id)`.
- Oy değiştirme yeni satır açmak yerine mevcut seçimi günceller.
- `(option_id, poll_id)` bileşik foreign key'i, oyun aynı ankete ait bir
  seçeneği göstermesini veritabanı seviyesinde garanti eder.

`listings`

- `post_id uuid primary key references posts(id)`
- `type listing_type`
- `condition listing_condition`
- `price integer`

İlan anonim veya anket olamaz. `free` fiyatı sıfır, diğer tiplerin fiyatı
`1..1_000_000` aralığında olmalıdır.

### Sosyal ve güvenlik

`follows`

- `follower_id uuid`
- `following_id uuid`
- `created_at timestamptz`
- Primary key: `(follower_id, following_id)`
- `check (follower_id <> following_id)`

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
- `like_count integer`
- `read_at timestamptz`
- `created_at timestamptz`

Metin istemcide üretilir, veritabanında saklanmaz. `check` kısıtı türe göre
alan şeklini zorlar: `follow` hedefsizdir, `like` gönderi ve `like_count >= 1`
ister, `comment | reply | mention` hem gönderi hem yorum ister. Kendine
bildirim üretilemez. `like` bildirimleri alıcı ve gönderi başına tekildir;
tekrarlanan beğeniler sayacı günceller, yeni satır açmaz.

`reports`

- `id uuid primary key`
- `reporter_id uuid`
- `target_type report_target_type`
- `target_id uuid`
- `post_id uuid references posts(id)`
- `reason report_reason`
- `detail varchar(300) not null default ''`
- `status report_status not null default 'pending'`
- `resolution report_resolution`
- `resolution_note varchar(240)`
- `resolved_by uuid`
- `resolved_at timestamptz`
- `created_at timestamptz`

Hedef `target_type` + `target_id` ile gösterilir; `post_id` yorum
şikâyetlerinde de yorumun ait olduğu gönderiyi taşır, böylece moderasyon
listesi tek join ile bağlam kurar. `(reporter_id, target_type, target_id)`
unique'tir. `check` kısıtı çözüm alanlarının durumla tutarlı olmasını zorlar.

`moderation_actions`

- `id uuid primary key`
- `actor_id uuid references users(id)` — otomatik işlemlerde `null`
- `action moderation_action_type`
- `report_id uuid references reports(id)`
- `target_user_id uuid references users(id)`
- `post_id uuid references posts(id)`
- `note varchar(240)`
- `created_at timestamptz`

Bu tablo append-only'dir. Satırlar uygulama tarafından güncellenemez; yalnızca
365 günlük saklama süresi dolunca bakım görevi tarafından silinir. Audit zinciri
silinmeden kullanıcı, rapor veya gönderi hard-delete edilemez. `actor_id` yalnızca
otomatik gizlemede boştur; insan kararlarında her zaman doludur.

`rate_limit_hits`

- `id uuid primary key`
- `user_id uuid references users(id)`
- `action varchar(40)`
- `created_at timestamptz`

Yazma işlemlerinin hız sınırı sayaçları. Beğeni, kaydetme ve takip geri
alınabildiği için kendi tablolarını saymak sınırı uygulamaya yetmez: kullanıcı
satırı silip yeniden ekleyerek sayacı sıfırlardı. Tablo yalnızca eklenir;
eski kayıtları temizlik görevi toplamalıdır.

## 4. API endpoint’leri

Aşağıdaki liste koddaki rotaların tamamıdır; method ve path'ler birebir
eşleşir. Kullanıcıya göre adreslenen uçlar `:id` değil `:username` alır.

### Authentication

- `POST /v1/auth/code/request`
- `POST /v1/auth/code/verify`
- `POST /v1/auth/register`
- `POST /v1/auth/guest`
- `POST /v1/auth/development` — yalnızca development ortamında
- `POST /v1/auth/logout`
- `GET /v1/session`
- `GET /v1/health`

### Profil ve hesap

- `GET /v1/users/:username`
- `GET /v1/users/:username/avatar`
- `PATCH /v1/me/profile`
- `DELETE /v1/me/profile` — hesap silme
- `PATCH /v1/me/settings`
- `POST /v1/me/avatar` — multipart yükleme
- `DELETE /v1/me/avatar`

### Gönderi ve yorum

- `GET /v1/posts?q=&category=&sort=&author=&scope=&cursor=&limit=`
- `POST /v1/posts`
- `GET /v1/posts/:id`
- `PATCH /v1/posts/:id`
- `DELETE /v1/posts/:id`
- `POST /v1/posts/:id/comments`
- `PATCH /v1/comments/:id`
- `DELETE /v1/comments/:id`
- `PUT /v1/posts/:id/like` · `DELETE /v1/posts/:id/like`
- `PUT /v1/posts/:id/bookmark` · `DELETE /v1/posts/:id/bookmark`
- `PUT /v1/polls/:id/vote`
- `GET /v1/me/bookmarks?cursor=&limit=`

`sort` değerleri: `newest | popular | trending`. `scope`: `global | following`.
`q` 2-80 karakter olmalıdır.

### Medya

- `POST /v1/media` — multipart yükleme, WebP'ye yeniden kodlanır
- `GET /v1/media/:id` — yetki kontrollü servis
- `DELETE /v1/media/:id` — gönderiye bağlanmamış görseli siler
- `POST /v1/media/documents` — PDF yükleme
- `GET /v1/media/documents/:id` — yetki kontrollü, zorunlu indirme
- `DELETE /v1/media/documents/:id` — gönderiye bağlanmamış PDF'i siler

### Takip ve engelleme

- `GET /v1/users/:username/followers?cursor=&limit=`
- `GET /v1/users/:username/following?cursor=&limit=`
- `POST /v1/users/:username/follow` · `DELETE /v1/users/:username/follow`
- `POST /v1/users/:username/block` · `DELETE /v1/users/:username/block`
- `GET /v1/me/blocks?cursor=&limit=`
- `GET /v1/me/suggested-follows`

### Bildirim

- `GET /v1/me/notifications?cursor=&limit=`
- `GET /v1/me/notifications/unread-count`
- `PATCH /v1/me/notifications/:id/read`
- `POST /v1/me/notifications/read-all`

### Şikâyet ve moderasyon

- `POST /v1/reports`
- `GET /v1/moderation/reports?status=&cursor=&limit=`
- `POST /v1/moderation/reports/:id/resolve`
- `GET /v1/moderation/users?cursor=&limit=`
- `PATCH /v1/moderation/users/:id/status`
- `PATCH /v1/moderation/users/:id/role`
- `GET /v1/moderation/history?cursor=&limit=`

## 5. Ortak yanıt biçimleri

Başarılı yanıtların tamamı `data` zarfı taşır. Bütün endpoint'ler
`Cache-Control: no-store` döner.

Tekil kayıt:

```json
{ "data": { } }
```

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

Cursor opaque'tir ve üretildiği sorguya bağlıdır: farklı filtre, sıralama veya
kapsamla gönderilen cursor `INVALID_REQUEST` ile reddedilir. Varsayılan sayfa
boyutu 20, en fazla 50.

Post DTO'su sayaçları ve kullanıcıya özel durumu ayrı taşır:

```json
{
  "likeCount": 42,
  "commentCount": 8,
  "viewerState": {
    "isAuthor": false,
    "canEdit": false,
    "canDelete": false,
    "liked": false,
    "bookmarked": true,
    "hidden": false,
    "selectedPollOptionId": null
  }
}
```

`viewerState.hidden` yalnızca yazarına `true` dönebilir; gizlenmiş gönderi
başka hiçbir görüntüleyene servis edilmez.

### Hata yanıtı

```json
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Gönderi bulunamadı veya artık görüntülenemiyor.",
    "fieldErrors": {},
    "attemptsLeft": 2,
    "retryAfterSeconds": 60
  }
}
```

`fieldErrors` her zaman bulunur (boş olabilir). `attemptsLeft` yalnızca OTP
doğrulamasında, `retryAfterSeconds` yalnızca hız sınırı ve OTP bekleme
durumlarında yer alır; `retryAfterSeconds` döndüğünde aynı değer `Retry-After`
başlığına da yazılır.

### Hata kodları

| Kod | Tipik durum |
| --- | --- |
| `INVALID_REQUEST` | 400 — doğrulama, bilinmeyen alan, bozuk cursor |
| `INVALID_ORIGIN` | 403 — same-origin kontrolü |
| `AUTHENTICATION_REQUIRED` | 401 — oturum yok veya geçersiz |
| `AUTHORIZATION_REQUIRED` | 403 — rol yetersiz |
| `ACCOUNT_INACTIVE` | 403 — askıya alınmış hesap |
| `ACCOUNT_NOT_FOUND` | 404 |
| `USER_NOT_FOUND` | 404 — profil yok veya engel nedeniyle gizli |
| `USERNAME_TAKEN` | 409 |
| `EMAIL_ALREADY_REGISTERED` | 409 |
| `POST_NOT_FOUND` | 404 — silinmiş, gizlenmiş veya engelli taraf |
| `COMMENT_NOT_FOUND` | 404 |
| `MEDIA_NOT_FOUND` | 404 |
| `AVATAR_NOT_FOUND` | 404 |
| `NOTIFICATION_NOT_FOUND` | 404 |
| `CONTENT_FORBIDDEN` | 403 — sahiplik kontrolü |
| `CONTENT_LIMIT_REACHED` | 409 — gönderi başına yorum tavanı |
| `CONTENT_RATE_LIMITED` | 429 — hız sınırı, `retryAfterSeconds` taşır |
| `OTP_RATE_LIMITED` | 429 — e-posta/IP kod isteği sınırı |
| `OTP_COOLDOWN` | 429 — yeniden gönderme beklemesi |
| `OTP_NOT_READY` | 409 — kod henüz gönderilmedi |
| `OTP_NOT_FOUND` · `OTP_EXPIRED` · `OTP_USED` | 400/410 |
| `OTP_INCORRECT` | 400 — `attemptsLeft` taşır |
| `OTP_LOCKED` | 429 — deneme hakkı bitti |
| `INVALID_REGISTRATION_GRANT` | 400 — kayıt bileti geçersiz |
| `EMAIL_DELIVERY_FAILED` | 502 |
| `SESSION_REVOCATION_FAILED` | 500 |
| `AUTH_CONFIGURATION_ERROR` | 500 — beklenmeyen sunucu hatası |

Hata gövdesi hiçbir zaman yığın izi, SQL metni veya iç kimlik sızdırmaz;
beklenmeyen hatalar `AUTH_CONFIGURATION_ERROR` altında genel mesajla döner.

## 6. Yetki matrisi

- Guest: mevcut sürümde yalnızca paketlenmiş 20 seçilmiş gönderiyi salt okunur
  görür; üye gönderi API'sine erişemez. İleride gerçek public okuma açılacaksa
  ayrı görünürlük ve moderasyon politikası gerektirir.
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

- OTP yalnızca `öğrenci-numarası@stu.yasar.edu.tr` biçimindeki adreslere
  gönderilmeli; `@` öncesinde yalnızca rakam bulunmalı.
- OTP kodu hash’lenmeli; e-posta ve IP bazlı rate limit uygulanmalı.
- İstemci IP’si yalnızca deployment tarafından üzerine yazılan, açıkça
  yapılandırılmış tek bir trusted proxy başlığından okunmalı.
- Session token yalnızca `httpOnly`, `secure`, `sameSite=lax` cookie ile
  taşınmalı.
- CSRF koruması bütün state-changing cookie endpoint’lerinde uygulanmalı.
- Sahiplik ve rol kontrolleri servis katmanındadır. Least-privileged uygulama
  rolü ve PostgreSQL RLS politikaları production sertleştirmesi olarak henüz
  uygulanmamıştır.
- Upload MIME değeri sunucuda doğrulanır ve görsel WebP'ye yeniden kodlanır.
  Kaynak dosya en fazla 1 MB, çıktı en fazla 1 MB, en uzun kenar 1600 piksel,
  giriş çözünürlüğü en fazla 20 megapiksel.
- Like, bookmark, follow, block ve vote endpoint’leri idempotenttir.
- Moderasyon hareketleri değiştirilemez `moderation_actions` kaydı üretir.

### Hız sınırları

Ortak katman `rate_limit_hits` tablosunu kayan pencereyle sayar ve kullanıcı
bazında advisory lock alır. Sınıra takılan istek `CONTENT_RATE_LIMITED`, 429 ve
`Retry-After` ile döner. Sayaç çağıranın transaction'ına yazılır: işlem geri
alınırsa kullanım da sayılmaz.

| İşlem | Sınır |
| --- | --- |
| Gönderi oluşturma | 10/saat, 30/gün |
| Yorum oluşturma | 20/dakika |
| Şikâyet | 10/gün |
| Takip | 60/saat |
| Engelleme | 30/saat |
| Genel yazma tavanı | 120/dakika |

Beğeni, kaydetme ve anket oyu `interaction` olarak sayılır; kendi sınırları
yoktur çünkü kullanıcı ve gönderi başına tekildirler, ancak genel tavana
dahildirler. Gönderi başına toplam yorum tavanı 500'dür ve soft-delete
kayıtlarını da sayar.

Görsel ve PDF yüklemeleri aynı kotayı paylaşır: saatte 20 yükleme ve aynı anda
en fazla 5 gönderiye bağlanmamış dosya. Son kota kontrolü ile asset rezervasyonu
kullanıcı bazlı PostgreSQL advisory lock altında aynı transaction'da yapılır;
eşzamanlı görsel/PDF istekleri kotayı birlikte aşamaz.

Ham multipart gövdesi dosya parse edilmeden önce akıştan sayılır. Görsel ve
avatar istekleri için sınır `1 MiB + 64 KiB multipart payı`, PDF için
`8 MiB + 64 KiB multipart payı`dır; `Content-Length` bulunmayan chunked istekler
de aynı sınıra tabidir. Next Proxy tamponu ayrıca istek başına 9 MiB ile
sınırlıdır. Dosyanın kendi kesin sınırı görselde 1 MiB, PDF'te 8 MiB'dir.

OTP: bir e-posta saatte en fazla beş, bir IP özeti saatte en fazla yirmi kod
isteyebilir.

### Otomatik gizleme

Üç bağımsız şikâyet alan gönderi otomatik gizlenir: `posts.hidden_at` yazılır,
gönderi listelerden ve doğrudan URL'den düşer, yalnızca yazarına
`viewerState.hidden: true` ile görünmeye devam eder.

Kuralın sınırları bilinçlidir:

- Yalnızca görsel veya GIF içeren gönderilerde çalışır. Metin gönderisi asla
  otomatik gizlenmez; birkaç kullanıcının anlaşıp bir fikri susturması riski,
  görselin bir süre açık kalması riskinden ağır basar.
- Şikâyetleri üç veya daha fazla kez haksız bulunmuş kullanıcılar eşiğe
  sayılmaz.
- Hesap yaşı şartı yoktur. Kayıt zaten öğrenci e-postası ve OTP istediği için
  tek kullanımlık hesap üretmek pahalıdır; yaş şartı korumayı yalnızca herkesin
  yeni olduğu lansman günlerinde devre dışı bırakırdı.
- Gizleme silme değildir. Moderatör şikâyeti reddederse gönderi geri yayına
  kalan güvenilir ve bekleyen şikâyet sayısı eşiğin altındaysa girer. Her iki
  işlem de audit kaydı üretir, otomatik gizlemede `actor_id` boştur.
- Askıdan çıkarma gerekçe ister, yalnızca gerçekten askıdaki ve silinmemiş hesabı
  değiştirir. Tekrarlanan aynı istek yeni audit kaydı üretmez. Askıya alma bütün
  mevcut oturumları anında iptal eder; restore eski oturumları yeniden açmaz.

## 8. Uygulama sırası ve ilerleme

Tamamlandı:

1. PostgreSQL temeli ve migration altyapısı
2. Auth, OTP ve session
3. Profil, ayarlar ve hesap silme
4. Gönderi/yorum CRUD ve üye frontend entegrasyonu
5. Like, bookmark, popüler ve trending sıralama
6. Anket, oy ve ilan
7. Medya yükleme ve object storage
8. Takip, engelleme ve şikâyet
9. Bildirimler
10. Admin/moderasyon
11. Arama ve profil gönderileri
12. Çift yönlü engelleme görünürlüğü
13. Bütün liste endpoint'lerinde cursor pagination
14. Kaydedilenler listesi
15. Hız sınırları ve otomatik gizleme
16. Development/test için idempotent seed script'i (`npm run db:seed`)
17. Batch cleanup worker, object-storage reconciliation ve veri saklama
    politikası (`DATA_RETENTION.md`)

Kalan:

18. Yüklenen görsellerde otomatik NSFW taraması
19. Production altyapısı: SMTP, S3, yedekleme, loglama, izleme
20. Least-privileged PostgreSQL rolü ve migration/runtime ayrımı
21. Tam kod güvenlik incelemesi
