# KAMPÜS

KAMPÜS, Yaşar Üniversitesi öğrencileri için geliştirilen bağımsız bir kampüs
topluluğu projesidir. Üniversitenin resmî ürünü değildir ve üniversite
tarafından işletilmez.

## Teknolojiler

- Next.js 16, React 19 ve TypeScript
- Tailwind CSS ve GSAP
- PostgreSQL
- Drizzle ORM ve `node-postgres`
- Vitest, Testing Library ve Playwright

## Yerel geliştirme

Bağımlılıkları kurup örnek ortam dosyasını kopyalayın:

```bash
npm install
cp .env.example .env
```

PowerShell kullanıyorsanız kopyalama komutu:

```powershell
Copy-Item .env.example .env
```

Ardından PostgreSQL ile yerel e-posta kutusunu başlatın, mevcut migration
dosyalarını uygulayın ve uygulamayı çalıştırın:

```bash
npm run db:up
npm run db:migrate
npm run dev
```

Uygulama `http://localhost:3000`, yakalanan yerel OTP e-postaları ise Mailpit
arayüzünde `http://localhost:8025` adresinde açılır. Mailpit yalnızca geliştirme
ortamı içindir; üretimde gerçek bir SMTP sağlayıcısı ve benzersiz bir
`AUTH_SECRET` kullanılmalıdır.

## PostgreSQL

Yerel veritabanı tanımı [compose.yaml](./compose.yaml) içindedir. Docker
kurulduktan sonra geliştirme veritabanını başlatın:

```bash
npm run db:up
npm run db:migrate
```

Kullanılabilir veritabanı komutları:

- `npm run db:up`: geliştirme PostgreSQL servisini başlatır.
- `npm run db:test:up`: izole test PostgreSQL servisini başlatır.
- `npm run db:down`: servisleri durdurur, verileri silmez.
- `npm run db:generate`: şema değişikliğinden sonra incelenebilir SQL migration
  dosyaları üretir.
- `npm run db:migrate`: bekleyen migration dosyalarını uygular.
- `npm run db:check`: migration geçmişinin tutarlılığını kontrol eder.
- `npm run db:studio`: Drizzle Studio'yu açar.

`GET /v1/health`, uygulamanın PostgreSQL bağlantısını güvenli bir yanıtla
kontrol eder. Bağlantı yoksa hassas hata ayrıntıları döndürmeden `503` verir.

## Testler

```bash
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:e2e
```

PostgreSQL entegrasyon ve gerçek OTP tarayıcı testleri için önce izole test
veritabanı ile Mailpit'i başlatın:

```bash
npm run db:test:up
npm run test:db
npm run test:e2e
```

## Backend planı

Veri modeli, API sınırları ve yetki kuralları
[BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) içinde tanımlanmıştır. Üyelik
akışı okul e-postasına gönderilen tek kullanımlık kodla çalışır; doğrulanmış
oturum sunucuda tutulur ve tarayıcıya yalnızca `HttpOnly` oturum çerezi verilir.
Gönderiler, takipler, bildirimler ve moderasyon verileri henüz sonraki backend
aşamalarındaki endpoint'lere taşınacaktır.
