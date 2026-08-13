import { expect, test, type Locator, type Page } from "@playwright/test";

import { seedMemberSession } from "./helpers/session";

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
    await expect(
      page.getByRole("tab", { name: "Kaydedilenler" }),
    ).toHaveCount(0);
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

  await page.goto("/kaydedilenler");
  await page.waitForURL("**/akis");
});

test("saved posts live only on the member profile and mobile profile stays last", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMemberSession(page);
  await page.goto("/profil");

  const savedTab = page.getByRole("tab", { name: "Kaydedilenler" });
  await expect(savedTab).toBeVisible();
  await savedTab.click();
  await expect(
    page.getByRole("region", { name: "Kaydedilen gönderiler" }),
  ).toBeVisible();

  const mobileNavigation = page.getByRole("navigation", {
    name: "Mobil uygulama menüsü",
  });
  const links = mobileNavigation.getByRole("link");

  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveAttribute("href", "/akis");
  await expect(links.nth(1)).toHaveAttribute("href", "/kesfet");
  await expect(links.nth(2)).toHaveAttribute("href", "/konu-olustur");
  await expect(links.nth(3)).toHaveAttribute("href", "/takip");
  await expect(links.nth(4)).toHaveAttribute("href", "/profil");
});
