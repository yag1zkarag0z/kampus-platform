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
    page.getByRole("status", { name: /Ece Arslan yazıyor/i }),
  ).toBeVisible({ timeout: 2_500 });
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
  await expect(
    guestMessageHistory.getByText("Sunum dosyasını da güncelledim.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 7_000 });

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

test("members receive realtime typing and messages after reconnect", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Realtime is covered once.");
  test.setTimeout(90_000);

  const senderContext = await browser.newContext();
  const recipientContext = await browser.newContext();
  const fallbackContext = await browser.newContext();
  const senderPage = await senderContext.newPage();
  const recipientPage = await recipientContext.newPage();
  const recipientRealtimeFrames: string[] = [];
  recipientPage.on("websocket", (socket) => {
    if (!socket.url().includes("/v1/realtime")) return;
    socket.on("framereceived", (frame) => {
      if (typeof frame.payload === "string") {
        recipientRealtimeFrames.push(frame.payload);
      }
    });
  });

  try {
    const sender = createUniqueStudentIdentity("realtime-sender");
    const recipient = createUniqueStudentIdentity("realtime-recipient");
    await seedMemberSession(senderPage, sender);
    await seedMemberSession(recipientPage, recipient);
    await Promise.all([
      senderPage.goto("/mesajlar"),
      recipientPage.goto("/mesajlar"),
    ]);
    const origin = new URL(senderPage.url()).origin;

    const [senderFollow, recipientFollow] = await Promise.all([
      senderPage.request.post(
        `/v1/users/${encodeURIComponent(recipient.username)}/follow`,
        { headers: { Origin: origin } },
      ),
      recipientPage.request.post(
        `/v1/users/${encodeURIComponent(sender.username)}/follow`,
        { headers: { Origin: origin } },
      ),
    ]);
    expect(senderFollow.status()).toBe(200);
    expect(recipientFollow.status()).toBe(200);

    const startResponse = await senderPage.request.post(
      "/v1/messages/conversations",
      {
        headers: { Origin: origin },
        data: { username: recipient.username },
      },
    );
    expect(startResponse.status()).toBe(201);
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };

    await Promise.all([
      senderPage.goto(`/mesajlar?sohbet=${conversation.id}`),
      recipientPage.goto(`/mesajlar?sohbet=${conversation.id}`),
    ]);
    const senderMessages = senderPage.getByRole("region", { name: "Mesajlar" });
    const recipientMessages = recipientPage.getByRole("region", {
      name: "Mesajlar",
    });
    await expect(senderMessages).toHaveAttribute(
      "data-realtime-status",
      "connected",
    );
    await expect(recipientMessages).toHaveAttribute(
      "data-realtime-status",
      "connected",
    );

    const senderComposer = senderPage.getByRole("textbox", { name: "Mesaj" });
    const recipientComposer = recipientPage.getByRole("textbox", {
      name: "Mesaj",
    });
    await expect(senderComposer).toBeVisible();
    await expect(recipientComposer).toBeVisible();
    await senderComposer.fill("Realtime selam!");
    await expect.poll(() =>
      recipientRealtimeFrames.some((frame) => frame.includes('"type":"typing"')),
    ).toBe(true);
    await expect(
      recipientPage.getByRole("status", {
        name: new RegExp(`${sender.displayName} yazıyor`, "i"),
      }),
    ).toBeVisible({ timeout: 3_000 });

    await senderComposer.press("Enter");
    await expect(
      recipientPage
        .getByLabel("Mesaj geçmişi")
        .getByText("Realtime selam!", { exact: true }),
    ).toBeVisible({ timeout: 4_500 });

    await senderContext.setOffline(true);
    await expect(senderMessages).toHaveAttribute(
      "data-realtime-status",
      "disconnected",
    );
    const reconnectedSocket = senderPage.waitForEvent("websocket", {
      predicate: (socket) => socket.url().includes("/v1/realtime"),
    });
    await senderContext.setOffline(false);
    await reconnectedSocket;
    await expect(senderMessages).toHaveAttribute(
      "data-realtime-status",
      "connected",
    );

    await recipientComposer.fill("BaÄŸlantÄ± geri geldi mi?");
    await expect(
      senderPage.getByRole("status", {
        name: new RegExp(`${recipient.displayName} yazıyor`, "i"),
      }),
    ).toBeVisible({ timeout: 3_000 });

    let interceptedFallbackSockets = 0;
    await fallbackContext.routeWebSocket(/\/v1\/realtime/, async (socket) => {
      interceptedFallbackSockets += 1;
      await socket.close({ code: 1013, reason: "Polling fallback test" });
    });
    await fallbackContext.addCookies(await senderContext.cookies());
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.goto(`/mesajlar?sohbet=${conversation.id}`);
    await expect.poll(() => interceptedFallbackSockets).toBeGreaterThan(0);

    const fallbackBody = "Polling üzerinden gelen mesaj.";
    const fallbackResponse = await recipientPage.request.post(
      `/v1/messages/conversations/${conversation.id}/messages`,
      {
        headers: { Origin: origin },
        data: { body: fallbackBody, clientMessageId: crypto.randomUUID() },
      },
    );
    expect(fallbackResponse.status()).toBe(201);
    await expect(
      fallbackPage
        .getByLabel("Mesaj geçmişi")
        .getByText(fallbackBody, { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await Promise.allSettled([
      senderContext.close(),
      recipientContext.close(),
      fallbackContext.close(),
    ]);
  }
});

test("members can send, accept, and continue a message request", async ({
  page,
}) => {
  test.setTimeout(90_000);

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
  let releaseFirstMessageAttempt!: () => void;
  const firstMessageAttemptGate = new Promise<void>((resolve) => {
    releaseFirstMessageAttempt = resolve;
  });
  await page.route("**/v1/messages/conversations/*/messages", async (route) => {
    if (route.request().method() !== "POST" || !failFirstMessageAttempt) {
      await route.continue();
      return;
    }
    failFirstMessageAttempt = false;
    await firstMessageAttemptGate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "TEMPORARY_FAILURE" } }),
    });
  });
  const initialSendClick = page
    .getByRole("button", { name: "Mesajı gönder" })
    .click();
  const pendingMessage = page
    .getByLabel("Mesaj geçmişi")
    .locator('li[data-delivery-status]')
    .filter({ hasText: "Kütüphanede görüşelim mi?" });
  try {
    await expect(pendingMessage).toHaveAttribute(
      "data-delivery-status",
      "sending",
    );
    await expect(pendingMessage.getByText("Gönderiliyor…")).toBeVisible();
  } finally {
    releaseFirstMessageAttempt();
  }
  await initialSendClick;
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
  await expect(page.getByRole("textbox", { name: "Mesaj" })).toBeVisible();

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

  for (let index = 0; index < 24; index += 1) {
    const response = await page.request.post(
      `/v1/messages/conversations/${conversationId}/messages`,
      {
        headers: { Origin: new URL(page.url()).origin },
        data: {
          body: `Scroll testi mesajı ${index + 1}: ${"kampüs konuşması devam ediyor; ".repeat(8)}`,
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
  await expect(
    messageHistory.getByText(/Scroll testi mesajı 24:/),
  ).toBeVisible();
  await expect.poll(() =>
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeLessThan(100);
  // Headless tarayıcıda wheel olayı, görünür scrollbar olmadığı zaman dış
  // sayfaya gidebiliyor. Scroll konumunu değiştirip gerçek scroll olayını
  // göndererek bileşenin "kullanıcı yukarıda" durumunu deterministik ölç.
  await messageHistory.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect.poll(() =>
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeGreaterThan(100);

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
  await expect(
    messageHistory.getByText(newestBody, { exact: true }),
  ).toBeVisible();
  await expect.poll(() =>
    messageHistory.evaluate(
      (element) =>
        element.scrollHeight - element.scrollTop - element.clientHeight,
    ),
  ).toBeLessThan(100);

  await page
    .getByRole("button", {
      name: `${recipient.displayName} için konuşma seçenekleri`,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Kullanıcıyı engelle" })
    .click();
  const blockDialog = page.getByRole("dialog", {
    name: `${recipient.displayName} engellensin mi?`,
  });
  await expect(blockDialog).toBeVisible();
  await blockDialog.getByRole("button", { name: "Engelle" }).click();
  await expect(page).toHaveURL(/\/mesajlar$/);
  await expect(
    page
      .getByRole("complementary", { name: "Konuşmalar" })
      .getByRole("button", { name: new RegExp(recipient.displayName, "i") }),
  ).toHaveCount(0);
});
