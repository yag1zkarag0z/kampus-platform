export const HOMEPAGE_CTA_SOURCES = [
  "header_login",
  "header_register",
  "hero_guest",
  "hero_register",
  "closing_guest",
  "closing_register",
] as const;

export const HOMEPAGE_CTA_TARGETS = ["login", "register", "guest"] as const;

export type HomepageCtaSource = (typeof HOMEPAGE_CTA_SOURCES)[number];
export type HomepageCtaTarget = (typeof HOMEPAGE_CTA_TARGETS)[number];
