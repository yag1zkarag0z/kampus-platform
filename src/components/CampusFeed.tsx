"use client";

import Image from "next/image";
import { campusButton } from "@/components/campusButtonStyles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusAuthorProfileLink from "@/components/CampusAuthorProfileLink";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  campusCategoryFilters,
  type CampusCategoryFilter,
} from "@/components/CampusCategoryNav";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusHiddenNotice from "@/components/CampusHiddenNotice";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostActions from "@/components/CampusPostActions";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import GiphyPicker from "@/components/GiphyPicker";
import { AuthClientError } from "@/auth/client";
import {
  deleteUnattachedContentImage,
  uploadContentImage,
} from "@/content/client";
import { useAutoGrowTextarea } from "@/components/useAutoGrowTextarea";
import {
  CAMPUS_POST_BODY_MAX_LENGTH,
  CAMPUS_POST_TITLE_MAX_LENGTH,
} from "@/data/campusContentRules";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusGif as CampusGifData,
  type CampusPostCategory,
  type CampusPostImage as CampusPostImageData,
} from "@/data/campusPosts";
import { useFeedback } from "@/components/FeedbackProvider";

type FeedView = "latest" | "following";

const feedViews: { id: FeedView; label: string }[] = [
  { id: "latest", label: "En yeni" },
  { id: "following", label: "Takip" },
];

const COMPOSER_DRAFT_KEY = "kampus-composer-draft";

/**
 * Paylaşım hatasını kullanıcıya anlatır. Sunucunun gönderdiği Türkçe mesaj
 * varsa o kullanılır; hız sınırında kalan süre de eklenir.
 */
function describeComposerError(error: unknown) {
  if (!(error instanceof AuthClientError)) {
    return "Gönderi paylaşılamadı. Tekrar dene.";
  }

  if (error.code !== "CONTENT_RATE_LIMITED") {
    return error.message;
  }

  const seconds = error.retryAfterSeconds ?? 0;

  if (seconds <= 0) {
    return error.message;
  }

  const minutes = Math.ceil(seconds / 60);

  return seconds < 60
    ? `${error.message} (${seconds} saniye)`
    : `${error.message} (${minutes} dakika)`;
}

const composerCategories: CampusPostCategory[] = [
  "Sohbet",
  "İtiraf",
  "Soru",
  "Etkinlik",
  "Kayıp Eşya",
];

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";
const quickEmojis = [
  { value: "👍", label: "Beğeni" },
  { value: "❤️", label: "Kalp" },
  { value: "😂", label: "Kahkaha" },
  { value: "🥲", label: "Duygulu yüz" },
  { value: "🎉", label: "Kutlama" },
  { value: "📚", label: "Kitaplar" },
  { value: "📍", label: "Konum" },
  { value: "❓", label: "Soru" },
  { value: "💀", label: "Kuru kafa" },
  { value: "🗿", label: "Moai" },
  { value: "🤡", label: "Palyaço" },
  { value: "🤨", label: "Şüpheli yüz" },
  { value: "😭", label: "Ağlayan yüz" },
  { value: "🫡", label: "Selam veren yüz" },
  { value: "🔥", label: "Ateş" },
  { value: "👀", label: "Gözler" },
] as const;
const MAX_SOURCE_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_OUTPUT_IMAGE_SIZE = 700 * 1024;
const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function getDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

async function createQuickPostImage(
  file: File,
): Promise<Omit<CampusPostImageData, "alt">> {
  const sourceImage = await createImageBitmap(file);
  const dimensionLimits = [1600, 1360, 1120, 900];
  const qualityLevels = [0.82, 0.72, 0.62, 0.52];

  try {
    for (const dimensionLimit of dimensionLimits) {
      const scale = Math.min(
        1,
        dimensionLimit / Math.max(sourceImage.width, sourceImage.height),
      );
      const width = Math.max(1, Math.round(sourceImage.width * scale));
      const height = Math.max(1, Math.round(sourceImage.height * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Image canvas could not be created.");
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(sourceImage, 0, 0, width, height);

      for (const quality of qualityLevels) {
        const src = canvas.toDataURL("image/webp", quality);

        if (getDataUrlSize(src) <= MAX_OUTPUT_IMAGE_SIZE) {
          return { src, width, height };
        }
      }
    }

    throw new Error("Processed image is too large.");
  } finally {
    sourceImage.close();
  }
}

function useHideOnScrollDown() {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const currentY = window.scrollY;
        const delta = currentY - lastY;
        if (Math.abs(delta) > 6) {
          setIsHidden(delta > 0 && currentY > 72);
          lastY = currentY;
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return isHidden;
}

function CharacterRing({ value, max }: { value: number; max: number }) {
  const ratio = Math.min(1, value / max);
  const isNearLimit = max - value <= 40;
  const circumference = 2 * Math.PI * 9;

  return (
    <span
      role="status"
      aria-label={`${value} / ${max} karakter`}
      className="grid shrink-0 place-items-center"
    >
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90">
        <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke={isNearLimit ? "#ff5a5a" : "#ff7a45"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
    </span>
  );
}

export default function CampusFeed() {
  const router = useRouter();
  // Aşağı kaydırırken sekmeler de üst barla birlikte çekilsin.
  const isHeaderHidden = useHideOnScrollDown();
  const { showToast } = useFeedback();
  const { isGuest } = useCampusAccount();
  const {
    posts,
    isHydrated,
    hasMore,
    isLoadingMore,
    loadMore,
    feedScope,
    setFeedScope,
    createPost,
    toggleLike,
    toggleBookmark,
  } = useCampusData();
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const quickPostBodyRef = useRef<HTMLTextAreaElement>(null);
  const quickPostImageInputRef = useRef<HTMLInputElement>(null);
  const activeView: FeedView =
    feedScope === "following" ? "following" : "latest";
  const [activeCategory, setActiveCategory] =
    useState<CampusCategoryFilter>("Tümü");
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [quickPostBody, setQuickPostBody] = useState("");
  // Başlık isteğe bağlı: kısa paylaşımlar başlıksız, konular başlıklı akar.
  const [quickPostTitle, setQuickPostTitle] = useState("");
  const [quickPostMessage, setQuickPostMessage] = useState("");
  const [isQuickPostSubmitting, setIsQuickPostSubmitting] = useState(false);
  const [quickPostGif, setQuickPostGif] = useState<CampusGifData | undefined>();
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [quickPostImage, setQuickPostImage] = useState<
    Omit<CampusPostImageData, "alt"> | undefined
  >();
  const [quickPostImageError, setQuickPostImageError] = useState("");
  const [isQuickPostImageProcessing, setIsQuickPostImageProcessing] =
    useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  // Alan odaklanana kadar tek satır durur; akış daha çok görünür.
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [composerCategory, setComposerCategory] =
    useState<CampusPostCategory>("Sohbet");
  const [isComposerCategoryOpen, setIsComposerCategoryOpen] =
    useState(false);
  const [isComposerAnonymous, setIsComposerAnonymous] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollError, setPollError] = useState("");

  useEffect(() => {
    const closeCategoryMenu = (event: PointerEvent) => {
      if (
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(event.target as Node)
      ) {
        setIsCategoryMenuOpen(false);
      }
    };
    const closeCategoryMenuWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCategoryMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeCategoryMenu);
    document.addEventListener("keydown", closeCategoryMenuWithKeyboard);

    return () => {
      document.removeEventListener("pointerdown", closeCategoryMenu);
      document.removeEventListener(
        "keydown",
        closeCategoryMenuWithKeyboard,
      );
    };
  }, []);

  // Taslağı geri yükle: sayfa değişip dönünce yazdığın kaybolmasın.
  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) return;

      try {
        const stored = window.sessionStorage.getItem(COMPOSER_DRAFT_KEY);
        if (!stored) return;

        const draft = JSON.parse(stored) as {
          title?: string;
          body?: string;
          category?: CampusPostCategory;
          isAnonymous?: boolean;
        };

        if (draft.body) {
          setQuickPostBody(draft.body.slice(0, CAMPUS_POST_BODY_MAX_LENGTH));
          setIsComposerExpanded(true);
        }
        if (draft.title) {
          setQuickPostTitle(
            draft.title.slice(0, CAMPUS_POST_TITLE_MAX_LENGTH),
          );
          setIsComposerExpanded(true);
        }
        if (draft.category) setComposerCategory(draft.category);
        if (draft.isAnonymous) setIsComposerAnonymous(true);
      } catch {
        // Bozuk taslak sessizce yok sayılır.
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Taslağı sakla.
  useEffect(() => {
    try {
      if (quickPostBody.trim() || quickPostTitle.trim()) {
        window.sessionStorage.setItem(
          COMPOSER_DRAFT_KEY,
          JSON.stringify({
            title: quickPostTitle,
            body: quickPostBody,
            category: composerCategory,
            isAnonymous: isComposerAnonymous,
          }),
        );
      } else {
        window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
      }
    } catch {
      // Depolama kapalıysa taslak korunmaz, akış etkilenmez.
    }
  }, [
    composerCategory,
    isComposerAnonymous,
    quickPostBody,
    quickPostTitle,
  ]);

  useAutoGrowTextarea(quickPostBodyRef, quickPostBody);

  useEffect(() => {
    if (!isComposerExpanded) {
      return;
    }

    const collapseOnOutsideClick = (event: PointerEvent) => {
      if (composerRef.current?.contains(event.target as Node)) {
        return;
      }

      // Yazılmış içerik veya ek varken kapatmak veri kaybı gibi hissettirir.
      const hasDraft =
        quickPostBody.trim().length > 0 ||
        quickPostTitle.trim().length > 0 ||
        Boolean(quickPostImage) ||
        Boolean(quickPostGif) ||
        isPollEnabled;

      if (!hasDraft) {
        setIsComposerExpanded(false);
        setIsComposerCategoryOpen(false);
        setIsEmojiPickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", collapseOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", collapseOnOutsideClick);
    };
  }, [
    isComposerExpanded,
    isPollEnabled,
    quickPostBody,
    quickPostTitle,
    quickPostGif,
    quickPostImage,
  ]);

  const visiblePosts = useMemo(() => {
    const categoryPosts =
      activeCategory === "Tümü"
        ? posts
        : posts.filter((post) => post.category === activeCategory);

    return [...categoryPosts].sort(
      (first, second) => second.createdAt - first.createdAt,
    );
  }, [activeCategory, posts]);

  const changeFeedView = (view: FeedView) => {
    if (view === "following" && isGuest) {
      showToast({
        message: "Takip ettiğin kişilerin gönderilerini görmek için giriş yap.",
        tone: "info",
        action: {
          label: "Giriş yap",
          onClick: () => router.push("/giris"),
        },
      });
      return;
    }

    setFeedScope(view === "following" ? "following" : "global");
  };

  const handleGuestComposerClick = () => {
    showToast({
      message: "Gönderi paylaşmak için giriş yapmalısın.",
      tone: "info",
      action: {
        label: "Giriş yap",
        onClick: () => router.push("/giris"),
      },
    });
  };

  const appendQuickPostEmoji = (emoji: string) => {
    const textarea = quickPostBodyRef.current;
    const selectionStart = textarea?.selectionStart ?? quickPostBody.length;
    const selectionEnd = textarea?.selectionEnd ?? quickPostBody.length;
    const nextBody =
      quickPostBody.slice(0, selectionStart) +
      emoji +
      quickPostBody.slice(selectionEnd);

    if (nextBody.length > CAMPUS_POST_BODY_MAX_LENGTH) {
      setQuickPostMessage(
        `Gönderi en fazla ${CAMPUS_POST_BODY_MAX_LENGTH} karakter olabilir.`,
      );
      return;
    }

    setQuickPostBody(nextBody);
    setQuickPostMessage("");
    setIsEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      quickPostBodyRef.current?.focus();
      quickPostBodyRef.current?.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition,
      );
    });
  };

  const handleEmojiPickerKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Escape") {
      setIsEmojiPickerOpen(false);
      quickPostBodyRef.current?.focus();
    }
  };

  const removeQuickPostImage = () => {
    setQuickPostImage(undefined);
    setQuickPostImageError("");

    if (quickPostImageInputRef.current) {
      quickPostImageInputRef.current.value = "";
    }
  };

  const handleQuickPostImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setQuickPostImageError("");
    setQuickPostMessage("");

    if (!acceptedImageTypes.has(file.type)) {
      setQuickPostImageError(
        "JPEG, PNG veya WebP biçiminde bir fotoğraf seçmelisin.",
      );
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SOURCE_IMAGE_SIZE) {
      setQuickPostImageError("Fotoğraf en fazla 5 MB olabilir.");
      event.target.value = "";
      return;
    }

    setIsQuickPostImageProcessing(true);

    try {
      setQuickPostImage(await createQuickPostImage(file));
      setQuickPostGif(undefined);
      setIsGifPickerOpen(false);
    } catch {
      setQuickPostImageError(
        "Fotoğraf hazırlanamadı. Daha küçük veya farklı bir görsel dene.",
      );
      event.target.value = "";
    } finally {
      setIsQuickPostImageProcessing(false);
    }
  };

  const toggleQuickPostPoll = () => {
    setIsPollEnabled((currentValue) => !currentValue);
    setPollError("");
    setIsEmojiPickerOpen(false);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((currentOptions) =>
      currentOptions.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
    setPollError("");
  };

  const addPollOption = () => {
    setPollOptions((currentOptions) =>
      currentOptions.length < 4 ? [...currentOptions, ""] : currentOptions,
    );
    setPollError("");
  };

  const removePollOption = (index: number) => {
    setPollOptions((currentOptions) =>
      currentOptions.length > 2
        ? currentOptions.filter((_, optionIndex) => optionIndex !== index)
        : currentOptions,
    );
    setPollError("");
  };

  const submitQuickPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = quickPostBody.trim();
    const normalizedPollOptions = pollOptions.map((option) => option.trim());

    if (
      !body ||
      !isHydrated ||
      isQuickPostSubmitting ||
      isQuickPostImageProcessing
    ) {
      setQuickPostMessage(
        !body
          ? "Önce bir şeyler yaz."
          : isQuickPostImageProcessing
            ? "Fotoğraf hazırlanıyor…"
            : "Akış hazırlanıyor, tekrar dene.",
      );
      return;
    }

    if (
      isPollEnabled &&
      (normalizedPollOptions.some((option) => !option) ||
        new Set(
          normalizedPollOptions.map((option) =>
            option.toLocaleLowerCase("tr-TR"),
          ),
        ).size !== normalizedPollOptions.length)
    ) {
      setPollError(
        normalizedPollOptions.some((option) => !option)
          ? "Anket için en az iki dolu seçenek yazmalısın."
          : "Anket seçenekleri birbirinden farklı olmalı.",
      );
      setQuickPostMessage("Anket seçeneklerini kontrol et.");
      return;
    }

    setIsQuickPostSubmitting(true);
    setQuickPostMessage("Gönderin paylaşılıyor…");
    setPollError("");

    let uploadedImageId: string | undefined;

    try {
      if (quickPostImage) {
        setQuickPostMessage("Fotoğraf yükleniyor…");
        const imageResponse = await fetch(quickPostImage.src);

        if (!imageResponse.ok) {
          throw new Error("Image preview could not be read.");
        }

        const uploadedImage = await uploadContentImage(
          await imageResponse.blob(),
        );
        uploadedImageId = uploadedImage.id;
        setQuickPostMessage("Gönderin paylaşılıyor…");
      }

      await createPost({
        title: isPollEnabled ? undefined : quickPostTitle.trim() || undefined,
        body,
        category: isPollEnabled ? "Anket" : composerCategory,
        isAnonymous: isComposerAnonymous,
        imageId: uploadedImageId,
        gif: quickPostGif,
        pollOptions: isPollEnabled ? normalizedPollOptions : undefined,
      });
      setQuickPostBody("");
      setQuickPostTitle("");
      setComposerCategory("Sohbet");
      setIsComposerAnonymous(false);
      setIsComposerExpanded(false);
      try {
        window.sessionStorage.removeItem(COMPOSER_DRAFT_KEY);
      } catch {
        // Depolama kapalıysa temizlik gerekmiyor.
      }
      setQuickPostGif(undefined);
      removeQuickPostImage();
      setIsGifPickerOpen(false);
      setIsEmojiPickerOpen(false);
      setIsPollEnabled(false);
      setPollOptions(["", ""]);
      setPollError("");
      setQuickPostMessage("");
      setFeedScope("global");
      setActiveCategory("Tümü");
      // Toast yerine sonucun kendisi: akış başa sarılır ve yeni gönderi
      // görünür. Aşağı kaydırmışken paylaşan kullanıcı aksi halde hiçbir
      // geri bildirim görmezdi.
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    } catch (error) {
      if (uploadedImageId) {
        await deleteUnattachedContentImage(uploadedImageId).catch(
          () => undefined,
        );
      }

      // Sunucu neden reddettiğini söylüyorsa onu göster: hız sınırına
      // takılmakla sunucu hatası almak kullanıcı için aynı şey değil.
      const message = describeComposerError(error);

      setQuickPostMessage(message);
      showToast({ message, tone: "error" });
    } finally {
      setIsQuickPostSubmitting(false);
    }
  };

  const loadMorePosts = async () => {
    try {
      await loadMore();
    } catch {
      showToast({
        message: "Gönderiler yüklenemedi. Tekrar dene.",
        tone: "error",
      });
    }
  };

  return (
    <section
      aria-labelledby="campus-feed-title"
      className="mx-auto min-h-[calc(100svh-4rem)] w-full max-w-[900px] min-w-0 bg-[#0a0d16] text-white sm:border-x sm:border-white/12 md:min-h-svh"
    >
      <h1 id="campus-feed-title" className="sr-only">
        Kampüs akışı
      </h1>

      <header
        className={`sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/55 backdrop-blur-xl transition-transform duration-300 ${
          isHeaderHidden ? "-translate-y-full md:translate-y-0" : "translate-y-0"
        }`}
      >
        <div
          role="group"
          aria-label="Akış görünümü"
          className="flex min-w-0"
        >
          <div
            className="grid min-w-0 flex-1 grid-cols-2"
          >
            {feedViews.map((view) => {
              const isActive = activeView === view.id;

              return (
                <button
                  key={view.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => changeFeedView(view.id)}
                  className={`relative min-h-14 min-w-0 px-2 text-sm font-black transition-colors sm:text-base ${focusRing} ${
                    isActive
                      ? "text-[#ff7a45] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[#ff7a45] sm:after:inset-x-6"
                      : "text-white/55 hover:bg-white/4 hover:text-white"
                  }`}
                >
                  <span className="block truncate">{view.label}</span>
                </button>
              );
            })}
          </div>

          <div
            ref={categoryMenuRef}
            className="relative shrink-0 border-l border-white/10"
          >
            <button
              type="button"
              aria-label={`Kategori filtresi: ${activeCategory}`}
              aria-expanded={isCategoryMenuOpen}
              aria-controls="campus-feed-category-menu"
              onClick={() =>
                setIsCategoryMenuOpen((currentValue) => !currentValue)
              }
              className={`inline-flex min-h-14 min-w-12 items-center justify-center gap-1.5 px-2 text-xs font-black transition-colors hover:bg-white/4 min-[460px]:min-w-28 min-[460px]:px-3 ${focusRing} ${
                activeCategory !== "Tümü"
                  ? "bg-[#ff7a45]/12 text-[#ff7a45]"
                  : "text-white/55"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                #
              </span>
              <span className="hidden max-w-20 truncate min-[460px]:inline">
                {activeCategory === "Tümü"
                  ? "Kategori"
                  : activeCategory}
              </span>
              <span
                aria-hidden="true"
                className={`hidden text-[10px] transition-transform min-[460px]:inline ${
                  isCategoryMenuOpen ? "rotate-180" : ""
                }`}
              >
                ▾
              </span>
            </button>

            {isCategoryMenuOpen && (
              <div
                id="campus-feed-category-menu"
                role="group"
                aria-label="Gönderi kategorileri"
                className="absolute top-[calc(100%+1px)] right-0 z-50 w-60 border border-white/12 bg-[#141720] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.42)]"
              >
                <p className="px-2 pt-1 pb-2 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">
                  Kategori seç
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {campusCategoryFilters.map((category) => {
                    const isActive = activeCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setActiveCategory(category);
                          setIsCategoryMenuOpen(false);
                        }}
                        className={`inline-flex min-h-11 items-center px-2.5 text-left text-[11px] font-bold transition-colors ${focusRing} ${
                          isActive
                            ? "bg-[#ff7a45]/12 text-[#ff7a45]"
                            : "text-white/55 hover:bg-white/6 hover:text-white"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative border-b border-white/12">
        {isGuest && (
          <button
            type="button"
            onClick={handleGuestComposerClick}
            aria-label="Gönderi paylaşmak için giriş yap"
            className={`absolute inset-0 z-10 cursor-pointer ${focusRing}`}
          />
        )}
        <form
          onSubmit={submitQuickPost}
          ref={composerRef}
          aria-labelledby="campus-composer-title"
          aria-busy={isQuickPostSubmitting}
          aria-hidden={isGuest}
          inert={isGuest}
          className="relative px-4 py-4 sm:px-5 sm:py-5"
        >
        <div className="flex items-start gap-3 sm:gap-4">
          <CampusAuthorAvatar
            author="@sen"
            authorId={LOCAL_ACCOUNT_OWNER_ID}
            size="lg"
          />
          <h2 id="campus-composer-title" className="sr-only">
            Yeni gönderi başlat
          </h2>
          <div className="min-w-0 flex-1">
            {isComposerExpanded && !isPollEnabled && (
              <div className="relative mb-1 inline-block">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isComposerCategoryOpen}
                  onClick={() =>
                    setIsComposerCategoryOpen((value) => !value)
                  }
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#ff7a45]/45 bg-[#ff7a45]/12 px-3 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/18 ${focusRing}`}
                >
                  {composerCategory}
                  <span aria-hidden="true" className="text-[9px]">▾</span>
                </button>

                {isComposerCategoryOpen && (
                  <div
                    role="menu"
                    className="absolute top-full left-0 z-50 mt-1 grid w-56 grid-cols-2 gap-1 border border-white/12 bg-[#141720] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.42)]"
                  >
                    {composerCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setComposerCategory(category);
                          setIsComposerCategoryOpen(false);
                        }}
                        className={`min-h-10 px-2.5 text-left text-[11px] font-bold transition-colors ${focusRing} ${
                          composerCategory === category
                            ? "bg-[#ff7a45]/15 text-[#ff7a45]"
                            : "text-white/62 hover:bg-white/6 hover:text-white"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          {/* Başlık yalnızca kutu açıkken ve anket dışında görünür. */}
          {isComposerExpanded && !isPollEnabled && (
            <>
              <label htmlFor="campus-quick-post-title" className="sr-only">
                Başlık (isteğe bağlı)
              </label>
              <input
                id="campus-quick-post-title"
                type="text"
                value={quickPostTitle}
                onChange={(event) => {
                  setQuickPostTitle(event.target.value);
                  setQuickPostMessage("");
                }}
                maxLength={CAMPUS_POST_TITLE_MAX_LENGTH}
                placeholder="Başlık ekle (isteğe bağlı)"
                className="w-full border-0 border-b border-white/10 bg-transparent px-0 py-2 text-xl font-black tracking-[-0.025em] text-white outline-none ring-0 placeholder:font-bold placeholder:text-white/38 focus:border-[#ff7a45]/45 focus:outline-none focus:ring-0 sm:text-2xl"
              />
            </>
          )}

          <textarea
            ref={quickPostBodyRef}
            onFocus={() => setIsComposerExpanded(true)}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === "Enter"
              ) {
                event.preventDefault();
                composerRef.current?.requestSubmit();
              }
            }}
            value={quickPostBody}
            onChange={(event) => {
              setQuickPostBody(event.target.value);
              setQuickPostMessage("");
            }}
            rows={1}
            maxLength={CAMPUS_POST_BODY_MAX_LENGTH}
            placeholder={
              isPollEnabled ? "Anket sorun ne?" : "Kampüste ne oluyor?"
            }
            aria-label="Gönderi metni"
            /* Kapak yok: 500 karakterin tamamı yazarken görünür kalsın. */
            className="min-h-14 w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-xl font-semibold leading-8 text-white outline-none ring-0 placeholder:font-medium placeholder:text-white/42 focus:outline-none focus:ring-0 sm:text-2xl"
          />

            {isComposerExpanded && (
              <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-white/62">
                <input
                  type="checkbox"
                  checked={isComposerAnonymous}
                  onChange={(event) =>
                    setIsComposerAnonymous(event.target.checked)
                  }
                  className="size-4 accent-[#ff7a45]"
                />
                {isComposerAnonymous
                  ? "Anonim paylaşıyorsun"
                  : "Anonim paylaş"}
              </label>
            )}
          </div>
	        </div>

          <input
            ref={quickPostImageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleQuickPostImageChange}
            disabled={isQuickPostImageProcessing}
            className="sr-only"
          />

          {quickPostImage && (
            /* ChatGPT tarzı küçük ek: önizleme akışı doldurmasın. */
            <div className="relative mt-3 inline-block size-20 overflow-hidden rounded-xl border border-white/12 bg-[#141720] min-[400px]:ml-[3.75rem] sm:ml-16">
              <Image
                src={quickPostImage.src}
                alt="Seçilen gönderi fotoğrafının önizlemesi"
                width={quickPostImage.width}
                height={quickPostImage.height}
                sizes="80px"
                unoptimized
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={removeQuickPostImage}
                aria-label="Seçilen fotoğrafı kaldır"
                className={`absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/80 text-xs font-black text-white hover:bg-black ${focusRing}`}
              >
                ×
              </button>
            </div>
          )}

	        {quickPostGif && (
	          <div className="relative mt-3 inline-block w-32 overflow-hidden rounded-xl min-[400px]:ml-[3.75rem] sm:ml-16">
	            <CampusGif gif={quickPostGif} compact />
	            <button
	              type="button"
	              onClick={() => setQuickPostGif(undefined)}
	              aria-label="Seçilen GIF'i kaldır"
	              className={`absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/80 text-xs font-black text-white hover:bg-black ${focusRing}`}
	            >
	              ×
	            </button>
	          </div>
	        )}

	        <div className="mt-3 flex min-w-0 items-center justify-between gap-1 border-t border-white/8 pt-3 min-[400px]:ml-[3.75rem] sm:ml-16">
          <div
            role="group"
            aria-label="Gönderi araçları"
            className="flex min-w-0 items-center gap-0.5 sm:gap-1"
          >
            <ComposerAction
              icon={<PhotoIcon />}
              label={
                isQuickPostImageProcessing
                  ? "Fotoğraf hazırlanıyor"
                  : "Fotoğraf ekle"
              }
              onClick={() => quickPostImageInputRef.current?.click()}
              isActive={Boolean(quickPostImage)}
              disabled={isQuickPostImageProcessing}
            />
	        <div className="relative">
	          <button
	            type="button"
	            onClick={() => {
	              setIsGifPickerOpen((value) => !value);
	              setIsEmojiPickerOpen(false);
	            }}
	            aria-expanded={isGifPickerOpen}
	            aria-label="GIF ekle"
	            title="GIF ekle"
	            className={`grid size-10 shrink-0 place-items-center text-[#ff7a45]/85 transition-colors hover:bg-[#ff7a45]/8 hover:text-[#ff7a45] sm:size-12 ${focusRing}`}
	          >
	            <span
	              aria-hidden="true"
	              className="rounded border-2 border-current px-1 py-0.5 text-[10px] leading-none font-black tracking-[-0.04em]"
	            >
	              GIF
	            </span>
	          </button>
	          {isGifPickerOpen && (
                <GiphyPicker
	              onClose={() => setIsGifPickerOpen(false)}
	              onSelect={(gif) => {
	                setQuickPostGif(gif);
	                removeQuickPostImage();
	                setIsGifPickerOpen(false);
	              }}
	            />
	          )}
	        </div>
            <ComposerAction
              icon={<PollIcon />}
              label={isPollEnabled ? "Anketi kaldır" : "Anket oluştur"}
              onClick={toggleQuickPostPoll}
              isActive={isPollEnabled}
            />
            <ComposerAction
              icon={<EmojiIcon />}
              label="Emoji ekle"
              onClick={() => {
                setIsEmojiPickerOpen((currentValue) => !currentValue);
                setIsGifPickerOpen(false);
              }}
              isActive={isEmojiPickerOpen}
            />
            <ComposerLinkAction
              icon={<ListingIcon />}
              label="İlan oluştur"
              href="/konu-olustur"
            />
          </div>

          {quickPostBody.length > 0 && (
            <CharacterRing
              value={quickPostBody.length}
              max={CAMPUS_POST_BODY_MAX_LENGTH}
            />
          )}

          <button
            type="submit"
            disabled={
              !quickPostBody.trim() ||
              !isHydrated ||
              isQuickPostImageProcessing ||
              isQuickPostSubmitting
            }
            className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-black transition-colors disabled:cursor-not-allowed sm:min-h-12 sm:px-6 sm:text-base ${focusRing} ${
              quickPostBody.trim()
                ? "bg-[#ff7a45] text-[#12100e] hover:bg-[#ff7a45]/90"
                : "bg-white/12 text-white/40"
            }`}
          >
            {isQuickPostSubmitting ? "Paylaşılıyor" : "Paylaş"}
          </button>
        </div>

        {isEmojiPickerOpen && (
          <div
            id="campus-feed-emoji-picker"
            role="group"
            aria-label="Gönderi emojileri"
            onKeyDown={handleEmojiPickerKeyDown}
            className="mt-3 grid grid-cols-6 gap-1 border-y border-white/10 bg-white/[0.025] p-2 min-[430px]:ml-[3.75rem] min-[430px]:grid-cols-8 sm:ml-16"
          >
            {quickEmojis.map((emoji) => (
              <button
                key={emoji.value}
                type="button"
                aria-label={`${emoji.label} emojisini ekle`}
                onClick={() => appendQuickPostEmoji(emoji.value)}
                className={`grid min-h-10 min-w-0 place-items-center rounded-lg text-xl transition-colors hover:bg-[#ff7a45]/10 sm:min-h-11 sm:text-2xl ${focusRing}`}
              >
                <span aria-hidden="true">{emoji.value}</span>
              </button>
            ))}
          </div>
        )}

        {isPollEnabled && (
          <div className="mt-3 border-y border-white/10 bg-white/[0.025] p-3 min-[430px]:ml-[3.75rem] sm:ml-16 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black sm:text-base">
                  Anket seçenekleri
                </p>
                <p className="mt-0.5 text-xs leading-5 text-white/55 sm:text-sm">
                  Gönderi metnin anket sorusu olarak görünecek.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleQuickPostPoll}
                className={`inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-black text-[#ffb199] hover:bg-[#ffb199]/8 sm:text-sm ${focusRing}`}
              >
                Kaldır
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex min-w-0 items-center gap-2">
                  <label
                    htmlFor={`campus-feed-poll-option-${index}`}
                    className="sr-only"
                  >
                    Anket seçeneği {index + 1}
                  </label>
                  <input
                    id={`campus-feed-poll-option-${index}`}
                    type="text"
                    value={option}
                    maxLength={60}
                    aria-invalid={Boolean(pollError)}
                    aria-describedby={
                      pollError ? "campus-feed-poll-error" : undefined
                    }
                    onChange={(event) =>
                      updatePollOption(index, event.target.value)
                    }
                    placeholder={`${index + 1}. seçenek`}
                    className={`min-h-11 min-w-0 flex-1 border border-white/12 bg-[#0a0d16]/70 px-3 text-sm font-semibold text-white placeholder:text-white/40 sm:min-h-12 sm:text-base ${focusRing}`}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      aria-label={`${index + 1}. anket seçeneğini kaldır`}
                      onClick={() => removePollOption(index)}
                      className={`grid size-11 shrink-0 place-items-center text-lg font-black text-[#ffb199] hover:bg-[#ffb199]/8 sm:size-12 ${focusRing}`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-white/55">
                {pollOptions.length}/4 seçenek
              </p>
              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className={`inline-flex min-h-10 items-center px-3 text-xs font-black text-[#ff7a45] hover:bg-[#ff7a45]/8 sm:text-sm ${focusRing}`}
                >
                  Seçenek ekle
                </button>
              )}
            </div>

            {pollError && (
              <p
                id="campus-feed-poll-error"
                role="alert"
                className="mt-2 text-sm font-bold text-[#ffb199]"
              >
                {pollError}
              </p>
            )}
          </div>
        )}

        {quickPostImageError && (
          <p
            role="alert"
            className="mt-2 text-sm font-bold text-[#ffb199] min-[400px]:pl-[3.75rem] sm:pl-16"
          >
            {quickPostImageError}
          </p>
        )}

        <p
          role="status"
          aria-live="polite"
          className="min-h-5 pt-1 text-sm font-bold text-[#ffb18c] min-[400px]:pl-[3.75rem] sm:pl-16"
        >
          {quickPostMessage}
        </p>

        {isQuickPostSubmitting && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#ff7a45]/20"
          >
            <span className="block h-full w-full animate-pulse bg-[#ff7a45] motion-reduce:animate-none" />
          </span>
        )}
        </form>
      </div>

      {!isHydrated ? (
        <div
          role="status"
          className="grid min-h-64 place-items-center border-b border-white/12 px-4 py-14 text-center"
        >
          <div>
            <span
              aria-hidden="true"
              className="mx-auto block size-7 animate-spin rounded-full border-2 border-white/14 border-t-[#ff7a45] motion-reduce:animate-none"
            />
            <p className="mt-4 text-sm font-bold text-white/60">
              Takip akışın hazırlanıyor…
            </p>
          </div>
        </div>
      ) : visiblePosts.length > 0 ? (
        <>
          <ol className="min-w-0">
            {visiblePosts.map((post) => (
              <li key={post.id} className="campus-feed-enter">
              <CampusPostCardSurface
                postId={post.id}
                className="border-b border-white/12 px-4 py-6 sm:bg-white/[0.015] sm:px-6 sm:py-6"
              >
                <header className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <CampusAuthorProfileLink
                      author={post.author}
                      authorId={post.authorId}
                      isAnonymous={post.isAnonymous}
                      ariaLabel={`${post.author} profilini aç`}
                      className="shrink-0"
                      linkClassName={`rounded-full transition-opacity hover:opacity-80 ${focusRing}`}
                    >
                      <CampusAuthorAvatar
                        author={post.author}
                        authorId={post.authorId}
                        isAnonymous={post.isAnonymous}
                        size="lg"
                      />
                    </CampusAuthorProfileLink>
                    <div className="min-w-0 pt-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
<span
                          className={`${campusCategoryBadgeBase} ${campusCategoryStyles[post.category].badge}`}
                        >
                          <span aria-hidden="true">{campusCategoryStyles[post.category].glyph}</span>
                          {post.category}
                        </span>
                        <span
                          aria-hidden="true"
                          className="size-1 rotate-45 bg-[#ff7a45]/55"
                        />
                        <CampusAuthorProfileLink
                          author={post.author}
                          authorId={post.authorId}
                          isAnonymous={post.isAnonymous}
                          ariaLabel={`${post.author} profilini aç`}
                          className="min-w-0"
                          linkClassName={`truncate text-sm font-black transition-colors hover:text-[#ff7a45] sm:text-base ${focusRing}`}
                        >
                          <span className="truncate text-sm font-black sm:text-base">
                            {post.author}
                          </span>
                        </CampusAuthorProfileLink>
                      </div>
                      {!isAnonymousCampusAuthor(post) &&
                        post.detail && (
                          <p className="mt-1 font-mono text-xs uppercase tracking-[0.07em] text-white/58 sm:text-[13px]">
                            {post.detail}
                          </p>
                        )}
                    </div>
                  </div>
                  <div className="-mr-2 flex shrink-0 items-center gap-0.5">
                    <time className="text-xs font-semibold text-white/58 sm:text-sm">
                      {post.time}
                      {post.edited && !post.isDeleted ? " · düzenlendi" : ""}
                    </time>
                    <CampusPostActions post={post} />
                  </div>
                </header>

                {post.isDeleted ? (
                  <div className="mt-4 border border-dashed border-white/12 bg-white/[0.025] px-4 py-4">
                    <p className="text-base font-black sm:text-lg">
                      Bu gönderi kaldırıldı.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                      Konuşma bağlamı korundu; varsa yorumları hâlâ
                      görüntüleyebilirsin.
                    </p>
                    {getCampusPostCommentCount(post) > 0 && (
                      <Link
                        href={`/gonderi/${post.id}#yorumlar`}
                        className={`mt-2 inline-flex min-h-11 items-center text-sm font-black text-[#ff7a45] sm:text-base ${focusRing}`}
                      >
                        {getCampusPostCommentCount(post)} yorumu görüntüle
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    {post.title && (
                      <h2 className="mt-4 max-w-[74ch] break-words text-xl font-black leading-7 tracking-[-0.025em] [overflow-wrap:anywhere] sm:text-2xl sm:leading-8">
                        <Link
                          href={`/gonderi/${post.id}`}
                          aria-label={`${post.title} konusunu aç`}
                          className={`decoration-[#ff7a45]/40 underline-offset-4 transition-colors hover:text-[#ff7a45] hover:underline ${focusRing}`}
                        >
                          {post.title}
                        </Link>
                      </h2>
                    )}

                    {post.isHidden && <CampusHiddenNotice />}

                    {post.listing && (
                      <CampusListingMeta listing={post.listing} />
                    )}

                    {post.body && (
                      <p className="mt-2.5 max-w-[74ch] whitespace-pre-wrap break-words text-base leading-7 tracking-[-0.01em] text-white/78 [overflow-wrap:anywhere] sm:text-lg sm:leading-8">
                        {post.body}
                      </p>
                    )}

                    {post.image && <CampusPostImage image={post.image} />}
                    {post.gif && <CampusGif gif={post.gif} />}
                    {post.poll && (
                      <CampusPoll postId={post.id} poll={post.poll} />
                    )}

                    {isGuest ? (
                  <footer className="mt-5 flex min-h-11 items-center justify-between gap-3 text-sm font-bold text-white/60 sm:mt-6 sm:text-base">
                    <span className="inline-flex items-center gap-2">
                      <HeartIcon filled={false} />
                      {post.likes} beğeni
                    </span>
                    <Link
                      href={`/gonderi/${post.id}`}
                      className={`inline-flex min-h-11 items-center px-2 text-[#ff7a45] ${focusRing}`}
                    >
                      Görüntüle
                    </Link>
                  </footer>
                ) : (
                  <footer className="mt-5 flex items-center justify-between gap-2 sm:mt-6">
                  <div className="flex min-w-0 items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={post.liked}
                      aria-label={
                        post.liked
                          ? `${post.title || "Gönderi"} gönderisindeki beğeniyi kaldır, ${post.likes} beğeni`
                          : `${post.title || "Gönderi"} gönderisini beğen, ${post.likes} beğeni`
                      }
                      onClick={() => toggleLike(post.id)}
                      className={`campus-pop-on-active inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold transition-colors sm:text-base ${focusRing} ${
                        post.liked
                          ? "bg-[#ff7a45]/10 text-[#ff7a45]"
                          : "text-white/55 hover:bg-white/4 hover:text-[#ff7a45]"
                      }`}
                    >
                      <HeartIcon filled={post.liked} />
                      <span aria-live="polite" aria-atomic="true">
                        {post.likes}
                      </span>
                      <span className="hidden min-[430px]:inline">beğeni</span>
                    </button>

                    <Link
                      href={`/gonderi/${post.id}#yorumlar`}
                      aria-label={`${post.title || "Gönderi"} konusunun ${getCampusPostCommentCount(post)} yorumunu aç`}
                      className={`inline-flex min-h-11 items-center gap-2 px-2 text-sm font-bold text-white/60 transition-colors hover:text-[#ff7a45] sm:text-base ${focusRing}`}
                    >
                      <CommentIcon />
                      <span>{getCampusPostCommentCount(post)}</span>
                      <span className="hidden min-[430px]:inline">yorum</span>
                    </Link>
                  </div>

                  <button
                    type="button"
                    aria-pressed={post.bookmarked}
                    aria-label={
                      post.bookmarked
                        ? "Kaydedilenlerden çıkar"
                        : "Gönderiyi kaydet"
                    }
                    onClick={() => toggleBookmark(post.id)}
                    className={`campus-pop-on-active grid size-12 shrink-0 place-items-center transition-colors ${focusRing} ${
                      post.bookmarked
                        ? "text-[#ff7a45]"
                        : "text-white/55 hover:text-[#ff7a45]"
                    }`}
                  >
                    <BookmarkIcon filled={post.bookmarked} />
                  </button>
                  </footer>
                    )}
                  </>
                )}
              </CampusPostCardSurface>
              </li>
            ))}
          </ol>

          {!isGuest && hasMore && (
            <div className="border-b border-white/12 px-4 py-5 text-center sm:px-5">
              <button
                type="button"
                aria-label="Daha fazla gönderi yükle"
                aria-busy={isLoadingMore}
                disabled={isLoadingMore}
                onClick={() => void loadMorePosts()}
                className={campusButton.secondary}
              >
                {isLoadingMore
                  ? "Gönderiler yükleniyor…"
                  : "Daha fazla gönderi yükle"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="border-b border-white/12 px-4 py-14 text-center sm:m-3 sm:border">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-full border border-white/12 text-2xl"
          >
            {activeView === "following" ? "👥" : "🔎"}
          </span>
          <p className="mt-5 text-base font-black sm:text-lg">
            {activeView === "following"
              ? "Takip ettiğin kişilerden henüz bir gönderi yok."
              : "Bu filtrelerle eşleşen bir konu yok."}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/55">
            {activeView === "following"
              ? "Keşfet'ten birkaç kişiyi takip et; paylaştıkları burada görünsün."
              : "Farklı bir kategori dene ya da ilk konuyu sen aç."}
          </p>
          {activeView === "following" && (
            <Link
              href="/kesfet"
              className={`mt-5 ${campusButton.primary}`}
            >
              Keşfet&apos;e git
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setFeedScope("global");
              setActiveCategory("Tümü");
            }}
            className={`mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#ff7a45] underline decoration-[#ff7a45]/40 underline-offset-4 sm:text-base ${focusRing}`}
          >
            Ana akışa dön
          </button>
        </div>
      )}
    </section>
  );
}

function ComposerAction({
  icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-10 shrink-0 place-items-center transition-colors disabled:cursor-wait disabled:opacity-45 sm:size-12 ${focusRing} ${
        isActive
          ? "bg-[#ff7a45]/12 text-[#ff7a45]"
          : "text-[#ff7a45]/85 hover:bg-[#ff7a45]/8 hover:text-[#ff7a45]"
      }`}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}

function ComposerLinkAction({
  icon,
  label,
  href,
}: {
  icon: ReactNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`grid size-10 shrink-0 place-items-center text-[#ff7a45]/85 transition-colors hover:bg-[#ff7a45]/8 hover:text-[#ff7a45] sm:size-12 ${focusRing}`}
    >
      <span aria-hidden="true">{icon}</span>
    </Link>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6 sm:size-7">
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

function PollIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6 sm:size-7">
      <path
        d="M5 7.5h2.5M5 12h2.5M5 16.5h2.5M11 7.5h8M11 12h5M11 16.5h7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6 sm:size-7">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
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

function ListingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6 sm:size-7">
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="size-5 sm:size-[22px]"
    >
      <path
        d="M10 16.2s-6-3.4-6-8.1A3.3 3.3 0 0 1 10 6a3.3 3.3 0 0 1 6 2.1c0 4.7-6 8.1-6 8.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-5 sm:size-[22px]"
    >
      <path
        d="M16.3 9.1c0 3.4-2.8 6-6.3 6a7 7 0 0 1-2.3-.4L4 16l1.1-3A5.8 5.8 0 0 1 3.7 9.1c0-3.4 2.8-6.1 6.3-6.1s6.3 2.7 6.3 6.1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      className="size-5 sm:size-[22px]"
    >
      <path
        d="M5.2 3.2h9.6v13.6L10 13.9l-4.8 2.9V3.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
