import { describe, expect, it } from "vitest";

import { AuthError } from "@/server/auth/errors";

import {
  containsBlockedUrl,
  createCommentSchema,
  createPostSchema,
  feedQuerySchema,
  parseContentInput,
  updateCommentSchema,
  updatePostSchema,
  validateFinalPostContent,
  votePollSchema,
} from "./validation";

function captureInvalidInput(action: () => unknown) {
  let caughtError: unknown;

  try {
    action();
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeInstanceOf(AuthError);
  expect(caughtError).toMatchObject({
    code: "INVALID_REQUEST",
    status: 400,
  });

  return caughtError as AuthError;
}

describe("content validation", () => {
  it("accepts one valid uploaded image id and rejects malformed ids", () => {
    const imageId = "d9955ee1-2c9c-49fe-9d45-6a94fe89b880";

    expect(
      parseContentInput(createPostSchema, {
        category: "chat",
        body: "Kampüsten bir kare",
        imageId,
      }),
    ).toMatchObject({ imageId });

    captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "chat",
        body: "Kampüsten bir kare",
        imageId: "not-an-id",
      }),
    );
  });

  it("accepts valid listings and enforces price and identity rules", () => {
    expect(
      parseContentInput(createPostSchema, {
        category: "listing",
        title: "Tasarım kitabı",
        body: "Temiz durumda.",
        listing: {
          type: "sale",
          condition: "lightly_used",
          price: 180,
        },
      }),
    ).toMatchObject({
      category: "listing",
      isAnonymous: false,
      listing: {
        type: "sale",
        condition: "lightly_used",
        price: 180,
      },
    });

    for (const invalidListing of [
      { type: "free", condition: "used", price: 5 },
      { type: "wanted", condition: "new", price: 0 },
    ]) {
      captureInvalidInput(() =>
        parseContentInput(createPostSchema, {
          category: "listing",
          title: "İlan",
          body: "Açıklama",
          listing: invalidListing,
        }),
      );
    }

    captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "listing",
        title: "İlan",
        body: "Açıklama",
        isAnonymous: true,
        listing: { type: "free", condition: "used", price: 0 },
      }),
    );
  });
  it("accepts valid polls and rejects malformed options", () => {
    expect(
      parseContentInput(createPostSchema, {
        category: "poll",
        title: "Bugün nerede çalışalım?",
        pollOptions: [" Kütüphane ", " Kampüs "],
      }),
    ).toMatchObject({
      category: "poll",
      pollOptions: ["Kütüphane", "Kampüs"],
    });

    captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "poll",
        title: "Seç",
        pollOptions: ["Aynı", "aynı"],
      }),
    );
    captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "chat",
        title: "Seç",
        pollOptions: ["Bir", "İki"],
      }),
    );

    const optionId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";
    expect(parseContentInput(votePollSchema, { optionId })).toEqual({
      optionId,
    });
  });
  it("normalizes a valid post and supplies safe defaults", () => {
    expect(
      parseContentInput(createPostSchema, {
        category: "chat",
        body: "  Kütüphanede çalışan var mı?  ",
      }),
    ).toEqual({
      category: "chat",
      title: "",
      body: "Kütüphanede çalışan var mı?",
      isAnonymous: false,
    });
  });

  it("requires content and rejects unknown post fields", () => {
    const blankError = captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "question",
        title: "   ",
        body: " ",
        isAnonymous: true,
      }),
    );

    expect(blankError.fieldErrors.body).toContain(
      "Başlık veya gönderi metninden en az birini yazmalısın.",
    );

    captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "chat",
        body: "Geçerli içerik",
        isAnonymous: false,
        role: "admin",
      }),
    );
  });

  it.each([
    "https://example.com/duyuru",
    "http://example.com",
    "h t t p s : / / example . com",
    "www . example . com",
    "example.com",
    "example.ru",
    "example.zip",
    "example [dot] com",
    "example[dot]ru",
    "example ( dot ) zip",
    "example nokta com",
    "example nokta ru",
    "example&#46;zip",
    "subdomain.example.photography",
    "https%3A%2F%2Fexample.com",
    "192.168.1.20:3000",
  ])("blocks URL-like content: %s", (value) => {
    expect(containsBlockedUrl(value)).toBe(true);

    const error = captureInvalidInput(() =>
      parseContentInput(createPostSchema, {
        category: "chat",
        title: "",
        body: value,
        isAnonymous: false,
      }),
    );

    expect(error.fieldErrors.body).toContain(
      "Bağlantı veya internet adresi paylaşamazsın.",
    );
  });

  it.each([
    "Final haftası 1.2 sürümü gibi geçti.",
    "Bugün saat 14.30'da buluşalım.",
    "React ve TypeScript hakkında konuşalım.",
    "Dosya adı package.json olarak kalsın.",
    "Bileşen App.tsx, stil dosyası globals.css.",
    "Rapor.pdf dosyasını daha sonra yükleyeceğim.",
  ])("allows ordinary non-link text: %s", (value) => {
    expect(containsBlockedUrl(value)).toBe(false);
  });

  it("accepts partial post edits and validates the final stored state", () => {
    expect(
      parseContentInput(updatePostSchema, {
        title: "  Güncel başlık  ",
      }),
    ).toEqual({ title: "Güncel başlık" });

    expect(
      validateFinalPostContent(
        { title: "Başlık", body: "Metin" },
        { title: "" },
      ),
    ).toEqual({ title: "", body: "Metin" });

    const finalStateError = captureInvalidInput(() =>
      validateFinalPostContent(
        { title: "Başlık", body: "" },
        { title: "" },
      ),
    );
    expect(finalStateError.fieldErrors.body).toContain(
      "Başlık veya gönderi metninden en az birini yazmalısın.",
    );

    captureInvalidInput(() =>
      parseContentInput(updatePostSchema, {}),
    );
  });

  it("validates comment creation and updates", () => {
    const parentId = "7bf0c452-64b0-4fa6-9604-521732e84ac0";

    expect(
      parseContentInput(createCommentSchema, {
        body: "  Katılıyorum.  ",
        parentId,
      }),
    ).toEqual({
      body: "Katılıyorum.",
      isAnonymous: false,
      parentId,
    });
    expect(
      parseContentInput(updateCommentSchema, {
        body: "  Düzenlenmiş yorum  ",
      }),
    ).toEqual({ body: "Düzenlenmiş yorum" });

    const blankError = captureInvalidInput(() =>
      parseContentInput(createCommentSchema, {
        body: " ",
        isAnonymous: false,
      }),
    );
    expect(blankError.fieldErrors.body).toContain(
      "Yorum yazmalı veya bir GIF seçmelisin.",
    );

    expect(
      parseContentInput(createCommentSchema, {
        body: "",
        gifId: "happyReaction123",
      }),
    ).toEqual({
      body: "",
      isAnonymous: false,
      gifId: "happyReaction123",
    });

    captureInvalidInput(() =>
      parseContentInput(createCommentSchema, {
        body: "Yanıt",
        parentId: "not-a-uuid",
      }),
    );
    captureInvalidInput(() =>
      parseContentInput(updateCommentSchema, {
        body: "example.com",
      }),
    );
    captureInvalidInput(() =>
      parseContentInput(updateCommentSchema, {
        body: "Yorum",
        isAnonymous: true,
      }),
    );
  });

  it("parses bounded feed filters and rejects malformed queries", () => {
    expect(parseContentInput(feedQuerySchema, {})).toEqual({
      sort: "newest",
      scope: "global",
      limit: 20,
    });
    expect(
      parseContentInput(feedQuerySchema, {
        category: "lost_found",
        sort: "popular",
        author: "  Campus.User  ",
        cursor: "eyJpZCI6IjEyMyJ9",
        limit: "50",
      }),
    ).toEqual({
      category: "lost_found",
      sort: "popular",
      scope: "global",
      author: "campus.user",
      cursor: "eyJpZCI6IjEyMyJ9",
      limit: 50,
    });

    for (const invalidQuery of [
      { category: "unknown" },
      { sort: "oldest" },
      { scope: "mine" },
      { limit: "0" },
      { limit: "51" },
      { limit: "1.5" },
      { cursor: "not opaque!" },
      { author: "invalid username" },
      { extra: "field" },
    ]) {
      captureInvalidInput(() =>
        parseContentInput(feedQuerySchema, invalidQuery),
      );
    }
  });
});
