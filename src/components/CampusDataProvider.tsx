"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  campusPosts,
  guestCampusPosts,
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusPost,
  type CampusGif,
  type CampusPostCategory,
  type CampusPostImage,
  type CampusPostListing,
  type CampusPostPoll,
} from "@/data/campusPosts";
import { AuthClientError } from "@/auth/client";
import {
  createContentComment as createContentCommentRequest,
  createContentPost as createContentPostRequest,
  deleteContentComment as deleteContentCommentRequest,
  deleteContentPost as deleteContentPostRequest,
  getContentPost as getContentPostRequest,
  listContentPosts as listContentPostsRequest,
  setContentCommentLike as setContentCommentLikeRequest,
  setContentPostBookmark as setContentPostBookmarkRequest,
  setContentPostLike as setContentPostLikeRequest,
  voteInContentPoll as voteInContentPollRequest,
  updateContentComment as updateContentCommentRequest,
  updateContentPost as updateContentPostRequest,
  type CoreContentPostCategory,
} from "@/content/client";
import {
  appendUniqueCampusPosts,
  getUsablePageCursor,
  toCampusComment,
  toCampusPost,
  toContentCategory,
} from "@/content/adapter";
import {
  CAMPUS_POST_BODY_MAX_LENGTH,
  CAMPUS_POST_TITLE_MAX_LENGTH,
} from "@/data/campusContentRules";
import { useCampusAccount } from "@/components/CampusAccountProvider";
import { useCampusModeration } from "@/components/CampusModerationProvider";

const STORAGE_KEY = "kampus-posts-v2";
const guestPreviewPosts = guestCampusPosts;
const validCategories = new Set<CampusPostCategory>([
  "Sohbet",
  "İtiraf",
  "Soru",
  "Etkinlik",
  "Kayıp Eşya",
  "Anket",
  "İlan",
]);
const validListingTypes = new Set<CampusPostListing["type"]>([
  "Satılık",
  "Aranıyor",
  "Ücretsiz",
]);
const validListingConditions = new Set<CampusPostListing["condition"]>([
  "Yeni",
  "Az kullanılmış",
  "Kullanılmış",
]);

const listingTypeValues = {
  "Satılık": "sale",
  "Aranıyor": "wanted",
  "Ücretsiz": "free",
} as const;

const listingConditionValues = {
  Yeni: "new",
  "Az kullanılmış": "lightly_used",
  Kullanılmış: "used",
} as const;

export type CreateCampusPostInput = {
  title?: string;
  body: string;
  category: CampusPostCategory;
  isAnonymous: boolean;
  imageId?: string;
  gif?: CampusGif;
  pollOptions?: string[];
  listing?: CampusPostListing;
};

export type AddCampusCommentInput = {
  body: string;
  isAnonymous: boolean;
  parentId?: string;
  gif?: CampusGif;
};

export type UpdateCampusPostInput = {
  title: string;
  body: string;
};

type CampusFeedScope = "global" | "following";

type CampusDataContextValue = {
  posts: CampusPost[];
  isHydrated: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  feedScope: CampusFeedScope;
  setFeedScope: (scope: CampusFeedScope) => void;
  createPost: (input: CreateCampusPostInput) => Promise<string>;
  toggleLike: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  voteInPoll: (postId: string, optionId: string) => void;
  addComment: (
    postId: string,
    input: AddCampusCommentInput,
  ) => Promise<void>;
  updatePost: (
    postId: string,
    input: UpdateCampusPostInput,
  ) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
  updateComment: (
    postId: string,
    commentId: string,
    body: string,
  ) => Promise<boolean>;
  deleteComment: (
    postId: string,
    commentId: string,
  ) => Promise<boolean>;
  loadPostDetail: (postId: string) => Promise<boolean>;
  /**
   * Başka bir sorgudan (ör. Keşfet araması) gelen gönderileri ağ isteği
   * atmadan paylaşılan listeye ekler. `toggleLike`/`toggleBookmark` yalnızca
   * bu listede bulunan gönderiler için çalışır; kayıtlı olmayan bir gönderi
   * üzerinde beğeni/kaydetme sessizce hiçbir şey yapmaz.
   */
  registerPosts: (posts: CampusPost[]) => void;
  moderateDeletePost: (postId: string) => boolean;
  moderateDeleteComment: (
    postId: string,
    commentId: string,
  ) => boolean;
  renameAuthoredContent: (
    previousUsername: string,
    nextUsername: string,
  ) => void;
  resetCampusData: () => void;
};

const CampusDataContext = createContext<CampusDataContextValue | undefined>(
  undefined,
);

function clonePosts(posts: CampusPost[]) {
  return posts.map((post) => ({
    ...post,
    image: post.image ? { ...post.image } : undefined,
    poll: post.poll
      ? {
          ...post.poll,
          options: post.poll.options.map((option) => ({ ...option })),
        }
      : undefined,
    listing: post.listing ? { ...post.listing } : undefined,
    comments: post.comments.map((comment) => ({ ...comment })),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStoredComment(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.author === "string" &&
    (value.authorId === undefined || typeof value.authorId === "string") &&
    (value.isAnonymous === undefined ||
      typeof value.isAnonymous === "boolean") &&
    (value.parentId === undefined || typeof value.parentId === "string") &&
    (value.edited === undefined || typeof value.edited === "boolean") &&
    (value.isDeleted === undefined ||
      typeof value.isDeleted === "boolean") &&
    typeof value.body === "string" &&
    typeof value.time === "string"
  );
}

function isStoredPostImage(value: unknown): value is CampusPostImage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.src === "string" &&
    (value.src.startsWith("data:image/") ||
      value.src.startsWith("/images/campus-feed/")) &&
    typeof value.width === "number" &&
    Number.isInteger(value.width) &&
    value.width > 0 &&
    typeof value.height === "number" &&
    Number.isInteger(value.height) &&
    value.height > 0 &&
    typeof value.alt === "string"
  );
}

function isStoredPostPoll(value: unknown): value is CampusPostPoll {
  if (!isRecord(value) || !Array.isArray(value.options)) {
    return false;
  }

  const optionIds = new Set<string>();
  const hasValidOptions =
    value.options.length >= 2 &&
    value.options.length <= 4 &&
    value.options.every((option) => {
      if (
        !isRecord(option) ||
        typeof option.id !== "string" ||
        option.id.length === 0 ||
        optionIds.has(option.id) ||
        typeof option.text !== "string" ||
        option.text.trim().length === 0 ||
        option.text.length > 60 ||
        typeof option.votes !== "number" ||
        !Number.isInteger(option.votes) ||
        option.votes < 0
      ) {
        return false;
      }

      optionIds.add(option.id);
      return true;
    });

  return (
    hasValidOptions &&
    (value.selectedOptionId === undefined ||
      (typeof value.selectedOptionId === "string" &&
        optionIds.has(value.selectedOptionId)))
  );
}

function isStoredPostListing(value: unknown): value is CampusPostListing {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    validListingTypes.has(value.type as CampusPostListing["type"]) &&
    typeof value.condition === "string" &&
    validListingConditions.has(
      value.condition as CampusPostListing["condition"],
    ) &&
    typeof value.price === "number" &&
    Number.isInteger(value.price) &&
    value.price >= 0 &&
    value.price <= 1_000_000 &&
    (value.type === "Ücretsiz"
      ? value.price === 0
      : value.price > 0)
  );
}

function isStoredPost(value: unknown): value is CampusPost {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.author === "string" &&
    (value.authorId === undefined || typeof value.authorId === "string") &&
    (value.isAnonymous === undefined ||
      typeof value.isAnonymous === "boolean") &&
    (value.edited === undefined || typeof value.edited === "boolean") &&
    (value.isDeleted === undefined ||
      typeof value.isDeleted === "boolean") &&
    (value.detail === undefined || typeof value.detail === "string") &&
    typeof value.category === "string" &&
    validCategories.has(value.category as CampusPostCategory) &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    (value.image === undefined || isStoredPostImage(value.image)) &&
    (value.poll === undefined || isStoredPostPoll(value.poll)) &&
    (value.listing === undefined ||
      isStoredPostListing(value.listing)) &&
    ((value.category === "İlan") ===
      (value.listing !== undefined)) &&
    !(value.listing !== undefined && value.poll !== undefined) &&
    !(
      value.listing !== undefined &&
      (value.isAnonymous === true ||
        (typeof value.author === "string" &&
          value.author.trim().toLocaleLowerCase("tr-TR") === "anonim"))
    ) &&
    (value.category !== "Anket" || value.poll !== undefined) &&
    typeof value.time === "string" &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    typeof value.likes === "number" &&
    Number.isFinite(value.likes) &&
    value.likes >= 0 &&
    typeof value.liked === "boolean" &&
    Array.isArray(value.comments) &&
    value.comments.every(isStoredComment) &&
    typeof value.bookmarked === "boolean"
  );
}

function isStoredPosts(value: unknown): value is CampusPost[] {
  return Array.isArray(value) && value.every(isStoredPost);
}

function getLatestCreatedAt(posts: CampusPost[]) {
  return posts.reduce(
    (latest, post) => Math.max(latest, post.createdAt),
    0,
  );
}

function migrateLegacyOwnership(posts: CampusPost[]) {
  return posts.map((post) => {
    const isAnonymous = isAnonymousCampusAuthor(post);

    return {
      ...post,
      category: post.poll
        ? "Anket"
        : post.listing
          ? "İlan"
          : post.category,
      author: isAnonymous ? "Anonim" : post.author,
      isAnonymous,
      detail: isAnonymous ? undefined : post.detail,
      authorId:
        post.authorId ??
        (post.author === "@sen" ? LOCAL_ACCOUNT_OWNER_ID : undefined),
      comments: post.comments.map((comment) => {
        const isAnonymousComment =
          isAnonymousCampusAuthor(comment);

        return {
          ...comment,
          author: isAnonymousComment ? "Anonim" : comment.author,
          isAnonymous: isAnonymousComment,
          authorId:
            comment.authorId ??
            (comment.author === "@sen"
              ? LOCAL_ACCOUNT_OWNER_ID
              : undefined),
        };
      }),
    };
  });
}

export function CampusDataProvider({ children }: { children: ReactNode }) {
  const {
    accountId,
    profile,
    settings,
    isGuest,
    sessionMode,
    role,
    retrySession,
  } = useCampusAccount();
  const { blockedAuthorIds, managedUsers } = useCampusModeration();
  const [posts, setPostsState] = useState<CampusPost[]>(() =>
    clonePosts(campusPosts),
  );
  const postsRef = useRef(posts);
  const [isHydrated, setIsHydrated] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedScope, setFeedScope] = useState<CampusFeedScope>("global");
  const isLoadingMoreRef = useRef(false);
  const feedRequestVersionRef = useRef(0);
  const interactionVersionsRef = useRef(new Map<string, number>());
  const latestCreatedAtRef = useRef(getLatestCreatedAt(campusPosts));
  const replacePosts = useCallback((nextPosts: CampusPost[]) => {
    postsRef.current = nextPosts;
    setPostsState(nextPosts);
  }, []);
  const updatePosts = useCallback(
    (updater: (currentPosts: CampusPost[]) => CampusPost[]) => {
      replacePosts(updater(postsRef.current));
    },
    [replacePosts],
  );

  useEffect(() => {
    let isCancelled = false;
    const requestVersion = ++feedRequestVersionRef.current;
    isLoadingMoreRef.current = false;

    if (sessionMode === "member" && accountId) {
      queueMicrotask(() => {
        if (!isCancelled) {
          setIsHydrated(false);
          setNextCursor(null);
          setHasMore(false);
          setIsLoadingMore(false);
        }
      });

      void listContentPostsRequest({ scope: feedScope })
        .then((response) => {
          if (
            isCancelled ||
            requestVersion !== feedRequestVersionRef.current
          ) {
            return;
          }

          const nextPosts = response.data.map(toCampusPost);
          const usableNextCursor = getUsablePageCursor(response.page);
          latestCreatedAtRef.current = getLatestCreatedAt(nextPosts);
          replacePosts(nextPosts);
          setNextCursor(usableNextCursor);
          setHasMore(usableNextCursor !== null);
        })
        .catch((error: unknown) => {
          if (
            isCancelled ||
            requestVersion !== feedRequestVersionRef.current
          ) {
            return;
          }

          replacePosts([]);
          setNextCursor(null);
          setHasMore(false);

          if (
            error instanceof AuthClientError &&
            error.status === 401
          ) {
            void retrySession();
          }
        })
        .finally(() => {
          if (
            !isCancelled &&
            requestVersion === feedRequestVersionRef.current
          ) {
            setIsHydrated(true);
          }
        });

      return () => {
        isCancelled = true;
      };
    }

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      setNextCursor(null);
      setHasMore(false);
      setIsLoadingMore(false);

      try {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);

        if (storedValue) {
          const parsedValue: unknown = JSON.parse(storedValue);

          if (isStoredPosts(parsedValue)) {
            const storedPosts = migrateLegacyOwnership(
              clonePosts(parsedValue),
            );
            latestCreatedAtRef.current = getLatestCreatedAt(storedPosts);
            replacePosts(storedPosts);
          }
        }
      } catch {
        // Keep the deterministic seed when stored data is unavailable or invalid.
      } finally {
        if (!isCancelled) {
          setIsHydrated(true);
        }
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    accountId,
    feedScope,
    replacePosts,
    retrySession,
    sessionMode,
  ]);

  useEffect(() => {
    if (!isHydrated || sessionMode === "member") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // The in-memory experience should continue when storage is unavailable.
    }
  }, [isHydrated, posts, sessionMode]);

  const loadMore = useCallback(async () => {
    if (
      sessionMode !== "member" ||
      !accountId ||
      !hasMore ||
      !nextCursor ||
      isLoadingMoreRef.current
    ) {
      return;
    }

    const requestVersion = feedRequestVersionRef.current;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await listContentPostsRequest({
        cursor: nextCursor,
        scope: feedScope,
      });

      if (requestVersion !== feedRequestVersionRef.current) {
        return;
      }

      const incomingPosts = response.data.map(toCampusPost);
      const usableNextCursor = getUsablePageCursor(response.page);

      updatePosts((currentPosts) =>
        appendUniqueCampusPosts(currentPosts, incomingPosts),
      );
      setNextCursor(usableNextCursor);
      setHasMore(usableNextCursor !== null);
    } catch (error) {
      if (requestVersion !== feedRequestVersionRef.current) {
        return;
      }

      if (error instanceof AuthClientError && error.status === 401) {
        void retrySession();
      }

      throw error;
    } finally {
      if (requestVersion === feedRequestVersionRef.current) {
        isLoadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    accountId,
    feedScope,
    hasMore,
    nextCursor,
    retrySession,
    sessionMode,
    updatePosts,
  ]);

  const createPost = useCallback(
    async (input: CreateCampusPostInput) => {
      if (sessionMode !== "member") {
        throw new Error("This session is read-only.");
      }

      const title = input.title?.trim() ?? "";
      const body = input.body.trim();

      if (
        (!title && !body) ||
        title.length > CAMPUS_POST_TITLE_MAX_LENGTH ||
        body.length > CAMPUS_POST_BODY_MAX_LENGTH
      ) {
        throw new Error("Post content is invalid.");
      }

      const pollOptions = input.pollOptions?.map((option) => option.trim());

      if (
        (input.category === "Anket" &&
          (!pollOptions ||
            pollOptions.length < 2 ||
            pollOptions.length > 4 ||
            pollOptions.some((option) => !option))) ||
        (input.category !== "Anket" && pollOptions)
      ) {
        throw new Error("Poll content is invalid.");
      }

      if (
        (input.category === "İlan" &&
          (!input.listing ||
            input.isAnonymous ||
            !validListingTypes.has(input.listing.type) ||
            !validListingConditions.has(input.listing.condition) ||
            !Number.isInteger(input.listing.price) ||
            input.listing.price < 0 ||
            input.listing.price > 1_000_000 ||
            (input.listing.type === "Ücretsiz"
              ? input.listing.price !== 0
              : input.listing.price === 0))) ||
        (input.category !== "İlan" && input.listing)
      ) {
        throw new Error("Listing content is invalid.");
      }

      const category = toContentCategory(input.category);

      const coreCategory: CoreContentPostCategory = category;
      const created = await createContentPostRequest({
        category: coreCategory,
        title,
        body,
        isAnonymous: input.isAnonymous,
        imageId: input.imageId,
        gifId: input.gif?.id,
        pollOptions,
        listing: input.listing
          ? {
              type: listingTypeValues[input.listing.type],
              condition:
                listingConditionValues[input.listing.condition],
              price: input.listing.price,
            }
          : undefined,
      });
      const post = toCampusPost(created);

      updatePosts((currentPosts) => [post, ...currentPosts]);
      latestCreatedAtRef.current = Math.max(
        latestCreatedAtRef.current,
        post.createdAt,
      );

      return post.id;
    },
    [sessionMode, updatePosts],
  );

  const toggleLike = useCallback((postId: string) => {
    if (sessionMode !== "member") {
      return;
    }

    const currentPost = postsRef.current.find(
      (post) => post.id === postId && !post.isDeleted,
    );

    if (!currentPost) {
      return;
    }

    const previousLiked = currentPost.liked;
    const previousLikeCount = currentPost.likes;
    const nextLiked = !previousLiked;
    const interactionKey = `like:${postId}`;
    const version =
      (interactionVersionsRef.current.get(interactionKey) ?? 0) + 1;

    interactionVersionsRef.current.set(interactionKey, version);
    updatePosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId && !post.isDeleted
          ? {
              ...post,
              liked: nextLiked,
              likes: Math.max(
                0,
                post.likes + (nextLiked ? 1 : -1),
              ),
            }
          : post,
      ),
    );

    void setContentPostLikeRequest(postId, nextLiked)
      .then((post) => {
        if (
          interactionVersionsRef.current.get(interactionKey) !== version
        ) {
          return;
        }

        updatePosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === postId
              ? {
                  ...currentPost,
                  liked: post.viewerState.liked,
                  likes: post.likeCount,
                }
              : currentPost,
          ),
        );
      })
      .catch((error: unknown) => {
        if (
          interactionVersionsRef.current.get(interactionKey) !== version
        ) {
          return;
        }

        updatePosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  liked: previousLiked,
                  likes: previousLikeCount,
                }
              : post,
          ),
        );

        if (error instanceof AuthClientError && error.status === 401) {
          void retrySession();
        }
      });
  }, [retrySession, sessionMode, updatePosts]);

  const toggleBookmark = useCallback((postId: string) => {
    if (sessionMode !== "member") {
      return;
    }

    const currentPost = postsRef.current.find(
      (post) => post.id === postId && !post.isDeleted,
    );

    if (!currentPost) {
      return;
    }

    const previousBookmarked = currentPost.bookmarked;
    const nextBookmarked = !previousBookmarked;
    const interactionKey = `bookmark:${postId}`;
    const version =
      (interactionVersionsRef.current.get(interactionKey) ?? 0) + 1;

    interactionVersionsRef.current.set(interactionKey, version);
    updatePosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId && !post.isDeleted
          ? { ...post, bookmarked: nextBookmarked }
          : post,
      ),
    );

    void setContentPostBookmarkRequest(postId, nextBookmarked)
      .then((post) => {
        if (
          interactionVersionsRef.current.get(interactionKey) !== version
        ) {
          return;
        }

        updatePosts((currentPosts) =>
          currentPosts.map((currentPost) =>
            currentPost.id === postId
              ? {
                  ...currentPost,
                  bookmarked: post.viewerState.bookmarked,
                }
              : currentPost,
          ),
        );
      })
      .catch((error: unknown) => {
        if (
          interactionVersionsRef.current.get(interactionKey) !== version
        ) {
          return;
        }

        updatePosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? { ...post, bookmarked: previousBookmarked }
              : post,
          ),
        );

        if (error instanceof AuthClientError && error.status === 401) {
          void retrySession();
        }
      });
  }, [retrySession, sessionMode, updatePosts]);

  const toggleCommentLike = useCallback(
    async (postId: string, commentId: string) => {
      if (sessionMode !== "member") {
        return;
      }

      const current = postsRef.current
        .find((post) => post.id === postId)
        ?.comments.find((comment) => comment.id === commentId);

      if (!current) {
        return;
      }

      const updated = toCampusComment(
        await setContentCommentLikeRequest(commentId, !current.liked),
      );

      updatePosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.map((comment) =>
                  comment.id === commentId ? updated : comment,
                ),
              }
            : post,
        ),
      );
    },
    [sessionMode, updatePosts],
  );

  const voteInPoll = useCallback(
    (postId: string, optionId: string) => {
      if (sessionMode !== "member") {
        return;
      }

      const currentPost = postsRef.current.find(
        (post) => post.id === postId && !post.isDeleted,
      );

      if (
        !currentPost?.poll ||
        currentPost.poll.selectedOptionId === optionId ||
        !currentPost.poll.options.some((option) => option.id === optionId)
      ) {
        return;
      }

      const previousPoll = {
        ...currentPost.poll,
        options: currentPost.poll.options.map((option) => ({ ...option })),
      };
      const interactionKey = `poll:${postId}`;
      const version =
        (interactionVersionsRef.current.get(interactionKey) ?? 0) + 1;

      interactionVersionsRef.current.set(interactionKey, version);
      updatePosts((currentPosts) =>
        currentPosts.map((post) => {
          if (
            post.id !== postId ||
            post.isDeleted ||
            !post.poll ||
            post.poll.selectedOptionId === optionId ||
            !post.poll.options.some((option) => option.id === optionId)
          ) {
            return post;
          }

          const previousOptionId = post.poll.selectedOptionId;

          return {
            ...post,
            poll: {
              selectedOptionId: optionId,
              options: post.poll.options.map((option) => ({
                ...option,
                votes:
                  option.id === optionId
                    ? option.votes + 1
                    : option.id === previousOptionId
                      ? Math.max(0, option.votes - 1)
                      : option.votes,
              })),
            },
          };
        }),
      );

      void voteInContentPollRequest(postId, optionId)
        .then((post) => {
          if (
            interactionVersionsRef.current.get(interactionKey) !== version
          ) {
            return;
          }

          const persistedPoll = toCampusPost(post).poll;

          updatePosts((currentPosts) =>
            currentPosts.map((currentPost) =>
              currentPost.id === postId && persistedPoll
                ? { ...currentPost, poll: persistedPoll }
                : currentPost,
            ),
          );
        })
        .catch((error: unknown) => {
          if (
            interactionVersionsRef.current.get(interactionKey) !== version
          ) {
            return;
          }

          updatePosts((currentPosts) =>
            currentPosts.map((post) =>
              post.id === postId ? { ...post, poll: previousPoll } : post,
            ),
          );

          if (error instanceof AuthClientError && error.status === 401) {
            void retrySession();
          }
        });
    },
    [retrySession, sessionMode, updatePosts],
  );

  const addComment = useCallback(
    async (postId: string, input: AddCampusCommentInput) => {
      if (sessionMode !== "member") {
        throw new Error("This session is read-only.");
      }

      const body = input.body.trim();

      if (!body && !input.gif) {
        throw new Error("Comment content is invalid.");
      }

      const created = await createContentCommentRequest(postId, {
        body,
        isAnonymous: input.isAnonymous,
        parentId: input.parentId,
        gifId: input.gif?.id,
      });
      const comment = toCampusComment(created);

      updatePosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id !== postId || post.isDeleted) {
            return post;
          }

          return {
            ...post,
            comments: [...post.comments, comment],
            commentCount:
              (post.commentCount ?? post.comments.length) + 1,
          };
        }),
      );
    },
    [sessionMode, updatePosts],
  );

  const updatePost = useCallback(
    async (postId: string, input: UpdateCampusPostInput) => {
      if (sessionMode !== "member") {
        return false;
      }

      const title = input.title.trim();
      const body = input.body.trim();

      if (
        (!title && !body) ||
        title.length > CAMPUS_POST_TITLE_MAX_LENGTH ||
        body.length > CAMPUS_POST_BODY_MAX_LENGTH
      ) {
        return false;
      }

      const canUpdate = postsRef.current.some(
        (post) =>
          post.id === postId &&
          post.authorId === LOCAL_ACCOUNT_OWNER_ID &&
          !post.isDeleted,
      );

      if (!canUpdate) {
        return false;
      }

      try {
        const updated = toCampusPost(
          await updateContentPostRequest(postId, {
            title,
            body,
          }),
        );

        updatePosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? {
                  ...updated,
                  liked: post.liked,
                  likes: post.likes,
                  bookmarked: post.bookmarked,
                }
              : post,
          ),
        );

        return true;
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          (error.status === 403 || error.status === 404)
        ) {
          return false;
        }

        throw error;
      }
    },
    [sessionMode, updatePosts],
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (sessionMode !== "member") {
        return false;
      }

      const canDelete = postsRef.current.some(
        (post) =>
          post.id === postId &&
          post.authorId === LOCAL_ACCOUNT_OWNER_ID &&
          !post.isDeleted,
      );

      if (!canDelete) {
        return false;
      }

      try {
        await deleteContentPostRequest(postId);

        updatePosts((currentPosts) =>
          currentPosts.map((post) => {
            if (
              post.id !== postId ||
              post.authorId !== LOCAL_ACCOUNT_OWNER_ID ||
              post.isDeleted
            ) {
              return post;
            }

            return {
              ...post,
              title: "",
              body: "",
              image: undefined,
              poll: undefined,
              listing: undefined,
              liked: false,
              bookmarked: false,
              isDeleted: true,
            };
          }),
        );

        return true;
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          (error.status === 403 || error.status === 404)
        ) {
          return false;
        }

        throw error;
      }
    },
    [sessionMode, updatePosts],
  );

  const updateComment = useCallback(
    async (
      postId: string,
      commentId: string,
      nextBody: string,
    ) => {
      if (sessionMode !== "member") {
        return false;
      }

      const body = nextBody.trim();

      if (!body || body.length > 500) {
        return false;
      }

      const canUpdate = postsRef.current.some(
        (post) =>
          post.id === postId &&
          post.comments.some(
            (comment) =>
              comment.id === commentId &&
              comment.authorId === LOCAL_ACCOUNT_OWNER_ID &&
              !comment.isDeleted,
          ),
      );

      if (!canUpdate) {
        return false;
      }

      try {
        const updated = toCampusComment(
          await updateContentCommentRequest(commentId, body),
        );

        updatePosts((currentPosts) =>
          currentPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments.map((comment) =>
                    comment.id === commentId ? updated : comment,
                  ),
                }
              : post,
          ),
        );

        return true;
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          (error.status === 403 || error.status === 404)
        ) {
          return false;
        }

        throw error;
      }
    },
    [sessionMode, updatePosts],
  );

  const deleteComment = useCallback(
    async (postId: string, commentId: string) => {
      if (sessionMode !== "member") {
        return false;
      }

      const canDelete = postsRef.current.some(
        (post) =>
          post.id === postId &&
          post.comments.some(
            (comment) =>
              comment.id === commentId &&
              comment.authorId === LOCAL_ACCOUNT_OWNER_ID &&
              !comment.isDeleted,
          ),
      );

      if (!canDelete) {
        return false;
      }

      try {
        await deleteContentCommentRequest(commentId);

        updatePosts((currentPosts) =>
          currentPosts.map((post) => {
            if (post.id !== postId) {
              return post;
            }

            return {
              ...post,
              commentCount: Math.max(
                0,
                (post.commentCount ?? post.comments.length) - 1,
              ),
              comments: post.comments.map((comment) => {
                if (
                  comment.id !== commentId ||
                  comment.authorId !== LOCAL_ACCOUNT_OWNER_ID ||
                  comment.isDeleted
                ) {
                  return comment;
                }

                return {
                  ...comment,
                  body: "",
                  isDeleted: true,
                };
              }),
            };
          }),
        );

        return true;
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          (error.status === 403 || error.status === 404)
        ) {
          return false;
        }

        throw error;
      }
    },
    [sessionMode, updatePosts],
  );

  const loadPostDetail = useCallback(
    async (postId: string) => {
      if (sessionMode !== "member") {
        return false;
      }

      try {
        const detailedPost = toCampusPost(
          await getContentPostRequest(postId),
        );

        updatePosts((currentPosts) => {
          const existing = currentPosts.find(
            (post) => post.id === postId,
          );
          const nextPost = existing
            ? {
                ...detailedPost,
                liked: existing.liked,
                likes: existing.likes,
                bookmarked: existing.bookmarked,
              }
            : detailedPost;

          return existing
            ? currentPosts.map((post) =>
                post.id === postId ? nextPost : post,
              )
            : [nextPost, ...currentPosts];
        });

        return true;
      } catch (error) {
        if (
          error instanceof AuthClientError &&
          error.status === 401
        ) {
          void retrySession();
        }

        if (
          error instanceof AuthClientError &&
          (error.status === 401 || error.status === 404)
        ) {
          return false;
        }

        throw error;
      }
    },
    [retrySession, sessionMode, updatePosts],
  );

  const registerPosts = useCallback(
    (incomingPosts: CampusPost[]) => {
      if (sessionMode !== "member" || incomingPosts.length === 0) {
        return;
      }

      updatePosts((currentPosts) =>
        appendUniqueCampusPosts(currentPosts, incomingPosts),
      );
    },
    [sessionMode, updatePosts],
  );

  const moderateDeletePost = useCallback(
    (postId: string) => {
      if (sessionMode !== "member" || role === "member") {
        return false;
      }

      const canDelete = postsRef.current.some(
        (post) => post.id === postId && !post.isDeleted,
      );

      if (!canDelete) {
        return false;
      }

      updatePosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id !== postId || post.isDeleted) {
            return post;
          }

          return {
            ...post,
            title: "",
            body: "",
            image: undefined,
            poll: undefined,
            listing: undefined,
            liked: false,
            bookmarked: false,
            isDeleted: true,
          };
        }),
      );

      return true;
    },
    [role, sessionMode, updatePosts],
  );

  const moderateDeleteComment = useCallback(
    (postId: string, commentId: string) => {
      if (sessionMode !== "member" || role === "member") {
        return false;
      }

      const canDelete = postsRef.current.some(
        (post) =>
          post.id === postId &&
          post.comments.some(
            (comment) =>
              comment.id === commentId && !comment.isDeleted,
          ),
      );

      if (!canDelete) {
        return false;
      }

      updatePosts((currentPosts) =>
        currentPosts.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          return {
            ...post,
            comments: post.comments.map((comment) => {
              if (comment.id !== commentId || comment.isDeleted) {
                return comment;
              }

              return { ...comment, body: "", isDeleted: true };
            }),
          };
        }),
      );

      return true;
    },
    [role, sessionMode, updatePosts],
  );

  const renameAuthoredContent = useCallback(
    (previousUsername: string, nextUsername: string) => {
      if (sessionMode !== "member") {
        return;
      }

      void previousUsername;
      const nextAuthor = `@${nextUsername}`;

      updatePosts((currentPosts) =>
        currentPosts.map((post) => ({
          ...post,
          author:
            !isAnonymousCampusAuthor(post) &&
            (post.authorId === LOCAL_ACCOUNT_OWNER_ID ||
              post.author === "@sen")
              ? nextAuthor
              : post.author,
          comments: post.comments.map((comment) => ({
            ...comment,
            author:
              !isAnonymousCampusAuthor(comment) &&
              (comment.authorId === LOCAL_ACCOUNT_OWNER_ID ||
                comment.author === "@sen")
                ? nextAuthor
                : comment.author,
          })),
        })),
      );
    },
    [sessionMode, updatePosts],
  );

  const resetCampusData = useCallback(() => {
    if (sessionMode !== "member") {
      return;
    }

    const requestVersion = ++feedRequestVersionRef.current;
    isLoadingMoreRef.current = false;
    setNextCursor(null);
    setHasMore(false);
    setIsLoadingMore(false);

    void listContentPostsRequest({ scope: feedScope })
      .then((response) => {
        if (requestVersion !== feedRequestVersionRef.current) {
          return;
        }

        const nextPosts = response.data.map(toCampusPost);
        const usableNextCursor = getUsablePageCursor(response.page);
        latestCreatedAtRef.current = getLatestCreatedAt(nextPosts);
        replacePosts(nextPosts);
        setNextCursor(usableNextCursor);
        setHasMore(usableNextCursor !== null);
      })
      .catch((error: unknown) => {
        if (requestVersion !== feedRequestVersionRef.current) {
          return;
        }

        if (
          error instanceof AuthClientError &&
          error.status === 401
        ) {
          void retrySession();
        }
      });
  }, [feedScope, replacePosts, retrySession, sessionMode]);

  const visiblePosts = useMemo(() => {
    const accountDetail = settings.showDepartment
      ? `${profile.department} · ${profile.year}`
      : "Öğrenci";
    const accountAuthor = `@${profile.username}`;
    const sourcePosts = isGuest
      ? clonePosts(guestPreviewPosts)
      : posts;
    const suspendedAuthorIds = new Set(
      managedUsers
        .filter((user) => user.status === "suspended")
        .map((user) => user.id),
    );

    return sourcePosts
      .filter(
        (post) =>
          isGuest ||
          !post.authorId ||
          (!blockedAuthorIds.has(post.authorId) &&
            !suspendedAuthorIds.has(post.authorId)),
      )
      .map((post) => {
      const isAnonymous = isAnonymousCampusAuthor(post);
        const isLocalAccount =
          !isGuest &&
          !isAnonymous &&
          (post.authorId === LOCAL_ACCOUNT_OWNER_ID ||
            post.author === "@sen");

        return {
          ...post,
          author: isAnonymous
            ? "Anonim"
            : isLocalAccount
              ? accountAuthor
              : post.author,
          isAnonymous,
          detail: isAnonymous
            ? undefined
            : isLocalAccount
              ? accountDetail
              : post.detail,
          comments: post.comments
            .filter(
              (comment) =>
                isGuest ||
                !comment.authorId ||
                (!blockedAuthorIds.has(comment.authorId) &&
                  !suspendedAuthorIds.has(comment.authorId)),
            )
            .map((comment) => {
            const isAnonymousComment =
              isAnonymousCampusAuthor(comment);
            const isLocalAccountComment =
              !isGuest &&
              !isAnonymousComment &&
              (comment.authorId === LOCAL_ACCOUNT_OWNER_ID ||
                comment.author === "@sen");

            return {
              ...comment,
              author: isAnonymousComment
                ? "Anonim"
                : isLocalAccountComment
                  ? accountAuthor
                  : comment.author,
              isAnonymous: isAnonymousComment,
            };
            }),
        };
      });
  }, [
    blockedAuthorIds,
    managedUsers,
    posts,
    isGuest,
    profile.department,
    profile.username,
    profile.year,
    settings.showDepartment,
  ]);

  const value = useMemo<CampusDataContextValue>(
    () => ({
      posts: visiblePosts,
      isHydrated,
      hasMore: !isGuest && hasMore,
      isLoadingMore: !isGuest && isLoadingMore,
      loadMore,
      feedScope,
      setFeedScope,
      createPost,
      toggleLike,
      toggleBookmark,
      toggleCommentLike,
      voteInPoll,
      addComment,
      updatePost,
      deletePost,
      updateComment,
      deleteComment,
      loadPostDetail,
      registerPosts,
      moderateDeletePost,
      moderateDeleteComment,
      renameAuthoredContent,
      resetCampusData,
    }),
    [
      visiblePosts,
      isHydrated,
      isGuest,
      hasMore,
      isLoadingMore,
      loadMore,
      feedScope,
      createPost,
      toggleLike,
      toggleBookmark,
      toggleCommentLike,
      voteInPoll,
      addComment,
      updatePost,
      deletePost,
      updateComment,
      deleteComment,
      loadPostDetail,
      registerPosts,
      moderateDeletePost,
      moderateDeleteComment,
      renameAuthoredContent,
      resetCampusData,
    ],
  );

  return (
    <CampusDataContext.Provider value={value}>
      {children}
    </CampusDataContext.Provider>
  );
}

export function useCampusData() {
  const context = useContext(CampusDataContext);

  if (!context) {
    throw new Error("useCampusData must be used within CampusDataProvider.");
  }

  return context;
}
