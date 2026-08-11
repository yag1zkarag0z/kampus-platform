# KAMPÜS veri saklama ve silme politikası

Bu belge uygulamadaki teknik veri yaşam döngüsünü tanımlar. Sürelerin tek kod
kaynağı `src/server/maintenance/policy.ts` dosyasıdır. Politika değişiklikleri
ürün, güvenlik ve gerektiğinde hukuk incelemesiyle birlikte yapılmalıdır.

## Saklama süreleri

| Veri | Saklama | Worker davranışı |
| --- | ---: | --- |
| OTP challenge | Süre bitiminden sonra 24 saat | Hard-delete |
| Süresi dolmuş veya iptal edilmiş session | İnaktif olduktan sonra 7 gün | Hard-delete |
| Rate-limit hit | 31 gün | Hard-delete; 30 günlük kullanıcı adı penceresini korur |
| Bildirim | 90 gün | Hard-delete |
| Mesaj gönderilmemiş konuşma taslağı | 7 gün | Hard-delete; iki katılımcının okunma satırları cascade silinir |
| Reddedilmiş mesaj isteği bekleme kaydı | Retten sonra 30 gün | Süre dolunca hard-delete; yalnızca aynı gönderici→alıcı yönünü sınırlar |
| Aktif bire bir mesaj | Hesap/konuşma yaşam döngüsü boyunca | Kullanıcı silince konuşma cascade silinir; kullanıcı tarafından silinen mesajın içeriği anında boşaltılır |
| Soft-delete gönderi ve yorum | 30 gün | Audit bağı yoksa hard-delete |
| Silinmiş hesap | En az 30 gün | PII hemen tombstone edilir; audit bağı bitince hard-delete |
| Bağlanmamış yükleme | 24 saat | DB kaydı ve object birlikte silinir |
| Çözülmüş rapor, raporlama anındaki içerik özeti ve moderasyon audit kaydı | 365 gün | Mesaj sonradan silinse de karar kanıtı korunur; audit satırı güncellenemez ve süre dolunca bakım görevi hard-delete eder |
| DB kaydı olmayan storage object | 24 saat grace | Object silinir |
| Storage object'i olmayan DB asset kaydı | 24 saat grace | Attachment kaldırılır, asset kaydı silinir |

Pending raporlar otomatik silinmez. Bir gönderi, yorum, mesaj veya hesap aktif bir
rapor/audit kaydına bağlıysa kısa saklama süresi dolmuş olsa bile audit süresi
tamamlanana kadar tombstone olarak kalır. Hesap silme anında e-posta, kullanıcı
adı, görünen ad, biyografi ve avatar zaten anonimleştirilir.

## Worker çalıştırma

Worker aynı anda yalnızca bir instance çalışacak şekilde PostgreSQL advisory
lock kullanır. İkinci instance veri değiştirmeden `skipped_locked` döndürür.
Worker başlatılmadan önce deployment migration'ları (`npm run db:migrate`)
uygulanmış olmalıdır.

```bash
# Önce üretimde silmeden rapor al
npm run maintenance:dry-run

# Cron/Kubernetes CronJob için tek tur
npm run maintenance:once

# Saatlik çalışan uzun ömürlü worker process'i
npm run maintenance:worker
```

İsteğe bağlı seçenekler:

- `--mode=cleanup`, `--mode=reconcile` veya `--mode=all`
- `--batch-size=100` (1–1000)
- `--interval-ms=3600000`
- Uzun ömürlü worker için `MAINTENANCE_INTERVAL_MS`

Önerilen production akışı önce `--dry-run`, sonuçların incelenmesi ve ardından
saatte bir `maintenance:once` çalıştırılmasıdır. Worker JSON satırları üretir;
object silme hatası veya boyut uyuşmazlığı tek seferlik çalışmada non-zero exit
code oluşturur.

## Reconciliation güvenlik kuralları

- Yeni veya devam eden upload'lar 24 saatlik grace window nedeniyle silinmez.
- DB silme storage silmesinden önce yapılır. Storage çağrısı başarısız olursa
  dosya orphan kalır ve sonraki reconciliation turunda tekrar denenir.
- Sadece `images/<user-uuid>/<asset-uuid>.webp` ve
  `documents/<user-uuid>/<asset-uuid>.pdf` anahtarları yönetilir.
- DB ve storage boyutu farklıysa worker otomatik düzeltme yapmaz; anomaliyi
  raporlar ve başarısız exit code üretir.
- Reconciliation object body'lerini indirmez; local stat/S3 list metadata'sı
  kullanır.
