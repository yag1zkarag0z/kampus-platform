const faqItems = [
  {
    question: "KAMPÜS resmî bir üniversite platformu mu?",
    answer:
      "Hayır. KAMPÜS bağımsız bir öğrenci projesidir; Yaşar Üniversitesi tarafından işletilmez veya desteklenmez.",
  },
  {
    question: "Kimler hesap açabilir?",
    answer:
      "Kayıt için @stu.yasar.edu.tr uzantılı öğrenci e-postanı doğrulaman gerekir.",
  },
  {
    question: "Kayıt olmadan bakabilir miyim?",
    answer:
      "Evet. Misafir görünümünde platformu inceleyebilirsin; paylaşmak ve etkileşime girmek için hesap gerekir.",
  },
  {
    question: "Anonim paylaşımda adım görünür mü?",
    answer:
      "Diğer öğrenciler adını görmez. Kötüye kullanım bildirimi oluşursa içerik yetkili moderatör tarafından incelenebilir.",
  },
  {
    question: "Bir içeriği bildirirsem ne olur?",
    answer:
      "Bildirim moderatör tarafından değerlendirilir. Gerekli işlem uygulanır ve sonuç kayıt altına alınır.",
  },
  {
    question: "Hesabımı silebilir miyim?",
    answer: "Evet. Hesabını ayarlardan kapatabilir ve silme sürecini başlatabilirsin.",
  },
  {
    question: "KAMPÜS ücretli mi?",
    answer: "Hayır. Platform öğrenciler için ücretsizdir.",
  },
];

export default function FAQSection() {
  return (
    <section
      aria-labelledby="faq-title"
      className="border-b border-white/10 bg-canvas text-white"
    >
      <div className="mx-auto w-full max-w-[900px] px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand sm:text-xs">
          SSS
        </p>
        <h1
          id="faq-title"
          className="mt-5 text-[clamp(2.8rem,7vw,5.8rem)] font-medium leading-[0.95] tracking-[-0.06em]"
        >
          Kısa yanıtlar<span className="text-brand">.</span>
        </h1>

        <ul className="mt-12 divide-y divide-white/10 border-y border-white/10 sm:mt-16">
          {faqItems.map((item) => (
            <li key={item.question}>
              <details className="group py-5 sm:py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold leading-6 outline-none marker:content-none focus-visible:text-brand sm:text-lg [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-white/12 text-brand transition-colors group-open:border-brand/45"
                  >
                    <span className="text-lg leading-none transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl pr-12 text-sm leading-6 text-white/52 sm:text-base sm:leading-7">
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
