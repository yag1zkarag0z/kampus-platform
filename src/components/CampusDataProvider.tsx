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
  type CampusPost,
  type CampusPostCategory,
} from "@/data/campusPosts";

const STORAGE_KEY = "kampus-posts-v2";
const validCategories = new Set<CampusPostCategory>([
  "İtiraf",
  "Soru",
  "Etkinlik",
  "Kayıp Eşya",
]);

export type CreateCampusPostInput = {
  title: string;
  body: string;
  category: CampusPostCategory;
  isAnonymous: boolean;
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
  addComment: (postId: string, input: AddCampusCommentInput) => void;
};

const CampusDataContext = createContext<CampusDataContextValue | undefined>(
  undefined,
);

function clonePosts(posts: CampusPost[]) {
  return posts.map((post) => ({
    ...post,
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
    typeof value.body === "string" &&
    typeof value.time === "string"
  );
}

function isStoredPost(value: unknown): value is CampusPost {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.author === "string" &&
    (value.detail === undefined || typeof value.detail === "string") &&
    typeof value.category === "string" &&
    validCategories.has(value.category as CampusPostCategory) &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
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

export function CampusDataProvider({ children }: { children: ReactNode }) {
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
            const storedPosts = clonePosts(parsedValue);
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

  const createPost = useCallback((input: CreateCampusPostInput) => {
    const title = input.title.trim();

    if (!title) {
      throw new Error("A post title is required.");
    }

    const now = Date.now();
    const createdAt = latestCreatedAtRef.current + 1;
    const id = `post-${now}-${createdAt}`;
    latestCreatedAtRef.current = createdAt;

    const post: CampusPost = {
      id,
      author: input.isAnonymous ? "Anonim" : "@sen",
      detail: input.isAnonymous ? undefined : "Öğrenci",
      category: input.category,
      title,
      body: input.body.trim(),
      time: "Şimdi",
      createdAt,
      likes: 0,
      liked: false,
      comments: [],
      bookmarked: false,
    };

    setPosts((currentPosts) => [post, ...currentPosts]);
    return id;
  }, []);

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

  const addComment = useCallback(
    (postId: string, input: AddCampusCommentInput) => {
      const body = input.body.trim();

      if (!body) {
        return;
      }

      const comment = {
        id: `comment-${postId}-${Date.now()}`,
        author: input.isAnonymous ? "Anonim" : "@sen",
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
    [],
  );

  const value = useMemo<CampusDataContextValue>(
    () => ({
      posts,
      isHydrated,
      createPost,
      toggleLike,
      toggleBookmark,
      addComment,
    }),
    [
      posts,
      isHydrated,
      createPost,
      toggleLike,
      toggleBookmark,
      addComment,
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
