# KAMPÜS Railway kurulumu

Repo, Railway'de tek bir uzun ömürlü Node.js servisi olarak çalışır. Web,
Next.js route'ları ve WebSocket aynı `npm run start` sürecindedir.
`railway.json` build, pre-deploy migration, healthcheck ve restart politikasını
otomatik uygular.

## 1. Kaynakları oluştur

Production environment içinde şu üç kaynağı oluştur:

1. GitHub reposuna bağlı KAMPÜS web servisi.
2. Bir Railway PostgreSQL servisi.
3. Kullanıcı yüklemeleri için bir Railway Storage Bucket.

Web servisine public domain üret. `RAILWAY_PUBLIC_DOMAIN` mevcut olduğunda
uygulama `APP_ORIGIN` değerini otomatik olarak `https://<domain>` yapar.

## 2. Web servisi değişkenleri

`DATABASE_URL` değerini yazıyla kopyalamak yerine PostgreSQL servisinden
reference olarak seç:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Ardından aşağıdaki uygulama değişkenlerini ekle:

```text
AUTH_SECRET=<en az 32 karakterlik yüksek entropili rastgele değer>
SMTP_HOST=<SMTP sağlayıcısı>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=<SMTP kullanıcısı>
SMTP_PASSWORD=<SMTP parolası veya API anahtarı>
EMAIL_FROM=KAMPÜS <doğrulanmış-gönderici@alan-adı>
MEDIA_MODERATION_DRIVER=rekognition
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=<Rekognition yetkili AWS anahtarı>
AWS_SECRET_ACCESS_KEY=<Rekognition AWS gizli anahtarı>
```

`AUTH_SECRET` yerelde şu komutla üretilebilir:

```text
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

`TRUSTED_CLIENT_IP_HEADER` Railway'de verilmezse güvenli varsayılan olarak
`x-forwarded-for` seçilir.

## 3. Bucket'ı bağla

Bucket'ın Credentials ekranından web servisine otomatik provision seçeneğini
kullan. Railway'in `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID` ve
`SECRET_ACCESS_KEY` değişkenleri repo tarafından otomatik olarak şu S3
ayarlarına dönüştürülür:

```text
MEDIA_STORAGE_DRIVER=s3
AWS_S3_BUCKET=<bucket>
AWS_S3_ENDPOINT=<endpoint>
AWS_S3_REGION=<region>
AWS_S3_ACCESS_KEY_ID=<bucket access key>
AWS_S3_SECRET_ACCESS_KEY=<bucket secret>
```

Bucket anahtarları Rekognition anahtarlarından özellikle ayrıdır.

## 4. İsteğe bağlı GIF desteği

GIF araması olmadan uygulama açılır. Özelliği açmak için:

```text
NEXT_PUBLIC_GIPHY_API_KEY=<Giphy browser key>
GIPHY_API_KEY=<Giphy server key>
```

`NEXT_PUBLIC_` değişkeni build sırasında bundle'a yazıldığı için anahtar
değiştiğinde yeni deployment gerekir.

## 5. Deploy

Değişken değişikliklerini staged changes ekranından **Deploy** ile uygula.
Çökmüş eski deployment üzerindeki **Restart**, eski yapılandırmayı yeniden
başlatır.

Deployment sırası otomatik olarak şöyledir:

1. `npm run build`
2. `npm run deploy:check`
3. `npm run deploy:migrate`
4. `npm run start`
5. Railway `GET /v1/health` ile uygulama ve PostgreSQL'i doğrular.

Eksik bir değer varsa pre-deploy logu artık değerin kendisini göstermeden ilgili
alan adını (`DATABASE_URL`, `APP_ORIGIN`, `SMTP_REQUIRE_TLS` gibi) açıkça yazar.
