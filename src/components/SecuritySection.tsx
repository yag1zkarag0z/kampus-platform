const securityPrinciples = [
  {
    code: "G-01",
    title: "Öğrenci doğrulaması",
    description:
      "Akışa yalnızca @stu.yasar.edu.tr adresini doğrulayan öğrenciler katılabilir.",
  },
  {
    code: "G-02",
    title: "Adın gizli kalır",
    description:
      "Anonim gönderilerde adın görünmez; ancak kötüye kullanım şikâyetleri incelenebilir.",
  },
  {
    code: "G-03",
    title: "Şikâyetler incelenir",
    description:
      "Uygunsuz gönderi ve yorumları bildirebilirsin. İçerik, işlem yapılmadan önce bir moderatör tarafından incelenir.",
  },
  {
    code: "G-04",
    title: "Yönetici erişimi sınırlıdır",
    description:
      "Moderatörler yalnızca inceleme için gereken bilgileri görebilir. Yapılan işlemler kayıt altında tutulur.",
  },
];

const moderationFlow = ["Bildirim", "İnceleme", "Karar", "Sonuç"];

export default function SecuritySection() {
  return (
    <section
      id="guvenlik"
      aria-labelledby="security-title"
      className="security-surface relative overflow-x-clip text-[#f8f4eb] dark:text-[#ece8e1]"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0 opacity-[0.07]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e7b897]/65 to-transparent dark:via-[#c7896d]/65"
      />

      <div className="relative mx-auto w-full max-w-[1360px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28 xl:py-32">
        <header className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-24">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-2.5 rotate-45 bg-[#e7b897] dark:bg-[#c7896d]"
              />
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#e7b897] dark:text-[#c7896d] sm:text-xs">
                Gizlilik ve güvenlik
              </p>
            </div>

            <h2
              id="security-title"
              className="max-w-4xl text-[clamp(2.75rem,7vw,6.2rem)] font-black leading-[0.91] tracking-[-0.06em]"
            >
              Adın gizli.
              <span className="block font-serif font-normal italic text-[#e7b897] dark:text-[#c7896d]">
                Kurallar herkes için aynı.
              </span>
            </h2>
          </div>

          <div className="border-l border-[#e7b897]/45 pl-5 dark:border-[#c7896d]/45 sm:pl-7">
            <p className="max-w-xl text-lg font-semibold leading-8 tracking-[-0.02em] text-[#f8f4eb]/88 dark:text-white/88 sm:text-xl">
              Anonim paylaşımlarda adın diğer öğrencilere görünmez. Her hesap
              öğrenci e-postasıyla doğrulanır.
            </p>
            <p className="mt-4 hidden max-w-xl text-sm leading-6 text-[#f8f4eb]/66 dark:text-white/66 sm:block">
              KAMPÜS, Yaşar Üniversitesi sistemlerine bağlı değildir.
              Moderatörler yalnızca bir şikâyeti incelemek için gereken
              bilgilere erişebilir.
            </p>
          </div>
        </header>

        <div className="mt-14 grid border-t border-white/16 sm:mt-16 sm:grid-cols-2 xl:grid-cols-4">
          {securityPrinciples.map((principle, index) => (
            <article
              key={principle.code}
              className={`border-b border-white/14 py-6 sm:min-h-64 sm:px-6 sm:py-9 xl:min-h-72 xl:border-b-0 xl:px-7 ${
                index % 2 === 1
                  ? "sm:border-l sm:border-white/14 sm:pr-0"
                  : "sm:pl-0"
              } ${index > 0 ? "xl:border-l xl:border-white/14" : ""} ${
                index === 0 ? "xl:pl-0" : ""
              } ${index === securityPrinciples.length - 1 ? "xl:pr-0" : ""}`}
            >
              <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#e7b897] dark:text-[#c7896d]">
                {principle.code}
              </span>
              <h3 className="mt-5 max-w-xs text-xl font-black tracking-[-0.035em] sm:mt-8 xl:mt-10">
                {principle.title}
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-6 text-[#f8f4eb]/66 dark:text-white/66 sm:mt-4">
                {principle.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 border-t border-white/16 pt-7 sm:mt-14 sm:pt-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#e7b897] dark:text-[#c7896d]">
              Bir şikâyet geldiğinde
            </p>

            <ol className="grid flex-1 grid-cols-2 gap-y-4 sm:grid-cols-4 lg:max-w-3xl">
              {moderationFlow.map((item, index) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.1em] text-[#f8f4eb]/72 dark:text-white/72"
                >
                  <span className="font-mono text-[9px] text-[#e7b897] dark:text-[#c7896d]">
                    0{index + 1}
                  </span>
                  {item}
                  {index < moderationFlow.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="ml-auto hidden text-[#f8f4eb]/22 sm:inline"
                    >
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
