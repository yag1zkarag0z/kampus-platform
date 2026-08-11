import { expect, request as playwrightRequest, test } from "@playwright/test";

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
  const guestConversationList = page.getByRole("complementary", {
    name: "Konuşmalar",
  });
  const guestConversationSearch = guestConversationList.getByRole(
    "searchbox",
    { name: "Konuşmalarda ara" },
  );
  await guestConversationSearch.fill("Mert");
  await expect(
    guestConversationList.getByRole("button", { name: /Mert Can/i }),
  ).toBeVisible();
  await expect(
    guestConversationList.getByRole("button", { name: /Ece Arslan/i }),
  ).toHaveCount(0);
  await guestConversationSearch.fill("");
  await expect(
    guestConversationList.getByRole("button", { name: /Ece Arslan/i }),
  ).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(
      page.getByRole("link", { name: "Cevap vermek için giriş yap" }),
    ).toBeVisible();
  }
  await guestConversationList
    .getByRole("button", { name: /Ece Arslan/i })
    .click();
  await expect(
    page.getByRole("link", { name: /Ece Arslan @ecearslan/i }),
  ).toHaveAttribute("href", "/profil/ecearslan");
  await page
    .getByRole("button", { name: "Ece Arslan için konuşma seçenekleri" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Profili gör" }),
  ).toHaveAttribute("href", "/profil/ecearslan");
  await expect(
    page.getByRole("menuitem", { name: "Kullanıcıyı bildir" }),
  ).toHaveAttribute("href", "/giris");
  await expect(
    page.getByRole("menuitem", { name: "Kullanıcıyı engelle" }),
  ).toHaveAttribute("href", "/giris");
  await page
    .getByRole("button", { name: "Konuşma seçeneklerini kapat" })
    .click();
  await expect(
    page
      .getByRole("paragraph")
      .filter({ hasText: /^Notları yükledim, göz atarsın\.$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("note").getByText("Cevap vermek için giriş yap"),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mesaj" })).toHaveCount(0);
  await expect(page.getByRole("separator", { name: "Bugün" })).toHaveCount(1);
  await expect(page.getByRole("separator", { name: "Dün" })).toHaveCount(1);

  const guestMessageHistory = page.getByLabel("Mesaj geçmişi");
  await expect.poll(() =>
    guestMessageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeLessThan(100);
  await guestMessageHistory.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect.poll(() =>
    guestMessageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeGreaterThan(100);
  const guestNewMessagesButton = page.getByRole("button", {
    name: "Yeni mesajlar ↓",
  });
  await expect(guestNewMessagesButton).toBeVisible({ timeout: 7_000 });
  await guestNewMessagesButton.click();
  await expect(
    guestMessageHistory.getByText("Sunum dosyasını da güncelledim.", {
      exact: true,
    }),
  ).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "Mesaj menüsünü aç" }).last().click();
    await expect(
      page.getByRole("menuitem", { name: "Bildirmek için giriş yap" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Vazgeç" }).click();
    await page.getByRole("button", { name: "Konuşmalara dön" }).click();
  }

  await guestConversationList
    .getByRole("button", { name: /Mert Can/i })
    .click();
  await expect(page.getByText("Görüldü", { exact: true })).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "Konuşmalara dön" }).click();
  }
  await guestConversationList
    .getByRole("button", { name: /Deniz Akın/i })
    .click();
  await expect(page.getByText("Gönderiliyor…", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gönderilemedi · Tekrar dene" }),
  ).toBeVisible();
});

test("members can send, accept, and continue a message request", async ({
  page,
}) => {
  test.setTimeout(60_000);

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
  const senderCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "kampus_session",
  );
  expect(senderCookie).toBeDefined();
  await page.goto("/mesajlar");

  const conversationList = page.getByRole("complementary", {
    name: "Konuşmalar",
  });
  await conversationList
    .getByRole("button", { name: "Yeni mesaj", exact: true })
    .click();
  await conversationList
    .getByRole("textbox", { name: "Mesaj gönderecek kişi ara" })
    .fill(recipient.username);
  await conversationList
    .getByRole("button", { name: new RegExp(recipient.displayName, "i") })
    .click();

  await expect(page).toHaveURL(/\/mesajlar\?sohbet=/);
  const conversationId = new URL(page.url()).searchParams.get("sohbet");
  expect(conversationId).toBeTruthy();
  const composer = page.getByRole("textbox", { name: "Mesaj" });
  await composer.fill("Kütüphanede görüşelim mi? 👋");
  let failFirstMessageAttempt = true;
  await page.route("**/v1/messages/conversations/*/messages", async (route) => {
    if (route.request().method() !== "POST" || !failFirstMessageAttempt) {
      await route.continue();
      return;
    }
    failFirstMessageAttempt = false;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEMPORARY_FAILURE" } }),
    });
  });
  await page.getByRole("button", { name: "Mesajı gönder" }).click();
  await expect(page.getByText("Gönderiliyor…", { exact: true })).toBeVisible();
  const retryButton = page.getByRole("button", {
    name: "Gönderilemedi · Tekrar dene",
  });
  await expect(retryButton).toBeVisible();
  const sendResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.status() === 201 &&
      /\/v1\/messages\/conversations\/[^/]+\/messages$/.test(response.url()),
  );
  await retryButton.click();
  const sendResponse = await sendResponsePromise;
  expect(sendResponse.status()).toBe(201);
  await expect(
    page.getByText("Kütüphanede görüşelim mi? 👋", { exact: true }),
  ).toBeVisible();

  await page.context().clearCookies();
  await page.context().addCookies([recipientCookie!]);
  await page.goto("/mesajlar");
  await page.getByRole("button", { name: /İstekler/ }).click();

  const conversationSearch = page.getByRole("searchbox", {
    name: "Konuşmalarda ara",
  });
  await conversationSearch.fill(sender.displayName);
  await expect(
    page
      .getByRole("complementary", { name: "Konuşmalar" })
      .getByRole("button", { name: new RegExp(sender.displayName, "i") }),
  ).toBeVisible();
  await conversationSearch.fill("");

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
  await expect(page.getByRole("separator", { name: "Bugün" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mesaj" })).toHaveCount(0);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "Mesaj menüsünü aç" }).click();
    await page.getByRole("menuitem", { name: "Mesajı bildir" }).click();
  } else {
    await page.getByRole("button", { name: "Mesajı bildir" }).click();
  }
  const reportDialog = page.getByRole("dialog", { name: "Mesajı bildir" });
  await expect(reportDialog).toBeVisible();
  const reportResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith("/v1/reports"),
  );
  await reportDialog.getByRole("button", { name: "Bildir", exact: true }).click();
  const reportResponse = await reportResponsePromise;
  expect(reportResponse.status()).toBe(201);
  await expect(
    page.getByText("Mesaj moderasyon sırasına eklendi.", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: `${sender.displayName} için konuşma seçenekleri`,
    })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Profili gör" }),
  ).toHaveAttribute("href", `/profil/${sender.username}`);
  await expect(
    page.getByRole("menuitem", { name: "Kullanıcıyı engelle" }),
  ).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Kullanıcıyı bildir" })
    .click();
  const memberReportDialog = page.getByRole("dialog", {
    name: "Kullanıcıyı bildir",
  });
  await expect(memberReportDialog).toBeVisible();
  await memberReportDialog.getByRole("button", { name: "Vazgeç" }).click();

  await page.getByRole("button", { name: "Kabul et" }).click();
  await expect(
    page.getByText("Mesaj isteği kabul edildi.", { exact: true }),
  ).toBeVisible();

  await page.context().clearCookies();
  await page.context().addCookies([senderCookie!]);
  await page.goto("/mesajlar");
  await page
    .getByRole("complementary", { name: "Konuşmalar" })
    .getByRole("button", { name: new RegExp(recipient.displayName, "i") })
    .click();
  await expect(page.getByText("Görüldü", { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await page.context().addCookies([recipientCookie!]);
  await page.goto(`/mesajlar?sohbet=${conversationId}`);

  const replyComposer = page.getByRole("textbox", { name: "Mesaj" });
  await expect(replyComposer).toBeVisible();
  await replyComposer.fill("Olur, görüşürüz!");
  await page.getByRole("button", { name: "Mesajı gönder" }).click();
  await expect(
    page.getByText("Olur, görüşürüz!", { exact: true }),
  ).toBeVisible();

  for (let index = 0; index < 16; index += 1) {
    const response = await page.request.post(
      `/v1/messages/conversations/${conversationId}/messages`,
      {
        headers: { Origin: new URL(page.url()).origin },
        data: {
          body: `Scroll testi mesajı ${index + 1}: kampüs konuşması devam ediyor.`,
          clientMessageId: crypto.randomUUID(),
        },
      },
    );
    expect(response.status()).toBe(201);
  }

  await page.context().clearCookies();
  await page.context().addCookies([senderCookie!]);
  await page.goto(`/mesajlar?sohbet=${conversationId}`);
  const messageHistory = page.getByLabel("Mesaj geçmişi");
  await expect.poll(() =>
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeLessThan(100);
  await messageHistory.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });

  const appOrigin = new URL(page.url()).origin;
  const recipientApi = await playwrightRequest.newContext({
    baseURL: appOrigin,
    extraHTTPHeaders: {
      Cookie: `kampus_session=${recipientCookie!.value}`,
      Origin: appOrigin,
    },
  });
  const newestBody = "Aşağıda bekleyen yepyeni mesaj.";
  const newestResponse = await recipientApi.post(
    `/v1/messages/conversations/${conversationId}/messages`,
    {
      data: { body: newestBody, clientMessageId: crypto.randomUUID() },
    },
  );
  expect(newestResponse.status()).toBe(201);
  await recipientApi.dispose();

  const newMessagesButton = page.getByRole("button", {
    name: "Yeni mesajlar ↓",
  });
  await expect(newMessagesButton).toBeVisible({ timeout: 12_000 });
  await expect(
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).resolves.toBeGreaterThan(100);
  await newMessagesButton.click();
  await expect(page.getByText(newestBody, { exact: true })).toBeVisible();
  await expect.poll(() =>
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeLessThan(100);
});
