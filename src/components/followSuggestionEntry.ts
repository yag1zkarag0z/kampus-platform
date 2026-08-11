import type { CampusFollowMember } from "@/data/campusFollows";
import type { SuggestedMemberDto } from "@/social/client";

export type SuggestionEntry = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  detail?: string;
  bio?: string;
  // Misafir tohum verisinde bu sinyaller yok; sebep türetmesi eksikliği
  // tolere ediyor.
  followerCount?: number;
  mutualCount?: number;
  mutualNames?: string[];
  isNewMember?: boolean;
};

/** Kampüs ölçeğinde bu takipçi sayısı "tanınıyor" demek. */
const POPULAR_FOLLOWER_THRESHOLD = 25;

export type SuggestionReason =
  | { kind: "mutual"; names: string[]; count: number }
  | { kind: "department"; label: string }
  | { kind: "new" }
  | { kind: "popular" };

/**
 * Öneri satırındaki tek satırlık gerekçe. Ortak takip en ikna edici sinyal,
 * bu yüzden başta; bölüm ondan sonra geliyor çünkü herkeste var ve tek başına
 * ayırt edici değil.
 */
export function resolveSuggestionReason(
  entry: SuggestionEntry,
): SuggestionReason | null {
  const mutualCount = entry.mutualCount ?? 0;

  if (mutualCount > 0) {
    return {
      kind: "mutual",
      names: entry.mutualNames ?? [],
      count: mutualCount,
    };
  }

  if (entry.detail) {
    return { kind: "department", label: entry.detail };
  }

  if (entry.isNewMember) {
    return { kind: "new" };
  }

  if ((entry.followerCount ?? 0) >= POPULAR_FOLLOWER_THRESHOLD) {
    return { kind: "popular" };
  }

  return null;
}

export function describeSuggestionReason(reason: SuggestionReason): string {
  switch (reason.kind) {
    case "mutual": {
      const [first, second] = reason.names;

      if (!first) {
        return `${reason.count} ortak takip`;
      }

      if (reason.count === 1) {
        return `${first} takip ediyor`;
      }

      if (reason.count === 2 && second) {
        return `${first} ve ${second} takip ediyor`;
      }

      return `${first} ve ${reason.count - 1} kişi takip ediyor`;
    }
    case "department":
      return reason.label;
    case "new":
      return "Yeni katıldı";
    case "popular":
      return "Kampüste popüler";
  }
}

export function toEntryFromMock(member: CampusFollowMember): SuggestionEntry {
  return {
    id: member.authorId,
    username: member.username,
    displayName: member.displayName,
    avatarUrl: member.avatarDataUrl ?? null,
    detail: member.detail,
    bio: member.bio,
  };
}

export function toEntryFromDto(member: SuggestedMemberDto): SuggestionEntry {
  return {
    id: member.id,
    username: member.username,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    detail: member.department,
    bio: member.bio,
    followerCount: member.followerCount,
    mutualCount: member.mutualCount,
    mutualNames: member.mutualNames,
    isNewMember: member.isNewMember,
  };
}
