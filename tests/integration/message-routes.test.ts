import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

import {
  GET as getConversations,
  POST as postConversation,
} from "@/app/v1/messages/conversations/route";
import { GET as getConversation } from "@/app/v1/messages/conversations/[id]/route";
import {
  GET as getMessages,
  POST as postMessage,
} from "@/app/v1/messages/conversations/[id]/messages/route";
import { POST as postRead } from "@/app/v1/messages/conversations/[id]/read/route";
import { POST as postMessageRequest } from "@/app/v1/messages/conversations/[id]/request/route";
import { DELETE as deleteMessage } from "@/app/v1/messages/[id]/route";
import { GET as getUnreadCount } from "@/app/v1/messages/unread-count/route";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import {
  REALTIME_POSTGRES_CHANNEL,
  type RealtimeBrokerEvent,
} from "@/realtime/protocol";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 5_000,
});
const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const testEmails = new Set<string>();

function createAccountFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const studentNumber = BigInt(`0x${suffix}`).toString();

  return {
    email: `${studentNumber}@stu.yasar.edu.tr`,
    username: `m${suffix}`,
  };
}

async function insertAccount(displayName: string) {
  const fixture = createAccountFixture();
  testEmails.add(fixture.email);
  const result = await pool.query<{ id: string }>(
    `insert into users (
      email,
      username,
      display_name,
      department,
      year_label,
      bio
    ) values ($1, $2, $3, $4, $5, $6)
    returning id`,
    [
      fixture.email,
      fixture.username,
      displayName,
      "Yazılım Mühendisliği",
      "2. sınıf",
      "",
    ],
  );
  const id = result.rows[0]!.id;
  await pool.query("insert into user_settings (user_id) values ($1)", [id]);

  const existingFixtureUsers = await pool.query<{ id: string }>(
    `select id from users
     where email = any($1)
       and id <> $2`,
    [[...testEmails], id],
  );
  for (const existingUser of existingFixtureUsers.rows) {
    await pool.query(
      `insert into follows (follower_id, following_id)
       values ($1, $2), ($2, $1)
       on conflict do nothing`,
      [id, existingUser.id],
    );
  }

  return { ...fixture, id, displayName };
}

async function createMemberCookie(userId: string) {
  const session = await createMemberSession(getDatabase(), {
    now: new Date(),
    role: "member",
    userId,
  });
  return session.cookieValue;
}

function request(
  path: string,
  {
    cookie,
    method = "GET",
    body,
    origin = appOrigin,
  }: {
    cookie?: string;
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    origin?: string;
  } = {},
) {
  return new NextRequest(new URL(path, appOrigin), {
    method,
    headers: {
      ...(cookie ? { Cookie: `kampus_session=${cookie}` } : {}),
      ...(method !== "GET" ? { Origin: origin } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function nextRealtimeEvent(client: PoolClient) {
  return new Promise<RealtimeBrokerEvent>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off("notification", handleNotification);
      reject(new Error("Timed out waiting for a realtime database event."));
    }, 5_000);
    const handleNotification = (notification: { payload?: string }) => {
      if (!notification.payload) return;
      clearTimeout(timer);
      client.off("notification", handleNotification);
      resolve(JSON.parse(notification.payload) as RealtimeBrokerEvent);
    };
    client.on("notification", handleNotification);
  });
}

afterEach(async () => {
  if (testEmails.size === 0) return;
  await pool.query("delete from users where email = any($1)", [[...testEmails]]);
  testEmails.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("direct message routes with PostgreSQL", () => {
  it("publishes committed conversation invalidations for realtime clients", async () => {
    const listener = await pool.connect();
    await listener.query(`listen ${REALTIME_POSTGRES_CHANNEL}`);

    try {
      const sender = await insertAccount("Realtime Sender");
      const recipient = await insertAccount("Realtime Recipient");
      const senderCookie = await createMemberCookie(sender.id);
      const recipientCookie = await createMemberCookie(recipient.id);

      const startedEventPromise = nextRealtimeEvent(listener);
      const startResponse = await postConversation(
        request("/v1/messages/conversations", {
          cookie: senderCookie,
          method: "POST",
          body: { username: recipient.username },
        }),
      );
      const { data: conversation } = (await startResponse.json()) as {
        data: { id: string };
      };
      await expect(startedEventPromise).resolves.toMatchObject({
        type: "conversation.invalidate",
        conversationId: conversation.id,
        reason: "conversation-started",
        userIds: expect.arrayContaining([sender.id, recipient.id]),
      });

      const messageEventPromise = nextRealtimeEvent(listener);
      const messageResponse = await postMessage(
        request(
          `/v1/messages/conversations/${conversation.id}/messages`,
          {
            cookie: senderCookie,
            method: "POST",
            body: {
              body: "Realtime mesajÄ±",
              clientMessageId: randomUUID(),
            },
          },
        ),
        { params: Promise.resolve({ id: conversation.id }) },
      );
      const { data: message } = (await messageResponse.json()) as {
        data: { id: string };
      };
      await expect(messageEventPromise).resolves.toMatchObject({
        type: "conversation.invalidate",
        conversationId: conversation.id,
        reason: "message-created",
        userIds: expect.arrayContaining([sender.id, recipient.id]),
      });

      const readEventPromise = nextRealtimeEvent(listener);
      await postRead(
        request(`/v1/messages/conversations/${conversation.id}/read`, {
          cookie: recipientCookie,
          method: "POST",
          body: { messageId: message.id },
        }),
        { params: Promise.resolve({ id: conversation.id }) },
      );
      await expect(readEventPromise).resolves.toMatchObject({
        type: "conversation.invalidate",
        conversationId: conversation.id,
        reason: "message-read",
        userIds: [sender.id],
      });
    } finally {
      await listener.query(`unlisten ${REALTIME_POSTGRES_CHANNEL}`);
      listener.release();
    }
  });

  it("creates one conversation per pair and tracks unread/read messages", async () => {
    const sender = await insertAccount("Gönderen Öğrenci");
    const recipient = await insertAccount("Alıcı Öğrenci");
    const senderCookie = await createMemberCookie(sender.id);
    const recipientCookie = await createMemberCookie(recipient.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    expect(startResponse.status).toBe(201);
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string; member: { id: string }; lastMessage: null };
    };
    expect(conversation.member.id).toBe(recipient.id);
    expect(conversation.lastMessage).toBeNull();

    // Boş taslak, karşı tarafa mesaj gelmeden konuşma listesinde görünmez.
    const recipientDraftList = await getConversations(
      request("/v1/messages/conversations", { cookie: recipientCookie }),
    );
    await expect(recipientDraftList.json()).resolves.toEqual({
      data: [],
      page: { nextCursor: null, hasMore: false },
    });

    const repeatResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: recipientCookie,
        method: "POST",
        body: { username: sender.username },
      }),
    );
    const repeatPayload = (await repeatResponse.json()) as {
      data: { id: string };
    };
    expect(repeatPayload.data.id).toBe(conversation.id);

    const sendResponse = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: {
            body: "Kütüphanede buluşalım mı?",
            clientMessageId: randomUUID(),
          },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(sendResponse.status).toBe(201);
    const { data: sentMessage } = (await sendResponse.json()) as {
      data: { id: string; body: string; isMine: boolean };
    };
    expect(sentMessage).toMatchObject({
      body: "Kütüphanede buluşalım mı?",
      isMine: true,
    });

    const recipientList = await getConversations(
      request("/v1/messages/conversations", { cookie: recipientCookie }),
    );
    await expect(recipientList.json()).resolves.toMatchObject({
      data: [
        {
          id: conversation.id,
          member: { id: sender.id, displayName: sender.displayName },
          unreadCount: 1,
          lastMessage: {
            preview: "Kütüphanede buluşalım mı?",
            isMine: false,
          },
        },
      ],
    });

    const unreadBefore = await getUnreadCount(
      request("/v1/messages/unread-count", { cookie: recipientCookie }),
    );
    await expect(unreadBefore.json()).resolves.toEqual({ data: { count: 1 } });

    const messagesResponse = await getMessages(
      request(
        `/v1/messages/conversations/${conversation.id}/messages?limit=50`,
        { cookie: recipientCookie },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    await expect(messagesResponse.json()).resolves.toMatchObject({
      data: [
        {
          id: sentMessage.id,
          body: "Kütüphanede buluşalım mı?",
          isMine: false,
          isDeleted: false,
        },
      ],
      page: { nextCursor: null, hasMore: false },
    });

    const readResponse = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: recipientCookie,
        method: "POST",
        body: { messageId: sentMessage.id },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(readResponse.status).toBe(204);

    const unreadAfter = await getUnreadCount(
      request("/v1/messages/unread-count", { cookie: recipientCookie }),
    );
    await expect(unreadAfter.json()).resolves.toEqual({ data: { count: 0 } });

    const senderMessagesResponse = await getMessages(
      request(
        `/v1/messages/conversations/${conversation.id}/messages?limit=50`,
        { cookie: senderCookie },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    await expect(senderMessagesResponse.json()).resolves.toMatchObject({
      data: [{ id: sentMessage.id, isMine: true, isSeen: true }],
    });
  });

  it("paginates conversation lists with an opaque box-scoped cursor", async () => {
    const viewer = await insertAccount("Sayfalama Öğrencisi");
    const peers = await Promise.all([
      insertAccount("Birinci Kişi"),
      insertAccount("İkinci Kişi"),
      insertAccount("Üçüncü Kişi"),
    ]);
    const viewerCookie = await createMemberCookie(viewer.id);

    const createdIds: string[] = [];
    for (const peer of peers) {
      const response = await postConversation(
        request("/v1/messages/conversations", {
          cookie: viewerCookie,
          method: "POST",
          body: { username: peer.username },
        }),
      );
      expect(response.status).toBe(201);
      const payload = (await response.json()) as { data: { id: string } };
      createdIds.push(payload.data.id);
    }

    const firstResponse = await getConversations(
      request("/v1/messages/conversations?box=inbox&limit=2", {
        cookie: viewerCookie,
      }),
    );
    const first = (await firstResponse.json()) as {
      data: Array<{ id: string }>;
      page: { nextCursor: string | null; hasMore: boolean };
    };
    expect(firstResponse.status).toBe(200);
    expect(first.data).toHaveLength(2);
    expect(first.page.hasMore).toBe(true);
    expect(first.page.nextCursor).toEqual(expect.any(String));

    const secondResponse = await getConversations(
      request(
        `/v1/messages/conversations?box=inbox&limit=2&cursor=${encodeURIComponent(first.page.nextCursor!)}`,
        { cookie: viewerCookie },
      ),
    );
    const second = (await secondResponse.json()) as {
      data: Array<{ id: string }>;
      page: { nextCursor: string | null; hasMore: boolean };
    };
    expect(secondResponse.status).toBe(200);
    expect(second.data).toHaveLength(1);
    expect(second.page).toEqual({ nextCursor: null, hasMore: false });

    const listedIds = [...first.data, ...second.data].map((item) => item.id);
    expect(new Set(listedIds).size).toBe(3);
    expect(listedIds.sort()).toEqual(createdIds.sort());

    const crossBoxResponse = await getConversations(
      request(
        `/v1/messages/conversations?box=requests&limit=2&cursor=${encodeURIComponent(first.page.nextCursor!)}`,
        { cookie: viewerCookie },
      ),
    );
    expect(crossBoxResponse.status).toBe(400);

    const searchResponse = await getConversations(
      request(
        `/v1/messages/conversations?box=inbox&search=${encodeURIComponent("İkinci Kişi")}`,
        { cookie: viewerCookie },
      ),
    );
    expect(searchResponse.status).toBe(200);
    await expect(searchResponse.json()).resolves.toMatchObject({
      data: [{ member: { displayName: "İkinci Kişi" } }],
      page: { nextCursor: null, hasMore: false },
    });
  });

  it("marks only the delivered message as read and never moves the cursor backwards", async () => {
    const sender = await insertAccount("Read Cursor Sender");
    const recipient = await insertAccount("Read Cursor Recipient");
    const senderCookie = await createMemberCookie(sender.id);
    const recipientCookie = await createMemberCookie(recipient.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };

    const send = async (body: string) => {
      const response = await postMessage(
        request(
          `/v1/messages/conversations/${conversation.id}/messages`,
          {
            cookie: senderCookie,
            method: "POST",
            body: { body, clientMessageId: randomUUID() },
          },
        ),
        { params: Promise.resolve({ id: conversation.id }) },
      );
      expect(response.status).toBe(201);
      return (await response.json()) as {
        data: { id: string; createdAt: string };
      };
    };

    const firstMessage = (await send("First unread message")).data;
    const secondMessage = (await send("Second unread message")).data;

    const readFirstResponse = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: recipientCookie,
        method: "POST",
        body: { messageId: firstMessage.id },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(readFirstResponse.status).toBe(204);

    const unreadAfterFirst = await getUnreadCount(
      request("/v1/messages/unread-count", { cookie: recipientCookie }),
    );
    await expect(unreadAfterFirst.json()).resolves.toEqual({
      data: { count: 1 },
    });

    const readSecondResponse = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: recipientCookie,
        method: "POST",
        body: { messageId: secondMessage.id },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(readSecondResponse.status).toBe(204);

    const staleReadResponse = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: recipientCookie,
        method: "POST",
        body: { messageId: firstMessage.id },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(staleReadResponse.status).toBe(204);

    const persistedRead = await pool.query<{
      last_read_at: Date;
      last_read_message_id: string;
    }>(
      `select last_read_at, last_read_message_id
       from direct_conversation_reads
       where conversation_id = $1 and user_id = $2`,
      [conversation.id, recipient.id],
    );
    expect(persistedRead.rows[0]).toMatchObject({
      last_read_message_id: secondMessage.id,
    });
    expect(persistedRead.rows[0]!.last_read_at.getTime()).toBe(
      new Date(secondMessage.createdAt).getTime(),
    );

    const unreadAfterStaleRead = await getUnreadCount(
      request("/v1/messages/unread-count", { cookie: recipientCookie }),
    );
    await expect(unreadAfterStaleRead.json()).resolves.toEqual({
      data: { count: 0 },
    });
  });

  it("keeps message timestamps monotonic when the previous message is ahead of the server clock", async () => {
    const sender = await insertAccount("Ordered Message Sender");
    const recipient = await insertAccount("Ordered Message Recipient");
    const senderCookie = await createMemberCookie(sender.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };

    const firstResponse = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: { body: "First message", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    const { data: firstMessage } = (await firstResponse.json()) as {
      data: { id: string };
    };
    const futureTimestamp = new Date(Date.now() + 60_000);

    await pool.query(
      "update direct_messages set created_at = $1 where id = $2",
      [futureTimestamp, firstMessage.id],
    );
    await pool.query(
      "update direct_conversations set last_message_at = $1 where id = $2",
      [futureTimestamp, conversation.id],
    );

    const secondResponse = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: { body: "Second message", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(secondResponse.status).toBe(201);
    const { data: secondMessage } = (await secondResponse.json()) as {
      data: { id: string; createdAt: string };
    };

    expect(new Date(secondMessage.createdAt).getTime()).toBeGreaterThan(
      futureTimestamp.getTime(),
    );

    const persistedConversation = await pool.query<{
      last_message_at: Date;
      last_message_id: string;
    }>(
      `select last_message_id, last_message_at
       from direct_conversations
       where id = $1`,
      [conversation.id],
    );
    expect(persistedConversation.rows[0]).toMatchObject({
      last_message_id: secondMessage.id,
    });
    expect(
      persistedConversation.rows[0]!.last_message_at.getTime(),
    ).toBe(new Date(secondMessage.createdAt).getTime());
  });

  it("deduplicates concurrent message retries without consuming the rate limit twice", async () => {
    const sender = await insertAccount("Idempotent Message Sender");
    const recipient = await insertAccount("Idempotent Message Recipient");
    const senderCookie = await createMemberCookie(sender.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };
    const clientMessageId = randomUUID();
    const send = (body: string, attemptId: string) =>
      postMessage(
        request(
          `/v1/messages/conversations/${conversation.id}/messages`,
          {
            cookie: senderCookie,
            method: "POST",
            body: { body, clientMessageId: attemptId },
          },
        ),
        { params: Promise.resolve({ id: conversation.id }) },
      );

    const [firstResponse, retryResponse] = await Promise.all([
      send("Retry-safe message", clientMessageId),
      send("Retry-safe message", clientMessageId),
    ]);
    expect(firstResponse.status).toBe(201);
    expect(retryResponse.status).toBe(201);
    const firstPayload = (await firstResponse.json()) as {
      data: { id: string };
    };
    const retryPayload = (await retryResponse.json()) as {
      data: { id: string };
    };
    expect(retryPayload.data.id).toBe(firstPayload.data.id);

    const persistedAttempt = await pool.query<{ total: number }>(
      `select count(*)::int as total
       from direct_messages
       where sender_id = $1 and client_message_id = $2`,
      [sender.id, clientMessageId],
    );
    expect(persistedAttempt.rows[0]?.total).toBe(1);

    const rateLimitAfterRetry = await pool.query<{ total: number }>(
      `select count(*)::int as total
       from rate_limit_hits
       where user_id = $1 and action = 'message_send'`,
      [sender.id],
    );
    expect(rateLimitAfterRetry.rows[0]?.total).toBe(1);

    const laterResponse = await send("Later message", randomUUID());
    expect(laterResponse.status).toBe(201);
    const laterPayload = (await laterResponse.json()) as {
      data: { id: string };
    };

    const lateRetryResponse = await send(
      "Retry-safe message",
      clientMessageId,
    );
    expect(lateRetryResponse.status).toBe(201);
    const conversationResponse = await getConversation(
      request(`/v1/messages/conversations/${conversation.id}`, {
        cookie: senderCookie,
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    await expect(conversationResponse.json()).resolves.toMatchObject({
      data: { lastMessage: { id: laterPayload.data.id } },
    });

    const conflictingRetry = await send(
      "Changed message body",
      clientMessageId,
    );
    expect(conflictingRetry.status).toBe(409);

    const rateLimitAfterAllRetries = await pool.query<{ total: number }>(
      `select count(*)::int as total
       from rate_limit_hits
       where user_id = $1 and action = 'message_send'`,
      [sender.id],
    );
    expect(rateLimitAfterAllRetries.rows[0]?.total).toBe(2);
  });

  it("allows only the sender to delete and hides blocked conversations", async () => {
    const sender = await insertAccount("Mesaj Sahibi");
    const recipient = await insertAccount("Mesaj Alıcısı");
    const senderCookie = await createMemberCookie(sender.id);
    const recipientCookie = await createMemberCookie(recipient.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };
    const sendResponse = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: {
            body: "Silinecek mesaj",
            clientMessageId: randomUUID(),
          },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    const { data: message } = (await sendResponse.json()) as {
      data: { id: string };
    };

    const forbiddenDelete = await deleteMessage(
      request(`/v1/messages/${message.id}`, {
        cookie: recipientCookie,
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: message.id }) },
    );
    expect(forbiddenDelete.status).toBe(404);

    const deleteResponse = await deleteMessage(
      request(`/v1/messages/${message.id}`, {
        cookie: senderCookie,
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: message.id }) },
    );
    expect(deleteResponse.status).toBe(204);

    const deletedMessages = await getMessages(
      request(
        `/v1/messages/conversations/${conversation.id}/messages?limit=50`,
        { cookie: recipientCookie },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    await expect(deletedMessages.json()).resolves.toMatchObject({
      data: [{ id: message.id, body: "", isDeleted: true }],
    });

    await pool.query(
      "insert into blocks (blocker_id, blocked_id) values ($1, $2)",
      [recipient.id, sender.id],
    );

    const blockedList = await getConversations(
      request("/v1/messages/conversations", { cookie: senderCookie }),
    );
    await expect(blockedList.json()).resolves.toEqual({
      data: [],
      page: { nextCursor: null, hasMore: false },
    });

    const blockedConversation = await getConversation(
      request(`/v1/messages/conversations/${conversation.id}`, {
        cookie: senderCookie,
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(blockedConversation.status).toBe(403);
  });

  it("routes non-mutual messages to requests and allows only one message until accepted", async () => {
    const sender = await insertAccount("İstek Gönderen");
    const recipient = await insertAccount("İstek Alıcısı");
    await pool.query(
      `delete from follows
       where (follower_id = $1 and following_id = $2)
          or (follower_id = $2 and following_id = $1)`,
      [sender.id, recipient.id],
    );
    const senderCookie = await createMemberCookie(sender.id);
    const recipientCookie = await createMemberCookie(recipient.id);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: {
        id: string;
        requestStatus: string;
        requestDirection: string;
      };
    };
    expect(conversation).toMatchObject({
      requestStatus: "pending",
      requestDirection: "outgoing",
    });

    const emptyRequests = await getConversations(
      request("/v1/messages/conversations?box=requests", {
        cookie: recipientCookie,
      }),
    );
    await expect(emptyRequests.json()).resolves.toEqual({
      data: [],
      page: { nextCursor: null, hasMore: false },
    });

    const firstMessage = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: { body: "Selam, tanışabilir miyiz?", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(firstMessage.status).toBe(201);

    const secondMessage = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: senderCookie,
          method: "POST",
          body: { body: "İkinci mesaj", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(secondMessage.status).toBe(403);

    const requestList = await getConversations(
      request("/v1/messages/conversations?box=requests", {
        cookie: recipientCookie,
      }),
    );
    await expect(requestList.json()).resolves.toMatchObject({
      data: [
        {
          id: conversation.id,
          requestStatus: "pending",
          requestDirection: "incoming",
          lastMessage: { preview: "Selam, tanışabilir miyiz?" },
        },
      ],
    });

    const acceptResponse = await postMessageRequest(
      request(
        `/v1/messages/conversations/${conversation.id}/request`,
        {
          cookie: recipientCookie,
          method: "POST",
          body: { action: "accept" },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(acceptResponse.status).toBe(200);
    await expect(acceptResponse.json()).resolves.toMatchObject({
      data: { requestStatus: "accepted", requestDirection: null },
    });

    const replyResponse = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: recipientCookie,
          method: "POST",
          body: { body: "Merhaba!", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(replyResponse.status).toBe(201);
  });

  it("applies a rejection cooldown and blocks request senders atomically", async () => {
    const sender = await insertAccount("Reddedilen Gönderen");
    const recipient = await insertAccount("Reddeden Alıcı");
    const blockedSender = await insertAccount("Engellenecek Gönderen");
    await pool.query(
      `delete from follows
       where (follower_id = $1 and following_id in ($2, $3))
          or (following_id = $1 and follower_id in ($2, $3))`,
      [recipient.id, sender.id, blockedSender.id],
    );
    const senderCookie = await createMemberCookie(sender.id);
    const recipientCookie = await createMemberCookie(recipient.id);
    const blockedSenderCookie = await createMemberCookie(blockedSender.id);

    const createRequest = async (cookie: string, username: string) => {
      const started = await postConversation(
        request("/v1/messages/conversations", {
          cookie,
          method: "POST",
          body: { username },
        }),
      );
      const { data } = (await started.json()) as { data: { id: string } };
      await postMessage(
        request(`/v1/messages/conversations/${data.id}/messages`, {
          cookie,
          method: "POST",
          body: { body: "Mesaj isteği", clientMessageId: randomUUID() },
        }),
        { params: Promise.resolve({ id: data.id }) },
      );
      return data.id;
    };

    const rejectedConversationId = await createRequest(
      senderCookie,
      recipient.username,
    );
    const deleteResponse = await postMessageRequest(
      request(
        `/v1/messages/conversations/${rejectedConversationId}/request`,
        {
          cookie: recipientCookie,
          method: "POST",
          body: { action: "delete" },
        },
      ),
      { params: Promise.resolve({ id: rejectedConversationId }) },
    );
    expect(deleteResponse.status).toBe(204);

    const retryResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: senderCookie,
        method: "POST",
        body: { username: recipient.username },
      }),
    );
    expect(retryResponse.status).toBe(429);
    await expect(retryResponse.json()).resolves.toMatchObject({
      error: { code: "CONTENT_RATE_LIMITED" },
    });

    const blockedConversationId = await createRequest(
      blockedSenderCookie,
      recipient.username,
    );
    const blockResponse = await postMessageRequest(
      request(`/v1/messages/conversations/${blockedConversationId}/request`, {
        cookie: recipientCookie,
        method: "POST",
        body: { action: "block" },
      }),
      { params: Promise.resolve({ id: blockedConversationId }) },
    );
    expect(blockResponse.status).toBe(204);

    const blockRow = await pool.query(
      `select 1 from blocks where blocker_id = $1 and blocked_id = $2`,
      [recipient.id, blockedSender.id],
    );
    expect(blockRow.rowCount).toBe(1);
    const removedConversation = await pool.query(
      `select 1 from direct_conversations where id = $1`,
      [blockedConversationId],
    );
    expect(removedConversation.rowCount).toBe(0);
  });

  it("rejects guests, invalid bodies, and nonparticipants", async () => {
    const first = await insertAccount("Birinci Öğrenci");
    const second = await insertAccount("İkinci Öğrenci");
    const outsider = await insertAccount("Dışarıdaki Öğrenci");
    const firstCookie = await createMemberCookie(first.id);
    const outsiderCookie = await createMemberCookie(outsider.id);

    const unauthorized = await getConversations(
      request("/v1/messages/conversations"),
    );
    expect(unauthorized.status).toBe(401);

    const selfConversation = await postConversation(
      request("/v1/messages/conversations", {
        cookie: firstCookie,
        method: "POST",
        body: { username: first.username },
      }),
    );
    expect(selfConversation.status).toBe(400);

    const startResponse = await postConversation(
      request("/v1/messages/conversations", {
        cookie: firstCookie,
        method: "POST",
        body: { username: second.username },
      }),
    );
    const { data: conversation } = (await startResponse.json()) as {
      data: { id: string };
    };

    const invalidBody = await postMessage(
      request(
        `/v1/messages/conversations/${conversation.id}/messages`,
        {
          cookie: firstCookie,
          method: "POST",
          body: { body: "   ", clientMessageId: randomUUID() },
        },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(invalidBody.status).toBe(400);

    const invalidReadCursor = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: firstCookie,
        method: "POST",
        body: { messageId: "not-a-message-id" },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(invalidReadCursor.status).toBe(400);

    const missingReadMessage = await postRead(
      request(`/v1/messages/conversations/${conversation.id}/read`, {
        cookie: firstCookie,
        method: "POST",
        body: { messageId: randomUUID() },
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(missingReadMessage.status).toBe(404);

    const outsiderResponse = await getMessages(
      request(
        `/v1/messages/conversations/${conversation.id}/messages?limit=50`,
        { cookie: outsiderCookie },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(outsiderResponse.status).toBe(404);
  });
});
