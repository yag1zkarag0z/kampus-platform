"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { campusAvatarUrl as avatarUrl } from "@/avatar/catalog";
import { campusCategoryStyles } from "@/data/campusCategoryStyles";
import type { CampusPostCategory } from "@/data/campusPosts";
import styles from "./HomepageBento.module.css";

type SwipeDirection = "follow" | "skip";

function DemoAvatar({
  src,
  size = "md",
  className = "",
}: {
  src: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizeClassNames = {
    sm: "size-8",
    md: "size-10",
    lg: "size-14",
    xl: "size-20",
  } as const;
  const imageSizes = {
    sm: "32px",
    md: "40px",
    lg: "56px",
    xl: "80px",
  } as const;

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-surface-hover ${sizeClassNames[size]} ${className}`}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={imageSizes[size]}
        unoptimized
        className="object-cover"
      />
    </span>
  );
}

/* Alanlar /kesfet akışındaki gönderi kartıyla birebir: kategori rozeti,
   yazar, üst bilgi satırı, başlık, gövde, beğeni ve yorum sayısı. */
const discoverPosts: {
  avatarUrl: string;
  author: string;
  category: CampusPostCategory;
  detail: string;
  title: string;
  body: string;
  likes: number;
  comments: number;
  time: string;
}[] = [
  {
    avatarUrl: avatarUrl("irem-ozturk"),
    author: "@iremozturk",
    category: "Anket",
    detail: "Topluluk anketi",
    title: "Final haftasında hangisisin?",
    body: "Çalışma düzenimizin bilimsel olmayan ama gerçekçi özeti.",
    likes: 112,
    comments: 1,
    time: "5 sa",
  },
  {
    avatarUrl: avatarUrl("deniz-ari"),
    author: "@denizari",
    category: "Kayıp Eşya",
    detail: "Ortak alan",
    title: "Ortak alanda bırakılan şarj kablosu",
    body: "Sabahtan beri masada duruyor, sahibi arıyorsa bende.",
    likes: 58,
    comments: 4,
    time: "31 dk",
  },
  {
    avatarUrl: avatarUrl("ece-yilmaz"),
    author: "@eceyilmaz",
    category: "Sohbet",
    detail: "Kampüs",
    title: "Kantinde yeni menü nasıl olmuş?",
    body: "Fiyatlar değişmiş, tadı hakkında ne düşünüyorsunuz?",
    likes: 76,
    comments: 9,
    time: "1 sa",
  },
  {
    avatarUrl: avatarUrl("deniz-akin"),
    author: "@denizakin",
    category: "Etkinlik",
    detail: "Bahar şenliği",
    title: "Sahne için hangi kulüp sırada?",
    body: "Program taslağı çıktı, önerilerinizi buraya bırakın.",
    likes: 93,
    comments: 12,
    time: "2 sa",
  },
];

const profiles = [
  {
    avatarUrl: avatarUrl("kayaozturk"),
    name: "Kaya Öztürk",
    username: "@kayaozturk",
    department: "Yazılım Mühendisliği",
    bio: "Yazılım, ürün geliştirme ve kampüs projeleriyle ilgileniyor.",
  },
  {
    avatarUrl: avatarUrl("ecearslan"),
    name: "Ece Arslan",
    username: "@ecearslan",
    department: "İşletme",
    bio: "Girişimcilik, öğrenci kulüpleri ve kampüs etkinlikleriyle ilgileniyor.",
  },
  {
    avatarUrl: avatarUrl("mertcan"),
    name: "Mert Can",
    username: "@mertcan",
    department: "Ekonomi",
    bio: "Ekonomi, finans ve öğrenci toplulukları üzerine paylaşımlar yapıyor.",
  },
  {
    avatarUrl: avatarUrl("irem-ozturk"),
    name: "İrem Öztürk",
    username: "@iremozturk",
    department: "Yeni Medya ve İletişim",
    bio: "Yeni medya, içerik üretimi ve kampüs etkinliklerini paylaşıyor.",
  },
];

function BentoCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={styles.bentoCard}
      data-testid="homepage-bento-card"
    >
      <div className={styles.cardContent}>{children}</div>

      <footer className={styles.cardFooter}>
        <h3
          id={titleId}
          className="text-center text-base font-semibold tracking-[-0.02em] text-white/88 sm:text-lg"
        >
          {title}
        </h3>
      </footer>
    </article>
  );
}

function DiscoverDemo() {
  return (
    <div className={styles.discoverViewport} aria-hidden="true">
      <div className={styles.discoverRail} data-testid="discover-rail">
        {[0, 1].map((group) => (
          <div key={group} className={styles.discoverGroup}>
            {discoverPosts.map((post) => (
              <article
                key={`${group}-${post.title}`}
                className={styles.discoverPost}
              >
                <div className={styles.discoverHead}>
                  <DemoAvatar src={post.avatarUrl} size="sm" />
                  <span className={styles.discoverIdentity}>
                    <span className={styles.discoverBadgeRow}>
                      <span
                        className={`${styles.discoverBadge} ${campusCategoryStyles[post.category].badge}`}
                      >
                        <span aria-hidden="true">
                          {campusCategoryStyles[post.category].glyph}
                        </span>
                        {post.category}
                      </span>
                      <span className={styles.discoverDiamond} />
                      <span className={styles.discoverAuthor}>
                        {post.author}
                      </span>
                    </span>
                    <span className={styles.discoverDetail}>{post.detail}</span>
                  </span>
                  <span className={styles.discoverTime}>{post.time}</span>
                </div>

                <p className={styles.discoverTitle}>{post.title}</p>
                <p className={styles.discoverBody}>{post.body}</p>

                <div className={styles.discoverActions}>
                  <span className={styles.discoverAction}>
                    <span aria-hidden="true">♡</span>
                    {post.likes} beğeni
                  </span>
                  <span className={styles.discoverAction}>
                    <span aria-hidden="true">💬</span>
                    {post.comments} yorum
                  </span>
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tanıtımdaki composer, uygulamadaki gerçek composer'ın küçültülmüş hâli:
 * avatar, "Kampüste ne oluyor?" yer tutucusu, ayraç, beş araç ikonu ve Paylaş.
 * Önceki sürüm uygulamada karşılığı olmayan bir ekran gösteriyordu (taslak
 * rozeti, başlık alanı, iki kategori çipi).
 *
 * Döngü gerçek bir paylaşımı anlatıyor: yaz → düğme canlansın → paylaş →
 * composer temizlensin. İkonlar bilerek durağan; hareket yazma ve düğmede.
 */
function ComposerDemo() {
  return (
    <div className={styles.composerSurface} aria-hidden="true">
      <div className={styles.composerBody}>
        <div className="flex min-w-0 items-start gap-2.5">
          <DemoAvatar src={avatarUrl("kayaozturk")} size="sm" />

          <div className="relative min-w-0 flex-1 pt-1">
            <span className={`${styles.composerPlaceholder} text-sm font-medium`}>
              Kampüste ne oluyor?
            </span>
            <span
              className={`${styles.typingLine} text-sm font-semibold`}
              data-testid="composer-typing-line"
            >
              Yarın dersler iptal mi?
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
          <div className="flex min-w-0 items-center gap-2 text-brand/85">
            <ComposerToolPhotoIcon />
            <span className="rounded border-2 border-current px-1 py-0.5 text-[7px] leading-none font-black tracking-[-0.04em]">
              GIF
            </span>
            <ComposerToolPollIcon />
            <ComposerToolEmojiIcon />
            <ComposerToolListingIcon />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ComposerCharacterRing />
            <span
              className={`${styles.composerSubmit} rounded-full px-4 py-1.5 text-[11px] font-black`}
            >
              Paylaş
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Gerçek composer'ın `CharacterRing` bileşeninin küçük kopyası: metin
 * yazılmaya başlayınca beliriyor ve doluyor.
 */
function ComposerCharacterRing() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${styles.composerRing} size-4 -rotate-90`}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="#ff6b3d"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={styles.composerRingProgress}
      />
    </svg>
  );
}

/* Araç ikonları gerçek composer'daki path'lerin birebir aynısı; yalnızca
   bento ölçeğine küçültüldü. */

function ComposerToolPhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="m5.5 17 4.2-4.1 3.1 2.8 2.2-2.1 3.5 3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComposerToolPollIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
      <path
        d="M5 7.5h2.5M5 12h2.5M5 16.5h2.5M11 7.5h8M11 12h5M11 16.5h7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ComposerToolEmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path
        d="M8.5 14.2c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ComposerToolListingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0">
      <path
        d="M5 5h14v14H5zM8 9h8M8 13h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.8 15.2h-1.6a1.2 1.2 0 0 0 0 2.4h1.6a1.2 1.2 0 0 0 0-2.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MessagesDemo() {
  return (
    <div className={styles.messageCanvas} aria-hidden="true">
      <div
        className={styles.messageSurface}
        data-testid="homepage-message-thread"
      >
        <div className="flex items-center gap-2.5 border-b border-white/8 px-3.5 py-2.5">
          <span className="relative">
            <DemoAvatar src={avatarUrl("ecearslan")} size="sm" />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-surface-raised bg-[#75d394]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black text-white/88 sm:text-xs">
              Ece Arslan
            </span>
            <span className="block text-[9px] font-semibold text-white/35">
              çevrimiçi
            </span>
          </span>
          <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-brand">
            KAMPÜS
          </span>
        </div>

        <div className={styles.messageThread}>
          <div
            className={`${styles.messageRow} ${styles.messageRowStart} ${styles.messageRowIncoming}`}
          >
            <div className={`${styles.messageBubble} ${styles.messageIncoming}`}>
              <p>Kütüphanede misin?</p>
              <time>10:24</time>
            </div>
          </div>

          <div
            className={`${styles.messageRow} ${styles.messageRowStart} ${styles.messageRowTyping}`}
          >
            <div className={styles.messageTyping}>
              <span />
              <span />
              <span />
            </div>
          </div>

          <div
            className={`${styles.messageRow} ${styles.messageRowEnd} ${styles.messageRowOutgoing}`}
          >
            <div
              className={`${styles.messageBubble} ${styles.messageOutgoing}`}
              data-testid="homepage-message-reply"
            >
              <p>Evet, üst kattayım.</p>
              <time>10:25</time>
            </div>
          </div>

          <div
            className={`${styles.messageRow} ${styles.messageRowEnd} ${styles.messageRowRead}`}
          >
            <span className={styles.messageRead}>Okundu ✓✓</span>
          </div>

          <div
            className={`${styles.messageRow} ${styles.messageRowStart} ${styles.messageRowClosing}`}
          >
            <div className={`${styles.messageBubble} ${styles.messageClosing}`}>
              <p>Geliyorum 👋</p>
              <time>10:25</time>
            </div>
          </div>
        </div>

        <div className={styles.messageComposer}>
          <span>Mesaj yaz</span>
          <span className={styles.messageSend}>↑</span>
        </div>
      </div>
    </div>
  );
}

function FollowDemo() {
  const [profileIndex, setProfileIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [decision, setDecision] = useState<SwipeDirection | null>(null);
  const [cardWidth, setCardWidth] = useState(280);
  const autoSwipeCount = useRef(0);
  const dragStartX = useRef<number | null>(null);
  const followCardRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | null>(null);
  const currentProfile = profiles[profileIndex];
  const nextProfile = profiles[(profileIndex + 1) % profiles.length];

  const getSwipeMetrics = useCallback(() => {
    const measuredWidth =
      followCardRef.current?.getBoundingClientRect().width ??
      cardWidth;
    const width = Math.max(220, measuredWidth);

    return {
      threshold: Math.max(52, Math.min(92, width * 0.23)),
      exitDistance: Math.max(
        width * 1.45,
        Math.min(window.innerWidth * 0.82, 680)
      ),
    };
  }, [cardWidth]);

  const completeSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
      }

      const { exitDistance } = getSwipeMetrics();

      setDecision(direction);
      setDragX(direction === "follow" ? exitDistance : -exitDistance);
      setIsDragging(false);

      settleTimer.current = window.setTimeout(() => {
        setProfileIndex((index) => (index + 1) % profiles.length);
        setDragX(0);
        setDecision(null);
      }, 220);
    },
    [getSwipeMetrics]
  );

  useEffect(() => {
    if (isDragging) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduceMotion) return;

    const runAutoSwipe = () => {
      const direction =
        autoSwipeCount.current % 3 === 2 ? "skip" : "follow";

      autoSwipeCount.current += 1;
      completeSwipe(direction);
    };

    const initialTimer = window.setTimeout(runAutoSwipe, 350);
    const interval = window.setInterval(runAutoSwipe, 1800);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [completeSwipe, isDragging]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) {
        window.clearTimeout(settleTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    const card = followCardRef.current;

    if (!card) return;

    const updateWidth = () => {
      setCardWidth(card.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(card);

    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setCardWidth(event.currentTarget.getBoundingClientRect().width);
    dragStartX.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    setDragX(event.clientX - dragStartX.current);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStartX.current = null;
    setIsDragging(false);

    const { threshold } = getSwipeMetrics();

    if (dragX > threshold) {
      completeSwipe("follow");
    } else if (dragX < -threshold) {
      completeSwipe("skip");
    } else {
      setDragX(0);
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStartX.current = null;
    setIsDragging(false);
    setDragX(0);
  };

  const dragProgress = Math.max(
    -1,
    Math.min(1, dragX / Math.max(cardWidth, 1))
  );

  const followOpacity = Math.min(
    1,
    Math.max(0, dragX / 90 + (decision === "follow" ? 1 : 0))
  );
  const skipOpacity = Math.min(
    1,
    Math.max(0, -dragX / 90 + (decision === "skip" ? 1 : 0))
  );

  return (
    <div className={styles.followStage}>
      <div className={styles.followDeck}>
        <div className={styles.followBackCard} aria-hidden="true">
          <div className="grid h-full place-items-center text-center opacity-30">
            <div>
              <DemoAvatar src={nextProfile.avatarUrl} className="mx-auto" />
              <p className="mt-2 text-sm font-black">{nextProfile.name}</p>
            </div>
          </div>
        </div>

        <div
          ref={followCardRef}
          className={styles.followCard}
          data-testid="follow-suggestion-card"
          role="group"
          aria-label={`Takip önerisi: ${currentProfile.name}`}
          style={{
            transform: `translateX(${dragX}px) rotate(${dragProgress * 13}deg)`,
            transition: isDragging
              ? "none"
              : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <span
            className={`${styles.decisionBadge} ${styles.followBadge} ${
              followOpacity > 0.12 ? styles.visibleBadge : ""
            }`}
            style={{ opacity: followOpacity }}
          >
            Takip
          </span>
          <span
            className={`${styles.decisionBadge} ${styles.skipBadge} ${
              skipOpacity > 0.12 ? styles.visibleBadge : ""
            }`}
            style={{ opacity: skipOpacity }}
          >
            Geç
          </span>

          <div
            className={`${styles.followProfileBody} flex flex-1 flex-col items-center justify-center px-5 py-4 text-center`}
          >
            <DemoAvatar src={currentProfile.avatarUrl} size="lg" />
            <p className="mt-2.5 text-lg font-black tracking-[-0.035em] text-white">
              {currentProfile.name}
            </p>
            <p className="mt-0.5 text-xs font-bold text-[#ff8b5d]">
              {currentProfile.username}
            </p>
            <span className="mt-2.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold text-white/55">
              {currentProfile.department}
            </span>
          </div>

          <div
            className={`${styles.followActions} grid grid-cols-2 gap-2 border-t border-white/8 p-3`}
          >
            <button
              type="button"
              className="min-h-11 rounded-xl border border-white/11 text-xs font-black text-white/65 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/50"
              onClick={() => completeSwipe("skip")}
              onPointerDown={(event) => event.stopPropagation()}
            >
              Geç
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl bg-brand text-xs font-black text-[#101012] outline-none transition-colors hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-white"
              onClick={() => completeSwipe("follow")}
              onPointerDown={(event) => event.stopPropagation()}
            >
              Takip et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomepageBento() {
  return (
    <section
      id="kampus-nabzi"
      aria-labelledby="kampus-nabzi-title"
      className={`${styles.section} relative overflow-x-clip text-white`}
      data-testid="homepage-bento"
    >
      <div className="relative mx-auto w-full max-w-[1320px] px-5 pb-10 sm:px-8 sm:pb-12 lg:px-10 lg:pb-14">
        {/* Kartlar saf aksiyon demosu; "kapalı ağ" mesajını slot harcamadan
            bu başlık çerçeveliyor. */}
        <h2
          id="kampus-nabzi-title"
          className="mb-6 text-center text-[clamp(1.6rem,5.2vw,2.7rem)] font-semibold leading-[1.34] tracking-[-0.05em] text-white sm:mb-9"
        >
          <span className={styles.brandUnderline}>
            Kayıt yalnızca Yaşar öğrencilerine açık
            <span className="text-brand">.</span>
          </span>
        </h2>

        <div
          className="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4"
          data-testid="homepage-bento-grid"
        >
          <BentoCard id="homepage-discover" title="Keşfet">
            <DiscoverDemo />
          </BentoCard>

          <BentoCard id="homepage-composer" title="Gönderi oluştur">
            <ComposerDemo />
          </BentoCard>

          <BentoCard id="homepage-messages" title="Mesajlaş">
            <MessagesDemo />
          </BentoCard>

          <BentoCard id="homepage-follow" title="Takip et">
            <FollowDemo />
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
