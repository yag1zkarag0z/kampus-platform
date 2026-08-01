"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusFollowConnections from "@/components/CampusFollowConnections";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusPoll from "@/components/CampusPoll";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import CampusPostImage from "@/components/CampusPostImage";
import CampusGif from "@/components/CampusGif";
import {
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusAuthorReference,
} from "@/data/campusPosts";

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#ff7a45]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

type ProfileTab = "topics" | "comments";

function normalizeAuthor(author: string) {
  return author.trim().replace(/^@/, "").toLocaleLowerCase("tr-TR");
}

function isCurrentUserAuthor(author: CampusAuthorReference) {
  const normalizedAuthor = normalizeAuthor(author.author);

  return (
    !isAnonymousCampusAuthor(author) &&
    (author.authorId === LOCAL_ACCOUNT_OWNER_ID ||
      normalizedAuthor === "sen")
  );
}

function getInitials(displayName: string) {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);

  return (
    nameParts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toLocaleUpperCase("tr-TR") || "K"
  );
}

export default function CampusProfile() {
  const {
    profile,
    settings,
    isGuest,
    isHydrated: isAccountHydrated,
  } =
    useCampusAccount();
  const { posts, isHydrated: isDataHydrated } = useCampusData();
  const [activeTab, setActiveTab] = useState<ProfileTab>("topics");

  const authoredTopics = useMemo(
    () =>
      isGuest
        ? []
        : posts
            .filter(
              (post) =>
                !post.isDeleted && isCurrentUserAuthor(post),
            )
            .sort(
              (first, second) =>
                second.createdAt - first.createdAt ||
                second.id.localeCompare(first.id, "tr"),
            ),
    [isGuest, posts],
  );

  const authoredComments = useMemo(
    () =>
      isGuest
        ? []
        : [...posts]
            .sort(
              (first, second) =>
                second.createdAt - first.createdAt ||
                second.id.localeCompare(first.id, "tr"),
            )
            .flatMap((post) =>
              [...post.comments]
                .reverse()
                .filter(
                  (comment) =>
                    !comment.isDeleted &&
                    isCurrentUserAuthor(comment),
                )
                .map((comment) => ({ comment, post })),
            ),
    [isGuest, posts],
  );

  const receivedLikes = authoredTopics.reduce(
    (total, post) => total + post.likes,
    0,
  );
  const isHydrated = isAccountHydrated && isDataHydrated;
  const departmentLine = [profile.department, profile.year]
    .filter(Boolean)
    .join(" · ");

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ProfileTab,
  ) => {
    let nextTab: ProfileTab | undefined;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextTab = currentTab === "topics" ? "comments" : "topics";
    } else if (event.key === "Home") {
      nextTab = "topics";
    } else if (event.key === "End") {
      nextTab = "comments";
    }

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveTab(nextTab);
    document
      .getElementById(
        nextTab === "topics"
          ? "profile-topics-tab"
          : "profile-comments-tab",
      )
      ?.focus();
  };

  if (!isHydrated) {
    return <ProfileLoading />;
  }

  return (
    <section
      aria-labelledby="profile-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 sm:px-6">
          <span aria-hidden="true" />
          <div className="min-w-0 justify-self-center text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
              {isGuest ? "Misafir hesabı" : "Hesabın"}
            </p>
            <h1
              id="profile-title"
              className="mt-0.5 truncate text-xl font-black tracking-[-0.04em]"
            >
              Profil
            </h1>
          </div>

          {isGuest ? (
            <span className="justify-self-end bg-white/7 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-white/55">
              Salt okunur
            </span>
          ) : (
            <Link
              href="/ayarlar"
              aria-label="Hesap ayarlarını aç"
              className={`grid size-11 shrink-0 place-items-center justify-self-end rounded-full text-white/55 transition-colors hover:bg-white/7 hover:text-white ${focusRing}`}
            >
              <SettingsIcon />
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl">
        <div className="px-4 pt-7 pb-6 sm:px-6 sm:pt-9 sm:pb-8">
          <div className="flex flex-col gap-5 min-[400px]:flex-row min-[400px]:items-start">
            <Avatar
              avatarDataUrl={profile.avatarDataUrl}
              displayName={profile.displayName}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-black tracking-[-0.045em] sm:text-3xl">
                    {profile.displayName}
                  </h2>
                  <p className="mt-1 break-all text-sm font-bold text-white/55">
                    @{profile.username}
                  </p>

                  {settings.showDepartment && departmentLine && (
                    <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-white/66">
                      <DepartmentIcon />
                      <span>{departmentLine}</span>
                    </p>
                  )}

                  <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-white/55">
                    <CalendarIcon />
                    <span>{profile.joinedLabel}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-[360px]:flex-row lg:shrink-0">
                  {isGuest ? (
                    <>
                      <Link
                        href="/giris"
                        className={`inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-black text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
                      >
                        Giriş yap
                      </Link>
                      <Link
                        href="/kayit"
                        className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-4 text-xs font-black transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                      >
                        Kayıt ol
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/profil/duzenle"
                        className={`inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-black text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
                      >
                        Profili düzenle
                      </Link>
                      <Link
                        href="/ayarlar"
                        className={`inline-flex min-h-11 items-center justify-center border border-white/12 px-4 text-xs font-black transition-colors hover:border-[#ff7a45]/35 hover:bg-[#ff7a45]/8 ${focusRing}`}
                      >
                        Ayarlar
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {profile.bio ? (
                <p className="mt-5 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-white/78 [overflow-wrap:anywhere]">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
                  Kendinden ve kampüste ilgilendiğin konulardan kısaca
                  bahsedebilirsin.
                </p>
              )}
              {!isGuest && (
                <CampusFollowConnections
                  member={{
                    authorId: LOCAL_ACCOUNT_OWNER_ID,
                    username: normalizeAuthor(profile.username),
                    author: `@${profile.username}`,
                    displayName: profile.displayName,
                  }}
                  isSelf
                />
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-3 border-y border-white/9">
          <ProfileStat label="Konu" value={authoredTopics.length} />
          <ProfileStat label="Yorum" value={authoredComments.length} />
          <ProfileStat label="Beğeni" value={receivedLikes} />
        </dl>

        <div
          role="tablist"
          aria-label="Profil içerikleri"
          className="grid grid-cols-2 border-b border-white/9 px-2 sm:px-4"
        >
          <ProfileTabButton
            id="profile-topics-tab"
            panelId="profile-topics-panel"
            label="Konular"
            count={authoredTopics.length}
            isActive={activeTab === "topics"}
            onClick={() => setActiveTab("topics")}
            onKeyDown={(event) => handleTabKeyDown(event, "topics")}
          />
          <ProfileTabButton
            id="profile-comments-tab"
            panelId="profile-comments-panel"
            label="Yorumlar"
            count={authoredComments.length}
            isActive={activeTab === "comments"}
            onClick={() => setActiveTab("comments")}
            onKeyDown={(event) => handleTabKeyDown(event, "comments")}
          />
        </div>

        {activeTab === "topics" ? (
          <div
            id="profile-topics-panel"
            role="tabpanel"
            aria-labelledby="profile-topics-tab"
            tabIndex={0}
            className={`px-3 py-3 sm:px-5 sm:py-4 ${focusRing}`}
          >
            {authoredTopics.length > 0 ? (
              <ol className="grid min-w-0 2xl:grid-cols-2 2xl:gap-4">
                {authoredTopics.map((post) => (
                  <li
                    key={post.id}
                    className="min-w-0 border-b border-white/8 last:border-b-0 2xl:border 2xl:bg-white/[0.015] 2xl:px-5 2xl:last:border-b"
                  >
                    <CampusPostCardSurface
                      postId={post.id}
                      className="py-5 sm:py-6"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#ff7a45]">
                          {post.category}
                        </span>
                        <span
                          aria-hidden="true"
                          className="size-1 rotate-45 bg-[#ff7a45]/55"
                        />
                        <time className="text-[11px] font-semibold text-white/55">
                          {post.time}
                        </time>
                      </div>

                      <h3 className="mt-2.5 break-words text-lg font-black leading-6 tracking-[-0.025em] [overflow-wrap:anywhere]">
                        <Link
                          href={`/gonderi/${post.id}`}
                          className={`decoration-[#ff7a45]/30 underline-offset-4 transition-colors hover:text-[#ff7a45] hover:underline ${focusRing}`}
                        >
                          {post.title}
                        </Link>
                      </h3>

                      {post.listing && (
                        <CampusListingMeta
                          listing={post.listing}
                          variant="compact"
                        />
                      )}

                      {post.body && (
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/68 [overflow-wrap:anywhere]">
                          {post.body}
                        </p>
                      )}

                      {post.image && (
                        <CampusPostImage
                          image={post.image}
                          variant="compact"
                        />
                      )}
                      {post.gif && <CampusGif gif={post.gif} compact />}
                      {post.poll && (
                        <CampusPoll
                          postId={post.id}
                          poll={post.poll}
                          compact
                        />
                      )}

                      <p className="mt-3 text-xs font-bold text-white/55">
                        {post.likes} beğeni ·{" "}
                        {getCampusPostCommentCount(post)} yorum
                      </p>
                    </CampusPostCardSurface>
                  </li>
                ))}
              </ol>
            ) : (
              <ProfileEmptyState
                title={isGuest ? "Misafir profilinde konu yok" : "Henüz bir konu açmadın"}
                description={
                  isGuest
                    ? "İsimsiz profil yalnızca görüntüleme içindir. Konu açmak için giriş yapabilirsin."
                    : "Kendi kullanıcı adınla açtığın konular burada görünür. Anonim konular profilinle ilişkilendirilmez."
                }
                actionLabel={isGuest ? "Akışa göz at" : "Konu aç"}
                actionHref={isGuest ? "/akis" : "/konu-olustur"}
              />
            )}
          </div>
        ) : (
          <div
            id="profile-comments-panel"
            role="tabpanel"
            aria-labelledby="profile-comments-tab"
            tabIndex={0}
            className={`px-3 py-3 sm:px-5 sm:py-4 ${focusRing}`}
          >
            {authoredComments.length > 0 ? (
              <ol className="grid min-w-0 2xl:grid-cols-2 2xl:gap-4">
                {authoredComments.map(({ comment, post }) => (
                  <li
                    key={comment.id}
                    className="min-w-0 border-b border-white/8 last:border-b-0 2xl:border 2xl:bg-white/[0.015] 2xl:px-5 2xl:last:border-b"
                  >
                    <article className="py-5 sm:py-6">
                      <p className="text-xs font-semibold text-white/55">
                        <Link
                          href={`/gonderi/${post.id}`}
                          className={`font-black text-[#ff7a45] underline decoration-[#ff7a45]/28 underline-offset-4 ${focusRing}`}
                        >
                          {post.title}
                        </Link>{" "}
                        konusuna yorum
                      </p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-white/74 [overflow-wrap:anywhere]">
                        {comment.body}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <time className="text-[11px] font-semibold text-white/55">
                          {comment.time}
                        </time>
                        <Link
                          href={`/gonderi/${post.id}#yorumlar`}
                          className={`inline-flex min-h-11 items-center px-2 text-xs font-black text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 ${focusRing}`}
                        >
                          Yoruma git
                        </Link>
                      </div>
                    </article>
                  </li>
                ))}
              </ol>
            ) : (
              <ProfileEmptyState
                title={isGuest ? "Misafir profilinde yorum yok" : "Henüz bir yorum yazmadın"}
                description={
                  isGuest
                    ? "İsimsiz profil yalnızca görüntüleme içindir. Yorum yapmak için giriş yapabilirsin."
                    : "Kendi kullanıcı adınla yaptığın yorumlar burada görünür. Anonim yorumlar profilinde yer almaz."
                }
                actionLabel="Akışa göz at"
                actionHref="/akis"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Avatar({
  avatarDataUrl,
  displayName,
}: {
  avatarDataUrl?: string;
  displayName: string;
}) {
  return (
    <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-white/11 bg-[#22252a] text-2xl font-black text-[#ff7a45] sm:size-28">
      {avatarDataUrl ? (
        <Image
          src={avatarDataUrl}
          alt={`${displayName} profil fotoğrafı`}
          fill
          sizes="(min-width: 640px) 112px, 96px"
          unoptimized
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(displayName)}</span>
      )}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border-r border-white/8 px-2 py-4 text-center last:border-r-0 sm:py-5">
      <dd className="truncate text-lg font-black tracking-[-0.03em] sm:text-xl">
        {value.toLocaleString("tr-TR")}
      </dd>
      <dt className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/55 sm:text-[11px]">
        {label}
      </dt>
    </div>
  );
}

function ProfileTabButton({
  id,
  panelId,
  label,
  count,
  isActive,
  onClick,
  onKeyDown,
}: {
  id: string;
  panelId: string;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-controls={panelId}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`relative inline-flex min-h-14 items-center justify-center gap-2 px-2 text-xs font-black transition-colors sm:text-sm ${
        isActive
          ? "text-[#ff7a45] after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-[#ff7a45]"
          : "text-white/55 hover:text-white"
      } ${focusRing}`}
    >
      {label}
      <span className="font-mono text-[10px] text-white/55">
        {count}
      </span>
    </button>
  );
}

function ProfileEmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="grid min-h-80 place-items-center px-3 py-14 text-center">
      <div className="max-w-md">
        <span
          aria-hidden="true"
          className="mx-auto grid size-12 place-items-center rounded-full border border-white/11 text-[#ff7a45]"
        >
          <DocumentIcon />
        </span>
        <h2 className="mt-5 text-lg font-black tracking-[-0.03em]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          {description}
        </p>
        <Link
          href={actionHref}
          className={`mt-6 inline-flex min-h-11 items-center justify-center bg-white px-4 text-xs font-black text-[#12100e] transition-colors hover:bg-white/90 ${focusRing}`}
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function ProfileLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Profil yükleniyor"
      className="min-h-[calc(100svh-4rem)] bg-[#0a0d16] text-white md:min-h-svh"
    >
      <div className="flex min-h-16 items-center border-b border-white/10 px-4 sm:px-6">
        <div className="h-5 w-20 animate-pulse bg-white/8 motion-reduce:animate-none" />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-start gap-5">
          <div className="size-24 shrink-0 animate-pulse rounded-full bg-white/8 motion-reduce:animate-none sm:size-28" />
          <div className="w-full max-w-lg">
            <div className="h-7 w-44 animate-pulse bg-white/8 motion-reduce:animate-none" />
            <div className="mt-3 h-4 w-28 animate-pulse bg-white/7 motion-reduce:animate-none" />
            <div className="mt-7 h-4 w-full animate-pulse bg-white/7 motion-reduce:animate-none" />
            <div className="mt-2 h-4 w-3/4 animate-pulse bg-white/7 motion-reduce:animate-none" />
          </div>
        </div>
        <span className="sr-only">Profil yükleniyor…</span>
      </div>
    </section>
  );
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06-2.12 2.12-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.64v.1h-3v-.1a1.8 1.8 0 0 0-1.1-1.64 1.8 1.8 0 0 0-2 .36l-.06.06-2.12-2.12.06-.06a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 5 13.9h-.1v-3H5a1.8 1.8 0 0 0 1.64-1.1 1.8 1.8 0 0 0-.36-2l-.06-.06 2.12-2.12.06.06a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 11.5 4.4v-.1h3v.1a1.8 1.8 0 0 0 1.1 1.64 1.8 1.8 0 0 0 2-.36l.06-.06 2.12 2.12-.06.06a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.64 1.1h.1v3H21A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

function DepartmentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-4 shrink-0"
    >
      <path d="m2.5 7.2 7.5-4 7.5 4-7.5 4-7.5-4Z" />
      <path d="M5.5 9v4.3c2.6 2 6.4 2 9 0V9M17.5 7.2v5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <rect x="3" y="4.5" width="14" height="12" rx="1.5" />
      <path d="M6.5 2.8v3.4M13.5 2.8v3.4M3 8h14" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M5 2.8h6l4 4v10.4H5V2.8Z" />
      <path d="M11 2.8v4h4M7.5 10h5M7.5 13h5" />
    </svg>
  );
}
