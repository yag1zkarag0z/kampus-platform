"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import { campusButton } from "@/components/campusButtonStyles";
import { useFeedback } from "@/components/FeedbackProvider";
import CampusAuthorAvatar from "@/components/CampusAuthorAvatar";
import CampusHiddenNotice from "@/components/CampusHiddenNotice";
import CampusLogo from "@/components/CampusLogo";
import {
  campusCategoryBadgeBase,
  campusCategoryStyles,
} from "@/data/campusCategoryStyles";
import { normalizeCampusProfileUsername } from "@/components/CampusAuthorProfileLink";
import { useCampusData } from "@/components/CampusDataProvider";
import CampusFollowConnections from "@/components/CampusFollowConnections";
import { useCampusModeration } from "@/components/CampusModerationProvider";
import CampusPostCardSurface from "@/components/CampusPostCardSurface";
import { useCampusPostQuery } from "@/components/useCampusPostQuery";
import {
  campusAdminRoleLabels,
  type CampusAdminRole,
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
import { campusFollowMembers } from "@/data/campusFollows";

type MemberProfileTab = "posts" | "comments";
type AuthoredComment = {
  comment: CampusComment;
  post: CampusPost;
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0d16]";

function authorMatchesUsername(
  author: CampusAuthorReference,
  username: string,
  currentUsername: string,
  expectedAuthorId?: string,
) {
  if (isAnonymousCampusAuthor(author)) {
    return false;
  }

  if (expectedAuthorId && author.authorId === expectedAuthorId) {
    return true;
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
  const suggestedMember = useMemo(
    () =>
      campusFollowMembers.find(
        (member) =>
          normalizeCampusProfileUsername(member.username) === username,
      ),
    [username],
  );
  const suggestedAuthorId = suggestedMember?.authorId;
  const isSelf =
    sessionMode === "member" && username === currentUsername;
  const isOfficial = username === "kampus";

  const managedUser = useMemo(
    () =>
      managedUsers.find(
        (user) =>
          normalizeCampusProfileUsername(user.username) === username,
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
      if (
        authorMatchesUsername(
          post,
          username,
          currentUsername,
          suggestedAuthorId,
        )
      ) {
        return {
          author: post.author,
          authorId: post.authorId,
          detail: post.detail,
        };
      }

      const comment = post.comments.find((item) =>
        authorMatchesUsername(
          item,
          username,
          currentUsername,
          suggestedAuthorId,
        ),
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
        : managedUser?.id ??
          blockedUser?.authorId ??
          suggestedAuthorId ??
          firstVisibleReference?.authorId;
  const isBlocked = Boolean(
    resolvedAuthorId && blockedAuthorIds.has(resolvedAuthorId),
  );
  const isSuspended = managedUser?.status === "suspended";
  const profileExists =
    isSelf ||
    isOfficial ||
    Boolean(
      managedUser ||
        blockedUser ||
        suggestedMember ||
        firstVisibleReference,
    );

  // Profil gönderileri artık genel akışa yüklenmiş olanlardan süzülmüyor;
  // sunucudaki author filtresiyle kendi sayfalamasını yapıyor.
  const {
    posts: authoredPosts,
    isLoading: isAuthoredPostsLoading,
    hasMore: hasMoreAuthoredPosts,
    isLoadingMore: isLoadingMoreAuthoredPosts,
    loadMore: loadMoreAuthoredPosts,
  } = useCampusPostQuery({
    author: username,
    enabled: sessionMode === "member" && !isBlocked && !isSuspended,
  });
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
                  suggestedAuthorId,
                ),
            )
            .map((comment) => ({ comment, post })),
        ),
    [currentUsername, posts, suggestedAuthorId, username],
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
        : (managedUser && `@${managedUser.username}`) ??
          blockedUser?.author ??
          suggestedMember?.author ??
          firstVisibleReference?.author ??
          `@${username}`;
  const displayName =
    isSelf
      ? profile.displayName
      : isOfficial
        ? "KAMPÜS"
        : managedUser?.displayName ??
          suggestedMember?.displayName ??
          getFallbackDisplayName(username);
  const department =
    isSelf
      ? settings.showDepartment
        ? [profile.department, profile.year].filter(Boolean).join(" · ")
        : ""
      : managedUser?.department ??
        suggestedMember?.detail ??
        firstVisibleReference?.detail ??
        "";
  const joinedLabel =
    isSelf
      ? profile.joinedLabel
      : isOfficial
        ? "Resmî topluluk hesabı"
        : managedUser?.joinedLabel ??
          suggestedMember?.joinedLabel ??
          "KAMPÜS topluluğu";
  const bio =
    isSelf && profile.bio
      ? profile.bio
      : isOfficial
        ? "Yaşar Üniversitesi öğrencileri için duyuru, güvenlik ve topluluk güncellemeleri."
        : suggestedMember?.bio ??
          "Yaşar Üniversitesi kampüs topluluğu üyesi.";
  const receivedLikes = authoredPosts.reduce(
    (total: number, post: CampusPost) => total + post.likes,
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
      className="min-h-[calc(100svh-4rem)] min-w-0 bg-[#0a0d16] text-white md:min-h-svh"
    >
      <header className="sticky top-0 z-30 border-b border-white/12 bg-[#0a0d16]/95 backdrop-blur-xl">
        <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-6">
          <Link
            href="/akis"
            aria-label="Akışa dön"
            className={`grid size-11 place-items-center rounded-full text-white/55 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
          >
            <BackIcon />
          </Link>
          <div className="min-w-0 text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
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
              className={`inline-flex min-h-11 items-center justify-center justify-self-end px-3 text-xs font-black text-[#ff7a45] hover:bg-[#ff7a45]/8 ${focusRing}`}
            >
              Profilim
            </Link>
          ) : sessionMode === "member" && resolvedAuthorId ? (
            <MemberProfileActions
              authorId={resolvedAuthorId}
              author={author}
              displayName={displayName}
              isBlocked={isBlocked}
            />
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl">
        {/* Kapak alanı: kullanıcıya ait veri değil, her profilde aynı. */}
        <div
          aria-hidden="true"
          className="grid h-28 w-full place-items-center overflow-hidden border-b border-white/10 bg-[#12151d] sm:h-40"
        >
          <CampusLogo
            idPrefix="member-profile-cover-lockup"
            wordmarkClassName="text-3xl sm:text-4xl"
          />
        </div>

        <div className="border-b border-white/12 px-4 pb-7 sm:px-6 sm:pb-9">
          <div className="-mt-12 flex flex-col gap-5 min-[420px]:flex-row min-[420px]:items-start sm:-mt-16">
            <span className="inline-flex shrink-0 rounded-full ring-4 ring-[#0a0d16]">
              <CampusAuthorAvatar
                author={author}
                authorId={resolvedAuthorId}
                avatarUrl={
                  isSelf
                    ? profile.avatarUrl
                    : managedUser?.avatarUrl ?? suggestedMember?.avatarDataUrl
                }
                size="md"
                className="size-20 text-xl min-[420px]:size-24 min-[420px]:text-2xl"
              />
            </span>
            <div className="min-w-0 flex-1 min-[420px]:pt-14 sm:pt-[4.5rem]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-2xl font-black tracking-[-0.045em] sm:text-3xl">
                      {displayName}
                    </h2>
                    {managedUser?.role &&
                      managedUser.role !== "member" && (
                        <RoleBadge role={managedUser.role} />
                      )}
                  </div>
                  <p className="mt-1 break-all text-sm font-bold text-white/55">
                    @{username}
                  </p>
                </div>
                {isOfficial && (
                  <span className="bg-[#8fba9b]/12 px-2.5 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#b5d8bd]">
                    Doğrulanmış
                  </span>
                )}
              </div>

              {department && (
                <p className="mt-4 text-sm font-semibold text-white/68">
                  {department}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-white/55">
                {joinedLabel}
              </p>
              {!isSuspended && !isBlocked && (
                <>
                  <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-white/70">
                    {bio}
                  </p>
                  <CampusFollowConnections
                    member={{
                      authorId:
                        resolvedAuthorId ?? `profile-${username}`,
                      username,
                      author,
                      displayName,
                      detail: department || undefined,
                      avatarDataUrl:
                        managedUser?.avatarUrl ??
                        suggestedMember?.avatarDataUrl ??
                        undefined,
                    }}
                    isSelf={isSelf}
                  />
                </>
              )}
            </div>
          </div>

          {!isSuspended && !isBlocked && (
            <dl className="mt-6 grid grid-cols-3 border-y border-white/12">
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
              className="grid grid-cols-2 border-b border-white/12 px-3 py-2 sm:px-6"
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
                        ? "bg-[#ff7a45]/12 text-[#ff7a45]"
                        : "text-white/55 hover:bg-white/8 hover:text-white"
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
                isLoading={isAuthoredPostsLoading}
                hasMore={hasMoreAuthoredPosts}
                isLoadingMore={isLoadingMoreAuthoredPosts}
                onLoadMore={() =>
                  void loadMoreAuthoredPosts().catch(() => undefined)
                }
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

/**
 * Engelleme kişi düzeyinde bir eylem; doğal yeri profilin sağ üstü. Yıkıcı
 * olduğu için birincil butonun yanında düz durmuyor, menünün arkasında.
 */
function MemberProfileActions({
  authorId,
  author,
  displayName,
  isBlocked,
}: {
  authorId: string;
  author: string;
  displayName: string;
  isBlocked: boolean;
}) {
  const router = useRouter();
  const { blockUser, unblockUser } = useCampusModeration();
  const { showToast } = useFeedback();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const toggleBlock = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const changed = isBlocked
        ? await unblockUser(authorId)
        : await blockUser(authorId, author);

      if (!changed) {
        showToast({
          message: "İşlem şu anda tamamlanamadı. Tekrar dene.",
          tone: "error",
        });
        return;
      }

      setIsOpen(false);
      showToast({
        message: isBlocked
          ? `${displayName} engeli kaldırıldı.`
          : `${displayName} engellendi.`,
        tone: "success",
      });

      // Engellenen profil artık görüntülenemiyor; kullanıcıyı burada bırakma.
      if (!isBlocked) {
        router.push("/akis");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div ref={menuRef} className="relative justify-self-end">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${displayName} için işlemler`}
        onClick={() => setIsOpen((open) => !open)}
        className={`grid size-11 place-items-center rounded-full text-white/62 transition-colors hover:bg-white/8 hover:text-white ${focusRing}`}
      >
        <BlockIcon />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-56 border border-white/12 bg-[#141720] py-1 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        >
          <button
            type="button"
            role="menuitem"
            disabled={isSubmitting}
            onClick={() => void toggleBlock()}
            className={`flex min-h-11 w-full items-center px-4 text-left text-xs font-bold text-[#ff7a45] transition-colors hover:bg-[#ff7a45]/8 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
          >
            {isBlocked ? "Engeli kaldır" : "Engelle"}
          </button>
        </div>
      )}
    </div>
  );
}

function MemberPosts({
  displayName,
  posts,
  isLoading,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: {
  displayName: string;
  posts: CampusPost[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (isLoading) {
    return (
      <div
        id="member-profile-posts-panel"
        role="tabpanel"
        aria-labelledby="member-profile-posts-tab"
        aria-busy="true"
        className="grid min-h-40 place-items-center px-4 py-10 text-center"
      >
        <p className="text-sm font-bold text-white/60">
          Gönderiler yükleniyor…
        </p>
      </div>
    );
  }

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
              className="border-b border-white/12 py-5 last:border-0"
            >
              <CampusPostCardSurface postId={post.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
              className={`${campusCategoryBadgeBase} ${campusCategoryStyles[post.category].badge}`}
            >
              <span aria-hidden="true">
                {campusCategoryStyles[post.category].glyph}
              </span>
              {post.category}
            </span>
                  <time className="text-[11px] font-semibold text-white/55">
                    {post.time}
                    {post.edited ? " · düzenlendi" : ""}
                  </time>
                </div>
                <h3 className="mt-2 break-words text-lg font-black leading-6 tracking-[-0.025em] sm:text-xl">
                  <Link
                    href={`/gonderi/${post.id}`}
                    className={`decoration-[#ff7a45]/30 underline-offset-4 hover:text-[#ff7a45] hover:underline ${focusRing}`}
                  >
                    {post.title || "Başlıksız gönderi"}
                  </Link>
                </h3>
                {post.body && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-white/72">
                    {post.body}
                  </p>
                )}
                {post.isHidden && <CampusHiddenNotice compact />}
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-white/55">
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

      {hasMore && (
        <div className="px-4 pb-6 text-center sm:px-6">
          <button
            type="button"
            aria-label="Daha fazla gönderi yükle"
            aria-busy={isLoadingMore}
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className={campusButton.secondary}
          >
            {isLoadingMore
              ? "Gönderiler yükleniyor…"
              : "Daha fazla gönderi yükle"}
          </button>
        </div>
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
              className="border-b border-white/12 py-5 last:border-0"
            >
              <article>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                  {post.title || "Başlıksız gönderi"} · {comment.time}
                </p>
                <blockquote className="mt-2 border-l-3 border-[#ff7a45]/40 pl-3 text-sm leading-6 text-white/70">
                  {comment.body}
                </blockquote>
                <Link
                  href={getProfileHrefForComment(post.id, comment.id)}
                  className={`mt-3 inline-flex min-h-11 items-center text-xs font-black text-[#ff7a45] hover:text-[#ff7a45]/80 ${focusRing}`}
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
          ? "border-x border-white/12"
          : ""
      }`}
    >
      <dd className="text-xl font-black tracking-[-0.04em]">{value}</dd>
      <dt className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.11em] text-white/55">
        {label}
      </dt>
    </div>
  );
}

function RoleBadge({ role }: { role: CampusAdminRole }) {
  return (
    <span className="bg-[#ff7a45]/12 px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.09em] text-[#ff7a45]">
      {campusAdminRoleLabels[role]}
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
      <div className="mx-auto max-w-xl border border-white/12 bg-[#141720] p-6 text-center sm:p-8">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ffb199]">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-black tracking-[-0.04em]">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
          {description}
        </p>
        <Link
          href={actionHref}
          className={`mt-6 ${campusButton.secondary} `}
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function ProfileNotFound({ username }: { username: string }) {
  return (
    <section className="grid min-h-[calc(100svh-4rem)] place-items-center bg-[#0a0d16] px-4 py-16 text-white md:min-h-svh">
      <div className="w-full max-w-lg border border-white/12 bg-[#141720] p-6 text-center sm:p-8">
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-full bg-white/8 font-serif text-2xl font-black italic text-white/55"
        >
          ?
        </span>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#ff7a45]">
          Profil bulunamadı
        </p>
        <h1 className="mt-2 break-all text-2xl font-black tracking-[-0.045em]">
          @{username || "kullanici"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
          Bu kullanıcı adıyla görüntülenebilecek bir topluluk profili yok.
        </p>
        <Link
          href="/kesfet"
          className={`mt-6 inline-flex min-h-11 items-center justify-center bg-white px-5 text-xs font-black text-[#12100e] hover:bg-white/90 ${focusRing}`}
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
        className="mx-auto block size-3 rotate-45 bg-[#ff7a45]/50"
      />
      <h3 className="mt-4 text-sm font-black">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-white/55">
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
      className="min-h-[calc(100svh-4rem)] bg-[#0a0d16] p-4 sm:p-6 md:min-h-svh"
    >
      <div className="h-16 animate-pulse bg-white/8 motion-reduce:animate-none" />
      <div className="mt-5 flex gap-5">
        <div className="size-20 shrink-0 animate-pulse rounded-full bg-white/8 motion-reduce:animate-none sm:size-24" />
        <div className="min-w-0 flex-1">
          <div className="h-8 w-48 max-w-full animate-pulse bg-white/8 motion-reduce:animate-none" />
          <div className="mt-3 h-4 w-32 animate-pulse bg-white/8 motion-reduce:animate-none" />
          <div className="mt-6 h-14 w-full animate-pulse bg-white/8 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-8 h-64 animate-pulse bg-white/8 motion-reduce:animate-none" />
    </section>
  );
}

function BlockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="size-[18px]"
    >
      <circle
        cx="10"
        cy="10"
        r="6.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m5.3 5.3 9.4 9.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
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
