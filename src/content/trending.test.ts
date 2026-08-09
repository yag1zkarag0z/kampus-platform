import { describe, expect, it } from "vitest";

import {
  getCampusDateKey,
  getCampusTrendingDayRank,
  rankCampusTrendingPosts,
} from "@/content/trending";

const anchorAt = new Date("2026-08-09T12:00:00.000Z");

function createPost({
  id,
  createdAt,
  likes = 0,
  comments = 0,
  pollVotes = 0,
}: {
  id: string;
  createdAt: string;
  likes?: number;
  comments?: number;
  pollVotes?: number;
}) {
  return {
    id,
    createdAt: new Date(createdAt).getTime(),
    likes,
    comments: Array.from({ length: comments }, () => ({})),
    poll:
      pollVotes > 0
        ? { options: [{ votes: pollVotes }] }
        : undefined,
  };
}

describe("campus trending ranking", () => {
  it("uses the Europe/Istanbul calendar day", () => {
    expect(getCampusDateKey(new Date("2026-08-08T21:30:00.000Z"))).toBe(
      "2026-08-09",
    );
    expect(
      getCampusTrendingDayRank(
        new Date("2026-08-08T21:30:00.000Z").getTime(),
        anchorAt,
      ),
    ).toBe(6);
  });

  it("keeps today's posts ahead and fills from the current seven-day window", () => {
    const todayQuiet = createPost({
      id: "today-quiet",
      createdAt: "2026-08-09T08:00:00.000Z",
    });
    const yesterdayPopular = createPost({
      id: "yesterday-popular",
      createdAt: "2026-08-08T08:00:00.000Z",
      likes: 500,
      comments: 100,
    });
    const sixDaysAgo = createPost({
      id: "six-days-ago",
      createdAt: "2026-08-03T08:00:00.000Z",
      likes: 2,
    });
    const outsideWindow = createPost({
      id: "outside-window",
      createdAt: "2026-08-02T08:00:00.000Z",
      likes: 5_000,
    });

    const ranked = rankCampusTrendingPosts(
      [outsideWindow, yesterdayPopular, sixDaysAgo, todayQuiet],
      { anchorAt },
    );

    expect(ranked.map(({ post }) => post.id)).toEqual([
      "today-quiet",
      "yesterday-popular",
      "six-days-ago",
    ]);
  });

  it("weights comments above likes and includes poll votes within a day", () => {
    const liked = createPost({
      id: "liked",
      createdAt: "2026-08-09T08:00:00.000Z",
      likes: 1,
    });
    const commented = createPost({
      id: "commented",
      createdAt: "2026-08-09T07:00:00.000Z",
      comments: 1,
    });
    const voted = createPost({
      id: "voted",
      createdAt: "2026-08-09T06:00:00.000Z",
      pollVotes: 5,
    });

    const ranked = rankCampusTrendingPosts([liked, commented, voted], {
      anchorAt,
    });

    expect(ranked.map(({ post }) => post.id)).toEqual([
      "voted",
      "commented",
      "liked",
    ]);
    expect(ranked[0]).toMatchObject({ interactions: 5, score: 5 });
  });

  it("uses newest-first and id as deterministic tie breakers", () => {
    const newest = createPost({
      id: "a-newest",
      createdAt: "2026-08-09T09:00:00.000Z",
      likes: 2,
    });
    const olderA = createPost({
      id: "a-older",
      createdAt: "2026-08-09T08:00:00.000Z",
      likes: 2,
    });
    const olderZ = createPost({
      id: "z-older",
      createdAt: "2026-08-09T08:00:00.000Z",
      likes: 2,
    });

    expect(
      rankCampusTrendingPosts([olderA, newest, olderZ], { anchorAt }).map(
        ({ post }) => post.id,
      ),
    ).toEqual(["a-newest", "z-older", "a-older"]);
  });
});
