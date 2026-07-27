import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import CampusLogo from "@/components/CampusLogo";
import SiteFooter from "@/components/SiteFooter";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Kullanım ve Topluluk Sözleşmesi | KAMPÜS.",
  description:
    "KAMPÜS üyelik koşulları, topluluk kuralları, anonimlik sınırları ve moderasyon ilkeleri.",
};

const sections = [
  { id: "kapsam", title: "Kapsam ve kabul" },
  { id: "uyelik", title: "Üyelik ve hesap güvenliği" },
  { id: "misafir", title: "Misafir erişimi" },
  { id: "anonimlik", title: "İçerik ve anonimlik" },
  { id: "kurallar", title: "Topluluk kuralları" },
  { id: "fotograflar", title: "Fotoğraf ve dosya yükleme" },
  { id: "moderasyon", title: "Moderasyon, şikâyet ve engelleme" },
  { id: "haklar", title: "İçerik hakları" },
  { id: "gizlilik", title: "Kişisel veriler ve gizlilik" },
  { id: "hesap-islemleri", title: "Hesabın askıya alınması veya silinmesi" },
  { id: "degisiklikler", title: "Değişiklikler ve iletişim" },
] as const;

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee9e1] dark:focus-visible:ring-[#c7896d]/30 dark:focus-visible:ring-offset-[#111315]";

export default function TermsPage() {
  return (
    <>
      <div className="relative isolate overflow-hidden bg-[#eee9e1] text-[#1c2821] dark:bg-[#111315] dark:text-[#ece8e1]">
        <a
          href="#terms-content"
          className="fixed top-3 left-3 z-[60] -translate-y-20 bg-[#5a1f32] px-4 py-3 text-xs font-black text-white outline-none transition-transform focus:translate-y-0 dark:bg-[#c7896d] dark:text-[#121417]"
        >
          İçeriğe geç
        </a>
        <div
          aria-hidden="true"
          className="hero-gradient-motion pointer-events-none absolute inset-0 -z-30 opacity-70 dark:opacity-55"
        />
        <div
          aria-hidden="true"
          className="paper-noise pointer-events-none absolute inset-0 -z-20"
        />

        <header className="sticky top-0 z-50 border-b border-[#1c2821]/13 bg-[#eee9e1]/92 backdrop-blur-xl dark:border-white/11 dark:bg-[#111315]/92">
          <div className="mx-auto flex min-h-[4.5rem] w-full max-w-[1360px] items-center justify-between gap-3 px-5 sm:min-h-20 sm:px-8 lg:px-12">
            <Link
              href="/"
              aria-label="KAMPÜS ana sayfa"
              className={`inline-flex min-h-11 items-center transition-opacity hover:opacity-80 ${focusRing}`}
            >
              <CampusLogo
                idPrefix="terms-header-logo"
                wordmarkClassName="text-lg sm:text-xl"
              />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className={`hidden min-h-11 items-center px-3 text-xs font-black text-[#58635c] transition-colors hover:text-[#5a1f32] dark:text-[#aeb4af] dark:hover:text-[#d09272] sm:inline-flex ${focusRing}`}
              >
                Ana sayfaya dön
              </Link>
              <ThemeToggle className="size-11 px-0" />
            </div>
          </div>
        </header>

        <main
          id="terms-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1360px] px-5 pt-10 pb-16 outline-none sm:px-8 sm:pt-14 sm:pb-20 lg:px-12 lg:pt-16"
        >
          <div className="mx-auto max-w-6xl">
            <header className="max-w-4xl border-b border-[#1c2821]/13 pb-9 dark:border-white/11 sm:pb-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#7d3c2d] dark:text-[#c7896d] sm:text-xs">
                KAMPÜS. / Sözleşme v1.0
              </p>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.55rem,8vw,5.7rem)] font-black leading-[0.92] tracking-[-0.06em]">
                Kullanım ve
                <span className="block font-serif font-normal italic text-[#7d3c2d] dark:text-[#d09272]">
                  topluluk sözleşmesi.
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-[#475149] dark:text-[#bcc1bd] sm:text-lg sm:leading-8">
                Bu metin KAMPÜS’e katılırken kabul ettiğin temel kullanım
                koşullarını, topluluğun sınırlarını ve moderasyon yaklaşımını
                açıklar.
              </p>
              <p className="mt-5 text-xs font-bold text-[#58635c] dark:text-[#aeb4af]">
                Son güncelleme:{" "}
                <time dateTime="2026-07-27">27 Temmuz 2026</time>
              </p>
            </header>

            <dl className="grid border-b border-[#1c2821]/13 dark:border-white/11 sm:grid-cols-3">
              <SummaryItem
                label="Öğrenci alanı"
                value="Öğrenci gönderileri yalnızca doğrulanmış üyelere açıktır."
              />
              <SummaryItem
                label="Misafir görünümü"
                value="Yalnızca KAMPÜS ekibinin seçtiği herkese açık içerikleri gösterir."
              />
              <SummaryItem
                label="Anonimlik"
                value="Kimliğin diğer öğrencilere gizlenir; platforma karşı gizlenmez."
              />
            </dl>

            <details className="mt-7 border-y border-[#1c2821]/13 py-1 dark:border-white/11 lg:hidden">
              <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between text-xs font-black [&::-webkit-details-marker]:hidden ${focusRing}`}>
                Bölümler
                <span aria-hidden="true" className="font-mono text-base">
                  +
                </span>
              </summary>
              <TermsNavigation className="pb-4" />
            </details>

            <div className="mt-10 grid items-start gap-12 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16 xl:gap-24">
              <aside className="sticky top-28 hidden lg:block">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#7d3c2d] dark:text-[#c7896d]">
                  Bu sayfada
                </p>
                <TermsNavigation className="mt-4" />
              </aside>

              <article className="min-w-0 max-w-[74ch]">
                <TermsSection number="01" id="kapsam" title="Kapsam ve kabul">
                  <p>
                    KAMPÜS, Yaşar Üniversitesi öğrencilerinin kampüs gündemini,
                    sorularını ve deneyimlerini paylaşabilmesi için geliştirilen
                    bağımsız bir öğrenci platformudur. Yaşar Üniversitesi
                    tarafından işletilmez, desteklenmez veya resmî bilgi kanalı
                    olarak kullanılmaz.
                  </p>
                  <p>
                    Hesap oluşturup bu sözleşmeyi onayladığında, platformu bu
                    koşullara ve yürürlükteki kurallara uygun kullanmayı kabul
                    edersin. Üniversiteye ilişkin kesin bilgi gereken
                    durumlarda resmî Yaşar kanallarını kontrol etmelisin.
                    KAMPÜS acil yardım veya resmî ihbar kanalı değildir.
                  </p>
                </TermsSection>

                <TermsSection
                  number="02"
                  id="uyelik"
                  title="Üyelik ve hesap güvenliği"
                >
                  <ul>
                    <li>
                      Öğrenci alanına erişmek için geçerli bir{" "}
                      <strong>@stu.yasar.edu.tr</strong> adresini doğrulaman
                      gerekir.
                    </li>
                    <li>
                      Başkası adına hesap oluşturamaz, başka bir öğrenciyi
                      taklit edemez veya hesabını devredemezsin.
                    </li>
                    <li>
                      Giriş bilgilerini ve doğrulama kodlarını korumaktan sen
                      sorumlusun. Şüpheli bir işlem fark ettiğinde destek
                      kanalıyla iletişime geçmelisin.
                    </li>
                    <li>
                      Doğrulama için kullanılan öğrenci e-postası herkese açık
                      profilinde gösterilmez.
                    </li>
                  </ul>
                </TermsSection>

                <TermsSection
                  number="03"
                  id="misafir"
                  title="Misafir erişimi"
                >
                  <p>
                    Giriş yapmayan ziyaretçiler yalnızca KAMPÜS ekibi tarafından
                    hazırlanmış veya misafir görünümüne özel olarak yayımlanmış
                    seçili içerikleri okuyabilir. Misafirler öğrenci
                    gönderilerini, yorumlarını ve profillerini göremez; beğeni,
                    yorum, kaydetme veya paylaşım işlemi yapamaz.
                  </p>
                  <p>
                    Bir öğrencinin içeriği, öğrenciden ayrıca izin alınmadan
                    misafir görünümüne taşınmaz. Böylece kampüs içindeki
                    konuşmalar kampüs içinde kalır.
                  </p>
                </TermsSection>

                <TermsSection
                  number="04"
                  id="anonimlik"
                  title="İçerik ve anonimlik"
                >
                  <p>
                    Paylaştığın gönderi, yorum ve dosyalardan sen sorumlusun.
                    Anonim paylaşım seçtiğinde adın ve profilin diğer
                    kullanıcılara gösterilmez; ancak içerik güvenliği ve
                    moderasyon amacıyla paylaşım hesabınla ilişkilendirilmeye
                    devam eder.
                  </p>
                  <p>
                    Anonimlik; kuralları, başkalarının haklarını veya hukuki
                    yükümlülükleri ortadan kaldırmaz. Hesap bağlantısı yalnızca
                    yetkili moderasyon süreçlerinde ve hukuken zorunlu
                    durumlarda kullanılır.
                  </p>
                </TermsSection>

                <TermsSection
                  number="05"
                  id="kurallar"
                  title="Topluluk kuralları"
                >
                  <p>KAMPÜS’te aşağıdaki içerik ve davranışlara izin verilmez:</p>
                  <ul>
                    <li>
                      Tehdit, hedef gösterme, taciz, zorbalık veya nefret
                      söylemi.
                    </li>
                    <li>
                      Bir kişinin adı, telefonu, adresi, öğrenci numarası,
                      konumu ya da özel yazışmaları gibi kişisel bilgileri
                      izinsiz paylaşmak.
                    </li>
                    <li>
                      Rıza dışı görüntü, mahrem içerik veya kişilerin
                      güvenliğini tehlikeye atan kayıtlar.
                    </li>
                    <li>
                      Şiddeti teşvik eden, yasa dışı faaliyeti kolaylaştıran,
                      dolandırıcılık veya kimliğe bürünme içeren paylaşımlar.
                    </li>
                    <li>
                      Spam, yanıltıcı reklam, yapay etkileşim veya topluluğu
                      manipüle etmeye yönelik tekrarlı içerik.
                    </li>
                    <li>
                      Sınav içeriğini izinsiz yaymak veya akademik dürüstlüğü
                      ihlal etmeye yönelik organize paylaşımlar.
                    </li>
                  </ul>
                  <p>
                    Eleştiri ve mizah serbesttir; ancak gerçek bir kişiyi
                    aşağılamak, susturmak veya toplu hedef hâline getirmek
                    eleştiri olarak değerlendirilmez.
                  </p>
                </TermsSection>

                <TermsSection
                  number="06"
                  id="fotograflar"
                  title="Fotoğraf ve dosya yükleme"
                >
                  <ul>
                    <li>
                      Yalnızca paylaşma hakkına sahip olduğun veya gerekli izni
                      aldığın görselleri yükleyebilirsin.
                    </li>
                    <li>
                      Fotoğrafta açıkça tanınan kişilerin mahremiyetine ve
                      paylaşılmama taleplerine saygı göstermelisin.
                    </li>
                    <li>
                      Güvenlik amacıyla dosya türü, boyutu ve çözünürlüğü
                      sınırlandırılabilir; görselin konum bilgisi gibi teknik
                      metaverileri kaldırılabilir.
                    </li>
                    <li>
                      Kuralları ihlal eden bir görsel, metni kurallara uygun
                      olsa bile kaldırılabilir.
                    </li>
                  </ul>
                </TermsSection>

                <TermsSection
                  number="07"
                  id="moderasyon"
                  title="Moderasyon, şikâyet ve engelleme"
                >
                  <p>
                    KAMPÜS; güvenliği korumak için içeriğin erişimini
                    sınırlayabilir, yoruma kapatabilir veya içeriği kaldırabilir.
                    İhlalin ağırlığına göre uyarı, geçici kısıtlama, hesap
                    askıya alma ya da kalıcı hesap kapatma uygulanabilir.
                  </p>
                  <p>
                    Kullanıcılar içerikleri şikâyet edebilir ve istemedikleri
                    hesapları engelleyebilir. Engelleme, karşı taraf hakkında
                    ayrıca yaptırım uygulandığı anlamına gelmez; şikâyetler
                    bağlam ve kanıtlarla birlikte ayrı değerlendirilir. Mümkün
                    olduğunda alınan kararın nedeni ve itiraz yolu kullanıcıya
                    bildirilir.
                  </p>
                </TermsSection>

                <TermsSection
                  number="08"
                  id="haklar"
                  title="İçerik hakları"
                >
                  <p>
                    Ürettiğin içeriğin hakları sana aittir. İçerik
                    yayımladığında KAMPÜS’e yalnızca hizmeti çalıştırmak için
                    gerekli ölçüde barındırma, teknik olarak dönüştürme ve
                    platform içinde gösterme izni verirsin.
                  </p>
                  <p>
                    Öğrenci içerikleri reklam amacıyla satılmaz ve misafir
                    görünümünde yeniden yayımlanmaz. Başkasına ait bir eseri
                    paylaşırken gerekli izinleri almak senin sorumluluğundadır.
                  </p>
                </TermsSection>

                <TermsSection
                  number="09"
                  id="gizlilik"
                  title="Kişisel veriler ve gizlilik"
                >
                  <p>
                    Bu sözleşme, kişisel verilerin işlenmesine ilişkin KVKK
                    aydınlatma metninin yerine geçmez. Veri sorumlusunun kimliği,
                    işlenen veriler, amaçlar, hukuki sebepler, aktarım ve
                    saklama koşulları ile başvuru hakları; kişisel veri
                    toplanmaya başlamadan önce ayrı bir aydınlatma metninde
                    açıklanır.
                  </p>
                  <p>
                    Açık rıza gerektiren isteğe bağlı bir işlem bulunursa bu
                    onay, sözleşme kabulünden ve aydınlatma metninden ayrı
                    alınır. Yalnızca hizmet için gerekli bilgiler
                    işlenmelidir.
                  </p>
                </TermsSection>

                <TermsSection
                  number="10"
                  id="hesap-islemleri"
                  title="Hesabın askıya alınması veya silinmesi"
                >
                  <p>
                    Hesabını ayarlardan silme talebi oluşturabilirsin. Silme
                    sonrasında profilin erişime kapatılır; mevzuat, güvenlik,
                    kötüye kullanım incelemesi veya hak talepleri için tutulması
                    zorunlu kayıtlar yalnızca gerekli süre boyunca
                    saklanabilir. Ayrıntılar aydınlatma ve saklama
                    politikalarında belirtilir.
                  </p>
                  <p>
                    Ağır veya tekrarlanan ihlallerde hesap önceden
                    sınırlandırılabilir. Acil güvenlik riski olmayan durumlarda
                    kullanıcıya açıklama ve itiraz olanağı sunulması esastır.
                  </p>
                </TermsSection>

                <TermsSection
                  number="11"
                  id="degisiklikler"
                  title="Değişiklikler ve iletişim"
                >
                  <p>
                    Sözleşme değiştiğinde sürüm numarası ve güncelleme tarihi bu
                    sayfada gösterilir. Kullanıcı haklarını veya yükümlülüklerini
                    önemli ölçüde etkileyen değişikliklerde yeniden onay
                    istenebilir.
                  </p>
                  <p>
                    Sözleşme, moderasyon kararı veya hesap işlemleriyle ilgili
                    sorularını{" "}
                    <a
                      href="mailto:help@yagizkaragoz.com"
                      className={`font-bold text-[#7d3c2d] underline decoration-[#9a5944]/35 underline-offset-4 hover:text-[#5a1f32] dark:text-[#d09272] dark:hover:text-[#e0a083] ${focusRing}`}
                    >
                      help@yagizkaragoz.com
                    </a>{" "}
                    adresine iletebilirsin.
                  </p>
                </TermsSection>

                <div className="mt-12 border-t border-[#1c2821]/13 pt-8 dark:border-white/11">
                  <p className="max-w-2xl text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
                    Kayıt ekranındaki kutuyu işaretlediğinde bu sözleşmenin
                    güncel sürümünü okuduğunu ve kabul ettiğini belirtmiş
                    olursun.
                  </p>
                  <Link
                    href="/kayit"
                    className={`mt-5 inline-flex min-h-12 items-center justify-center bg-[#5a1f32] px-5 text-sm font-black text-white transition-colors hover:bg-[#6b2940] dark:bg-[#9a5944] dark:text-[#121417] dark:hover:bg-[#ad6b53] ${focusRing}`}
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

function TermsNavigation({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Sözleşme bölümleri" className={className}>
      <ol className="grid gap-1.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={`flex min-h-11 items-center gap-2 text-[11px] font-bold leading-4 text-[#58635c] transition-colors hover:text-[#5a1f32] dark:text-[#aeb4af] dark:hover:text-[#d09272] ${focusRing}`}
            >
              <span
                aria-hidden="true"
                className="font-mono text-[9px] text-[#9a5944] dark:text-[#c7896d]"
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
    <div className="border-b border-[#1c2821]/13 py-5 last:border-b-0 dark:border-white/11 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <dt className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
        {label}
      </dt>
      <dd className="mt-2 text-xs font-semibold leading-5 text-[#475149] dark:text-[#bcc1bd]">
        {value}
      </dd>
    </div>
  );
}

function TermsSection({
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
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28 border-t border-[#1c2821]/13 py-9 first:border-t-0 first:pt-0 dark:border-white/11 sm:py-11"
    >
      <div className="flex items-baseline gap-3">
        <span
          aria-hidden="true"
          className="font-mono text-[10px] font-bold text-[#9a5944] dark:text-[#c7896d]"
        >
          {number}
        </span>
        <h2
          id={`${id}-title`}
          className="text-xl font-black tracking-[-0.035em] sm:text-2xl"
        >
          {title}
        </h2>
      </div>
      <div className="mt-5 space-y-4 text-sm leading-7 text-[#475149] marker:text-[#9a5944] dark:text-[#bcc1bd] dark:marker:text-[#c7896d] [&_li]:pl-1 [&_strong]:font-black [&_strong]:text-[#1c2821] dark:[&_strong]:text-[#ece8e1] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2.5">
        {children}
      </div>
    </section>
  );
}
