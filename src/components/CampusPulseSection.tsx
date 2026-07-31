function FeedMockup() {
  const posts = [
    {
      tag: "Anonim",
      time: "4 dk önce",
      text: "Final haftası için kütüphanede birlikte çalışacak biri arıyorum.",
      stats: "84 beğeni · 12 yorum",
    },
    {
      tag: "Etkinlik",
      time: "Bugün",
      text: "Kulüpler tanışma günü avluda başlıyor, herkes davetli.",
      stats: "31 beğeni · 6 yorum",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      {posts.map((post) => (
        <div
          key={post.text}
          className="rounded-xl border border-white/10 bg-[#1e2024] p-3"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#2a2d33] font-mono text-[8px] font-bold text-white/70">
              KA
            </span>
            <div className="min-w-0">
              <p
                className={`font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${
                  post.tag === "Anonim" ? "text-[#ff7a45]" : "text-white/55"
                }`}
              >
                {post.tag}
              </p>
              <p className="font-mono text-[8px] text-white/40">{post.time}</p>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] leading-4 text-white/85">
            {post.text}
          </p>

          <p className="mt-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-white/45">
            {post.stats}
          </p>
        </div>
      ))}
    </div>
  );
}

function DiscoverMockup() {
  const categories = ["Tümü", "Sohbet", "İtiraf", "Anket"];
  const pollOptions = [
    { label: "Erkenden başlarım", pct: 62 },
    { label: "Son gece", pct: 38 },
  ];

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category, index) => (
          <span
            key={category}
            className={`rounded-full px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] ${
              index === 0
                ? "bg-[#ff7a45] text-[#141720]"
                : "border border-white/12 text-white/55"
            }`}
          >
            {category}
          </span>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-[#1e2024] p-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">
          Topluluk anketi
        </p>

        <p className="mt-2 text-[11px] font-semibold leading-4 text-white/90">
          Final haftasında ne zaman başlarsın?
        </p>

        <div className="mt-3 grid gap-1.5">
          {pollOptions.map((option) => (
            <div
              key={option.label}
              className="relative overflow-hidden rounded-lg border border-white/10"
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-[#ff7a45]/25"
                style={{ width: `${option.pct}%` }}
              />
              <div className="relative flex items-center justify-between px-2.5 py-1.5 text-[9px] font-bold text-white/80">
                <span>{option.label}</span>
                <span className="font-mono text-white/50">{option.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotificationsMockup() {
  const notifications = [
    {
      initials: "MC",
      name: "Mert C.",
      action: "seni takip etmeye başladı.",
      time: "Şimdi",
      accent: true,
    },
    {
      initials: "EY",
      name: "Ece Y.",
      action: "gönderine yorum yaptı.",
      time: "4 dk",
    },
    {
      initials: "DA",
      name: "Deniz A.",
      action: "bir yorumda senden bahsetti.",
      time: "18 dk",
    },
    {
      initials: "12",
      name: "12 kişi",
      action: "gönderini beğendi.",
      time: "36 dk",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-1.5 p-4">
      {notifications.map((item) => (
        <div
          key={item.name + item.action}
          className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${
            item.accent ? "bg-[#ff7a45]/10" : ""
          }`}
        >
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#2a2d33] font-mono text-[8px] font-bold text-white/70">
            {item.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] leading-4 text-white/85">
              <span className="font-bold text-white">{item.name}</span>{" "}
              {item.action}
            </p>
            <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-white/40">
              {item.time}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const appScreens = [
  {
    Mockup: FeedMockup,
    title: "Akışta kal",
    description:
      "Gönderileri, itirafları ve duyuruları tek yerde takip et.",
    badge: "Misafir görünümü",
  },
  {
    Mockup: DiscoverMockup,
    title: "Keşfet",
    description: "Kategoriye göre filtrele, yükselen gönderileri yakala.",
    badge: "Kategori filtreleri",
  },
  {
    Mockup: NotificationsMockup,
    title: "Anında haberdar ol",
    description: "Takip, yorum ve bahsetmelerden anında haberin olsun.",
    badge: "Gerçek zamanlı",
  },
];

export default function CampusPulseSection() {
  return (
    <section
      id="kampus-nabzi"
      aria-labelledby="campus-pulse-title"
      className="reveal-item relative overflow-x-clip border-b border-white/10 bg-[#0a0d16] text-white"
    >
      <div
        aria-hidden="true"
        className="paper-noise pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto flex w-full max-w-[1360px] flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        <div className="reveal-item">
          <svg
            aria-hidden="true"
            viewBox="0 0 100 36"
            fill="none"
            className="prism-emoji pointer-events-none h-9 w-24 -rotate-2 text-white sm:h-11 sm:w-28"
          >
            <path
              className="pulse-ecg-line"
              d="M3 21c3-.6 4.6.9 6.4.3 2-.7 2.9.9 6.1.1 2.1-.5 3.4.6 6.9-.1L32 20.6c1.7 0 2.4-14 5-14.6 2.6-.6 1.6 27.4 4.4 26.9 2.4-.4 3.3-12 6.4-11.7l7.6.2c2-.7 3.6.9 6.4.1 2-.6 2.9.9 6 .1 2.4-.6 4.1.6 7.4-.2 2.3-.5 3.9.6 7.9-.1"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h2
          id="campus-pulse-title"
          className="reveal-item mt-6 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.95] tracking-[-0.04em] sm:mt-8"
        >
          Kampüs Nabzı
        </h2>

        <div className="mt-16 w-full sm:mt-20">
          <div className="grid gap-14 sm:grid-cols-3 sm:gap-8 lg:gap-10">
            {appScreens.map((screen) => (
              <div
                key={screen.title}
                className="reveal-item flex flex-col items-start text-left"
              >
                <div className="relative w-full">
                  <div
                    aria-hidden="true"
                    className="absolute -right-3 -top-3 -z-10 h-full w-full rounded-[1.6rem] bg-[#ff7a45]"
                  />

                  <div className="relative flex h-64 flex-col overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#17191c] shadow-[0_18px_55px_rgba(0,0,0,0.32)] sm:h-72">
                    <screen.Mockup />
                  </div>
                </div>

                <h3 className="mt-7 text-lg font-black tracking-[-0.02em] sm:text-xl">
                  {screen.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-white/62">
                  {screen.description}
                </p>

                <span className="mt-4 inline-flex items-center rounded-full border border-white/14 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                  {screen.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
