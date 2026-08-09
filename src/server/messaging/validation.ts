import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

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

export function parseMessagingInput<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  return parseAuthInput(schema, value);
}
