import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

const phoneViewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

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

async function expectInsideViewport(
  locator: Locator,
  viewportWidth: number,
) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    viewportWidth + 1,
  );
}

async function expectUsesMobilePageFlow(
  page: Page,
  locator: Locator,
  viewport: { width: number; height: number },
) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeCloseTo(viewport.width, 0);
  expect(box?.y ?? 0).toBeGreaterThanOrEqual(63);
  expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
    viewport.height / 2,
  );
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThanOrEqual(
    viewport.height - 1,
  );

  const nestedScrollers = await page.evaluate(() =>
    [...document.querySelectorAll('section[aria-label$="formu"] *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          (style.overflowY === "auto" || style.overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 2
        );
      })
      .map((element) => element.tagName),
  );

  expect(nestedScrollers).toEqual([]);
}

for (const viewport of phoneViewports) {
  test(`login fits a ${viewport.width}px phone`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/giris");

    const card = page.locator('section[aria-label="Giriş formu"] > div');
    const primaryButton = page.getByRole("button", {
      name: "Giriş kodu gönder",
    });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(card).toBeVisible();
    await expectInsideViewport(card, viewport.width);
    await expectUsesMobilePageFlow(page, card, viewport);
    await expectInsideViewport(primaryButton, viewport.width);
    await expectNoHorizontalOverflow(page);

    const primaryBox = await primaryButton.boundingBox();
    expect(primaryBox?.height ?? 0).toBeGreaterThanOrEqual(49);
    expect(primaryBox?.height ?? 0).toBeLessThanOrEqual(53);
  });

  test(`registration and avatars fit a ${viewport.width}px phone`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/kayit");

    const registrationButton = page.getByRole("button", {
      name: "Doğrulama kodu gönder",
    });
    await expect(registrationButton).toBeVisible();
    await expectInsideViewport(registrationButton, viewport.width);
    await expectNoHorizontalOverflow(page);

    await page.goto("/kayit?preview=avatar");

    const card = page.locator('section[aria-label="Kayıt formu"] > div');
    const primaryButton = page.getByRole("button", {
      name: "Bu avatarı kullan",
    });
    const avatars = page.getByRole("radio");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Avatarını seç." }),
    ).toBeVisible();
    await expect(avatars).toHaveCount(8);
    await expectInsideViewport(card, viewport.width);
    await expectUsesMobilePageFlow(page, card, viewport);
    await expectInsideViewport(primaryButton, viewport.width);
    await expectNoHorizontalOverflow(page);

    const primaryBox = await primaryButton.boundingBox();
    const firstAvatarBox = await avatars.first().boundingBox();
    expect(primaryBox?.height ?? 0).toBeGreaterThanOrEqual(49);
    expect(primaryBox?.height ?? 0).toBeLessThanOrEqual(53);
    expect(firstAvatarBox?.width ?? 0).toBeGreaterThanOrEqual(50);
    expect(firstAvatarBox?.width ?? 0).toBeLessThanOrEqual(96);
  });
}

for (const viewport of [
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]) {
  test(`auth layouts stay bounded at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const path of ["/giris", "/kayit?preview=avatar"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);

      const formSection = page.locator('section[aria-label$="formu"]');
      const card = formSection.locator(":scope > div");
      const box = await card.boundingBox();
      const maximumCardWidth =
        viewport.width >= 1536
          ? 901
          : viewport.width >= 1280
            ? 861
            : viewport.width >= 1024
              ? 721
              : 545;

      expect(box).not.toBeNull();
      expect(box?.width ?? 0).toBeLessThanOrEqual(maximumCardWidth);

      if (viewport.width >= 1536) {
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(899);
      } else if (viewport.width >= 1280) {
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(859);
      }

      await expectInsideViewport(card, viewport.width);

      if (viewport.width >= 1024) {
        const heading = page.getByRole("heading", { level: 1 });
        const headingBox = await heading.boundingBox();
        const lineHeight = await heading.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).lineHeight),
        );

        expect(headingBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan(
          lineHeight * 1.3,
        );
      }
    }
  });
}

test("login and registration share the same desktop geometry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  async function readGeometry(
    path: string,
    formLabel: string,
    switchLabel: string,
  ) {
    await page.goto(path);

    const card = page.locator(`section[aria-label="${formLabel}"] > div`);
    const heading = card.getByRole("heading", { level: 2 });
    const label = card.locator("label").first();
    const input = card.locator("input").first();
    const authSwitch = page
      .locator("header")
      .getByRole("link", { name: switchLabel });

    const [cardBox, switchBox, alignments] = await Promise.all([
      card.boundingBox(),
      authSwitch.boundingBox(),
      Promise.all(
        [heading, label, input].map((locator) =>
          locator.evaluate((element) => getComputedStyle(element).textAlign),
        ),
      ),
    ]);

    expect(cardBox).not.toBeNull();
    expect(switchBox).not.toBeNull();

    return { cardBox, switchBox, alignments };
  }

  const login = await readGeometry(
    "/giris",
    "Giriş formu",
    "Kayıt ol",
  );
  const registration = await readGeometry(
    "/kayit",
    "Kayıt formu",
    "Giriş yap",
  );

  expect(login.cardBox?.width).toBeCloseTo(registration.cardBox?.width ?? 0, 0);
  expect(login.cardBox?.height).toBeCloseTo(
    registration.cardBox?.height ?? 0,
    0,
  );
  expect(login.cardBox?.y).toBeCloseTo(registration.cardBox?.y ?? 0, 0);
  expect(login.cardBox?.y ?? 0).toBeGreaterThan(220);
  expect((login.cardBox?.x ?? 0) + (login.cardBox?.width ?? 0) / 2).toBeCloseTo(
    720,
    0,
  );
  expect(
    (registration.cardBox?.x ?? 0) +
      (registration.cardBox?.width ?? 0) / 2,
  ).toBeCloseTo(720, 0);
  expect(login.switchBox?.width).toBeCloseTo(
    registration.switchBox?.width ?? 0,
    0,
  );
  expect(login.switchBox?.height).toBeCloseTo(
    registration.switchBox?.height ?? 0,
    0,
  );
  expect(login.alignments).toEqual(["center", "center", "center"]);
  expect(registration.alignments).toEqual(["center", "center", "center"]);
  await expect(
    page.getByRole("button", { name: "Misafir olarak göz at" }),
  ).toBeVisible();
});
