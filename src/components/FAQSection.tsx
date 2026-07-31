import HeroParticles, {
  createHeroParticles,
} from "@/components/HeroParticles";
import LottiePlayer from "@/components/LottiePlayer";
import faqParachutistsAnimation from "./faq-parachutists-lottie.json";

const faqParticles = createHeroParticles(16, 0x2e2418);

const faqItems = [
  {
    question: "Bu resmi bir üniversite uygulaması mı?",
    answer:
      "Hayır, alakası yok. Üniversitenin bundan haberi bile olmayabilir, tamamen bağımsız.",
  },
  {
    question: "Bunu kim yaptı?",
    answer:
      "Ben, Yağız. Tek başıma, portfolyom için ve staj başvurularında gösterebileceğim gerçek bir proje olsun diye yaptım. Yani arkasında bir şirket falan yok.",
  },
  {
    question: "Neden böyle bir şey yapma ihtiyacı duydun?",
    answer:
      "Kampüste olup biteni takip edebileceğimiz, gerçekten sadece bizim girebileceğimiz ve bize ait bir yer yoktu. Ben de olsun istedim.",
  },
  {
    question: "Gerçekten sadece Yaşarlılar mı görebiliyor?",
    answer:
      "Evet. @stu.yasar.edu.tr maili olmayan içeri giremiyor, o yüzden akış tanımadığın insanlarla dolmuyor.",
  },
  {
    question: "Anonim atarsam adım gerçekten çıkmıyor mu yani?",
    answer:
      "Çıkmıyor, kimse görmüyor. Sadece biri seni şikayet ederse moderatör bakabiliyor, o kadar.",
  },
  {
    question: "Birini şikayet edersem ne oluyor, benim adım geçiyor mu?",
    answer:
      "Hayır, kim şikayet etti kimse bilmiyor. İnceleniyor, bir karar veriliyor, işlem kayda geçiyor. Sen görünmezsin.",
  },
  {
    question: "Hesabı silmek istersem uğraştırır mı?",
    answer: "Yok, ayarlardan tek tıkla kapatırsın, veriler de siliniyor.",
  },
  {
    question: "Para falan mı istiyorsunuz?",
    answer: "Yok öyle bir şey, tamamen bedava.",
  },
  {
    question: "Para almıyorsan bu değirmenin suyu nasıl dönecek?",
    answer:
      "Şimdilik tüm masrafları kendi cebimden karşılıyorum. Açıkçası buradan para kazanmak gibi bir amacım yok; bu deneyimi yaşamak, insanların sosyalleşebileceği güzel bir ortam oluşturmak ve ortaya çıkan projeyi portfolyoma eklemek benim için yeterli. Tabii ileride nereye gider bilinmez; belki büyür, beklemediğim yerlere ulaşır. Şimdilik tek amacım güzel ve gerçekten kullanılan bir şey ortaya çıkarmak."
  },
  {
    question: "Bir sorun olursa ya da fikrim olursa ne yapmalıyım?",
    answer:
      "Direkt bana ulaşabilirsin, yazabiliriz. Footer'daki isme tıklaman yeterli.",
  },
];

export default function FAQSection() {
  return (
    <section
      id="sss"
      aria-labelledby="faq-title"
      className="reveal-item relative overflow-hidden border-b border-white/10 bg-[#0a0d16] text-white"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 opacity-[0.05]"
      />

      <HeroParticles particles={faqParticles} />

      <div className="relative mx-auto w-full max-w-[900px] px-5 pb-20 pt-8 sm:px-8 sm:pb-24 sm:pt-10 lg:px-12">
        <div className="reveal-item text-center">
          <LottiePlayer
            animationData={faqParachutistsAnimation}
            className="mx-auto h-44 w-44 sm:h-56 sm:w-56 lg:h-64 lg:w-64"
          />

          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff7a45] sm:text-xs">
            Sık sorulan sorular
          </p>

          <h2
            id="faq-title"
            className="mt-5 text-[clamp(2.2rem,5.5vw,3.6rem)] font-black leading-[0.95] tracking-[-0.045em]"
          >
            Aklına takılanlar
          </h2>
        </div>

        <ul className="reveal-item mt-12 divide-y divide-white/10 border-t border-white/10 sm:mt-16">
          {faqItems.map((item) => (
            <li key={item.question}>
              <details className="group py-5 sm:py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold leading-6 outline-none marker:content-none focus-visible:text-[#ff7a45] sm:text-lg [&::-webkit-details-marker]:hidden">
                  {item.question}

                  <span
                    aria-hidden="true"
                    className="relative size-5 shrink-0 text-[#ff7a45]"
                  >
                    <span className="absolute inset-0 top-1/2 h-[1.5px] w-full -translate-y-1/2 bg-current" />
                    <span className="absolute inset-0 left-1/2 h-full w-[1.5px] -translate-x-1/2 bg-current transition-transform duration-200 group-open:rotate-90" />
                  </span>
                </summary>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/62 sm:text-[15px] sm:leading-7">
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
