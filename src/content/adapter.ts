import type {
  ContentCommentDto,
  ContentPostDetailDto,
  ContentPostDto,
  ContentPostPageDto,
} from "@/content/types";
import {
  LOCAL_ACCOUNT_OWNER_ID,
  type CampusComment,
  type CampusPost,
  type CampusPostCategory,
  type CampusListingCondition,
  type CampusListingType,
} from "@/data/campusPosts";

const listingTypeLabels: Record<
  "sale" | "wanted" | "free",
  CampusListingType
> = {
  sale: "Satılık",
  wanted: "Aranıyor",
  free: "Ücretsiz",
};

const listingConditionLabels: Record<
  "new" | "lightly_used" | "used",
  CampusListingCondition
> = {
  new: "Yeni",
  lightly_used: "Az kullanılmış",
  used: "Kullanılmış",
};

const categoryLabels: Record<
  ContentPostDto["category"],
  CampusPostCategory
> = {
  chat: "Sohbet",
  confession: "İtiraf",
  question: "Soru",
  event: "Etkinlik",
  lost_found: "Kayıp Eşya",
  poll: "Anket",
  listing: "İlan",
};

const categoryValues = Object.fromEntries(
  Object.entries(categoryLabels).map(([value, label]) => [
    label,
    value,
  ]),
) as Record<
  CampusPostCategory,
  ContentPostDto["category"]
>;

function parseTimestamp(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function formatCampusRelativeTime(
  value: string,
  now = Date.now(),
) {
  const elapsedMilliseconds = Math.max(
    0,
    now - parseTimestamp(value),
  );
  const minutes = Math.floor(elapsedMilliseconds / 60_000);

  if (minutes < 1) {
    return "Şimdi";
  }

  if (minutes < 60) {
    return `${minutes} dk`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} sa`;
  }

  const days = Math.floor(hours / 24);

  if (days < 30) {
    return `${days} gün`;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function toContentCategory(
  category: CampusPostCategory,
) {
  return categoryValues[category];
}

export function getUsablePageCursor(page: ContentPostPageDto) {
  return page.hasMore &&
    typeof page.nextCursor === "string" &&
    page.nextCursor.length > 0
    ? page.nextCursor
    : null;
}

export function appendUniqueCampusPosts(
  currentPosts: CampusPost[],
  incomingPosts: CampusPost[],
) {
  const knownPostIds = new Set(currentPosts.map((post) => post.id));
  const uniquePosts = incomingPosts.filter((post) => {
    if (knownPostIds.has(post.id)) {
      return false;
    }

    knownPostIds.add(post.id);
    return true;
  });

  return uniquePosts.length > 0
    ? [...currentPosts, ...uniquePosts]
    : currentPosts;
}

function toCampusAuthor(
  dto: ContentPostDto | ContentCommentDto,
) {
  const isAuthor = dto.viewerState.isAuthor;

  if (dto.isAnonymous) {
    return {
      author: "Anonim",
      authorId: isAuthor ? LOCAL_ACCOUNT_OWNER_ID : undefined,
    };
  }

  if (!dto.author.id || !dto.author.username) {
    return {
      author: dto.author.displayName || "Silinen kullanıcı",
      authorId: undefined,
    };
  }

  return {
    author: `@${dto.author.username}`,
    authorId: isAuthor
      ? LOCAL_ACCOUNT_OWNER_ID
      : dto.author.id,
  };
}

export function toCampusComment(
  dto: ContentCommentDto,
): CampusComment {
  const author = toCampusAuthor(dto);

  return {
    id: dto.id,
    ...author,
    isAnonymous: dto.isAnonymous,
    parentId: dto.parentId ?? undefined,
    edited: dto.editedAt !== null,
    isDeleted: dto.isDeleted,
    body: dto.body ?? "",
    time: formatCampusRelativeTime(dto.createdAt),
    gif: dto.gif
      ? {
          id: dto.gif.id,
          src: dto.gif.src,
          width: dto.gif.width,
          height: dto.gif.height,
          alt: dto.gif.alt,
        }
      : undefined,
  };
}

export function toCampusPost(
  dto: ContentPostDto | ContentPostDetailDto,
): CampusPost {
  const author = toCampusAuthor(dto);
  const comments =
    "comments" in dto
      ? dto.comments.map(toCampusComment)
      : [];

  return {
    id: dto.id,
    ...author,
    isAnonymous: dto.isAnonymous,
    detail: dto.isAnonymous ? undefined : "Öğrenci",
    category: categoryLabels[dto.category],
    title: dto.title,
    body: dto.body,
    time: formatCampusRelativeTime(dto.createdAt),
    createdAt: parseTimestamp(dto.createdAt),
    likes: dto.likeCount,
    liked: dto.viewerState.liked,
    comments,
    commentCount: dto.commentCount,
    bookmarked: dto.viewerState.bookmarked,
    poll: dto.poll
      ? {
          options: dto.poll.options.map((option) => ({
            id: option.id,
            text: option.text,
            votes: option.voteCount,
          })),
          selectedOptionId:
            dto.viewerState.selectedPollOptionId ?? undefined,
        }
      : undefined,
    listing: dto.listing
      ? {
          type: listingTypeLabels[dto.listing.type],
          condition: listingConditionLabels[dto.listing.condition],
          price: dto.listing.price,
        }
      : undefined,
    image: dto.image
      ? {
          src: dto.image.src,
          width: dto.image.width,
          height: dto.image.height,
          alt: dto.image.alt,
        }
      : undefined,
    gif: dto.gif
      ? {
          id: dto.gif.id,
          src: dto.gif.src,
          width: dto.gif.width,
          height: dto.gif.height,
          alt: dto.gif.alt,
        }
      : undefined,
    edited: dto.editedAt !== null,
    isHidden: dto.viewerState.hidden,
  };
}
