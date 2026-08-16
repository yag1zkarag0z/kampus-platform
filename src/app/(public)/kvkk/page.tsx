import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import CampusLogo from "@/components/CampusLogo";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | KAMPÜS.",
  description:
    "KAMPÜS platformunda işlenen kişisel veriler, amaçlar, saklama süreleri, aktarım esasları ve KVKK kapsamındaki haklar.",
};

const controllerEmail = "karagozyagiz465@gmail.com";

const sections = [
  { id: "veri-sorumlusu", title: "Veri sorumlusu" },
  { id: "veriler", title: "İşlenen veriler" },
  { id: "amaclar", title: "Amaçlar ve hukuki sebepler" },
  { id: "toplama", title: "Toplama yöntemi" },
  { id: "aktarim", title: "Aktarım ve sağlayıcılar" },
  { id: "gorunurluk", title: "Görünürlük ve anonimlik" },
  { id: "saklama", title: "Saklama ve silme" },
  { id: "guvenlik", title: "Veri güvenliği" },
  { id: "haklar", title: "Hakların" },
  { id: "basvuru", title: "Başvuru yöntemi" },
] as const;

const dataGroups = [
  {
    title: "Hesap ve profil",
    text: "Doğrulanmış Yaşar öğrenci e-posta adresi, kullanıcı adı, görünen ad, bölüm, sınıf, biyografi, avatar tercihi, üyelik rolü ve bildirim ayarları.",
  },
  {
    title: "Doğrulama ve güvenlik",
    text: "Tek kullanımlık kod kaydının özeti, doğrulama denemeleri, oturum belirteci özeti, oturum süresi, istek zamanı, istek kimliği ve kötüye kullanımı önlemek için HMAC ile geri döndürülemez hâle getirilen IP türevleri.",
  },
  {
    title: "İçerik ve sosyal etkileşim",
    text: "Gönderi, yorum, anket ve oylar; beğeni, kaydetme, takip, engelleme, ilan, bildirim ve bunlara ait zaman bilgileri. Anonim gönderiler de sistem içinde hesapla ilişkilidir.",
  },
  {
    title: "Mesajlaşma",
    text: "Konuşma katılımcıları, mesaj istekleri, mesaj metni, gönderim ve okunma zamanları, silme durumu ile raporlanan mesaja ait inceleme kopyası.",
  },
  {
    title: "Medya ve dosya",
    text: "Yüklenen görsel veya PDF, dosya adı, türü, boyutu, sağlama değeri, depolama anahtarı ve güvenlik/moderasyon sonucu. GIF seçildiğinde GIPHY kimliği ve kaynak bilgileri.",
  },
  {
    title: "Destek, analitik ve moderasyon",
    text: "Geri bildirim metni ve kategorisi, ziyaret edilen sayfa, temel ürün olayları, rapor nedeni ve açıklaması, moderasyon kararı, denetim kaydı ve hata günlükleri.",
  },
] as const;

const purposeRows = [
  {
    purpose: "Üyelik ve doğrulama",
    detail:
      "Öğrenci uygunluğunu doğrulamak, hesabı oluşturmak ve oturumu yönetmek.",
    basis: "Sözleşmenin kurulması veya ifası; meşru menfaat",
  },
  {
    purpose: "Platform özellikleri",
    detail:
      "İçerik, etkileşim, bildirim, takip ve mesajlaşma işlevlerini sunmak.",
    basis: "Sözleşmenin ifası",
  },
  {
    purpose: "Güvenlik ve moderasyon",
    detail:
      "Spam, sahte hesap, taciz ve kötüye kullanımı önlemek; raporları incelemek.",
    basis:
      "Meşru menfaat; bir hakkın tesisi, kullanılması veya korunması",
  },
  {
    purpose: "Ürün geliştirme",
    detail:
      "Hataları gidermek, temel kullanım ölçümlerini üretmek ve geri bildirimi değerlendirmek.",
    basis: "Meşru menfaat",
  },
  {
    purpose: "Yasal süreçler",
    detail:
      "Yetkili makam taleplerini yanıtlamak ve mevzuattan doğan yükümlülükleri yerine getirmek.",
    basis:
      "Hukuki yükümlülük; bir hakkın tesisi, kullanılması veya korunması",
  },
] as const;

const retentionRows = [
  ["Doğrulama kodları", "Süre bitiminden sonra en geç 24 saat"],
  ["Süresi dolan veya iptal edilen oturumlar", "En geç 7 gün"],
  ["Bildirimler", "90 gün"],
  ["Ürün analitiği ve geri bildirim", "En fazla 180 gün"],
  ["Bağlanmamış yükleme dosyaları", "24 saat"],
  ["Silinen gönderi ve yorumlar", "Kural olarak 30 gün"],
  ["Çözümlenen rapor ve denetim kayıtları", "365 gün"],
  ["Güvenlik ve hız sınırı kayıtları", "Amacına göre 2–31 gün"],
] as const;

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

export default function KvkkPage() {
  return (
    <>
      <div className="relative isolate overflow-hidden bg-canvas text-white">
        <a
          href="#kvkk-content"
          className="fixed top-3 left-3 z-[60] -translate-y-20 bg-white px-4 py-3 text-xs font-black text-[#101012] outline-none transition-transform focus:translate-y-0"
        >
          İçeriğe geç
        </a>

        <header className="sticky top-0 z-50 border-b border-white/10 bg-canvas/92 backdrop-blur-xl">
          <div className="mx-auto flex min-h-[4.5rem] w-full max-w-[1360px] items-center justify-between gap-3 px-5 sm:min-h-20 sm:px-8 lg:px-12">
            <Link
              href="/"
              aria-label="KAMPÜS ana sayfa"
              className={
                "inline-flex min-h-11 items-center transition-opacity hover:opacity-80 " +
                focusRing
              }
            >
              <CampusLogo
                idPrefix="kvkk-header-logo"
                wordmarkClassName="text-lg sm:text-xl"
              />
            </Link>
            <Link
              href="/kayit"
              className={
                "inline-flex min-h-11 items-center px-3 text-xs font-black text-white/55 transition-colors hover:text-brand " +
                focusRing
              }
            >
              Kayıt ekranına dön
            </Link>
          </div>
        </header>

        <main
          id="kvkk-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1360px] px-5 pt-10 pb-16 outline-none sm:px-8 sm:pt-14 sm:pb-20 lg:px-12 lg:pt-16"
        >
          <div className="mx-auto max-w-6xl">
            <header className="max-w-4xl border-b border-white/10 pb-9 sm:pb-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand sm:text-xs">
                KAMPÜS. / Aydınlatma v1.0
              </p>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.55rem,8vw,5.7rem)] font-black leading-[0.92] tracking-[-0.06em]">
                KVKK aydınlatma
                <span className="block font-serif font-normal italic text-brand">
                  metni.
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                Bu metin, KAMPÜS’ü kullanırken hangi kişisel verilerin neden
                işlendiğini, kimlerle paylaşılabildiğini, ne kadar saklandığını
                ve haklarını açıklar. KAMPÜS, Yaşar Üniversitesi’nin resmî
                platformu değildir.
              </p>
              <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                Son güncelleme: 16 Ağustos 2026
              </p>
            </header>

            <dl className="grid border-b border-white/10 sm:grid-cols-3">
              <SummaryItem label="Veri sorumlusu" value="Yağız Karagöz" />
              <SummaryItem label="İletişim" value={controllerEmail} />
              <SummaryItem
                label="Kapsam"
                value="Üyeler, misafirler ve başvuru sahipleri"
              />
            </dl>

            <div className="grid gap-12 pt-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:pt-14">
              <KvkkNavigation className="hidden lg:sticky lg:top-28 lg:block lg:self-start" />

              <article className="min-w-0">
                <KvkkNavigation className="mb-10 border-b border-white/10 pb-9 lg:hidden" />

                <KvkkSection
                  number="01"
                  id="veri-sorumlusu"
                  title="Veri sorumlusu"
                >
                  <p>
                    6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”)
                    kapsamında veri sorumlusu, bağımsız KAMPÜS öğrenci
                    projesinin geliştiricisi ve işletmecisi olan{" "}
                    <strong>Yağız Karagöz</strong>’dür.
                  </p>
                  <p>
                    İletişim ve KVKK başvuruları için{" "}
                    <a href={"mailto:" + controllerEmail}>{controllerEmail}</a>{" "}
                    adresini kullanabilirsin. Proje hakkında bilgi için{" "}
                    <a
                      href="https://www.yagizkaragoz.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      yagizkaragoz.com
                    </a>{" "}
                    adresine ulaşabilirsin.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="02"
                  id="veriler"
                  title="İşlenen kişisel veriler"
                >
                  {dataGroups.map((group) => (
                    <DataGroup key={group.title} title={group.title}>
                      {group.text}
                    </DataGroup>
                  ))}
                  <p>
                    KAMPÜS; sağlık, siyasi düşünce, din, biyometrik veri gibi
                    özel nitelikli kişisel verileri istemez. Bu bilgileri
                    gönderi, mesaj, biyografi veya dosyalarda paylaşmamalısın.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="03"
                  id="amaclar"
                  title="Amaçlar ve hukuki sebepler"
                >
                  <PurposeTable />
                  <p>
                    İşleme faaliyetleri ağırlıklı olarak KVKK m.5/2(c)
                    kapsamındaki üyelik/hizmet ilişkisinin kurulması veya ifası,
                    m.5/2(ç) kapsamındaki hukuki yükümlülükler, m.5/2(e)
                    kapsamındaki bir hakkın tesisi, kullanılması ya da korunması
                    ve m.5/2(f) kapsamındaki meşru menfaat sebeplerine dayanır.
                  </p>
                  <p>
                    Aydınlatma metni bir açık rıza veya üyelik sözleşmesi
                    değildir. İleride açık rıza gerektiren isteğe bağlı bir
                    özellik eklenirse rıza ayrıca, belirli bir konu için ve
                    özgür iradeyle alınır.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="04"
                  id="toplama"
                  title="Verilerin toplanması"
                >
                  <p>
                    Veriler; kayıt ve profil formlarına yazdığın bilgiler,
                    platformdaki içerik ve etkileşimlerin, mesajlaşma ve
                    bildirim işlemlerin, dosya yüklemelerin, geri bildirimlerin
                    ve tarayıcı ile sunucu arasında oluşan güvenlik kayıtları
                    üzerinden elektronik ortamda otomatik veya kısmen otomatik
                    yollarla toplanır.
                  </p>
                  <p>
                    Misafir modunda hesap profili oluşturulmaz. Buna rağmen
                    güvenlik, hız sınırı ve geri bildirim kotası için sınırlı
                    teknik kayıtlar üretilebilir; uygulama veritabanında ham IP
                    yerine gizli anahtarla oluşturulan HMAC özeti tutulur.
                    Barındırma sağlayıcısı ağ bağlantısını teknik olarak
                    görebilir.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="05"
                  id="aktarim"
                  title="Aktarım ve hizmet sağlayıcılar"
                >
                  <p>
                    Veriler satılmaz ve reklam profili oluşturmak amacıyla
                    paylaşılmaz. Hizmetin çalışması için yalnızca gerekli veri,
                    veri işleyen sıfatıyla hizmet sunan aşağıdaki altyapılara
                    aktarılabilir:
                  </p>
                  <ul>
                    <li>
                      <strong>Vercel:</strong> web uygulamasının barındırılması,
                      dağıtımı, ağ güvenliği ve teknik günlükler.
                    </li>
                    <li>
                      <strong>Neon:</strong> hesap, içerik, sosyal etkileşim ve
                      uygulama kayıtlarının PostgreSQL veritabanında tutulması.
                    </li>
                    <li>
                      <strong>Google/Gmail:</strong> öğrenci e-posta adresine
                      tek kullanımlık doğrulama kodunun iletilmesi.
                    </li>
                    <li>
                      <strong>GIPHY:</strong> GIF arama ve seçme özelliğinin
                      kullanılması hâlinde sorgu, GIF kimliği ve teknik istek
                      bilgileri.
                    </li>
                    <li>
                      <strong>S3 uyumlu depolama ve AWS Rekognition:</strong>{" "}
                      dosya yükleme özelliği etkinse medyanın saklanması ve
                      uygunsuz görsel kontrolü.
                    </li>
                  </ul>
                  <p>
                    Ayrıca veriler, kanunen yetkili kamu kurumları veya adli
                    merciler tarafından usulüne uygun talep edilirse ve yalnızca
                    talep kapsamıyla sınırlı olmak üzere paylaşılabilir.
                  </p>
                  <div className="border-l-2 border-brand bg-brand/[0.055] p-4 text-white/72 sm:p-5">
                    <strong>Yurt dışı aktarım notu:</strong> Bu sağlayıcıların
                    altyapısı Türkiye dışında bulunabilir. İlgili servis ve
                    bölge seçimi gerçek kullanıcıya açılmadan önce doğrulanır;
                    gerekli aktarım, KVKK m.9’daki uygulanabilir şart ve uygun
                    güvence tamamlanmadan etkinleştirilmez.
                  </div>
                </KvkkSection>

                <KvkkSection
                  number="06"
                  id="gorunurluk"
                  title="Görünürlük ve anonimlik"
                >
                  <ul>
                    <li>
                      Profil bilgileri ile adınla paylaştığın içerikler,
                      platformun ilgili ekranlarında üyelere; misafir önizlemesi
                      açıksa misafirlere de gösterilebilir.
                    </li>
                    <li>
                      “Anonim paylaş” seçeneği yalnızca diğer kullanıcıların
                      gönderi üzerinde kimliğini görmesini engeller. Güvenlik,
                      şikâyet ve moderasyon için içerik hesabınla sistem içinde
                      ilişkili kalır.
                    </li>
                    <li>
                      Mesajlar yalnızca konuşmanın taraflarına gösterilir ancak
                      uçtan uca şifreli değildir. Bir mesaj raporlanırsa sınırlı
                      bir kopyası yetkili moderasyon incelemesine alınabilir.
                    </li>
                  </ul>
                </KvkkSection>

                <KvkkSection
                  number="07"
                  id="saklama"
                  title="Saklama ve silme"
                >
                  <p>
                    Veriler yalnızca işleme amacı için gerekli süre boyunca
                    tutulur. Başlıca uygulama süreleri şöyledir:
                  </p>
                  <div className="overflow-hidden border border-white/10">
                    {retentionRows.map(([record, period]) => (
                      <div
                        key={record}
                        className="grid gap-1 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px] sm:gap-5"
                      >
                        <span className="font-bold text-white">{record}</span>
                        <span>{period}</span>
                      </div>
                    ))}
                  </div>
                  <p>
                    Aktif profil, içerik ve mesaj kayıtları hesabın veya ilgili
                    hizmetin yaşam döngüsü boyunca tutulur. Hesap silme
                    talebinde profil hemen erişime kapatılır, oturumlar iptal
                    edilir ve doğrudan tanımlayıcılar anonim değerlerle
                    değiştirilir. Hukuki veya açık bir moderasyon saklama nedeni
                    yoksa bağımlı kayıtların kalıcı silme süreci en erken 30 gün
                    sonra tamamlanır.
                  </p>
                  <p>
                    İncelemesi süren raporlar sonuçlanana kadar; hukuki
                    uyuşmazlık veya yetkili makam talebi bulunan kayıtlar ise
                    gerekli yasal süre boyunca saklanabilir. Süre sonunda veri
                    silinir, yok edilir veya anonim hâle getirilir.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="08"
                  id="guvenlik"
                  title="Veri güvenliği"
                >
                  <p>
                    KAMPÜS’te doğrulama kodları ve oturum anahtarları açık metin
                    yerine kriptografik özetlerle saklanır; oturumlar güvenli
                    çerezlerle sınırlandırılır; erişimler rol kontrolü, hız
                    sınırı ve aynı kaynak denetimleriyle korunur. IP türevleri
                    HMAC ile geri döndürülemez hâle getirilir.
                  </p>
                  <p>
                    Yüklemelerde dosya türü, boyut, imza ve içerik denetimleri;
                    moderasyon işlemlerinde yetki ve denetim kaydı uygulanır.
                    Veri erişimi hizmetin işletilmesi için gerekli bileşenlerle
                    sınırlandırılır. Hiçbir internet hizmeti mutlak güvenlik
                    garanti edemediğinden şüpheli bir durum görürsen iletişim
                    adresine bildirmelisin.
                  </p>
                </KvkkSection>

                <KvkkSection
                  number="09"
                  id="haklar"
                  title="KVKK kapsamındaki hakların"
                >
                  <p>KVKK’nın 11. maddesi uyarınca:</p>
                  <ul>
                    <li>Kişisel verilerinin işlenip işlenmediğini öğrenme,</li>
                    <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
                    <li>
                      İşlenme amacını ve amacına uygun kullanılıp
                      kullanılmadığını öğrenme,
                    </li>
                    <li>
                      Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri
                      bilme,
                    </li>
                    <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
                    <li>
                      KVKK m.7’deki şartlar oluşmuşsa silinmesini veya yok
                      edilmesini isteme,
                    </li>
                    <li>
                      Düzeltme, silme veya yok etme işlemlerinin verinin
                      aktarıldığı üçüncü kişilere bildirilmesini isteme,
                    </li>
                    <li>
                      Yalnızca otomatik sistemlerle analiz sonucu aleyhine bir
                      sonucun ortaya çıkmasına itiraz etme,
                    </li>
                    <li>
                      Kanuna aykırı işleme nedeniyle zarara uğrarsan zararın
                      giderilmesini talep etme
                    </li>
                  </ul>
                  <p>haklarına sahipsin.</p>
                </KvkkSection>

                <KvkkSection
                  number="10"
                  id="basvuru"
                  title="Başvuru yöntemi"
                >
                  <p>
                    Başvurunu, hesabında doğruladığın öğrenci e-posta adresinden{" "}
                    <a href={"mailto:" + controllerEmail}>{controllerEmail}</a>{" "}
                    adresine “KVKK Başvurusu” konusuyla gönderebilirsin.
                    Başvuruda ad-soyad, hesabındaki kullanıcı adı, talebin ve
                    yanıt için iletişim bilgisi bulunmalıdır. Kimlik doğrulamak
                    için yalnızca talebi sonuçlandırmak bakımından gerekli ek
                    bilgiler istenebilir.
                  </p>
                  <p>
                    Başvurular niteliğine göre en kısa sürede ve en geç 30 gün
                    içinde ücretsiz sonuçlandırılır. İşlemin ayrıca maliyet
                    gerektirmesi hâlinde yalnızca Kişisel Verileri Koruma Kurulu
                    tarafından belirlenen tarifedeki ücret talep edilebilir.
                  </p>
                  <p>
                    Başvurunun reddedilmesi, yanıtın yetersiz bulunması veya
                    süresinde yanıt verilmemesi hâlinde KVKK’da belirtilen
                    süreler içinde Kişisel Verileri Koruma Kuruluna şikâyet
                    hakkın vardır.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <OfficialLink href="https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-">
                      KVKK bilgilendirmesi ↗
                    </OfficialLink>
                    <OfficialLink href="https://www.kvkk.gov.tr/Icerik/2062/Basvuru-Hakki">
                      Başvuru hakkı ↗
                    </OfficialLink>
                  </div>
                </KvkkSection>

                <div className="mt-12 border-t border-white/10 pt-8">
                  <p className="max-w-2xl text-sm leading-6 text-white/55">
                    Bu metni okumak veya kayıt işlemine devam etmek, açık rıza
                    verdiğin anlamına gelmez. Kullanım koşullarının kabulü ayrı
                    olarak alınır.
                  </p>
                  <Link
                    href="/kayit"
                    className={
                      "mt-5 inline-flex min-h-12 items-center justify-center bg-white px-5 text-sm font-black text-[#101012] transition-colors hover:bg-white/90 " +
                      focusRing
                    }
                  >
                    Kayıt ekranına dön
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}

function KvkkNavigation({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Aydınlatma metni bölümleri" className={className}>
      <ol className="grid gap-1.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={"#" + section.id}
              className={
                "flex min-h-11 items-center gap-2 text-[11px] font-bold leading-4 text-white/55 transition-colors hover:text-brand " +
                focusRing
              }
            >
              <span
                aria-hidden="true"
                className="font-mono text-[9px] text-brand"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
        {label}
      </dt>
      <dd className="mt-2 break-words text-xs font-semibold leading-5 text-white/68">
        {value}
      </dd>
    </div>
  );
}

function KvkkSection({
  number,
  id,
  title,
  children,
}: {
  number: string;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id + "-title"}
      className="scroll-mt-28 border-t border-white/10 py-9 first:border-t-0 first:pt-0 sm:py-11"
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-mono text-[10px] font-bold text-brand"
        >
          {number}
        </span>
        <h2
          id={id + "-title"}
          className="text-xl font-black tracking-[-0.035em] sm:text-2xl"
        >
          {title}
        </h2>
      </div>
      <div className="mt-5 space-y-4 text-sm leading-7 text-white/68 marker:text-brand [&_a]:font-bold [&_a]:text-brand [&_a]:underline [&_a]:decoration-brand/35 [&_a]:underline-offset-4 [&_a]:outline-none [&_a]:hover:text-[#ff9e80] [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-brand/30 [&_li]:pl-1 [&_strong]:font-black [&_strong]:text-white [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2.5">
        {children}
      </div>
    </section>
  );
}

function DataGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-l border-white/14 pl-4">
      <h3 className="text-sm font-black text-white">{title}</h3>
      <p className="mt-1">{children}</p>
    </div>
  );
}

function PurposeTable() {
  return (
    <div className="overflow-hidden border border-white/10">
      {purposeRows.map((row) => (
        <div
          key={row.purpose}
          className="grid gap-2 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-x-5"
        >
          <h3 className="font-black text-white">{row.purpose}</h3>
          <div>
            <p>{row.detail}</p>
            <p className="mt-1 text-xs text-white/45">
              <strong>Hukuki sebep:</strong> {row.basis}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficialLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex min-h-11 items-center border border-white/14 px-4 text-xs font-black text-white/68 transition-colors hover:border-white/30 hover:text-white " +
        focusRing
      }
    >
      {children}
    </a>
  );
}
