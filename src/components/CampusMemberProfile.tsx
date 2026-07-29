"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import { normalizeCampusProfileUsername } from "@/components/CampusAuthorProfileLink";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusFollowConnections from "@/components/CampusFollowConnections";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import {
  campusAdminRoleLabels,
  type CampusManagedUser,
} from "@/data/campusAdmin";
import {
  CAMPUS_OFFICIAL_AUTHOR_ID,
  getCampusPostCommentCount,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusAuthorReference,
  type CampusComment,
  type CampusPost,
} from "@/data/campusPosts";

type MemberProfileTab = "posts" | "comments";
type AuthoredComment = {
  comment: CampusComment;
  post: CampusPost;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-[#5a1f32]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf8f1] dark:focus-visible:ring-[#c7896d]/30 dark:focus-visible:ring-offset-[#17191c]";

function authorMatchesUsername(
  author: CampusAuthorReference,
  username: string,
  currentUsername: string,
) {
  if (isAnonymousCampusAuthor(author)) {
    return false;
  }

  if (author.authorId === LOCAL_ACCOUNT_OWNER_ID) {
    return username === currentUsername;
  }

  if (author.authorId === CAMPUS_OFFICIAL_AUTHOR_ID) {
    return username === "kampus";
  }

  return normalizeCampusProfileUsername(author.author) === username;
}

function getFallbackDisplayName(username: string) {
  return username
    .split(/[._]/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1),
    )
    .join(" ");
}

function getProfileHrefForComment(
  postId: string,
  commentId: string,
) {
  const searchParams = new URLSearchParams({
    hedef: "yorum",
    yorum: commentId,
  });

  return `/gonderi/${postId}?${searchParams.toString()}#yorumlar`;
}

export default function CampusMemberProfile({
  username: usernameParam,
}: {
  username: string;
}) {
  const {
    profile,
    settings,
    sessionMode,
    isHydrated: isAccountHydrated,
  } = useCampusAccount();
  const { posts, isHydrated: isDataHydrated } = useCampusData();
  const {
    blockedUsers,
    blockedAuthorIds,
    managedUsers,
    isHydrated: isModerationHydrated,
  } = useCampusModeration();
  const [activeTab, setActiveTab] =
    useState<MemberProfileTab>("posts");
  const username = normalizeCampusProfileUsername(usernameParam);
  const currentUsername = normalizeCampusProfileUsername(
    profile.username,
  );
  const isSelf =
    sessionMode === "member" && username === currentUsername;
  const isOfficial = username === "kampus";

  const managedUser = useMemo(
    () =>
      managedUsers.find(
        (user) =>
          normalizeCampusProfileUsername(user.author) === username,
      ),
    [managedUsers, username],
  );
  const blockedUser = useMemo(
    () =>
      blockedUsers.find(
        (user) =>
          normalizeCampusProfileUsername(user.author) === username,
      ),
    [blockedUsers, username],
  );
  const firstVisibleReference = (() => {
    for (const post of posts) {
      if (authorMatchesUsername(post, username, currentUsername)) {
        return {
          author: post.author,
          authorId: post.authorId,
          detail: post.detail,
        };
      }

      const comment = post.comments.find((item) =>
        authorMatchesUsername(item, username, currentUsername),
      );

      if (comment) {
        return {
          author: comment.author,
          authorId: comment.authorId,
          detail: undefined,
        };
      }
    }

    return undefined;
  })();
  const resolvedAuthorId =
    isSelf
      ? LOCAL_ACCOUNT_OWNER_ID
      : isOfficial
        ? CAMPUS_OFFICIAL_AUTHOR_ID
        : managedUser?.authorId ??
          blockedUser?.authorId ??
          firstVisibleReference?.authorId;
  const isBlocked = Boolean(
    resolvedAuthorId && blockedAuthorIds.has(resolvedAuthorId),
  );
  const isSuspended = managedUser?.status === "suspended";
  const profileExists =
    isSelf ||
    isOfficial ||
    Boolean(managedUser || blockedUser || firstVisibleReference);

  const authoredPosts = useMemo(
    () =>
      posts
        .filter(
          (post) =>
            !post.isDeleted &&
            authorMatchesUsername(post, username, currentUsername),
        )
        .sort(
          (first, second) =>
            second.createdAt - first.createdAt ||
            second.id.localeCompare(first.id, "tr"),
        ),
    [currentUsername, posts, username],
  );
  const authoredComments = useMemo(
    () =>
      [...posts]
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
                authorMatchesUsername(
                  comment,
                  username,
                  currentUsername,
                ),
            )
            .map((comment) => ({ comment, post })),
        ),
    [currentUsername, posts, username],
  );

  const isHydrated =
    isAccountHydrated && isDataHydrated && isModerationHydrated;

  if (!isHydrated) {
    return <CampusMemberProfileLoading />;
  }

  if (!profileExists) {
    return <ProfileNotFound username={username} />;
  }

  const author =
    isSelf
      ? `@${profile.username}`
      : isOfficial
        ? "KAMPÜS"
        : managedUser?.author ??
          blockedUser?.author ??
          firstVisibleReference?.author ??
          `@${username}`;
  const displayName =
    isSelf
      ? profile.displayName
      : isOfficial
        ? "KAMPÜS"
        : managedUser?.displayName ?? getFallbackDisplayName(username);
  const department =
    isSelf
      ? settings.showDepartment
        ? [profile.department, profile.year].filter(Boolean).join(" · ")
        : ""
      : managedUser?.department ?? firstVisibleReference?.detail ?? "";
  const joinedLabel =
    isSelf
      ? profile.joinedLabel
      : isOfficial
        ? "Resmî topluluk hesabı"
        : managedUser?.joinedLabel ?? "KAMPÜS topluluğu";
  const bio =
    isSelf && profile.bio
      ? profile.bio
      : isOfficial
        ? "Yaşar Üniversitesi öğrencileri için duyuru, güvenlik ve topluluk güncellemeleri."
        : "Yaşar Üniversitesi kampüs topluluğu üyesi.";
  const receivedLikes = authoredPosts.reduce(
    (total, post) => total + post.likes,
    0,
  );

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: MemberProfileTab,
  ) => {
    let nextTab: MemberProfileTab | undefined;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextTab = currentTab === "posts" ? "comments" : "posts";
    } else if (event.key === "Home") {
      nextTab = "posts";
    } else if (event.key === "End") {
      nextTab = "comments";
    }

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    setActiveTab(nextTab);
    document
      .getElementById(`member-profile-${nextTab}-tab`)
      ?.focus();
  };

  return (
    <section
      aria-labelledby="member-profile-title"
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#fbf8f1] text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh"
    >
      <header className="sticky top-16 z-30 border-b border-[#1c2821]/12 bg-[#fbf8f1]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#17191c]/95 md:top-0">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-6">
          <Link
            href="/akis"
            aria-label="Akışa dön"
            className={`grid size-11 place-items-center rounded-full text-[#58635c] transition-colors hover:bg-[#1c2821]/6 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/7 dark:hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>
          <div className="min-w-0 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
              Topluluk profili
            </p>
            <h1
              id="member-profile-title"
              className="mt-0.5 truncate text-xl font-black tracking-[-0.04em]"
            >
              {displayName}
            </h1>
          </div>
          {isSelf ? (
            <Link
              href="/profil"
              className={`inline-flex min-h-11 items-center justify-center justify-self-end px-3 text-xs font-black text-[#7d3c2d] hover:bg-[#5a1f32]/6 dark:text-[#d09272] dark:hover:bg-[#c7896d]/8 ${focusRing}`}
            >
              Profilim
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl">
        <div className="border-b border-[#1c2821]/10 px-4 py-7 dark:border-white/9 sm:px-6 sm:py-9">
          <div className="flex flex-col gap-5 min-[420px]:flex-row min-[420px]:items-start">
            <CampusAuthorAvatar
              author={author}
              authorId={resolvedAuthorId}
              size="md"
              className="size-20 text-xl min-[420px]:size-24 min-[420px]:text-2xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-2xl font-black tracking-[-0.045em] sm:text-3xl">
                      {displayName}
                    </h2>
                    {managedUser?.role &&
                      managedUser.role !== "member" && (
                        <RoleBadge user={managedUser} />
                      )}
                  </div>
                  <p className="mt-1 break-all text-sm font-bold text-[#58635c] dark:text-[#aeb4af]">
                    @{username}
                  </p>
                </div>
                {isOfficial && (
                  <span className="bg-[#52735a]/10 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#31523d] dark:bg-[#8fba9b]/11 dark:text-[#b5d8bd]">
                    Doğrulanmış
                  </span>
                )}
              </div>

              {department && (
                <p className="mt-4 text-sm font-semibold text-[#1c2821]/70 dark:text-white/66">
                  {department}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-[#58635c] dark:text-[#aeb4af]">
                {joinedLabel}
              </p>
              {!isSuspended && !isBlocked && (
                <>
                  <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-[#1c2821]/78 dark:text-white/74">
                    {bio}
                  </p>
                  <CampusFollowConnections
                    member={{
                      authorId:
                        resolvedAuthorId ?? `profile-${username}`,
                      username,
                      author,
                      displayName,
                    }}
                    isSelf={isSelf}
                  />
                </>
              )}
            </div>
          </div>

          {!isSuspended && !isBlocked && (
            <dl className="mt-6 grid grid-cols-3 border-y border-[#1c2821]/10 dark:border-white/9">
              <ProfileStat label="Gönderi" value={authoredPosts.length} />
              <ProfileStat
                label="Yorum"
                value={authoredComments.length}
                bordered
              />
              <ProfileStat label="Beğeni" value={receivedLikes} />
            </dl>
          )}
        </div>

        {isSuspended ? (
          <RestrictedProfileState
            eyebrow="Hesap askıda"
            title="Bu profil şu anda görüntülenemiyor"
            description="Hesap, topluluk kuralları kapsamında moderasyon incelemesine alındı. Gönderi ve yorumları geçici olarak gizleniyor."
          />
        ) : isBlocked ? (
          <RestrictedProfileState
            eyebrow="Engellenen kullanıcı"
            title="Bu kullanıcının içeriklerini gizledin"
            description="Gönderi ve yorumları akışında gösterilmiyor. Engeli hesap ayarlarından kaldırabilirsin."
            actionHref="/ayarlar"
            actionLabel="Engelleri yönet"
          />
        ) : (
          <>
            <div
              role="tablist"
              aria-label={`${displayName} profil içeriği`}
              className="grid grid-cols-2 border-b border-[#1c2821]/11 px-3 py-2 dark:border-white/9 sm:px-6"
            >
              {(
                [
                  ["posts", "Gönderiler", authoredPosts.length],
                  ["comments", "Yorumlar", authoredComments.length],
                ] as const
              ).map(([tab, label, count]) => {
                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    id={`member-profile-${tab}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`member-profile-${tab}-panel`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab)}
                    onKeyDown={(event) =>
                      handleTabKeyDown(event, tab)
                    }
                    className={`min-h-11 px-3 text-xs font-black transition-colors ${focusRing} ${
                      isActive
                        ? "bg-[#5a1f32]/9 text-[#5a1f32] dark:bg-[#c7896d]/12 dark:text-[#e0aa8d]"
                        : "text-[#58635c] hover:bg-[#1c2821]/5 hover:text-[#1c2821] dark:text-[#aeb4af] dark:hover:bg-white/5 dark:hover:text-white"
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 font-mono text-[9px]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTab === "posts" ? (
              <MemberPosts
                displayName={displayName}
                posts={authoredPosts}
              />
            ) : (
              <MemberComments
                comments={authoredComments}
                displayName={displayName}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function MemberPosts({
  displayName,
  posts,
}: {
  displayName: string;
  posts: CampusPost[];
}) {
  return (
    <div
      id="member-profile-posts-panel"
      role="tabpanel"
      aria-labelledby="member-profile-posts-tab"
    >
      {posts.length > 0 ? (
        <ol className="grid px-3 py-3 sm:px-6 sm:py-5">
          {posts.map((post) => (
            <li
              key={post.id}
              className="border-b border-[#1c2821]/11 py-5 last:border-0 dark:border-white/9"
            >
              <CampusPostCardSurface postId={post.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7d3c2d] dark:text-[#d09272]">
                    {post.category}
                  </span>
                  <time className="text-[11px] font-semibold text-[#58635c] dark:text-[#aeb4af]">
                    {post.time}
                    {post.edited ? " · düzenlendi" : ""}
                  </time>
                </div>
                <h3 className="mt-2 break-words text-lg font-black leading-6 tracking-[-0.025em] sm:text-xl">
                  <Link
                    href={`/gonderi/${post.id}`}
                    className={`decoration-[#9a5944]/30 underline-offset-4 hover:text-[#7d3c2d] hover:underline dark:hover:text-[#d09272] ${focusRing}`}
                  >
                    {post.title || "Başlıksız gönderi"}
                  </Link>
                </h3>
                {post.body && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#1c2821]/76 dark:text-white/72">
                    {post.body}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-[#58635c] dark:text-[#aeb4af]">
                  <span>{post.likes} beğeni</span>
                  <span>{getCampusPostCommentCount(post)} yorum</span>
                </div>
              </CampusPostCardSurface>
            </li>
          ))}
        </ol>
      ) : (
        <ProfileEmptyState
          title="Henüz gönderi yok"
          description={`${displayName} kendi adıyla bir gönderi paylaştığında burada görünecek.`}
        />
      )}
    </div>
  );
}

function MemberComments({
  comments,
  displayName,
}: {
  comments: AuthoredComment[];
  displayName: string;
}) {
  return (
    <div
      id="member-profile-comments-panel"
      role="tabpanel"
      aria-labelledby="member-profile-comments-tab"
    >
      {comments.length > 0 ? (
        <ol className="grid px-3 py-3 sm:px-6 sm:py-5">
          {comments.map(({ comment, post }) => (
            <li
              key={`${post.id}-${comment.id}`}
              className="border-b border-[#1c2821]/11 py-5 last:border-0 dark:border-white/9"
            >
              <article>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#58635c] dark:text-[#aeb4af]">
                  {post.title || "Başlıksız gönderi"} · {comment.time}
                </p>
                <blockquote className="mt-2 border-l-3 border-[#9a5944]/38 pl-3 text-sm leading-6 text-[#1c2821]/78 dark:border-[#c7896d]/42 dark:text-white/74">
                  {comment.body}
                </blockquote>
                <Link
                  href={getProfileHrefForComment(post.id, comment.id)}
                  className={`mt-3 inline-flex min-h-11 items-center text-xs font-black text-[#7d3c2d] hover:text-[#5a1f32] dark:text-[#d09272] dark:hover:text-[#e0aa8d] ${focusRing}`}
                >
                  Konuşmaya git
                </Link>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <ProfileEmptyState
          title="Henüz yorum yok"
          description={`${displayName} kendi adıyla bir yorum yazdığında burada görünecek.`}
        />
      )}
    </div>
  );
}

function ProfileStat({
  label,
  value,
  bordered = false,
}: {
  label: string;
  value: number;
  bordered?: boolean;
}) {
  return (
    <div
      className={`py-4 text-center ${
        bordered
          ? "border-x border-[#1c2821]/10 dark:border-white/9"
          : ""
      }`}
    >
      <dd className="text-xl font-black tracking-[-0.04em]">{value}</dd>
      <dt className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.11em] text-[#58635c] dark:text-[#aeb4af]">
        {label}
      </dt>
    </div>
  );
}

function RoleBadge({ user }: { user: CampusManagedUser }) {
  return (
    <span className="bg-[#5a1f32]/9 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.09em] text-[#5a1f32] dark:bg-[#c7896d]/12 dark:text-[#e0aa8d]">
      {campusAdminRoleLabels[user.role]}
    </span>
  );
}

function RestrictedProfileState({
  eyebrow,
  title,
  description,
  actionHref = "/akis",
  actionLabel = "Akışa dön",
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-xl border border-[#1c2821]/13 bg-white/28 p-6 text-center dark:border-white/11 dark:bg-white/[0.02] sm:p-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b2f2a] dark:text-[#e18a7d]">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
          {description}
        </p>
        <Link
          href={actionHref}
          className={`mt-6 inline-flex min-h-11 items-center justify-center border border-[#1c2821]/14 px-4 text-xs font-black hover:bg-[#1c2821]/6 dark:border-white/12 dark:hover:bg-white/7 ${focusRing}`}
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function ProfileNotFound({ username }: { username: string }) {
  return (
    <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#fbf8f1] px-4 py-16 text-[#1c2821] dark:bg-[#17191c] dark:text-[#ece8e1] md:min-h-svh">
      <div className="w-full max-w-lg border border-[#1c2821]/13 bg-white/30 p-6 text-center dark:border-white/11 dark:bg-white/[0.02] sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-[#1c2821]/6 font-serif text-2xl font-black italic text-[#58635c] dark:bg-white/6 dark:text-[#aeb4af]"
        >
          ?
        </span>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#7d3c2d] dark:text-[#c7896d]">
          Profil bulunamadı
        </p>
        <h1 className="mt-2 break-all text-2xl font-black tracking-[-0.045em]">
          @{username || "kullanici"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#58635c] dark:text-[#aeb4af]">
          Bu kullanıcı adıyla görüntülenebilecek bir topluluk profili yok.
        </p>
        <Link
          href="/kesfet"
          className={`mt-6 inline-flex min-h-11 items-center justify-center bg-[#5a1f32] px-5 text-xs font-black text-white hover:bg-[#481527] dark:bg-[#c7896d] dark:text-[#17191c] dark:hover:bg-[#d79a7b] ${focusRing}`}
        >
          Keşfete dön
        </Link>
      </div>
    </section>
  );
}

function ProfileEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-4 py-14 text-center sm:px-6 sm:py-20">
      <span
        aria-hidden="true"
        className="mx-auto block size-3 rotate-45 bg-[#9a5944]/45 dark:bg-[#c7896d]/50"
      />
      <h3 className="mt-4 text-sm font-black">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#58635c] dark:text-[#aeb4af]">
        {description}
      </p>
    </div>
  );
}

export function CampusMemberProfileLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Üye profili yükleniyor"
      className="min-h-[calc(100svh-4rem)] bg-[#fbf8f1] p-4 dark:bg-[#17191c] sm:p-6 md:min-h-svh"
    >
      <div className="h-16 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
      <div className="mt-5 flex gap-5">
        <div className="size-20 shrink-0 animate-pulse rounded-full bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none sm:size-24" />
        <div className="min-w-0 flex-1">
          <div className="h-8 w-48 max-w-full animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
          <div className="mt-3 h-4 w-32 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
          <div className="mt-6 h-14 w-full animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-8 h-64 animate-pulse bg-[#1c2821]/6 dark:bg-white/6 motion-reduce:animate-none" />
    </section>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[18px]"
    >
      <path
        d="m12.5 4.5-5.5 5.5 5.5 5.5M7.3 10h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
