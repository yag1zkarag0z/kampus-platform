import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

export const feedbackCategories = ["bug", "suggestion", "other"] as const;
export const feedbackStatuses = [
  "new",
  "reviewing",
  "resolved",
  "dismissed",
] as const;

export const submitFeedbackSchema = z
  .object({
    category: z.enum(feedbackCategories, {
      error: "Geri bildirim türü geçersiz.",
    }),
    message: z
      .string({ error: "Geri bildirim metni geçersiz." })
      .trim()
      .min(20, "Biraz daha ayrıntı ekle; en az 20 karakter gerekli.")
      .max(1000, "Geri bildirim en fazla 1000 karakter olabilir."),
    pagePath: z
      .string({ error: "Sayfa bilgisi geçersiz." })
      .trim()
      .min(1, "Sayfa bilgisi gerekli.")
      .max(240, "Sayfa bilgisi çok uzun.")
      .regex(/^\/(?!\/)[^\s?#]*$/u, "Sayfa bilgisi geçersiz."),
  })
  .strict();

export const listFeedbackQuerySchema = z
  .object({
    status: z.enum(feedbackStatuses).optional(),
    category: z.enum(feedbackCategories).optional(),
  })
  .strict();

export const updateFeedbackStatusSchema = z
  .object({
    status: z.enum(feedbackStatuses, {
      error: "Geri bildirim durumu geçersiz.",
    }),
  })
  .strict();

export const feedbackIdSchema = z.uuid({
  error: "Geri bildirim kimliği geçersiz.",
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type FeedbackCategory = (typeof feedbackCategories)[number];
export type FeedbackStatus = (typeof feedbackStatuses)[number];

export function parseFeedbackInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return parseAuthInput(schema, input);
}
