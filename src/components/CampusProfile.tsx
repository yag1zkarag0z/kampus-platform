"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusButton } from "@/components/campusButtonStyles";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusFollowConnections from "@/components/CampusFollowConnections";
import CampusListingMeta from "@/components/CampusListingMeta";
import CampusProfileHero from "@/components/CampusProfileHero";
import CampusPoll from "@/components/CampusPoll";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
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
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        {/* X'teki gibi sola yaslı: ad ve altında gönderi sayısı. */}
        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1
              id="profile-title"
              className="truncate text-xl font-black tracking-[-0.04em]"
            >
              {isGuest ? "Misafir hesabı" : profile.displayName}
            </h1>
            <p className="truncate text-xs font-semibold text-white/55">
              {authoredTopics.length} gönderi
            </p>
          </div>

          {isGuest ? (
            <span className="justify-self-end bg-orange/7 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-white/55">
              Misafir Girişi
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

      <CampusProfileHero
        coverIdPrefix="profile-cover-lockup"
        author={`@${profile.username}`}
        authorId={LOCAL_ACCOUNT_OWNER_ID}
        avatarUrl={profile.avatarUrl}
        displayName={profile.displayName}
        username={profile.username}
        bio={profile.bio}
        bioFallback="Kendinden ve kampüste ilgilendiğin konulardan kısaca bahsedebilirsin."
        department={
          settings.showDepartment && departmentLine ? departmentLine : null
        }
        joinedLabel={profile.joinedLabel}
        actions={
          isGuest ? (
            <>
              <Link href="/giris" className={campusButton.primary}>
                Giriş yap
              </Link>
              <Link href="/kayit" className={campusButton.secondary}>
                Kayıt ol
              </Link>
            </>
          ) : (
            <Link href="/profil/duzenle" className={campusButton.secondary}>
              Profili düzenle
            </Link>
          )
        }
        stats={[
          { label: "Gönderi", value: authoredTopics.length },
          { label: "Yorum", value: authoredComments.length },
          { label: "Beğeni", value: receivedLikes },
        ]}
      >
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
      </CampusProfileHero>

      <div className="mx-auto w-full max-w-6xl">
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
                        <span
              className={`${campusCategoryBadgeBase} ${campusCategoryStyles[post.category].badge}`}
            >
              <span aria-hidden="true">
                {campusCategoryStyles[post.category].glyph}
              </span>
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
          className={`mt-6 ${campusButton.primary} `}
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
