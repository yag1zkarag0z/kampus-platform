"use client";

import type {
  HomepageCtaSource,
  HomepageCtaTarget,
} from "./homepageEvents";

const analyticsEndpoint = "/v1/analytics/homepage-cta";

/**
 * Yalnızca CTA konumu ve hedefi gönderilir. Kullanıcı kimliği, URL sorgusu,
 * IP veya tarayıcı bilgisi istemci payload'una eklenmez.
 */
export function trackHomepageCta(
  source: HomepageCtaSource,
  target: HomepageCtaTarget,
) {
  if (typeof navigator === "undefined") {
    return;
  }

  const body = JSON.stringify({
    event: "homepage_cta_click",
    source,
    target,
  });

  if (typeof navigator.sendBeacon === "function") {
    const accepted = navigator.sendBeacon(
      analyticsEndpoint,
      new Blob([body], { type: "application/json" }),
    );

    if (accepted) {
      return;
    }
  }

  void fetch(analyticsEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}
