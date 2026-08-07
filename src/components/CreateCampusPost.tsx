"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { useCampusData } from "@/components/CampusDataProvider";
import { campusButton } from "@/components/campusButtonStyles";
import CampusGif from "@/components/CampusGif";
import GiphyPicker from "@/components/GiphyPicker";
import {
  deleteUnattachedContentDocument,
  deleteUnattachedContentImage,
  uploadContentDocument,
  uploadContentImage,
} from "@/content/client";
import {
  CAMPUS_POST_BODY_MAX_LENGTH,
  CAMPUS_POST_TITLE_MAX_LENGTH,
} from "@/data/campusContentRules";
import type {
  CampusListingCondition,
  CampusListingType,
  CampusPostCategory,
  CampusGif as CampusGifData,
  CampusPostImage,
} from "@/data/campusPosts";

const categories: {
  value: CampusPostCategory;
  description: string;
}[] = [
  {
    value: "Sohbet",
    description: "Gündelik bir düşünceyi veya sohbeti paylaş.",
  },
  {
    value: "İtiraf",
    description: "Aklında kalanı kampüsle paylaş.",
  },
  {
    value: "Soru",
    description: "Öğrencilerden fikir veya yardım al.",
  },
  {
    value: "Etkinlik",
    description: "Bir buluşmayı ya da etkinliği duyur.",
  },
  {
    value: "Kayıp Eşya",
    description: "Kayıp veya bulunan bir eşyayı bildir.",
  },
  {
    value: "Anket",
    description: "Kampüsün fikrini seçeneklerle öğren.",
  },
  {
    value: "İlan",
    description: "Kampüs içinde sat, ara veya ücretsiz paylaş.",
  },
];

const listingTypes: {
  value: CampusListingType;
  description: string;
}[] = [
  {
    value: "Satılık",
    description: "Bir ürününü fiyatıyla ilana çıkar.",
  },
  {
    value: "Aranıyor",
    description: "Aradığın ürünü ve bütçeni paylaş.",
  },
  {
    value: "Ücretsiz",
    description: "Kullanmadığın ürünü ücretsiz ver.",
  },
];

const listingConditions: CampusListingCondition[] = [
  "Yeni",
  "Az kullanılmış",
  "Kullanılmış",
];

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

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40";
const MAX_SOURCE_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_OUTPUT_IMAGE_SIZE = 700 * 1024;
const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);

  return megabytes >= 0.1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}

function getDataUrlSize(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

async function createPostImage(
  file: File,
): Promise<Omit<CampusPostImage, "alt">> {
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

export default function CreateCampusPost() {
  const router = useRouter();
  const { createPost, isHydrated } = useCampusData();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const listingPriceInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<CampusPostCategory>("Sohbet");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [selectedGif, setSelectedGif] = useState<CampusGifData | undefined>();
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<
    Omit<CampusPostImage, "alt"> | undefined
  >();
  const [imageError, setImageError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<
    { file: File; name: string; sizeBytes: number } | undefined
  >();
  const [documentError, setDocumentError] = useState("");
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollError, setPollError] = useState("");
  const [listingType, setListingType] =
    useState<CampusListingType>("Satılık");
  const [listingCondition, setListingCondition] =
    useState<CampusListingCondition>("Az kullanılmış");
  const [listingPrice, setListingPrice] = useState("");
  const [listingError, setListingError] = useState("");
  const [titleError, setTitleError] = useState("");
  const [bodyError, setBodyError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<
    "neutral" | "error" | "success"
  >("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isListing = category === "İlan";

  const appendEmoji = (emoji: string) => {
    const textarea = bodyInputRef.current;
    const selectionStart = textarea?.selectionStart ?? body.length;
    const selectionEnd = textarea?.selectionEnd ?? body.length;
    const nextBody =
      body.slice(0, selectionStart) + emoji + body.slice(selectionEnd);

    if (nextBody.length > CAMPUS_POST_BODY_MAX_LENGTH) {
      setStatusMessage(
        `Açıklama en fazla ${CAMPUS_POST_BODY_MAX_LENGTH} karakter olabilir.`,
      );
      setStatusTone("error");
      return;
    }

    setBody(nextBody);
    setStatusMessage("");
    setStatusTone("neutral");
    setIsEmojiPickerOpen(false);

    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      bodyInputRef.current?.focus();
      bodyInputRef.current?.setSelectionRange(
        nextCursorPosition,
        nextCursorPosition
      );
    });
  };

  const handleEmojiPickerKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === "Escape") {
      setIsEmojiPickerOpen(false);
      bodyInputRef.current?.focus();
    }
  };

  const handleImageChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImageError("");
    setStatusMessage("");

    if (!acceptedImageTypes.has(file.type)) {
      setImageError("JPEG, PNG veya WebP biçiminde bir fotoğraf seçmelisin.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SOURCE_IMAGE_SIZE) {
      setImageError("Fotoğraf en fazla 5 MB olabilir.");
      event.target.value = "";
      return;
    }

    setIsProcessingImage(true);

    try {
      setImagePreview(await createPostImage(file));
      setSelectedGif(undefined);
      removeDocument();
    } catch {
      setImageError(
        "Fotoğraf işlenemedi. Daha küçük veya farklı bir görsel deneyebilirsin.",
      );
      event.target.value = "";
    } finally {
      setIsProcessingImage(false);
    }
  };

  const removeImage = () => {
    setImagePreview(undefined);
    setImageError("");

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setDocumentError("");
    setStatusMessage("");

    if (file.type !== "application/pdf") {
      setDocumentError("Yalnızca PDF dosyası ekleyebilirsin.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_DOCUMENT_SIZE) {
      setDocumentError("Doküman en fazla 8 MB olabilir.");
      event.target.value = "";
      return;
    }

    setDocumentPreview({ file, name: file.name, sizeBytes: file.size });
    setSelectedGif(undefined);
    removeImage();
  };

  const removeDocument = () => {
    setDocumentPreview(undefined);
    setDocumentError("");

    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }
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
      currentOptions.length < 4
        ? [...currentOptions, ""]
        : currentOptions,
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

  const submitPost = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    const normalizedPollOptions = pollOptions.map((option) =>
      option.trim(),
    );
    const normalizedListingPrice =
      listingType === "Ücretsiz" ? 0 : Number(listingPrice);

    if (!isHydrated) {
      setStatusMessage("Konu alanı hazırlanıyor. Birkaç saniye sonra dene.");
      setStatusTone("neutral");
      return;
    }

    if (!normalizedTitle) {
      setTitleError(
        isListing
          ? "İlan başlığını yazmalısın."
          : "Konu başlığını yazmalısın.",
      );
      setStatusMessage(
        isListing
          ? "İlan yayımlanamadı. Başlık alanını kontrol et."
          : "Konu yayımlanamadı. Başlık alanını kontrol et.",
      );
      setStatusTone("error");
      titleInputRef.current?.focus();
      return;
    }

    if (isListing && !normalizedBody) {
      setBodyError("İlanın durumunu ve önemli ayrıntılarını yazmalısın.");
      setStatusMessage(
        "İlan yayımlanamadı. Açıklama alanını kontrol et.",
      );
      setStatusTone("error");
      bodyInputRef.current?.focus();
      return;
    }

    if (
      isListing &&
      listingType !== "Ücretsiz" &&
      (!Number.isInteger(normalizedListingPrice) ||
        normalizedListingPrice <= 0 ||
        normalizedListingPrice > 1_000_000)
    ) {
      setListingError(
        listingType === "Aranıyor"
          ? "1 ile 1.000.000 TL arasında bir bütçe yazmalısın."
          : "1 ile 1.000.000 TL arasında bir fiyat yazmalısın.",
      );
      setStatusMessage(
        "İlan yayımlanamadı. Fiyat bilgisini kontrol et.",
      );
      setStatusTone("error");
      listingPriceInputRef.current?.focus();
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
      setStatusMessage("Konu yayımlanamadı. Anket seçeneklerini kontrol et.");
      setStatusTone("error");
      document.getElementById("campus-poll-option-0")?.focus();
      return;
    }

    setPollError("");
    setListingError("");
    setTitleError("");
    setBodyError("");
    setStatusMessage(
      isListing ? "İlan yayımlanıyor…" : "Konu yayımlanıyor…",
    );
    setStatusTone("neutral");
    setIsSubmitting(true);

    let uploadedImageId: string | undefined;
    let uploadedDocumentId: string | undefined;

    try {
      if (imagePreview) {
        setStatusMessage("Görsel güvenli biçimde yükleniyor…");
        const imageResponse = await fetch(imagePreview.src);

        if (!imageResponse.ok) {
          throw new Error("Image preview could not be read.");
        }

        const uploadedImage = await uploadContentImage(
          await imageResponse.blob(),
        );
        uploadedImageId = uploadedImage.id;
        setStatusMessage(
          isListing ? "İlan yayımlanıyor…" : "Konu yayımlanıyor…",
        );
      }

      if (documentPreview) {
        setStatusMessage("Doküman güvenli biçimde yükleniyor…");

        const uploadedDocument = await uploadContentDocument(
          documentPreview.file,
          documentPreview.name,
        );
        uploadedDocumentId = uploadedDocument.id;
        setStatusMessage(
          isListing ? "İlan yayımlanıyor…" : "Konu yayımlanıyor…",
        );
      }

      const postId = await createPost({
        title: normalizedTitle,
        body: normalizedBody,
        category,
        isAnonymous,
        imageId: uploadedImageId,
        gif: selectedGif,
        documentId: uploadedDocumentId,
        pollOptions: isPollEnabled ? normalizedPollOptions : undefined,
        listing: isListing
          ? {
              type: listingType,
              condition: listingCondition,
              price: normalizedListingPrice,
            }
          : undefined,
      });

      setStatusMessage(
        isListing
          ? "İlan yayımlandı. Gönderiye yönlendiriliyorsun."
          : "Konu yayımlandı. Gönderiye yönlendiriliyorsun.",
      );
      setStatusTone("success");
      router.push(`/gonderi/${postId}`);
    } catch {
      if (uploadedImageId) {
        await deleteUnattachedContentImage(uploadedImageId).catch(
          () => undefined,
        );
      }

      if (uploadedDocumentId) {
        await deleteUnattachedContentDocument(uploadedDocumentId).catch(
          () => undefined,
        );
      }

      setIsSubmitting(false);
      setStatusMessage(
        isListing
          ? "İlan şu anda yayımlanamadı. Bir kez daha deneyebilirsin."
          : "Konu şu anda yayımlanamadı. Bir kez daha deneyebilirsin.",
      );
      setStatusTone("error");
    }
  };

  return (
    <section
      aria-labelledby="create-post-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-5">
          <span aria-hidden="true" />

          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
              {isListing ? "Kampüs pazarı" : "Kampüse yaz"}
            </p>
            <h1
              id="create-post-title"
              className="truncate text-base font-black tracking-[-0.03em]"
            >
              {isListing ? "Yeni ilan oluştur" : "Yeni konu aç"}
            </h1>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="mb-6 sm:mb-8">
          <p className="max-w-xl text-sm leading-6 text-white/62">
            {isListing
              ? "Ürünü açıkça tanımla, durumunu belirt ve kampüs içinde güvenli bir şekilde paylaş."
              : "Sorunu, duyurunu veya kampüste konuşulmasını istediğin konuyu anlaşılır bir başlıkla paylaş."}
          </p>
        </div>

        <form
          noValidate
          onSubmit={submitPost}
          className="border-y border-white/12 py-6 sm:border sm:bg-white/[0.02] sm:p-7"
        >
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor="campus-post-title"
                className="text-sm font-black tracking-[-0.015em]"
              >
                Başlık
              </label>
              <span className="font-mono text-[10px] font-bold text-white/55">
                {title.length}/{CAMPUS_POST_TITLE_MAX_LENGTH}
              </span>
            </div>
            <input
              ref={titleInputRef}
              id="campus-post-title"
              name="title"
              type="text"
              value={title}
              maxLength={CAMPUS_POST_TITLE_MAX_LENGTH}
              required
              autoFocus
              autoComplete="off"
              aria-invalid={Boolean(titleError)}
              aria-describedby={
                titleError ? "campus-post-title-error" : undefined
              }
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError("");
                setStatusMessage("");
                setStatusTone("neutral");
              }}
              placeholder={
                isListing
                  ? "Ne satıyor veya arıyorsun?"
                  : "Konu ne hakkında?"
              }
              className={`mt-2 min-h-12 w-full border bg-white/[0.03] px-3.5 py-2.5 text-[15px] font-bold text-white placeholder:font-medium placeholder:text-white/40 ${
                titleError
                  ? "border-[#ffb199]"
                  : "border-white/12"
              } ${focusRing}`}
            />
            {titleError && (
              <p
                id="campus-post-title-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-[#ffb199]"
              >
                {titleError}
              </p>
            )}
          </div>

          <fieldset className="mt-7">
            <legend className="text-sm font-black tracking-[-0.015em]">
              Kategori
            </legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {categories.map((option) => {
                const isSelected = category === option.value;

                return (
                  <label
                    key={option.value}
                    className={`flex min-h-16 cursor-pointer items-start gap-3 border px-3.5 py-3 transition-colors ${
                      isSelected
                        ? "border-[#ff7a45]/60 bg-[#ff7a45]/9"
                        : "border-white/12 bg-white/[0.02] hover:border-[#ff7a45]/35"
                    } ${focusRing}`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => {
                        setCategory(option.value);
                        setIsPollEnabled(option.value === "Anket");
                        setPollError("");
                        setListingError("");
                        setBodyError("");

                        if (option.value === "İlan") {
                          setIsAnonymous(false);
                        } else {
                          setListingType("Satılık");
                          setListingCondition("Az kullanılmış");
                          setListingPrice("");
                        }
                      }}
                      className="mt-0.5 size-4 shrink-0 accent-[#ff7a45]"
                    />
                    <span>
                      <span className="block text-xs font-black">
                        {option.value}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-white/55">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isListing && (
            <fieldset className="mt-7 border border-[#ff7a45]/28 bg-[#ff7a45]/6 p-4 sm:p-5">
              <legend className="px-1 text-sm font-black tracking-[-0.015em] text-[#ff7a45]">
                İlan bilgileri
              </legend>
              <p className="text-[11px] leading-5 text-white/55">
                İlan türünü, ürünün durumunu ve fiyatını belirt.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {listingTypes.map((option) => {
                  const isSelected = listingType === option.value;

                  return (
                    <label
                      key={option.value}
                      className={`flex min-h-20 cursor-pointer flex-col border px-3 py-3 transition-colors ${
                        isSelected
                          ? "border-[#ff7a45]/48 bg-[#ff7a45]/9"
                          : "border-white/12 bg-white/[0.02] hover:border-[#ff7a45]/30"
                      } ${focusRing}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="listing-type"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => {
                            setListingType(option.value);
                            setListingError("");

                            if (option.value === "Ücretsiz") {
                              setListingPrice("");
                            }
                          }}
                          className="size-4 shrink-0 accent-[#ff7a45]"
                        />
                        <span className="text-xs font-black">
                          {option.value}
                        </span>
                      </span>
                      <span className="mt-1 pl-6 text-[10px] leading-4 text-white/55">
                        {option.description}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  {listingType === "Ücretsiz" ? (
                    <p className="text-xs font-black">Fiyat</p>
                  ) : (
                    <label
                      htmlFor="campus-listing-price"
                      className="text-xs font-black"
                    >
                      {listingType === "Aranıyor" ? "Bütçe" : "Fiyat"}
                    </label>
                  )}

                  {listingType === "Ücretsiz" ? (
                    <div className="mt-2 flex min-h-12 items-center border border-white/12 bg-white/[0.02] px-3.5 text-sm font-black text-[#ff7a45]">
                      Fiyat gerekmiyor
                    </div>
                  ) : (
                    <div className="relative mt-2">
                      <input
                        ref={listingPriceInputRef}
                        id="campus-listing-price"
                        name="listing-price"
                        type="number"
                        min={1}
                        max={1_000_000}
                        step={1}
                        inputMode="numeric"
                        value={listingPrice}
                        required
                        aria-invalid={Boolean(listingError)}
                        aria-describedby={
                          listingError
                            ? "campus-listing-price-error"
                            : "campus-listing-price-help"
                        }
                        onChange={(event) => {
                          setListingPrice(event.target.value);
                          setListingError("");
                          setStatusMessage("");
                        }}
                        placeholder={
                          listingType === "Aranıyor"
                            ? "En yüksek bütçe"
                            : "Satış fiyatı"
                        }
                        className={`min-h-12 w-full border bg-white/[0.03] px-3.5 py-2.5 pr-12 text-sm font-bold placeholder:font-medium placeholder:text-white/40 ${
                          listingError
                            ? "border-[#ffb199]"
                            : "border-white/12"
                        } ${focusRing}`}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-black text-white/55">
                        TL
                      </span>
                    </div>
                  )}

                  {listingError ? (
                    <p
                      id="campus-listing-price-error"
                      role="alert"
                      className="mt-2 text-xs font-semibold text-[#ffb199]"
                    >
                      {listingError}
                    </p>
                  ) : (
                    <p
                      id="campus-listing-price-help"
                      className="mt-2 text-[10px] leading-4 text-white/55"
                    >
                      Yalnızca tam sayı olarak Türk lirası gir.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="campus-listing-condition"
                    className="text-xs font-black"
                  >
                    Ürün durumu
                  </label>
                  <select
                    id="campus-listing-condition"
                    name="listing-condition"
                    value={listingCondition}
                    onChange={(event) =>
                      setListingCondition(
                        event.target.value as CampusListingCondition,
                      )
                    }
                    className={`mt-2 min-h-12 w-full border border-white/12 bg-[#141720] px-3.5 text-sm font-bold ${focusRing}`}
                  >
                    {listingConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="mt-4 border-l-2 border-[#ff7a45]/45 pl-3 text-[11px] leading-5 text-white/60">
                İlanlar güven için profilinle yayımlanır. Telefon, e-posta veya
                açık adresini açıklamaya yazma.
              </p>
            </fieldset>
          )}

          <div className="mt-7">
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor="campus-post-body"
                className="text-sm font-black tracking-[-0.015em]"
              >
                {isListing ? "İlan açıklaması" : "Açıklama"}{" "}
                {!isListing && (
                  <span className="font-medium text-white/55">
                    (isteğe bağlı)
                  </span>
                )}
              </label>
              <span className="font-mono text-[10px] font-bold text-white/55">
                {body.length}/{CAMPUS_POST_BODY_MAX_LENGTH}
              </span>
            </div>
            <textarea
              ref={bodyInputRef}
              id="campus-post-body"
              name="body"
              value={body}
              maxLength={CAMPUS_POST_BODY_MAX_LENGTH}
              rows={7}
              required={isListing}
              aria-invalid={Boolean(bodyError)}
              aria-describedby={
                bodyError
                  ? "campus-post-body-error campus-post-body-help"
                  : "campus-post-body-help"
              }
              onChange={(event) => {
                setBody(event.target.value);
                setBodyError("");
                setStatusMessage("");
                setStatusTone("neutral");
              }}
              placeholder={
                isListing
                  ? "Ürünün özelliklerini, kusurlarını ve teslim için uygun olduğun kampüs alanını yaz."
                  : "Detay vermek istersen buraya yazabilirsin."
              }
              className={`mt-2 min-h-40 w-full resize-y border bg-white/[0.03] px-3.5 py-3 text-sm leading-6 text-white placeholder:text-white/40 ${
                bodyError
                  ? "border-[#ffb199]"
                  : "border-white/12"
              } ${focusRing}`}
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                {bodyError && (
                  <p
                    id="campus-post-body-error"
                    role="alert"
                    className="text-xs font-semibold text-[#ffb199]"
                  >
                    {bodyError}
                  </p>
                )}
                <p
                  id="campus-post-body-help"
                  className={`${bodyError ? "mt-1" : ""} text-[11px] leading-5 text-white/55`}
                >
                  {isListing
                    ? "Kişisel iletişim bilgilerini değil, ürünün ayrıntılarını paylaş."
                    : "Kişisel bilgi paylaşmamaya dikkat et."}
                </p>
              </div>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Açıklamaya emoji ekle"
                  aria-expanded={isEmojiPickerOpen}
                  aria-controls="campus-post-emoji-picker"
                  onClick={() =>
                    setIsEmojiPickerOpen((currentValue) => !currentValue)
                  }
                  className={`inline-flex min-h-11 items-center gap-2 border border-white/12 px-3 text-xs font-bold transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                >
                  <span aria-hidden="true" className="text-base">
                    ☺
                  </span>
                  Emoji
                </button>

                {isEmojiPickerOpen && (
                  <div
                    id="campus-post-emoji-picker"
                    role="group"
                    aria-label="Açıklama emojileri"
                    onKeyDown={handleEmojiPickerKeyDown}
                    className="absolute right-0 bottom-[calc(100%+0.5rem)] z-40 grid w-52 grid-cols-4 gap-1 border border-white/12 bg-[#17191c] p-2 shadow-[0_16px_42px_rgba(0,0,0,0.4)]"
                  >
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji.value}
                        type="button"
                        aria-label={`${emoji.label} emojisini ekle`}
                        onClick={() => appendEmoji(emoji.value)}
                        className={`grid size-11 place-items-center rounded-lg text-xl transition-colors hover:bg-[#ff7a45]/10 ${focusRing}`}
                      >
                        <span aria-hidden="true">{emoji.value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">GIF <span className="font-medium text-white/55">(isteğe bağlı)</span></p>
                <p className="mt-1 text-[11px] text-white/55">GIPHY&apos;den bir tepki GIF&apos;i seç.</p>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsGifPickerOpen((value) => !value)}
                  aria-expanded={isGifPickerOpen}
                  className={`inline-flex min-h-11 items-center border border-white/12 px-4 text-xs font-black text-[#ff7a45] hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                >
                  GIF seç
                </button>
                {isGifPickerOpen && (
                  <GiphyPicker
                    onClose={() => setIsGifPickerOpen(false)}
                    onSelect={(gif) => { setSelectedGif(gif); removeImage(); removeDocument(); setIsGifPickerOpen(false); }}
                  />
                )}
              </div>
            </div>
            {selectedGif && (
              <div className="relative">
                <CampusGif gif={selectedGif} compact />
                <button
                  type="button"
                  onClick={() => setSelectedGif(undefined)}
                  aria-label="Seçilen GIF'i kaldır"
                  className={`absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-black/75 text-white hover:bg-black ${focusRing}`}
                >×</button>
              </div>
            )}
          </div>

          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black tracking-[-0.015em]">
                  {isListing ? "İlan fotoğrafı" : "Fotoğraf"}{" "}
                  <span className="font-medium text-white/55">
                    {isListing ? "(önerilir)" : "(isteğe bağlı)"}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/55">
                  Tek fotoğraf · JPEG, PNG veya WebP · en fazla 5 MB
                </p>
              </div>

              <input
                ref={imageInputRef}
                id="campus-post-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                disabled={isProcessingImage}
                className="sr-only"
              />

              {!imagePreview && (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className={`${campusButton.secondary} disabled:cursor-wait disabled:opacity-50 `}
                >
                  {isProcessingImage ? "İşleniyor…" : "Fotoğraf ekle"}
                </button>
              )}
            </div>

            {imagePreview && (
              <div className="mt-4 overflow-hidden border border-white/12 bg-[#141720]">
                <Image
                  src={imagePreview.src}
                  alt={
                    isListing
                      ? "Seçilen ilan fotoğrafının önizlemesi"
                      : "Seçilen gönderi fotoğrafının önizlemesi"
                  }
                  width={imagePreview.width}
                  height={imagePreview.height}
                  sizes="(max-width: 768px) 100vw, 720px"
                  unoptimized
                  className="max-h-[30rem] h-auto w-full object-contain"
                />
                <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 bg-[#0a0d16]/80 p-3">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isProcessingImage}
                    className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-4 text-xs font-black transition-colors hover:bg-white/6 disabled:cursor-wait disabled:opacity-50 ${focusRing}`}
                  >
                    Değiştir
                  </button>
                  <button
                    type="button"
                    onClick={removeImage}
                    className={`inline-flex min-h-11 items-center justify-center px-4 text-xs font-black text-[#ffb199] transition-colors hover:bg-[#ffb199]/8 ${focusRing}`}
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            )}

            {imageError && (
              <p
                role="alert"
                className="mt-3 text-xs font-semibold text-[#ffb199]"
              >
                {imageError}
              </p>
            )}

            {imagePreview && isAnonymous && (
              <p className="mt-3 border-l-2 border-[#ff7a45]/45 pl-3 text-[11px] leading-5 text-white/60">
                Anonim paylaşımda fotoğraftaki yüz, plaka veya belgeler seni
                belli edebilir.
              </p>
            )}
          </div>

          <div className="mt-7 border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black tracking-[-0.015em]">
                  Doküman{" "}
                  <span className="font-medium text-white/55">
                    (isteğe bağlı)
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/55">
                  Ders notu veya belge · yalnızca PDF · en fazla 8 MB
                </p>
              </div>

              <input
                ref={documentInputRef}
                id="campus-post-document"
                type="file"
                accept="application/pdf"
                onChange={handleDocumentChange}
                className="sr-only"
              />

              {!documentPreview && (
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  className={campusButton.secondary}
                >
                  PDF ekle
                </button>
              )}
            </div>

            {documentPreview && (
              <div className="mt-4 flex items-center gap-3 border border-white/12 bg-[#141720] p-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center border border-white/12 bg-white/6 text-[10px] font-black uppercase tracking-[0.06em] text-[#ff7a45]"
                >
                  PDF
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">
                    {documentPreview.name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/55">
                    {formatFileSize(documentPreview.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeDocument}
                  className={`inline-flex min-h-11 shrink-0 items-center justify-center px-4 text-xs font-black text-[#ffb199] transition-colors hover:bg-[#ffb199]/8 ${focusRing}`}
                >
                  Kaldır
                </button>
              </div>
            )}

            {documentError && (
              <p
                role="alert"
                className="mt-3 text-xs font-semibold text-[#ffb199]"
              >
                {documentError}
              </p>
            )}
          </div>

          {!isListing && (
            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black tracking-[-0.015em]">
                  Anket
                </p>
                <p className="mt-1 text-[11px] leading-5 text-white/55">
                  Başlığın anket sorusu, aşağıdakiler seçenekler olur.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={isPollEnabled}
                onClick={() => {
                  const nextValue = !isPollEnabled;
                  setIsPollEnabled(nextValue);
                  setCategory(
                    nextValue
                      ? "Anket"
                      : category === "Anket"
                        ? "Sohbet"
                        : category,
                  );
                  setPollError("");
                }}
                className={`inline-flex min-h-11 items-center justify-center border px-4 text-xs font-black transition-colors ${focusRing} ${
                  isPollEnabled
                    ? "border-[#ff7a45]/42 bg-[#ff7a45]/10 text-[#ff7a45]"
                    : "border-white/12 hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8"
                }`}
              >
                {isPollEnabled ? "Anketi kaldır" : "Anket ekle"}
              </button>
              </div>

            {isPollEnabled && (
              <div className="mt-4">
                <div className="grid gap-2">
                  {pollOptions.map((option, index) => (
                    <div
                      key={index}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <label
                        htmlFor={`campus-poll-option-${index}`}
                        className="sr-only"
                      >
                        Anket seçeneği {index + 1}
                      </label>
                      <input
                        id={`campus-poll-option-${index}`}
                        type="text"
                        value={option}
                        maxLength={60}
                        aria-invalid={Boolean(pollError)}
                        aria-describedby={
                          pollError ? "campus-poll-error" : undefined
                        }
                        onChange={(event) =>
                          updatePollOption(index, event.target.value)
                        }
                        placeholder={`${index + 1}. seçenek`}
                        className={`min-h-12 min-w-0 flex-1 border border-white/12 bg-white/[0.03] px-3.5 text-sm font-semibold placeholder:text-white/40 ${focusRing}`}
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          aria-label={`${index + 1}. anket seçeneğini kaldır`}
                          onClick={() => removePollOption(index)}
                          className={`grid size-12 shrink-0 place-items-center text-lg font-bold text-[#ffb199] transition-colors hover:bg-[#ffb199]/8 ${focusRing}`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold text-white/55">
                    {pollOptions.length}/4 seçenek
                  </p>
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      className={`inline-flex min-h-11 items-center justify-center px-3 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 ${focusRing}`}
                    >
                      Seçenek ekle
                    </button>
                  )}
                </div>

                {pollError && (
                  <p
                    id="campus-poll-error"
                    role="alert"
                    className="mt-2 text-xs font-semibold text-[#ffb199]"
                  >
                    {pollError}
                  </p>
                )}
              </div>
            )}
            </div>
          )}

          <div className="mt-7 border-t border-white/10 pt-5">
            {isListing ? (
              <div className="flex min-h-16 items-center gap-3 border border-[#ff7a45]/25 bg-[#ff7a45]/6 px-3.5 py-3">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center border border-[#ff7a45]/34 text-sm font-black text-[#ff7a45]"
                >
                  @
                </span>
                <div>
                  <p className="text-xs font-black">Profilinle yayımlanacak</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-white/55">
                    İlanlarda güven ve iletişim için anonim paylaşım kapalıdır.
                  </p>
                </div>
              </div>
            ) : (
              <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 border border-white/12 px-3.5 py-2.5">
                <span>
                  <span className="block text-xs font-black">
                    Anonim paylaş
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-white/55">
                    Adın ve bölüm bilgin gönderide görünmez.
                  </span>
                </span>
                <input
                  type="checkbox"
                  name="anonymous"
                  checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)}
                  className={`size-5 shrink-0 accent-[#ff7a45] ${focusRing}`}
                />
              </label>
            )}
          </div>

          <div
            className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={`min-h-5 text-xs font-semibold ${
                statusTone === "error"
                  ? "text-[#ffb199]"
                  : statusTone === "success"
                    ? "text-[#7fd9a3]"
                    : "text-white/55"
              }`}
            >
              {statusMessage}
            </p>

            <div className="flex shrink-0 gap-2">
              <Link
                href="/akis"
                className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-4 text-xs font-bold text-white/62 transition-colors hover:bg-white/6 hover:text-white ${focusRing}`}
              >
                Vazgeç
              </Link>
              <button
                type="submit"
                disabled={
                  isSubmitting || isProcessingImage || !isHydrated
                }
                className={`inline-flex min-h-11 min-w-28 items-center justify-center bg-white px-5 text-xs font-bold text-[#12100e] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
              >
                {isSubmitting
                  ? isListing
                    ? "İlan yayımlanıyor…"
                    : "Yayımlanıyor…"
                  : isProcessingImage
                    ? "Fotoğraf işleniyor…"
                  : isHydrated
                    ? isListing
                      ? "İlanı yayımla"
                      : "Konuyu yayımla"
                    : "Hazırlanıyor…"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
