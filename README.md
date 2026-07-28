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
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

## PostgreSQL

Yerel veritabanı tanımı [compose.yaml](./compose.yaml) içindedir. Docker
kurulduktan sonra geliştirme veritabanını başlatın:

```bash
npm run db:up
npm run db:generate
npm run db:migrate
```

Kullanılabilir veritabanı komutları:

- `npm run db:up`: geliştirme PostgreSQL servisini başlatır.
- `npm run db:test:up`: izole test PostgreSQL servisini başlatır.
- `npm run db:down`: servisleri durdurur, verileri silmez.
- `npm run db:generate`: incelenebilir SQL migration dosyaları üretir.
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
npm run test:e2e
```

Gerçek PostgreSQL entegrasyon testi için önce test veritabanını başlatın:

```bash
npm run db:test:up
npm run test:db
```

## Backend planı

Veri modeli, API sınırları ve yetki kuralları
[BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md) içinde tanımlanmıştır. Mevcut
frontend verileri backend endpoint'leri tamamlanana kadar demo amaçlı tarayıcı
depolamasını kullanır.
