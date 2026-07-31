"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "kampus-theme";

/**
 * Forces the page to the dark cosmic theme while mounted, then restores the
 * visitor's real theme preference on unmount (client-side navigation away
 * doesn't re-run the anti-FOUC script in <head>, so this has to happen here).
 */
export function useForceDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;

    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";

    return () => {
      let saved: string | null = null;

      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        // The theme still resolves via system preference below.
      }

      const theme =
        saved === "dark" || saved === "light"
          ? saved
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    };
  }, []);
}

/**
 * Renders nothing; lets Server Component pages (which can't add "use
 * client" themselves, e.g. because they export `metadata`) still force the
 * dark theme by mounting this as a child.
 */
export default function ForceDarkTheme() {
  useForceDarkTheme();
  return null;
}
