export const campusAvatarSeeds = [
  "kayaozturk",
  "ecearslan",
  "deniz-akin",
  "mertcan",
  "selin-yilmaz",
  "canberk",
  "beril-aydin",
  "ece-yilmaz",
  "teknoloji-toplulugu",
  "deniz-ari",
  "bora-demir",
  "selin-kaya",
  "irem-ozturk",
  "misafir",
] as const;

export type CampusAvatarSeed = (typeof campusAvatarSeeds)[number];

export function campusAvatarUrl(seed: CampusAvatarSeed) {
  return `/images/avatars/${seed}.svg`;
}
