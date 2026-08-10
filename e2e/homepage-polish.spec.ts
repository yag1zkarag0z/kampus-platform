import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("homepage-bento")).toBeVisible();
});

test("homepage stays inside the viewport with stable card dimensions", async ({
  page,
}) => {
  const viewport = page.viewportSize();
  const cards = page.getByTestId("homepage-bento-card");

  expect(viewport).not.toBeNull();
  await expect(cards).toHaveCount(4);

  const horizontalOverflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );

    return documentWidth - window.innerWidth;
  });

  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  for (let index = 0; index < 4; index += 1) {
    const box = await cards.nth(index).boundingBox();

    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
      (viewport?.width ?? 0) + 1,
    );
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(280);
    expect(box?.height ?? 0).toBeLessThanOrEqual(500);
  }
});

test("reduced motion freezes looping homepage demos", async ({ page }) => {
  const discoverAnimation = await page
    .getByTestId("discover-rail")
    .evaluate((element) => getComputedStyle(element).animationName);
  const typingAnimation = await page
    .getByTestId("composer-typing-line")
    .evaluate((element) => getComputedStyle(element).animationName);
  const messageAnimation = await page
    .getByTestId("homepage-message-reply")
    .evaluate((element) => getComputedStyle(element).animationName);
  const followTransition = await page
    .getByTestId("follow-suggestion-card")
    .evaluate((element) => getComputedStyle(element).transitionDuration);

  expect(discoverAnimation).toBe("none");
  expect(typingAnimation).toBe("none");
  expect(messageAnimation).toBe("none");
  expect(followTransition).toBe("0s");
});

test("primary entry points and interactive demos remain keyboard focusable", async ({
  page,
}) => {
  const headerLogin = page
    .getByRole("link", { name: "Giriş yap", exact: true })
    .first();
  const guestEntry = page
    .getByRole("button", { name: "Misafir olarak göz at" })
    .first();
  const followButton = page
    .getByRole("button", { name: "Takip et", exact: true })
    .first();

  await headerLogin.focus();
  await expect(headerLogin).toBeFocused();
  await guestEntry.focus();
  await expect(guestEntry).toBeFocused();
  await followButton.scrollIntoViewIfNeeded();
  await followButton.focus();
  await expect(followButton).toBeFocused();

  const focusStyle = await followButton.evaluate(
    (element) => getComputedStyle(element).boxShadow,
  );

  expect(focusStyle).not.toBe("none");
});
