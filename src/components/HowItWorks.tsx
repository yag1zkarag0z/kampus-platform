import LottiePlayer from "@/components/LottiePlayer";
import campusWorkflowAnimation from "./campus-workflow-lottie.json";

const steps = [
  {
    number: "01",
    label: "Öğrenci e-postası",
    title: "Yaşar e-postanı doğrula.",
    description:
      "@stu.yasar.edu.tr adresine gönderilen 6 haneli kodu gir ve hesabını aç.",
    
  },
  {
    number: "02",
    label: "Kampüs akışı",
    title: "Kampüste olup biteni gör.",
    description:
      "İtirafları, soruları, kayıp eşya ilanlarını ve etkinlikleri tek yerde takip et.",
    
  },
  {
    number: "03",
    label: "Paylaşmaya başla",
    title: "İster adınla, ister anonim paylaş.",
    description:
      "İtirafını, sorunu ya da duyurunu yaz. Anonim gönderilerde adın görünmez; topluluk kuralları yine geçerlidir.",
    
  },
];

export default function HowItWorks() {
  return (
    <section
      id="nasil-calisir"
      aria-labelledby="how-it-works-title"
      className="reveal-item relative overflow-x-clip border-b border-white/10 bg-[#0a0d16] text-white"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto flex w-full max-w-[1360px] flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        <div className="reveal-item">
          <LottiePlayer
            animationData={campusWorkflowAnimation}
            className="h-11 w-[9.5rem] sm:h-12 sm:w-44"
          />
        </div>

        <h2
          id="how-it-works-title"
          className="reveal-item mt-6 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.95] tracking-[-0.04em] sm:mt-8"
        >
          Nasıl Çalışır?
        </h2>

        <ol className="mt-16 grid w-full gap-10 sm:mt-20 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => (
            <li
              key={step.number}
              className={`reveal-item flex flex-col items-center border-t border-white/12 pt-8 md:border-t-0 md:px-5 md:py-4 lg:px-8 ${
                index === 0 ? "md:pl-0" : "md:border-l md:border-white/12"
              } ${index === steps.length - 1 ? "md:pr-0" : ""}`}
            >
              <span className="font-mono text-[11px] font-bold text-[#ff7a45]">
                {step.number}
              </span>

              <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/60">
                {step.label}
              </span>

              <h3 className="mt-5 max-w-xs text-xl font-black leading-[1.1] tracking-[-0.035em] sm:text-2xl md:min-h-[3.6rem]">
                {step.title}
              </h3>

              <p className="mt-3 max-w-xs text-sm leading-6 text-white/62">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
