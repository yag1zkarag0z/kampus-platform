import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

export const POST_CATEGORIES = [
  "chat",
  "confession",
  "question",
  "event",
  "lost_found",
  "poll",
  "listing",
] as const;

export const POST_SORTS = ["newest", "popular"] as const;

const CONTENT_REQUIRED_MESSAGE =
  "Başlık veya gönderi metninden en az birini yazmalısın.";
const URL_NOT_ALLOWED_MESSAGE =
  "Bağlantı veya internet adresi paylaşamazsın.";

const countryCodeTopLevelDomains = new Set(
  `
    ac ad ae af ag ai al am ao aq ar as at au aw ax az
    ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz
    ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz
    de dj dk dm do dz
    ec ee eg eh er es et eu
    fi fj fk fm fo fr
    ga gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy
    hk hm hn hr ht hu
    id ie il im in io iq ir is it
    je jm jo jp
    ke kg kh ki km kn kp kr kw ky kz
    la lb lc li lk lr ls lt lu lv ly
    ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz
    na nc ne nf ng ni nl no np nr nu nz
    om
    pa pe pf pg ph pk pl pm pn pr ps pt pw py
    qa
    re ro rs ru rw
    sa sb sc sd se sg sh si sj sk sl sm sn so sr ss st su sv sx sy sz
    tc td tf tg th tj tk tl tm tn to tr tt tv tw tz
    ua ug uk us uy uz
    va vc ve vg vi vn vu
    wf ws
    ye yt
    za zm zw
  `
    .trim()
    .split(/\s+/u),
);

// A broad suffix check keeps the filter useful as new generic TLDs are
// delegated. These common file/code suffixes are excluded because strings
// such as "package.json" and "App.tsx" are not useful evidence of a URL.
const commonNonDomainSuffixes = new Set(
  `
    apk avi bat bmp cjs cmd cpp css csv deb dmg doc docx env exe gif gql
    graphql gz htm html hpp ico ini java jpeg jpg js json jsonc jsx kt kts
    less map mdx mjs mkv mp3 mp4 msi ogg pdf php png ppt pptx ps1 py rar
    rtf sass scss sh sql svelte swift tar tgz tiff toml ts tsv tsx txt vue
    wav webm webp xls xlsx xml yaml yml
  `
    .trim()
    .split(/\s+/u),
);

const spacedProtocolPattern =
  /\b(?:h\s*t\s*t\s*p\s*s?|f\s*t\s*p)\s*:\s*[\\/]\s*[\\/]/iu;
const domainCandidatePattern = new RegExp(
  String.raw`(?:^|[^\p{L}\p{N}@_-])((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(xn--[a-z0-9-]{2,59}|[a-z]{2,63}))(?=$|[^\p{L}\p{N}_-])`,
  "giu",
);
const ipAddressPattern =
  /(?:^|[^\d])(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?=$|[^\d])/u;
const wwwPattern = /\bw\s*w\s*w\s*\./iu;

function decodePercentEncoding(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeUrlCandidate(value: string) {
  return decodePercentEncoding(value.normalize("NFKC"))
    .toLocaleLowerCase("en-US")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
    .replace(/[\u3002\uFF0E\uFF61]/gu, ".")
    .replace(/&#(?:46|x0*2e);|&period;/giu, ".")
    .replace(/&#(?:47|x0*2f);/giu, "/")
    .replace(
      /(?:\[|\(|\{)\s*(?:\.|dot|nokta)\s*(?:\]|\)|\})/giu,
      ".",
    )
    .replace(/\s+(?:dot|nokta)\s+/giu, ".")
    .replace(/\s*([.:/\\])\s*/gu, "$1");
}

function containsBareDomain(value: string) {
  for (const match of value.matchAll(domainCandidatePattern)) {
    const suffix = match[2];

    if (!suffix) {
      continue;
    }

    if (suffix.startsWith("xn--")) {
      return true;
    }

    if (suffix.length === 2) {
      if (countryCodeTopLevelDomains.has(suffix)) {
        return true;
      }

      continue;
    }

    if (!commonNonDomainSuffixes.has(suffix)) {
      return true;
    }
  }

  return false;
}

export function containsBlockedUrl(value: string) {
  const normalizedValue = normalizeUrlCandidate(value);

  return (
    spacedProtocolPattern.test(normalizedValue) ||
    wwwPattern.test(normalizedValue) ||
    containsBareDomain(normalizedValue) ||
    ipAddressPattern.test(normalizedValue)
  );
}

function addUrlIssue(
  context: z.RefinementCtx,
  field: "title" | "body",
  value: string | undefined,
) {
  if (value && containsBlockedUrl(value)) {
    context.addIssue({
      code: "custom",
      message: URL_NOT_ALLOWED_MESSAGE,
      path: [field],
    });
  }
}

function addPostContentIssues(
  context: z.RefinementCtx,
  value: {
    title?: string;
    body?: string;
  },
) {
  if (!value.title?.trim() && !value.body?.trim()) {
    context.addIssue({
      code: "custom",
      message: CONTENT_REQUIRED_MESSAGE,
      path: ["body"],
    });
  }

  addUrlIssue(context, "title", value.title);
  addUrlIssue(context, "body", value.body);
}

const postCategorySchema = z.enum(POST_CATEGORIES, {
  error: "Geçerli bir gönderi kategorisi seçmelisin.",
});

const postTitleSchema = z
  .string({ error: "Başlık metin olmalıdır." })
  .trim()
  .max(100, "Başlık en fazla 100 karakter olabilir.");

const postBodySchema = z
  .string({ error: "Gönderi metni geçersiz." })
  .trim()
  .max(500, "Gönderi metni en fazla 500 karakter olabilir.");

const commentBodySchema = z
  .string({ error: "Yorum metni geçersiz." })
  .trim()
  .min(1, "Yorum boş bırakılamaz.")
  .max(500, "Yorum en fazla 500 karakter olabilir.")
  .refine((value) => !containsBlockedUrl(value), {
    message: URL_NOT_ALLOWED_MESSAGE,
  });

const gifIdSchema = z
  .string({ error: "GIF kimliği geçersiz." })
  .trim()
  .min(1, "GIF kimliği boş olamaz.")
  .max(80, "GIF kimliği çok uzun.")
  .regex(/^[A-Za-z0-9_-]+$/u, "GIF kimliği geçersiz.");

const pollOptionSchema = z
  .string({ error: "Anket seçeneği metin olmalıdır." })
  .trim()
  .min(1, "Anket seçeneği boş olamaz.")
  .max(60, "Anket seçeneği en fazla 60 karakter olabilir.");

const listingSchema = z
  .object({
    type: z.enum(["sale", "wanted", "free"]),
    condition: z.enum(["new", "lightly_used", "used"]),
    price: z
      .number({ error: "İlan fiyatı sayı olmalıdır." })
      .int("İlan fiyatı tam sayı olmalıdır.")
      .min(0, "İlan fiyatı negatif olamaz.")
      .max(1_000_000, "İlan fiyatı en fazla 1.000.000 TL olabilir."),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === "free" && value.price !== 0) {
      context.addIssue({
        code: "custom",
        message: "Ücretsiz ilanların fiyatı 0 olmalıdır.",
        path: ["price"],
      });
    }

    if (value.type !== "free" && value.price === 0) {
      context.addIssue({
        code: "custom",
        message: "Satılık ve aranıyor ilanlarında fiyat yazmalısın.",
        path: ["price"],
      });
    }
  });

export const createPostSchema = z
  .object({
    category: postCategorySchema,
    title: postTitleSchema.default(""),
    body: postBodySchema.default(""),
    isAnonymous: z
      .boolean({ error: "Anonimlik tercihi doğru veya yanlış olmalıdır." })
      .default(false),
    pollOptions: z.array(pollOptionSchema).min(2).max(4).optional(),
    listing: listingSchema.optional(),
    imageId: z.uuid("Görsel kimliği geçersiz.").optional(),
    gifId: gifIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    addPostContentIssues(context, value);

    if (value.imageId && value.gifId) {
      context.addIssue({
        code: "custom",
        message: "Aynı gönderiye hem fotoğraf hem GIF ekleyemezsin.",
        path: ["gifId"],
      });
    }

    if (value.category === "poll" && !value.pollOptions) {
      context.addIssue({
        code: "custom",
        message: "Anket için en az iki seçenek yazmalısın.",
        path: ["pollOptions"],
      });
    }

    if (value.category !== "poll" && value.pollOptions) {
      context.addIssue({
        code: "custom",
        message: "Anket seçenekleri yalnızca anket gönderilerinde kullanılabilir.",
        path: ["pollOptions"],
      });
    }

    if (
      value.pollOptions &&
      new Set(
        value.pollOptions.map((option) =>
          option.toLocaleLowerCase("tr-TR"),
        ),
      ).size !== value.pollOptions.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Anket seçenekleri birbirinden farklı olmalıdır.",
        path: ["pollOptions"],
      });
    }

    if (value.category === "listing" && !value.listing) {
      context.addIssue({
        code: "custom",
        message: "İlan bilgilerini eksiksiz doldurmalısın.",
        path: ["listing"],
      });
    }

    if (value.category !== "listing" && value.listing) {
      context.addIssue({
        code: "custom",
        message: "İlan bilgileri yalnızca ilan gönderilerinde kullanılabilir.",
        path: ["listing"],
      });
    }

    if (value.category === "listing" && value.isAnonymous) {
      context.addIssue({
        code: "custom",
        message: "İlanlar anonim yayımlanamaz.",
        path: ["isAnonymous"],
      });
    }

    if (value.category === "listing" && !value.title.trim()) {
      context.addIssue({
        code: "custom",
        message: "İlan başlığını yazmalısın.",
        path: ["title"],
      });
    }

    if (value.category === "listing" && !value.body.trim()) {
      context.addIssue({
        code: "custom",
        message: "İlan açıklamasını yazmalısın.",
        path: ["body"],
      });
    }
  });

export const votePollSchema = z
  .object({
    optionId: z.uuid("Anket seçeneği geçersiz."),
  })
  .strict();

export const updatePostSchema = z
  .object({
    title: postTitleSchema.optional(),
    body: postBodySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Güncellenecek en az bir alan göndermelisin.",
    path: ["body"],
  })
  .superRefine((value, context) => {
    addUrlIssue(context, "title", value.title);
    addUrlIssue(context, "body", value.body);
  });

export const createCommentSchema = z
  .object({
    body: commentBodySchema,
    isAnonymous: z
      .boolean({ error: "Anonimlik tercihi doğru veya yanlış olmalıdır." })
      .default(false),
    parentId: z
      .uuid("Yanıtlanan yorum kimliği geçersiz.")
      .optional(),
    gifId: gifIdSchema.optional(),
  })
  .strict();

export const updateCommentSchema = z
  .object({
    body: commentBodySchema,
  })
  .strict();

const usernameSchema = z
  .string({ error: "Kullanıcı adı geçersiz." })
  .trim()
  .toLowerCase()
  .min(3, "Kullanıcı adı en az 3 karakter olmalıdır.")
  .max(24, "Kullanıcı adı en fazla 24 karakter olabilir.")
  .regex(
    /^[a-z0-9]+(?:[._][a-z0-9]+)*$/,
    "Kullanıcı adı yalnızca küçük harf, rakam, nokta ve alt çizgi içerebilir.",
  );

export const feedQuerySchema = z
  .object({
    category: postCategorySchema.optional(),
    sort: z
      .enum(POST_SORTS, {
        error: "Sıralama newest veya popular olmalıdır.",
      })
      .default("newest"),
    author: usernameSchema.optional(),
    cursor: z
      .string({ error: "Sayfalama anahtarı geçersiz." })
      .trim()
      .min(1, "Sayfalama anahtarı boş olamaz.")
      .max(512, "Sayfalama anahtarı çok uzun.")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "Sayfalama anahtarı geçersiz.",
      )
      .optional(),
    limit: z.coerce
      .number({ error: "Limit bir sayı olmalıdır." })
      .int("Limit tam sayı olmalıdır.")
      .min(1, "Limit en az 1 olmalıdır.")
      .max(50, "Limit en fazla 50 olabilir.")
      .default(20),
  })
  .strict();

const finalPostContentSchema = z
  .object({
    title: postTitleSchema,
    body: postBodySchema,
  })
  .strict()
  .superRefine((value, context) => {
    addPostContentIssues(context, value);
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type VotePollInput = z.infer<typeof votePollSchema>;

export function parseContentInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return parseAuthInput(schema, input);
}

export function validateFinalPostContent(
  current: {
    title: string;
    body: string;
  },
  updates: Pick<UpdatePostInput, "title" | "body">,
) {
  return parseContentInput(finalPostContentSchema, {
    title: updates.title ?? current.title,
    body: updates.body ?? current.body,
  });
}
