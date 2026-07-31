import LottiePlayer from "@/components/LottiePlayer";
import securityDinoAnimation from "./security-dino-lottie.json";

const securityPrinciples = [
  {
    code: "1",
    title: "Öğrenci doğrulaması",
    description:
      "Akışa yalnızca @stu.yasar.edu.tr adresini doğrulayan öğrenciler katılabilir.",
  },
  {
    code: "2",
    title: "Adın gizli kalır",
    description:
      "Anonim gönderilerde adın görünmez; ancak kötüye kullanım şikâyetleri incelenebilir.",
  },
  {
    code: "3",
    title: "Şikâyetler incelenir",
    description:
      "Uygunsuz gönderi ve yorumları bildirebilirsin. İçerik, işlem yapılmadan önce bir moderatör tarafından incelenir.",
  },
  {
    code: "4",
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
      className="reveal-item relative overflow-x-clip border-b border-white/10 bg-[#0a0d16] text-white"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto flex w-full max-w-[1360px] flex-col items-center px-5 py-14 text-center sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="reveal-item">
          <LottiePlayer
            animationData={securityDinoAnimation}
            className="h-24 w-48 sm:h-28 sm:w-56"
          />
        </div>

        <h2
          id="security-title"
          className="reveal-item mt-6 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.95] tracking-[-0.04em] sm:mt-8"
        >
          Güvenlik
        </h2>

        <p className="reveal-item mt-5 max-w-xl text-base leading-7 text-white/78 sm:text-lg sm:leading-8">
          Anonim paylaşımlarda adın diğer öğrencilere görünmez. Her hesap
          öğrenci e-postasıyla doğrulanır.
        </p>

        <ol className="mt-14 grid w-full gap-10 sm:mt-16 md:grid-cols-4 md:gap-8">
          {securityPrinciples.map((principle, index) => (
            <li
              key={principle.code}
              className={`reveal-item flex flex-col items-center border-t border-white/12 pt-8 md:border-t-0 md:px-5 md:py-4 lg:px-7 ${
                index === 0 ? "md:pl-0" : "md:border-l md:border-white/12"
              } ${index === securityPrinciples.length - 1 ? "md:pr-0" : ""}`}
            >
              <span className="font-mono text-4xl font-black leading-none tracking-[-0.02em] text-[#ff7a45] sm:text-5xl">
                {principle.code}
              </span>

              <h3 className="mt-5 max-w-xs text-lg font-black leading-[1.1] tracking-[-0.03em] sm:text-xl md:min-h-[3.2rem]">
                {principle.title}
              </h3>

              <p className="mt-3 max-w-xs text-base leading-7 text-white/75">
                {principle.description}
              </p>
            </li>
          ))}
        </ol>

        <div className="reveal-item mt-14 flex flex-col items-center gap-5 border-t border-white/12 pt-8 sm:mt-16">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff7a45]">
            Bir şikâyet geldiğinde
          </p>

          <ol className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-2xl">
            {moderationFlow.map((item, index) => (
              <li
                key={item}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-white/72"
              >
                <span className="font-mono text-xl text-[#ff7a45] ">
                  {index + 1}
                </span>
                {item}
                {index < moderationFlow.length -1 && (
                  <span aria-hidden="true" className="ml-1 text-white/25">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
