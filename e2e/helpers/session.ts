import type { Page } from "@playwright/test";

export async function seedMemberSession(page: Page) {
  await page.addInitScript(
    ({ expiresAt }) => {
      window.localStorage.setItem("kampus-session-v1", "member");
      window.localStorage.setItem(
        "kampus-session-expires-v1",
        String(expiresAt),
      );
    },
    { expiresAt: Date.now() + 8 * 60 * 60 * 1_000 },
  );
}
