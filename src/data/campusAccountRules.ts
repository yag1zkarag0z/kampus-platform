export const campusUsernamePattern =
  /^(?=.{3,24}$)[a-z0-9]+(?:[._][a-z0-9]+)*$/;

export const reservedCampusUsernames = new Set([
  "anonim",
  "sen",
  "admin",
  "moderator",
  "kampus",
  "destek",
]);
