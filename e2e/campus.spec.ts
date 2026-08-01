import { expect, test } from "@playwright/test";

import { waitForOtpEmail } from "./helpers/mailpit";
import {
  createUniqueStudentIdentity,
  getSessionState,
  logoutSession,
  seedMemberSession,
} from "./helpers/session";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("public home presents the product and entry points", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Yaşar’da bugün ne konuşuluyor/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Kayıt ol" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Misafir olarak giriş yap" }),
  ).toBeVisible();
});

test("signed-out platform access redirects to login", async ({ page }) => {
  await page.goto("/akis");

  await expect(page).toHaveURL(/\/giris$/);
  await expect(
    page.getByRole("heading", { name: "Tekrar hoş geldin." }),
  ).toBeVisible();
});

test("member can complete the real OTP login flow", async ({ page }) => {
  const identity = createUniqueStudentIdentity("login");

  await seedMemberSession(page, identity);
  await logoutSession(page, identity.requestIp);
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": identity.requestIp,
  });
  await page.goto("/giris");

  await page
    .getByLabel("Yaşar öğrenci e-postan")
    .fill(identity.email);
  await page
    .getByRole("button", { name: "Giriş kodu gönder" })
    .click();
  const code = await waitForOtpEmail(identity.email, "login");

  await page.getByLabel("Giriş kodu").fill(code);
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(
    page.getByRole("heading", { name: "Giriş tamamlandı." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Akışa geç" }).click();
  await expect(page).toHaveURL(/\/akis$/);
  await expect(page.getByLabel("Gönderi metni")).toBeVisible();

  const session = await getSessionState(page);

  expect(session.mode).toBe("member");
  expect(session.user?.profile.username).toBe(identity.username);
  await expect
    .poll(() =>
      page.evaluate(() => document.cookie.includes("kampus_session")),
    )
    .toBe(false);

  await page.reload();
  await expect(page.getByLabel("Gönderi metni")).toBeVisible();
});

test("registration persists a member account", async ({ page }) => {
  const identity = createUniqueStudentIdentity("registration");

  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": identity.requestIp,
  });
  await page.goto("/kayit");

  await page
    .getByLabel("Yaşar öğrenci e-postan")
    .fill(identity.email);
  await page
    .getByRole("button", {
      name: "Doğrulama kodu gönder",
    })
    .click();
  const code = await waitForOtpEmail(identity.email, "registration");

  await page
    .getByRole("textbox", { name: "Doğrulama kodu", exact: true })
    .fill(code);
  await page.getByRole("button", { name: "Kodu doğrula" }).click();

  await page.getByLabel("Kullanıcı adı").fill(identity.username);
  await page.getByLabel(/Görünen adın/).fill(identity.displayName);
  await page
    .getByRole("combobox", { name: "Bölüm", exact: true })
    .selectOption("Yazılım Mühendisliği");
  await page
    .getByRole("combobox", { name: "Sınıf", exact: true })
    .selectOption("2. sınıf");
  await page
    .getByRole("checkbox", {
      name: /Kullanım ve Topluluk Sözleşmesi/,
    })
    .check();
  await page.getByRole("button", { name: "Kaydı tamamla" }).click();

  await expect(
    page.getByRole("heading", { name: "Aramıza hoş geldin." }),
  ).toBeVisible();

  const session = await getSessionState(page);

  expect(session).toMatchObject({
    mode: "member",
    user: {
      role: "member",
      profile: {
        username: identity.username,
        displayName: identity.displayName,
        department: "Yazılım Mühendisliği",
        year: "2. sınıf",
      },
    },
  });
});

test("member profile and settings persist across reloads", async ({
  page,
}) => {
  const identity = createUniqueStudentIdentity("profile");
  const updatedUsername = `${identity.username}_edit`;
  const updatedDisplayName = `Kalıcı profil ${identity.username.slice(-6)}`;
  const updatedBio =
    "Profil ve bildirim tercihleri PostgreSQL üzerinde kalıcı.";

  await seedMemberSession(page, identity);
  await page.goto("/profil/duzenle");

  await page.getByLabel("Görünen ad").fill(updatedDisplayName);
  await page.getByLabel("Kullanıcı adı").fill(updatedUsername);
  await page.getByLabel("Biyografi").fill(updatedBio);
  await page
    .getByRole("combobox", { name: "Bölüm", exact: true })
    .selectOption("Bilgisayar Mühendisliği");
  await page
    .getByRole("combobox", { name: "Sınıf", exact: true })
    .selectOption("3. sınıf");
  await page
    .getByRole("button", { name: "Değişiklikleri kaydet" })
    .click();

  await expect(page).toHaveURL(/\/profil$/);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: updatedDisplayName,
    }),
  ).toBeVisible();
  await expect(page.getByText(`@${updatedUsername}`, { exact: true }))
    .toBeVisible();
  await expect(page.getByText(updatedBio, { exact: true })).toBeVisible();

  const profileSession = await getSessionState(page);

  expect(profileSession.mode).toBe("member");
  if (profileSession.mode !== "member") {
    throw new Error("Profile update did not preserve the member session.");
  }

  expect(profileSession.user.profile).toMatchObject({
    username: updatedUsername,
    displayName: updatedDisplayName,
    department: "Bilgisayar Mühendisliği",
    year: "3. sınıf",
    bio: updatedBio,
  });

  await page.reload();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: updatedDisplayName,
    }),
  ).toBeVisible();
  await expect(page.getByText(`@${updatedUsername}`, { exact: true }))
    .toBeVisible();
  await expect(page.getByText(updatedBio, { exact: true })).toBeVisible();

  await page.goto("/ayarlar");
  const likesSwitch = page.getByRole("switch", { name: "Beğeniler" });

  await expect(likesSwitch).toHaveAttribute("aria-checked", "true");
  await likesSwitch.click();
  await expect(likesSwitch).toHaveAttribute("aria-checked", "false");
  await expect
    .poll(async () => {
      const session = await getSessionState(page);
      return session.mode === "member"
        ? session.user.settings.notifyLikes
        : null;
    })
    .toBe(false);

  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Beğeniler" }),
  ).toHaveAttribute("aria-checked", "false");
});

test("guest stays read-only and cannot open protected screens", async ({
  page,
}) => {
  await page.goto("/giris");
  await page
    .getByRole("button", { name: "Misafir olarak göz at" })
    .click();

  await expect(page).toHaveURL(/\/akis$/);
  await expect(
    page.getByText("Misafir görünümü", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Misafir akışındaki 20 gönderiyi görüntülüyorsun."),
  ).toBeVisible();
  await expect(page.getByLabel("Gönderi metni")).toHaveCount(0);

  await page.goto("/profil/duzenle");
  await expect(page).toHaveURL(/\/akis$/);
});

test("member can publish a quick post and open it from the card body", async ({
  page,
}) => {
  await seedMemberSession(page);
  const body = `E2E kampüs gönderisi ${Date.now()}`;

  await page.goto("/akis");
  await page.getByLabel("Gönderi metni").fill(body);
  await page.getByRole("button", { name: "Paylaş" }).click();

  await expect(
    page.getByText("Gönderin akışta paylaşıldı."),
  ).toBeVisible();

  const card = page.getByRole("article").filter({ hasText: body }).first();
  await expect(card).toBeVisible();

  const interactionButtons = card.locator("button[aria-pressed]");
  const likeButton = interactionButtons.first();
  const bookmarkButton = interactionButtons.last();
  const likeResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/like"),
  );

  await likeButton.click();
  expect((await likeResponse).status()).toBe(200);
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");

  const bookmarkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/bookmark"),
  );

  await bookmarkButton.click();
  expect((await bookmarkResponse).status()).toBe(200);
  await expect(bookmarkButton).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  const persistedCard = page
    .getByRole("article")
    .filter({ hasText: body })
    .first();

  await expect(
    persistedCard.locator('button[aria-pressed="true"]'),
  ).toHaveCount(2);

  await persistedCard.getByText(body).click();

  await expect(page).toHaveURL(
    /\/gonderi\/[0-9a-f]{8}-[0-9a-f-]{27}$/i,
  );
  await expect(page.getByText(body).first()).toBeVisible();

  await page.reload();
  await expect(page.getByText(body).first()).toBeVisible();

  const commentBody = `E2E kalıcı yorum ${Date.now()}`;
  await page.getByLabel("Yorumunu ekle").fill(commentBody);
  await page.getByRole("button", { name: "Yorum yap" }).click();
  await expect(
    page.getByText("Yorumun gönderiye eklendi."),
  ).toBeVisible();
  await expect(
    page.locator("#yorumlar li").filter({ hasText: commentBody }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator("#yorumlar li").filter({ hasText: commentBody }),
  ).toBeVisible();
});

test("responsive application navigation reaches explore", async ({
  page,
}, testInfo) => {
  await seedMemberSession(page);
  await page.goto("/akis");

  if (testInfo.project.name === "mobile-chromium") {
    await expect(
      page.getByRole("navigation", {
        name: "Mobil uygulama menüsü",
      }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("button", {
        name: "Masaüstü menüsünü kapat",
      }),
    ).toBeVisible();
  }

  await page.getByRole("link", { name: "Keşfet" }).click();
  await expect(page).toHaveURL(/\/kesfet$/);
  await expect(
    page.getByLabel("Kampüs gönderilerinde ara"),
  ).toBeVisible();
});
