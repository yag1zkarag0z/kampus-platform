import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function enterAsGuest(page: Page) {
  await page.goto("/giris");
  await page.getByRole("button", { name: "Misafir olarak göz at" }).click();
  await page.waitForURL("**/akis");
}

test("public information header fits the narrowest supported phone", async ({
  page,
}) => {
  const viewport = { width: 320, height: 568 };
  await page.setViewportSize(viewport);

  for (const path of ["/nasil-calisir", "/guvenlik", "/sss"]) {
    await page.goto(path);

    const header = page.getByRole("banner");
    const logo = header.getByRole("link", { name: "KAMPÜS ana sayfa" });
    const login = header.getByRole("link", { name: "Giriş yap" });

    await expect(logo).toBeVisible();
    await expect(login).toBeVisible();
    await expect(
      header.getByRole("link", { name: "Ana sayfa", exact: true }),
    ).toBeHidden();
    await expectInsideViewport(logo, viewport.width);
    await expectInsideViewport(login, viewport.width);
    await expectNoHorizontalOverflow(page);
  }
});

test("notification activity and mobile navigation fit at 320px", async ({
  page,
}) => {
  const viewport = { width: 320, height: 568 };
  await page.setViewportSize(viewport);
  await enterAsGuest(page);
  await page.goto("/bildirimler");

  const mobileLabels = page
    .getByRole("navigation", { name: "Mobil uygulama menüsü" })
    .locator("a > span:last-child");
  const labelWidths = await mobileLabels.evaluateAll((elements) =>
    elements.map((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    })),
  );

  for (const width of labelWidths) {
    expect(width.scrollWidth).toBeLessThanOrEqual(width.clientWidth + 1);
  }

  await expect(page.locator("#notifications-list h2").first()).toBeVisible();

  const firstNotification = page.locator("#notifications-list li").first();
  const mobileTime = firstNotification.locator("time:visible");
  const actorLine = firstNotification.locator("[data-notification-copy]");
  const [timeBox, actorBox] = await Promise.all([
    mobileTime.boundingBox(),
    actorLine.boundingBox(),
  ]);

  expect(timeBox).not.toBeNull();
  expect(actorBox).not.toBeNull();
  expect(timeBox?.y ?? 0).toBeGreaterThan(actorBox?.y ?? 0);

  // Bildirim sayfası açıldığında mevcut bildirimler topluca okunmuş sayılır.
  await expect(
    page.locator('#notifications-list a[aria-label*="Okunmamış"]'),
  ).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
});

test("feed composer tools remain fully visible across phone widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await enterAsGuest(page);

  for (const width of [320, 360, 390, 430, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/akis");

    const toolGroup = page.locator('[aria-label="Gönderi araçları"]');
    const geometry = await toolGroup.evaluate((element) => {
      const groupRect = element.getBoundingClientRect();
      const visibleTools = [...element.children]
        .filter((child) => {
          const style = getComputedStyle(child);
          const rect = child.getBoundingClientRect();
          return style.display !== "none" && rect.width > 0;
        })
        .map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
          };
        });

      return {
        left: groupRect.left,
        right: groupRect.right,
        visibleTools,
      };
    });

    expect(geometry.visibleTools).toHaveLength(width < 640 ? 4 : 5);
    for (const tool of geometry.visibleTools) {
      expect(tool.left).toBeGreaterThanOrEqual(geometry.left - 1);
      expect(tool.right).toBeLessThanOrEqual(geometry.right + 1);
    }

    await expectNoHorizontalOverflow(page);
  }
});

test("mobile pages hide scrollbar chrome without disabling scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await enterAsGuest(page);
  await expect(page.getByRole("article").first()).toBeVisible();

  const mobileState = await page.evaluate(() => ({
    scrollbarWidth: getComputedStyle(document.documentElement).getPropertyValue(
      "scrollbar-width",
    ),
    maxScroll:
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      ) - window.innerHeight,
  }));

  expect(mobileState.scrollbarWidth).toBe("none");
  expect(mobileState.maxScroll).toBeGreaterThan(100);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/akis");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "scrollbar-width",
      ),
    ),
  ).not.toBe("none");
});

test("tablet application rail shows icons without a clipped wordmark", async ({
  page,
}) => {
  const viewport = { width: 768, height: 1024 };
  await page.setViewportSize(viewport);
  await enterAsGuest(page);

  const logoLink = page.getByRole("link", {
    name: "KAMPÜS akışına git",
  });
  const logoVariants = logoLink.locator(":scope > span");
  const homeLink = page
    .getByRole("navigation", { name: "Uygulama menüsü" })
    .getByRole("link", { name: "Ana sayfa", exact: true });

  await expect(logoVariants.nth(0)).toBeVisible();
  await expect(logoVariants.nth(1)).toBeHidden();
  await expect(homeLink.locator(":scope > span:last-child")).toBeHidden();
  await expectInsideViewport(logoLink, viewport.width);
  await expectNoHorizontalOverflow(page);
});

test("inline reply composer keeps its writing area on narrow phones", async ({
  page,
}) => {
  const viewport = { width: 320, height: 568 };
  await page.setViewportSize(viewport);
  await enterAsGuest(page);
  await page.goto(
    "/gonderi/best-study-spot/yorum/comment-best-study-spot-ece",
  );

  const form = page.locator('form[aria-hidden="true"]');
  const textarea = form.getByLabel("Yanıt metni");
  const submit = form.locator('button[type="submit"]');
  const [textareaBox, submitBox] = await Promise.all([
    textarea.boundingBox(),
    submit.boundingBox(),
  ]);

  expect(textareaBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(textareaBox?.width ?? 0).toBeGreaterThanOrEqual(200);
  expect(submitBox?.y ?? 0).toBeGreaterThanOrEqual(
    (textareaBox?.y ?? 0) + (textareaBox?.height ?? 0),
  );
  await expectInsideViewport(textarea, viewport.width);
  await expectInsideViewport(submit, viewport.width);
  await expectNoHorizontalOverflow(page);
});
