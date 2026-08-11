import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";
import {
  cursorFieldSchema,
  limitFieldSchema,
} from "@/server/pagination/cursor";

export const startConversationSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Kullanıcı adı çok kısa.")
      .max(24, "Kullanıcı adı çok uzun.")
      .regex(
        /^[a-z0-9]+(?:[._][a-z0-9]+)*$/u,
        "Kullanıcı adı geçersiz.",
      )
      .transform((value) => value.toLocaleLowerCase("en-US")),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    clientMessageId: z.uuid(
      "Mesaj kimli\u011fi ge\u00e7ersiz.",
    ),
    body: z
      .string()
      .trim()
      .min(1, "Mesaj boş olamaz.")
      .max(1000, "Mesaj en fazla 1000 karakter olabilir.")
      .refine(
        (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value),
        "Mesaj desteklenmeyen karakterler içeriyor.",
      ),
  })
  .strict();

export const markConversationReadSchema = z
  .object({
    messageId: z.uuid("Mesaj kimli\u011fi ge\u00e7ersiz."),
  })
  .strict();

export const conversationListQuerySchema = z
  .object({
    box: z.enum(["inbox", "requests"]).default("inbox"),
    cursor: cursorFieldSchema.optional(),
    limit: limitFieldSchema({ defaultLimit: 20, maxLimit: 50 }),
    search: z
      .string()
      .trim()
      .max(64, "Arama en fazla 64 karakter olabilir.")
      .optional(),
  })
  .strict();

export const messageRequestActionSchema = z
  .object({
    action: z.enum(["accept", "delete", "block"]),
  })
  .strict();

export function parseMessagingInput<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  return parseAuthInput(schema, value);
}
