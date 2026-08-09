export const CAMPUS_TIME_ZONE = "Europe/Istanbul";
export const CAMPUS_TRENDING_WINDOW_DAYS = 7;
export const CAMPUS_TRENDING_LIKE_WEIGHT = 2;
export const CAMPUS_TRENDING_COMMENT_WEIGHT = 4;
export const CAMPUS_TRENDING_POLL_VOTE_WEIGHT = 1;

type TrendingPost = {
  id: string;
  createdAt: number;
  likes: number;
  comments: readonly unknown[];
  commentCount?: number;
  poll?: {
    options: readonly { votes: number }[];
  };
};

export type RankedCampusTrendingPost<TPost extends TrendingPost> = {
  post: TPost;
  interactions: number;
  score: number;
  /** 6 bugünü, 0 pencerenin son gününü ifade eder. */
  dayRank: number;
};

const campusDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPUS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isCampusDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));

  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() === month - 1 &&
    normalized.getUTCDate() === day
  );
}

/** Verilen zamanı İstanbul takviminde YYYY-MM-DD biçimine çevirir. */
export function getCampusDateKey(timestamp: number | Date) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const parts = campusDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function dateKeyToEpochDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function getCampusTrendingDayRank(
  createdAt: number,
  anchorAt: number | Date = Date.now(),
) {
  const createdDateKey = getCampusDateKey(createdAt);
  const anchorDateKey = getCampusDateKey(anchorAt);

  if (!createdDateKey || !anchorDateKey) {
    return null;
  }

  const ageInDays =
    dateKeyToEpochDay(anchorDateKey) - dateKeyToEpochDay(createdDateKey);

  if (ageInDays < 0 || ageInDays >= CAMPUS_TRENDING_WINDOW_DAYS) {
    return null;
  }

  return CAMPUS_TRENDING_WINDOW_DAYS - 1 - ageInDays;
}

export function getCampusTrendingMetrics<TPost extends TrendingPost>(
  post: TPost,
) {
  const comments = Math.max(0, post.commentCount ?? post.comments.length);
  const pollVotes =
    post.poll?.options.reduce(
      (total, option) => total + Math.max(0, option.votes),
      0,
    ) ?? 0;
  const likes = Math.max(0, post.likes);

  return {
    interactions: likes + comments + pollVotes,
    score:
      likes * CAMPUS_TRENDING_LIKE_WEIGHT +
      comments * CAMPUS_TRENDING_COMMENT_WEIGHT +
      pollVotes * CAMPUS_TRENDING_POLL_VOTE_WEIGHT,
  };
}

/**
 * "Kampüste ne oluyor?" için ortak istemci/misafir sıralaması.
 * Önce takvim günü, aynı gün içinde ağırlıklı etkileşim, sonra yayın zamanı
 * kullanılır. Böylece bugün yeterli içerik varsa eski popüler içerik araya
 * girmez; içerik azsa son yedi günden doğal biçimde tamamlanır.
 */
export function rankCampusTrendingPosts<TPost extends TrendingPost>(
  posts: readonly TPost[],
  {
    anchorAt = Date.now(),
    limit,
  }: {
    anchorAt?: number | Date;
    limit?: number;
  } = {},
) {
  const ranked = posts
    .flatMap<RankedCampusTrendingPost<TPost>>((post) => {
      const dayRank = getCampusTrendingDayRank(post.createdAt, anchorAt);

      if (dayRank === null) {
        return [];
      }

      const metrics = getCampusTrendingMetrics(post);

      return [
        {
          post,
          ...metrics,
          dayRank,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.dayRank - left.dayRank ||
        right.score - left.score ||
        right.post.createdAt - left.post.createdAt ||
        right.post.id.localeCompare(left.post.id),
    );

  return limit === undefined ? ranked : ranked.slice(0, Math.max(0, limit));
}
