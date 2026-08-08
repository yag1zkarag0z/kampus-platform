const securityPrinciples = [
  {
    code: "01",
    title: "Öğrenci doğrulaması",
    description:
      "Akışa yalnızca @stu.yasar.edu.tr adresini doğrulayan öğrenciler katılabilir.",
  },
  {
    code: "02",
    title: "Kontrollü anonimlik",
    description:
      "Anonim gönderilerde adın öğrencilere görünmez. Kötüye kullanım bildirimleri incelenebilir.",
  },
  {
    code: "03",
    title: "İnsan denetimi",
    description:
      "Bildirilen içerik, işlem uygulanmadan önce bir moderatör tarafından değerlendirilir.",
  },
  {
    code: "04",
    title: "Sınırlı erişim",
    description:
      "Moderatörler yalnızca inceleme için gereken bilgilere erişir; işlemler kayıt altında tutulur.",
  },
];

const moderationFlow = ["Bildirim", "İnceleme", "Karar", "Sonuç"];

export default function SecuritySection() {
  return (
    <section
      aria-labelledby="security-title"
      className="border-b border-white/10 bg-canvas text-white"
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand sm:text-xs">
            Güvenlik
          </p>
          <h1
            id="security-title"
            className="mt-5 text-[clamp(2.8rem,7vw,5.8rem)] font-medium leading-[0.95] tracking-[-0.06em]"
          >
            Güvenlik ve anonimlik<span className="text-brand">.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/56 sm:text-lg">
            Kimlik doğrulama, ölçülü moderasyon ve açık kurallar.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 sm:grid-cols-2 md:mt-16 md:gap-4">
          {securityPrinciples.map((principle) => (
            <li
              key={principle.code}
              className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-7"
            >
              <span className="font-mono text-xs font-bold text-brand">
                {principle.code}
              </span>
              <h2 className="mt-10 text-2xl font-semibold tracking-[-0.04em]">
                {principle.title}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/52">
                {principle.description}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-2xl border border-white/10 bg-surface p-6 sm:p-7">
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.17em] text-white/38">
            Bildirim süreci
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-4">
            {moderationFlow.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-3 border-b border-white/8 pb-3 text-sm font-bold sm:border-b-0 sm:border-r sm:pb-0 sm:last:border-r-0"
              >
                <span className="font-mono text-xs text-brand">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
