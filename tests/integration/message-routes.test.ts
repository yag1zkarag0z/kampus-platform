import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { Pool } from "pg";

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
import { DELETE as deleteMessage } from "@/app/v1/messages/[id]/route";
import { GET as getUnreadCount } from "@/app/v1/messages/unread-count/route";
import { createMemberSession } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

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

afterEach(async () => {
  if (testEmails.size === 0) return;
  await pool.query("delete from users where email = any($1)", [[...testEmails]]);
  testEmails.clear();
});

afterAll(async () => {
  await pool.end();
});

describe("direct message routes with PostgreSQL", () => {
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
    await expect(recipientDraftList.json()).resolves.toEqual({ data: [] });

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
          body: { body: "Kütüphanede buluşalım mı?" },
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
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(readResponse.status).toBe(204);

    const unreadAfter = await getUnreadCount(
      request("/v1/messages/unread-count", { cookie: recipientCookie }),
    );
    await expect(unreadAfter.json()).resolves.toEqual({ data: { count: 0 } });
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
          body: { body: "Silinecek mesaj" },
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
    await expect(blockedList.json()).resolves.toEqual({ data: [] });

    const blockedConversation = await getConversation(
      request(`/v1/messages/conversations/${conversation.id}`, {
        cookie: senderCookie,
      }),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(blockedConversation.status).toBe(403);
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
        { cookie: firstCookie, method: "POST", body: { body: "   " } },
      ),
      { params: Promise.resolve({ id: conversation.id }) },
    );
    expect(invalidBody.status).toBe(400);

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
