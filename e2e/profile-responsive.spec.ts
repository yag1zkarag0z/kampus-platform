import { expect, test, type Locator, type Page } from "@playwright/test";

const phoneViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

async function expectInsideViewport(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );

    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test("profile hero stays usable across phone widths", async ({ page }) => {
  await page.goto("/giris");
  await page.getByRole("button", { name: "Misafir olarak göz at" }).click();
  await page.waitForURL("**/akis");

  for (const viewport of phoneViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/profil");

    const profileHeading = page.getByRole("heading", {
      name: "Misafir hesabı",
    });
    const displayName = page.getByRole("heading", {
      name: "İsimsiz Kullanıcı",
    });
    const loginAction = page.getByRole("link", { name: "Giriş yap" });
    const registerAction = page.getByRole("link", { name: "Kayıt ol" });
    const profileHeader = profileHeading.locator("xpath=ancestor::header");

    await expect(profileHeading).toBeVisible();
    await expect(loginAction).toBeVisible();
    await expect(registerAction).toBeVisible();
    await expectInsideViewport(displayName, viewport.width);
    await expectInsideViewport(loginAction, viewport.width);
    await expectInsideViewport(registerAction, viewport.width);
    await expectNoHorizontalOverflow(page);

    await expect
      .poll(() =>
        profileHeader.evaluate((element) => getComputedStyle(element).position),
      )
      .toBe("relative");
  }
});
