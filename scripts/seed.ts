import "dotenv/config";

import { createHash } from "node:crypto";

import { Pool, type PoolClient } from "pg";

/**
 * Development/test veritabanını gerçek satırlarla doldurur.
 *
 * Misafir görünümünün paketlenmiş içeriğiyle ilgisi yoktur; buradaki veri
 * yalnızca PostgreSQL'e yazılır. Script idempotenttir: kimlikler sabit bir
 * namespace'ten türetildiği için kaç kez çalıştırılırsa çalıştırılsın aynı
 * satırlar güncellenir, kopya oluşmaz.
 */

const SEED_NAMESPACE = "kampus.seed.v1";
const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "postgres-test",
]);

// Liste endpoint'lerinin sayfalanmasını gerçekten test edebilmek için
// varsayılan 20'lik sayfa boyutunun üzerine çıkacak kadar kalabalık gerekiyor.
const CROWD_USER_COUNT = 24;

function seedUuid(key: string) {
  const digest = createHash("sha1")
    .update(`${SEED_NAMESPACE}:${key}`)
    .digest();
  const bytes = Uint8Array.prototype.slice.call(digest, 0, 16);

  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Buffer.from(bytes).toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

type SeedUser = {
  key: string;
  email: string;
  username: string;
  displayName: string;
  department: string;
  yearLabel: string;
  bio: string;
  role: "member" | "moderator" | "admin";
  suspended?: boolean;
};

type SeedComment = {
  key: string;
  authorKey: string;
  body: string;
  minutesAgo: number;
  isAnonymous?: boolean;
  replyToKey?: string;
};

type SeedPost = {
  key: string;
  authorKey: string;
  category:
    | "chat"
    | "confession"
    | "question"
    | "event"
    | "lost_found"
    | "poll"
    | "listing";
  title: string;
  body: string;
  minutesAgo: number;
  isAnonymous?: boolean;
  poll?: string[];
  listing?: {
    type: "sale" | "wanted" | "free";
    condition: "new" | "lightly_used" | "used";
    price: number;
  };
  comments?: SeedComment[];
  likedByKeys?: string[];
};

const VIEWER_KEY = "viewer";

const seedUsers: SeedUser[] = [
  {
    // /v1/auth/development ile giriş yapılan hesap.
    key: VIEWER_KEY,
    email: "999999999@stu.yasar.edu.tr",
    username: "yagizdev",
    displayName: "Yağız Test",
    department: "Yazılım Mühendisliği",
    yearLabel: "2. sınıf",
    bio: "KAMPÜS yerel geliştirme hesabı",
    role: "member",
  },
  {
    key: "ece",
    email: "210301001@stu.yasar.edu.tr",
    username: "ecearslan",
    displayName: "Ece Arslan",
    department: "İşletme",
    yearLabel: "3. sınıf",
    bio: "Öğrenci kulüpleri ve kampüs etkinlikleri.",
    role: "member",
  },
  {
    key: "deniz",
    email: "210301002@stu.yasar.edu.tr",
    username: "denizakin",
    displayName: "Deniz Akın",
    department: "Endüstriyel Tasarım",
    yearLabel: "2. sınıf",
    bio: "Atölyede bulunur. Maket ve çizim.",
    role: "member",
  },
  {
    key: "selin",
    email: "210301003@stu.yasar.edu.tr",
    username: "selinkaya",
    displayName: "Selin Kaya",
    department: "Mimarlık",
    yearLabel: "4. sınıf",
    bio: "Bitirme projesi ve kahve.",
    role: "member",
  },
  {
    key: "mert",
    email: "210301004@stu.yasar.edu.tr",
    username: "mertdogan",
    displayName: "Mert Doğan",
    department: "Bilgisayar Mühendisliği",
    yearLabel: "1. sınıf",
    bio: "Yeni başladım, her şeyi soruyorum.",
    role: "member",
  },
  {
    // Görüntüleyeni engelleyen taraf: engelleme kuralları için fikstür.
    key: "burak",
    email: "210301005@stu.yasar.edu.tr",
    username: "burakcetin",
    displayName: "Burak Çetin",
    department: "Hukuk",
    yearLabel: "3. sınıf",
    bio: "Kütüphanenin sessiz katında yaşıyorum.",
    role: "member",
  },
  {
    key: "moderator",
    email: "210301006@stu.yasar.edu.tr",
    username: "nazliyildiz",
    displayName: "Nazlı Yıldız",
    department: "Psikoloji",
    yearLabel: "4. sınıf",
    bio: "Topluluk moderatörü.",
    role: "moderator",
  },
  {
    key: "admin",
    email: "210301007@stu.yasar.edu.tr",
    username: "kerem.aydin",
    displayName: "Kerem Aydın",
    department: "Yazılım Mühendisliği",
    yearLabel: "4. sınıf",
    bio: "Platform yöneticisi.",
    role: "admin",
  },
  {
    // Askıya alınmış hesabın içeriği listelerde görünmemeli.
    key: "suspended",
    email: "210301008@stu.yasar.edu.tr",
    username: "askidahesap",
    displayName: "Askıda Hesap",
    department: "İşletme",
    yearLabel: "1. sınıf",
    bio: "Askıya alınmış test hesabı.",
    role: "member",
    suspended: true,
  },
];

const crowdUsers: SeedUser[] = Array.from(
  { length: CROWD_USER_COUNT },
  (_unused, index) => {
    const order = String(index + 1).padStart(2, "0");

    return {
      key: `crowd-${order}`,
      email: `2103${String(index + 100).padStart(5, "0")}@stu.yasar.edu.tr`,
      username: `ogrenci${order}`,
      displayName: `Öğrenci ${order}`,
      department: "Yazılım Mühendisliği",
      yearLabel: "1. sınıf",
      bio: "Sayfalama testleri için oluşturulmuş hesap.",
      role: "member" as const,
    };
  },
);

const seedPosts: SeedPost[] = [
  {
    // Görüntüleyenin kendi içeriği: profil sayfası ve "bana gelen bildirim"
    // senaryoları bunlar olmadan doğru kurulamıyor.
    key: "post-viewer-rehber",
    authorKey: VIEWER_KEY,
    category: "chat",
    title: "Yeni gelenler için kampüs rehberi topluyorum",
    body: "Kayıt haftasında işinize yarayacak ne varsa buraya yazalım; ben de derleyip tek gönderide toplarım.",
    minutesAgo: 18,
    likedByKeys: ["ece", "deniz", "selin", "mert"],
    comments: [
      {
        key: "comment-viewer-1",
        authorKey: "ece",
        body: "Öğrenci kartını ilk gün çıkarttırmak çok zaman kazandırıyor, onu ekleyebilirsin.",
        minutesAgo: 16,
      },
      {
        key: "comment-viewer-2",
        authorKey: "mert",
        body: "Servis saatlerini de yazarsanız birinci sınıflar için çok iyi olur.",
        minutesAgo: 15,
        replyToKey: "comment-viewer-1",
      },
    ],
  },
  {
    key: "post-viewer-ders-notu",
    authorKey: VIEWER_KEY,
    category: "question",
    title: "Ders notlarını nerede paylaşıyorsunuz?",
    body: "Ortak bir klasör var mı, yoksa herkes kendi bölümünde mi paylaşıyor?",
    minutesAgo: 34,
    likedByKeys: ["deniz"],
    comments: [
      {
        key: "comment-viewer-3",
        authorKey: "mert",
        body: "@yagizdev bizim bölümde sınıf temsilcisi topluyor, sana da iletebilirim.",
        minutesAgo: 30,
      },
    ],
  },
  {
    key: "post-viewer-anket",
    authorKey: VIEWER_KEY,
    category: "poll",
    title: "Rehberi hangi formatta hazırlayayım?",
    body: "",
    minutesAgo: 52,
    poll: ["Tek gönderi", "PDF", "Kısa video"],
  },
  {
    // Görüntüleyenin kendi gönderisi: bildirimlerin hedefi burası.
    key: "post-kutuphane-priz",
    authorKey: VIEWER_KEY,
    category: "question",
    title: "Kütüphanede priz olan masalar nerede?",
    body: "Üçüncü katta priz bulamadım, sessiz çalışabileceğim başka bir yer önerir misiniz?",
    minutesAgo: 12,
    likedByKeys: ["ece", "deniz", "selin", "mert"],
    comments: [
      {
        key: "comment-priz-1",
        authorKey: "deniz",
        body: "Dördüncü katın pencere tarafında her masada priz var, sabah erken git.",
        minutesAgo: 9,
      },
      {
        key: "comment-priz-2",
        authorKey: "selin",
        body: "Mimarlık stüdyosunun yanındaki çalışma odası da boş oluyor genelde.",
        minutesAgo: 7,
      },
      {
        key: "comment-priz-viewer",
        authorKey: VIEWER_KEY,
        body: "İkisini de deneyeceğim, teşekkürler.",
        minutesAgo: 6,
      },
      {
        key: "comment-priz-3",
        authorKey: "ece",
        body: "Sabah dokuzdan önce gidersen pencere kenarı boş oluyor.",
        minutesAgo: 5,
        replyToKey: "comment-priz-viewer",
      },
    ],
  },
  {
    key: "post-bahar-senligi",
    authorKey: "ece",
    category: "event",
    title: "Bahar şenliği programı açıklandı",
    body: "Cuma günü ana sahnede öğrenci grupları çalıyor, cumartesi atölyeler var. Kayıt formu kulüp panosunda.",
    minutesAgo: 45,
    likedByKeys: ["viewer", "deniz", "selin", "mert", "burak"],
    comments: [
      {
        key: "comment-senlik-1",
        authorKey: "mert",
        body: "Atölyelere birinci sınıflar katılabiliyor mu?",
        minutesAgo: 40,
      },
    ],
  },
  {
    key: "post-ara-durak-anketi",
    authorKey: "deniz",
    category: "poll",
    title: "Ders arasında ilk durağın neresi?",
    body: "Kısa bir merak, herkes nereye gidiyor?",
    minutesAgo: 70,
    poll: ["Kantin", "Kütüphane", "Bahçe", "Otopark"],
    likedByKeys: ["viewer", "ece"],
  },
  {
    key: "post-hesap-makinesi",
    authorKey: "selin",
    category: "listing",
    title: "Grafik hesap makinesi satılık",
    body: "İki dönem kullandım, kutusu ve kablosu duruyor. Kampüste elden teslim.",
    minutesAgo: 95,
    listing: { type: "sale", condition: "lightly_used", price: 1450 },
    likedByKeys: ["mert"],
  },
  {
    key: "post-maket-birak",
    authorKey: "deniz",
    category: "listing",
    title: "Maket malzemesi ücretsiz veriliyor",
    body: "Dönem sonunda artan kartonlar ve maket bıçağı duruyor. İhtiyacı olan yazsın.",
    minutesAgo: 130,
    listing: { type: "free", condition: "used", price: 0 },
  },
  {
    key: "post-istatistik-kitabi",
    authorKey: "mert",
    category: "listing",
    title: "İstatistik kitabı aranıyor",
    body: "Bu dönem okutulan istatistik kitabını ikinci el arıyorum, makul fiyata alırım.",
    minutesAgo: 160,
    listing: { type: "wanted", condition: "used", price: 250 },
  },
  {
    key: "post-kayip-kulaklik",
    authorKey: "selin",
    category: "lost_found",
    title: "Kütüphanede kulaklık buldum",
    body: "Siyah kablosuz kulaklık, üzerinde küçük beyaz bir çıkartma var. Danışmaya bıraktım.",
    minutesAgo: 210,
    likedByKeys: ["viewer", "ece", "deniz"],
    comments: [
      {
        key: "comment-kulaklik-1",
        authorKey: "mert",
        body: "Benimki olabilir, yarın danışmaya uğrayacağım.",
        minutesAgo: 200,
      },
    ],
  },
  {
    key: "post-itiraf-vize",
    authorKey: "mert",
    category: "confession",
    title: "",
    body: "Vize haftası boyunca her gün aynı masaya oturup hiç ders çalışmadan çıktım. Kimseye söylemedim.",
    minutesAgo: 240,
    isAnonymous: true,
    likedByKeys: ["viewer", "ece", "selin"],
    comments: [
      {
        key: "comment-itiraf-1",
        authorKey: "ece",
        body: "Yalnız değilsin, aynısını finalde ben yaptım.",
        minutesAgo: 230,
        isAnonymous: true,
      },
    ],
  },
  {
    key: "post-servis-saati",
    authorKey: "burak",
    category: "question",
    title: "Akşam servisi kaçta kalkıyor?",
    body: "Son servis saatini değiştirmişler mi, bilen var mı?",
    minutesAgo: 280,
  },
  {
    key: "post-sessiz-kat",
    authorKey: "burak",
    category: "chat",
    title: "Sessiz kat gerçekten sessiz mi",
    body: "Üçüncü katta telefonla konuşanlar var, tabelayı kimse okumuyor sanırım.",
    minutesAgo: 320,
  },
  {
    key: "post-kahve-onerisi",
    authorKey: "ece",
    category: "chat",
    title: "Kampüste en iyi filtre kahve nerede?",
    body: "Kantin dışında bir öneriniz var mı? Işıklar tarafındaki yerleri de yazabilirsiniz.",
    minutesAgo: 360,
    likedByKeys: ["viewer", "selin"],
  },
  {
    key: "post-bitirme-projesi",
    authorKey: "selin",
    category: "chat",
    title: "Bitirme projesi teslim haftası taktikleri",
    body: "Son hafta panik olmamak için erkenden maket fotoğraflarını çekmenizi öneririm.",
    minutesAgo: 420,
  },
  {
    key: "post-staj-sorusu",
    authorKey: "mert",
    category: "question",
    title: "Yaz stajı için başvurular ne zaman açılıyor?",
    body: "Bölüm sayfasında tarih göremedim, geçen yıl ne zaman açılmıştı?",
    minutesAgo: 480,
  },
  {
    key: "post-yurt-itiraf",
    authorKey: "selin",
    category: "confession",
    title: "",
    body: "Yurtta üç yıl kaldım ve ilk kez dün mutfağı kullandım. Makarna yaktım.",
    minutesAgo: 540,
    isAnonymous: true,
  },
  {
    key: "post-kulup-tanitim",
    authorKey: "ece",
    category: "event",
    title: "Fotoğrafçılık kulübü tanıtım toplantısı",
    body: "Perşembe 17.00'de B blok girişinde buluşuyoruz, ekipman zorunlu değil.",
    minutesAgo: 600,
  },
  {
    key: "post-kayip-kart",
    authorKey: "deniz",
    category: "lost_found",
    title: "Öğrenci kartımı kaybettim",
    body: "Yemekhane çevresinde düşürmüş olabilirim, bulan olursa haber versin.",
    minutesAgo: 700,
  },
  {
    key: "post-otopark",
    authorKey: "burak",
    category: "chat",
    title: "Otopark sabah dokuzdan sonra doluyor",
    body: "Arabayla gelenler için uyarı, dokuzdan sonra yer bulmak imkânsız.",
    minutesAgo: 780,
  },
  {
    key: "post-ders-secimi",
    authorKey: "mert",
    category: "question",
    title: "Seçmeli ders önerisi olan var mı?",
    body: "İş yükü çok ağır olmayan ama gerçekten bir şey öğrendiğim bir seçmeli arıyorum.",
    minutesAgo: 860,
  },
  {
    key: "post-kutuphane-saat",
    authorKey: "selin",
    category: "question",
    title: "Kütüphane final haftasında 24 saat açık mı?",
    body: "Geçen sene açıktı ama bu dönem duyuru göremedim.",
    minutesAgo: 940,
  },
  {
    key: "post-bisiklet",
    authorKey: "deniz",
    category: "listing",
    title: "Şehir bisikleti satılık",
    body: "Kampüs içi kullanım için ideal, yeni bakımdan çıktı.",
    minutesAgo: 1_020,
    listing: { type: "sale", condition: "used", price: 3200 },
  },
  {
    key: "post-yemekhane-anketi",
    authorKey: "ece",
    category: "poll",
    title: "Yemekhane menüsünde en çok neyi bekliyorsun?",
    body: "",
    minutesAgo: 1_100,
    poll: ["Çorba çeşidi", "Vejetaryen seçenek", "Tatlı", "Salata barı"],
  },
  {
    key: "post-spor-salonu",
    authorKey: "burak",
    category: "chat",
    title: "Spor salonu akşam saatlerinde çok kalabalık",
    body: "Öğleden sonra gidenler için sakin oluyor, akşam altıdan sonra sıra bekliyorsunuz.",
    minutesAgo: 1_180,
  },
  {
    key: "post-kayip-defter",
    authorKey: "mert",
    category: "lost_found",
    title: "Amfide mavi defter buldum",
    body: "İçinde matematik notları var, sahibi mesaj atsın.",
    minutesAgo: 1_260,
  },
  {
    key: "post-mezuniyet",
    authorKey: "selin",
    category: "event",
    title: "Mezuniyet fotoğrafı çekimi",
    body: "Cumartesi sabahı ana bahçede toplanıyoruz, cübbeler okuldan alınacak.",
    minutesAgo: 1_340,
  },
  {
    key: "post-kantin-fiyat",
    authorKey: "ece",
    category: "chat",
    title: "Kantin fiyatları güncellendi mi?",
    body: "Sabah tost aldım, geçen haftaya göre farklıydı gibi geldi.",
    minutesAgo: 1_420,
  },
  {
    key: "post-grup-calisma",
    authorKey: "deniz",
    category: "chat",
    title: "Grup çalışması için oda rezervasyonu nasıl yapılıyor?",
    body: "Kütüphane sitesinden mi yoksa danışmadan mı ayırtılıyor?",
    minutesAgo: 1_500,
  },
  {
    key: "post-itiraf-sunum",
    authorKey: "ece",
    category: "confession",
    title: "",
    body: "Sunum sırasında slaytları karıştırdım ve kimse fark etmedi. Hâlâ inanamıyorum.",
    minutesAgo: 1_580,
    isAnonymous: true,
  },
  {
    key: "post-askidaki-ilan",
    authorKey: "suspended",
    category: "chat",
    title: "Bu gönderi askıya alınmış hesaba ait",
    body: "Askıya alınan hesabın içeriği listelerde görünmemeli.",
    minutesAgo: 1_660,
  },
];

function assertSafeTarget(databaseUrl: string, force: boolean) {
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error(
      "NODE_ENV=production. Seed yalnızca development/test için tasarlandı.",
    );
  }

  if (force) {
    return;
  }

  const { hostname } = new URL(databaseUrl);

  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `"${hostname}" yerel bir veritabanı değil. Gerçekten istiyorsan --force ekle.`,
    );
  }
}

/**
 * Fikstür hesaplarına ait bütün içeriği siler. Yalnızca --reset ile çalışır:
 * seed anahtarları değiştiğinde eski satırlar öksüz kaldığı için gerekli.
 * Dev hesabının elle oluşturduğu içerik de bu temizliğe dahildir.
 */
async function resetSeedContent(client: PoolClient, emails: string[]) {
  const owner = "(select id from users where email = any($1))";
  const statements = [
    `delete from follows
       where follower_id in ${owner} or following_id in ${owner}`,
    `delete from blocks
       where blocker_id in ${owner} or blocked_id in ${owner}`,
    `delete from notifications
       where recipient_id in ${owner} or actor_id in ${owner}`,
    `delete from reports where reporter_id in ${owner}`,
    `delete from comments where author_id in ${owner}`,
    `delete from posts where author_id in ${owner}`,
  ];
  let removed = 0;

  for (const statement of statements) {
    const result = await client.query(statement, [emails]);
    removed += result.rowCount ?? 0;
  }

  return removed;
}

async function upsertUser(client: PoolClient, user: SeedUser) {
  const createdAt = minutesAgo(60 * 24 * 30);
  const result = await client.query<{ id: string }>(
    `insert into users (
       id, email, username, display_name, department,
       year_label, bio, role, status, suspended_at, created_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (email) do update set
       username = excluded.username,
       display_name = excluded.display_name,
       department = excluded.department,
       year_label = excluded.year_label,
       bio = excluded.bio,
       role = excluded.role,
       status = excluded.status,
       suspended_at = excluded.suspended_at,
       deleted_at = null
     returning id`,
    [
      seedUuid(`user:${user.key}`),
      user.email,
      user.username,
      user.displayName,
      user.department,
      user.yearLabel,
      user.bio,
      user.role,
      user.suspended ? "suspended" : "active",
      user.suspended ? createdAt : null,
      createdAt,
    ],
  );

  const id = result.rows[0]!.id;

  await client.query(
    `insert into user_settings (user_id, show_department)
     values ($1, true)
     on conflict (user_id) do nothing`,
    [id],
  );

  return id;
}

async function upsertPost(
  client: PoolClient,
  post: SeedPost,
  authorId: string,
) {
  const id = seedUuid(`post:${post.key}`);

  await client.query(
    `insert into posts (
       id, author_id, category, is_anonymous, title, body, created_at
     ) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       author_id = excluded.author_id,
       category = excluded.category,
       is_anonymous = excluded.is_anonymous,
       title = excluded.title,
       body = excluded.body,
       created_at = excluded.created_at,
       deleted_at = null`,
    [
      id,
      authorId,
      post.category,
      post.isAnonymous ?? false,
      post.title,
      post.body,
      minutesAgo(post.minutesAgo),
    ],
  );

  return id;
}

async function upsertPoll(
  client: PoolClient,
  postId: string,
  options: string[],
) {
  await client.query(
    `insert into polls (post_id) values ($1)
     on conflict (post_id) do nothing`,
    [postId],
  );

  const optionIds: string[] = [];

  for (const [position, text] of options.entries()) {
    const optionId = seedUuid(`poll-option:${postId}:${position}`);

    await client.query(
      `insert into poll_options (id, poll_id, text, position)
       values ($1, $2, $3, $4)
       on conflict (id) do update set
         text = excluded.text,
         position = excluded.position`,
      [optionId, postId, text, position],
    );
    optionIds.push(optionId);
  }

  return optionIds;
}

async function main() {
  const force = process.argv.includes("--force");
  const reset = process.argv.includes("--reset");
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL tanımlı değil. .env dosyasını kontrol et.");
  }

  assertSafeTarget(databaseUrl, force);

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("begin");

    let removedRows = 0;

    if (reset) {
      removedRows = await resetSeedContent(
        client,
        [...seedUsers, ...crowdUsers].map((user) => user.email),
      );
    }

    const userIds = new Map<string, string>();

    for (const user of [...seedUsers, ...crowdUsers]) {
      userIds.set(user.key, await upsertUser(client, user));
    }

    const userId = (key: string) => {
      const id = userIds.get(key);

      if (!id) {
        throw new Error(`Seed kullanıcısı bulunamadı: ${key}`);
      }

      return id;
    };

    const viewerId = userId(VIEWER_KEY);
    const postIds = new Map<string, string>();
    const commentIds = new Map<string, string>();

    for (const post of seedPosts) {
      const authorId = userId(post.authorKey);
      const postId = await upsertPost(client, post, authorId);

      postIds.set(post.key, postId);

      if (post.poll) {
        const optionIds = await upsertPoll(client, postId, post.poll);
        const voterKeys = ["viewer", "ece", "deniz", "selin", "mert"];

        for (const [index, voterKey] of voterKeys.entries()) {
          await client.query(
            `insert into poll_votes (poll_id, user_id, option_id)
             values ($1, $2, $3)
             on conflict (poll_id, user_id) do update set
               option_id = excluded.option_id`,
            [
              postId,
              userId(voterKey),
              optionIds[index % optionIds.length]!,
            ],
          );
        }
      }

      if (post.listing) {
        await client.query(
          `insert into listings (post_id, type, condition, price)
           values ($1, $2, $3, $4)
           on conflict (post_id) do update set
             type = excluded.type,
             condition = excluded.condition,
             price = excluded.price`,
          [postId, post.listing.type, post.listing.condition, post.listing.price],
        );
      }

      for (const comment of post.comments ?? []) {
        const commentId = seedUuid(`comment:${comment.key}`);
        const parentKey = comment.replyToKey;
        const parentId = parentKey
          ? (commentIds.get(parentKey) ?? null)
          : null;

        await client.query(
          `insert into comments (
             id, post_id, author_id, parent_id, is_anonymous, body, created_at
           ) values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (id) do update set
             body = excluded.body,
             parent_id = excluded.parent_id,
             is_anonymous = excluded.is_anonymous,
             created_at = excluded.created_at,
             deleted_at = null`,
          [
            commentId,
            postId,
            userId(comment.authorKey),
            parentId,
            comment.isAnonymous ?? false,
            comment.body,
            minutesAgo(comment.minutesAgo),
          ],
        );
        commentIds.set(comment.key, commentId);
      }

      for (const likerKey of post.likedByKeys ?? []) {
        await client.query(
          `insert into post_likes (post_id, user_id)
           values ($1, $2)
           on conflict do nothing`,
          [postId, userId(likerKey)],
        );
      }
    }

    // Görüntüleyen için 20'den fazla kayıt: kaydedilenler sayfasının
    // cursor pagination'ı ancak bu sayıdan sonra ikinci sayfaya geçiyor.
    const bookmarkKeys = seedPosts
      .filter((post) => post.authorKey !== "suspended")
      .slice(0, 22);

    for (const [index, post] of bookmarkKeys.entries()) {
      await client.query(
        `insert into post_bookmarks (post_id, user_id, created_at)
         values ($1, $2, $3)
         on conflict (post_id, user_id) do update set
           created_at = excluded.created_at`,
        [postIds.get(post.key)!, viewerId, minutesAgo(index * 7 + 3)],
      );
    }

    const followEdges: [string, string][] = [
      [VIEWER_KEY, "ece"],
      [VIEWER_KEY, "deniz"],
      [VIEWER_KEY, "selin"],
      ["ece", VIEWER_KEY],
      ["ece", "deniz"],
      ["deniz", VIEWER_KEY],
      ["deniz", "selin"],
      ["selin", "ece"],
      ["mert", VIEWER_KEY],
      ["mert", "ece"],
      ...crowdUsers.map(
        (user) => [user.key, VIEWER_KEY] as [string, string],
      ),
    ];

    for (const [followerKey, followingKey] of followEdges) {
      await client.query(
        `insert into follows (follower_id, following_id)
         values ($1, $2)
         on conflict do nothing`,
        [userId(followerKey), userId(followingKey)],
      );
    }

    // Tek yönlü engelleme: burak görüntüleyeni engelliyor ama görüntüleyen
    // onu engellemiyor. Engelleme kuralları maddesi için asıl fikstür bu.
    const blockEdges: [string, string][] = [
      ["burak", VIEWER_KEY],
      [VIEWER_KEY, "suspended"],
    ];

    for (const [blockerKey, blockedKey] of blockEdges) {
      await client.query(
        `insert into blocks (blocker_id, blocked_id)
         values ($1, $2)
         on conflict do nothing`,
        [userId(blockerKey), userId(blockedKey)],
      );
    }

    const notificationRows: {
      key: string;
      actorKey: string;
      kind: "like" | "comment" | "reply" | "mention" | "follow";
      postKey?: string;
      commentKey?: string;
      likeCount?: number;
      minutesAgo: number;
      read?: boolean;
    }[] = [
      // Bildirimlerin hedefi görüntüleyenin kendi içeriği olmalı.
      {
        key: "notification-like-rehber",
        actorKey: "ece",
        kind: "like",
        postKey: "post-viewer-rehber",
        likeCount: 4,
        minutesAgo: 8,
      },
      {
        key: "notification-comment-rehber",
        actorKey: "ece",
        kind: "comment",
        postKey: "post-viewer-rehber",
        commentKey: "comment-viewer-1",
        minutesAgo: 14,
      },
      {
        key: "notification-reply-rehber",
        actorKey: "mert",
        kind: "reply",
        postKey: "post-viewer-rehber",
        commentKey: "comment-viewer-2",
        minutesAgo: 20,
      },
      {
        key: "notification-mention-ders-notu",
        actorKey: "mert",
        kind: "mention",
        postKey: "post-viewer-ders-notu",
        commentKey: "comment-viewer-3",
        minutesAgo: 26,
        read: true,
      },
      ...crowdUsers.map((user, index) => ({
        key: `notification-follow-${user.key}`,
        actorKey: user.key,
        kind: "follow" as const,
        minutesAgo: 40 + index * 11,
        read: index % 3 === 0,
      })),
    ];

    for (const notification of notificationRows) {
      const createdAt = minutesAgo(notification.minutesAgo);

      await client.query(
        `insert into notifications (
           id, recipient_id, actor_id, kind, post_id,
           comment_id, like_count, read_at, created_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (id) do update set
           kind = excluded.kind,
           post_id = excluded.post_id,
           comment_id = excluded.comment_id,
           like_count = excluded.like_count,
           read_at = excluded.read_at,
           created_at = excluded.created_at`,
        [
          seedUuid(`notification:${notification.key}`),
          viewerId,
          userId(notification.actorKey),
          notification.kind,
          notification.postKey
            ? postIds.get(notification.postKey)!
            : null,
          notification.commentKey
            ? commentIds.get(notification.commentKey)!
            : null,
          notification.likeCount ?? null,
          notification.read ? createdAt : null,
          createdAt,
        ],
      );
    }

    // Moderasyon listelerinin sayfalanabilmesi için 20'den fazla açık şikâyet.
    const reportTargets = [
      "post-sessiz-kat",
      "post-otopark",
      "post-kantin-fiyat",
      "post-servis-saati",
    ];
    const reportReasons = [
      "spam",
      "harassment",
      "misleading",
      "personal_information",
      "other",
    ];

    for (const [index, reporter] of crowdUsers.entries()) {
      const postKey = reportTargets[index % reportTargets.length]!;
      const postId = postIds.get(postKey)!;

      await client.query(
        `insert into reports (
           id, reporter_id, target_type, target_id, post_id,
           reason, detail, status, created_at
         ) values ($1, $2, 'post', $3, $3, $4, $5, 'pending', $6)
         on conflict (id) do update set
           reason = excluded.reason,
           detail = excluded.detail,
           created_at = excluded.created_at`,
        [
          seedUuid(`report:${reporter.key}:${postKey}`),
          userId(reporter.key),
          postId,
          reportReasons[index % reportReasons.length]!,
          "Sayfalama testi için oluşturulmuş örnek şikâyet.",
          minutesAgo(30 + index * 17),
        ],
      );
    }

    await client.query("commit");

    console.log(
      [
        "Seed tamamlandı.",
        ...(reset ? [`  silinen satır  : ${removedRows}`] : []),
        `  kullanıcı      : ${seedUsers.length + crowdUsers.length}`,
        `  gönderi        : ${seedPosts.length}`,
        `  takip kenarı   : ${followEdges.length}`,
        `  bildirim       : ${notificationRows.length}`,
        `  şikâyet        : ${crowdUsers.length}`,
        `  kaydedilen     : ${bookmarkKeys.length}`,
        "",
        "Giriş: /v1/auth/development ile yagizdev hesabına gir.",
      ].join("\n"),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
