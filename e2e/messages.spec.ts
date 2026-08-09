import { expect, test } from "@playwright/test";

import {
  createUniqueStudentIdentity,
  getSessionState,
  seedMemberSession,
} from "./helpers/session";

test("guest sees an animated unread preview and read-only seed messages", async ({
  page,
}) => {
  await page.goto("/giris");
  await page.getByRole("button", { name: "Misafir olarak göz at" }).click();
  await expect(page).toHaveURL(/\/akis$/);
  await expect.poll(async () => (await getSessionState(page)).mode).toBe(
    "guest",
  );

  const messagesLink = page
    .getByRole("link", { name: /Mesajlar, 3 okunmamış mesaj/i })
    .first();
  await expect(messagesLink).toBeVisible();
  await expect(messagesLink.locator("svg")).toHaveClass(
    /campus-notification-heart--unread/,
  );
  await messagesLink.click();

  await expect(page).toHaveURL(/\/mesajlar$/);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const messagesBox = await page
      .getByRole("region", { name: "Mesajlar" })
      .boundingBox();
    expect(messagesBox?.width ?? 0).toBeGreaterThan(800);
    await expect(
      page.getByRole("heading", { name: "Kampüste ne oluyor?" }),
    ).toBeHidden();
  }
  await expect(
    page.getByRole("button", { name: /Ece Arslan/i }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(
      page.getByRole("link", { name: "Cevap vermek için giriş yap" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: /Ece Arslan/i }).click();
  await expect(
    page
      .getByRole("paragraph")
      .filter({ hasText: /^Notları yükledim, göz atarsın\.$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("note").getByText("Cevap vermek için giriş yap"),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mesaj" })).toHaveCount(0);
});

test("members can start, send, receive, and read a direct message", async ({
  page,
}) => {
  const recipient = createUniqueStudentIdentity("message-recipient");
  await seedMemberSession(page, recipient);
  const recipientCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "kampus_session",
  );
  expect(recipientCookie).toBeDefined();

  // Oturumu revoke etmeden yalnızca tarayıcıdan çıkar; test sonunda alıcı
  // çerezini geri yükleyip gerçek ikinci kullanıcı davranışını doğrulayacağız.
  await page.context().clearCookies();

  const sender = createUniqueStudentIdentity("message-sender");
  await seedMemberSession(page, sender);
  await page.goto("/mesajlar");

  const conversationList = page.getByRole("complementary", {
    name: "Konuşmalar",
  });
  await conversationList.getByRole("button", { name: "Yeni mesaj" }).click();
  await conversationList
    .getByRole("textbox", { name: "Mesaj gönderecek kişi ara" })
    .fill(recipient.username);
  await conversationList
    .getByRole("button", { name: new RegExp(recipient.displayName, "i") })
    .click();

  await expect(page).toHaveURL(/\/mesajlar\?sohbet=/);
  const composer = page.getByRole("textbox", { name: "Mesaj" });
  await composer.fill("Kütüphanede görüşelim mi? 👋");
  const sendResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/v1\/messages\/conversations\/[^/]+\/messages$/.test(response.url()),
  );
  await page.getByRole("button", { name: "Mesajı gönder" }).click();
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.status()).toBe(201);
  await expect(
    page.getByText("Kütüphanede görüşelim mi? 👋", { exact: true }),
  ).toBeVisible();

  await page.context().clearCookies();
  await page.context().addCookies([recipientCookie!]);
  await page.goto("/mesajlar");

  const senderConversation = page
    .getByRole("complementary", { name: "Konuşmalar" })
    .getByRole("button", {
      name: new RegExp(sender.displayName, "i"),
    });
  await expect(senderConversation).toBeVisible();
  await expect(senderConversation).toContainText("Kütüphanede görüşelim mi?");
  await senderConversation.click();
  await expect(
    page.getByText("Kütüphanede görüşelim mi? 👋", { exact: true }),
  ).toBeVisible();
});
