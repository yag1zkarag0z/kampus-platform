import { expect, test } from "@playwright/test";

import { seedMemberSession } from "./helpers/session";

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

test("member can complete the demo login flow", async ({ page }) => {
  await page.goto("/giris");

  await page
    .getByLabel("Yaşar öğrenci e-postan")
    .fill("e2e.student@stu.yasar.edu.tr");
  await page
    .getByRole("button", { name: "Demo giriş kodunu hazırla" })
    .click();
  await page.getByLabel("Giriş kodu").fill("135790");
  await page.getByRole("button", { name: "Giriş yap" }).click();

  await expect(
    page.getByRole("heading", { name: "Giriş tamamlandı." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Akışa geç" }).click();
  await expect(page).toHaveURL(/\/akis$/);
  await expect(page.getByLabel("Gönderi metni")).toBeVisible();

  const session = await page.evaluate(() => ({
    mode: localStorage.getItem("kampus-session-v1"),
    expiresAt: Number(
      localStorage.getItem("kampus-session-expires-v1"),
    ),
  }));
  expect(session.mode).toBe("member");
  expect(session.expiresAt).toBeGreaterThan(Date.now());
});

test("registration persists a member account", async ({ page }) => {
  await page.goto("/kayit");

  await page
    .getByLabel("Yaşar öğrenci e-postan")
    .fill("new.student@stu.yasar.edu.tr");
  await page
    .getByRole("button", {
      name: "Demo doğrulama kodunu hazırla",
    })
    .click();
  await page
    .getByRole("textbox", { name: "Doğrulama kodu", exact: true })
    .fill("135790");
  await page.getByRole("button", { name: "Kodu doğrula" }).click();

  await page.getByLabel("Kullanıcı adı").fill("e2e_student");
  await page.getByLabel(/Görünen adın/).fill("E2E Öğrencisi");
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

  const account = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("kampus-account-v1") ?? "{}"),
  );
  expect(account).toMatchObject({
    role: "member",
    profile: {
      username: "e2e_student",
      displayName: "E2E Öğrencisi",
      department: "Yazılım Mühendisliği",
      year: "2. sınıf",
    },
  });
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
  await card.getByText(body).click();

  await expect(page).toHaveURL(/\/gonderi\/post-/);
  await expect(page.getByText(body).first()).toBeVisible();
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
