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
  isAnonymousCampusAuthor,
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusPost,
  type CampusPostCategory,
  type CampusPostImage,
  type CampusPostListing,
  type CampusPostPoll,
} from "@/data/campusPosts";
import { useCampusAccount } from "@/components/CampusAccountProvider";

const STORAGE_KEY = "kampus-posts-v2";
const validCategories = new Set<CampusPostCategory>([
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

export type CreateCampusPostInput = {
  title: string;
  body: string;
  category: CampusPostCategory;
  isAnonymous: boolean;
  image?: CampusPostImage;
  pollOptions?: string[];
  listing?: CampusPostListing;
};

export type AddCampusCommentInput = {
  body: string;
  isAnonymous: boolean;
};

type CampusDataContextValue = {
  posts: CampusPost[];
  isHydrated: boolean;
  createPost: (input: CreateCampusPostInput) => string;
  toggleLike: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  voteInPoll: (postId: string, optionId: string) => void;
  addComment: (postId: string, input: AddCampusCommentInput) => void;
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
    value.src.startsWith("data:image/") &&
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
  const { profile, settings } = useCampusAccount();
  const [posts, setPosts] = useState<CampusPost[]>(() =>
    clonePosts(campusPosts),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const latestCreatedAtRef = useRef(getLatestCreatedAt(campusPosts));

  useEffect(() => {
    let isCancelled = false;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);

        if (storedValue) {
          const parsedValue: unknown = JSON.parse(storedValue);

          if (isStoredPosts(parsedValue)) {
            const storedPosts = migrateLegacyOwnership(
              clonePosts(parsedValue),
            );
            latestCreatedAtRef.current = getLatestCreatedAt(storedPosts);
            setPosts(storedPosts);
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
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch {
      // The in-memory experience should continue when storage is unavailable.
    }
  }, [isHydrated, posts]);

  const createPost = useCallback(
    (input: CreateCampusPostInput) => {
      const title = input.title.trim();
      const pollOptions = input.pollOptions
        ?.map((option) => option.trim())
        .filter(Boolean);

      if (!title) {
        throw new Error("A post title is required.");
      }

      if (
        pollOptions &&
        (pollOptions.length < 2 ||
          pollOptions.length > 4 ||
          pollOptions.some((option) => option.length > 60) ||
          new Set(
            pollOptions.map((option) =>
              option.toLocaleLowerCase("tr-TR"),
            ),
          ).size !== pollOptions.length)
      ) {
        throw new Error("Poll options are invalid.");
      }

      if (input.category === "Anket" && !pollOptions) {
        throw new Error("Poll category requires poll options.");
      }

      if (
        (input.category === "İlan") !== Boolean(input.listing) ||
        (input.listing && !isStoredPostListing(input.listing)) ||
        (input.listing && pollOptions) ||
        (input.listing && input.isAnonymous) ||
        (input.listing && !input.body.trim())
      ) {
        throw new Error("Listing details are invalid.");
      }

      const now = Date.now();
      const createdAt = latestCreatedAtRef.current + 1;
      const id = `post-${now}-${createdAt}`;
      latestCreatedAtRef.current = createdAt;

      const post: CampusPost = {
        id,
        author: input.isAnonymous ? "Anonim" : `@${profile.username}`,
        authorId: LOCAL_ACCOUNT_OWNER_ID,
        isAnonymous: input.isAnonymous,
        detail: input.isAnonymous
          ? undefined
          : settings.showDepartment
            ? `${profile.department} · ${profile.year}`
            : "Öğrenci",
        category: pollOptions
          ? "Anket"
          : input.listing
            ? "İlan"
            : input.category,
        title,
        body: input.body.trim(),
        image: input.image ? { ...input.image } : undefined,
        poll: pollOptions
          ? {
              options: pollOptions.map((text, index) => ({
                id: `poll-${createdAt}-${index + 1}`,
                text,
                votes: 0,
              })),
            }
          : undefined,
        listing: input.listing ? { ...input.listing } : undefined,
        time: "Şimdi",
        createdAt,
        likes: 0,
        liked: false,
        comments: [],
        bookmarked: false,
      };

      setPosts((currentPosts) => [post, ...currentPosts]);
      return id;
    },
    [
      profile.department,
      profile.username,
      profile.year,
      settings.showDepartment,
    ],
  );

  const toggleLike = useCallback((postId: string) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        const liked = !post.liked;

        return {
          ...post,
          liked,
          likes: Math.max(0, post.likes + (liked ? 1 : -1)),
        };
      }),
    );
  }, []);

  const toggleBookmark = useCallback((postId: string) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.id === postId
          ? { ...post, bookmarked: !post.bookmarked }
          : post,
      ),
    );
  }, []);

  const voteInPoll = useCallback(
    (postId: string, optionId: string) => {
      setPosts((currentPosts) =>
        currentPosts.map((post) => {
          if (
            post.id !== postId ||
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
    },
    [],
  );

  const addComment = useCallback(
    (postId: string, input: AddCampusCommentInput) => {
      const body = input.body.trim();

      if (!body) {
        return;
      }

      const comment = {
        id: `comment-${postId}-${Date.now()}`,
        author: input.isAnonymous ? "Anonim" : `@${profile.username}`,
        authorId: LOCAL_ACCOUNT_OWNER_ID,
        isAnonymous: input.isAnonymous,
        body,
        time: "Şimdi",
      };

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.id === postId
            ? { ...post, comments: [...post.comments, comment] }
            : post,
        ),
      );
    },
    [profile.username],
  );

  const renameAuthoredContent = useCallback(
    (previousUsername: string, nextUsername: string) => {
      void previousUsername;
      const nextAuthor = `@${nextUsername}`;

      setPosts((currentPosts) =>
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
    [],
  );

  const resetCampusData = useCallback(() => {
    const initialPosts = clonePosts(campusPosts);
    latestCreatedAtRef.current = getLatestCreatedAt(initialPosts);
    setPosts(initialPosts);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset should still complete in memory when storage is unavailable.
    }
  }, []);

  const visiblePosts = useMemo(() => {
    const accountDetail = settings.showDepartment
      ? `${profile.department} · ${profile.year}`
      : "Öğrenci";
    const accountAuthor = `@${profile.username}`;

    return posts.map((post) => {
      const isAnonymous = isAnonymousCampusAuthor(post);
      const isLocalAccount =
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
        comments: post.comments.map((comment) => {
          const isAnonymousComment =
            isAnonymousCampusAuthor(comment);
          const isLocalAccountComment =
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
    posts,
    profile.department,
    profile.username,
    profile.year,
    settings.showDepartment,
  ]);

  const value = useMemo<CampusDataContextValue>(
    () => ({
      posts: visiblePosts,
      isHydrated,
      createPost,
      toggleLike,
      toggleBookmark,
      voteInPoll,
      addComment,
      renameAuthoredContent,
      resetCampusData,
    }),
    [
      visiblePosts,
      isHydrated,
      createPost,
      toggleLike,
      toggleBookmark,
      voteInPoll,
      addComment,
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
