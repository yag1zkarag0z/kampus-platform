import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

const REPORT_REASONS = [
  "spam",
  "harassment",
  "personal_information",
  "misleading",
  "other",
] as const;

const REPORT_RESOLUTIONS = [
  "dismissed",
  "content_removed",
  "user_suspended",
] as const;

const ACCOUNT_STATUSES = ["active", "suspended"] as const;
const MEMBER_ROLES = ["member", "moderator", "admin"] as const;

const noteSchema = z
  .string({ error: "Not metni geçersiz." })
  .trim()
  .max(240, "Not en fazla 240 karakter olabilir.");

export const submitReportSchema = z
  .object({
    targetType: z.enum(["post", "comment"], {
      error: "Şikâyet hedefi gönderi veya yorum olmalıdır.",
    }),
    targetId: z.uuid("Şikâyet edilen içerik kimliği geçersiz."),
    reason: z.enum(REPORT_REASONS, {
      error: "Şikâyet nedeni geçersiz.",
    }),
    detail: z
      .string({ error: "Açıklama geçersiz." })
      .trim()
      .max(300, "Açıklama en fazla 300 karakter olabilir.")
      .optional(),
  })
  .strict();

export const resolveReportSchema = z
  .object({
    resolution: z.enum(REPORT_RESOLUTIONS, {
      error: "Karar dismissed, content_removed veya user_suspended olmalıdır.",
    }),
    note: noteSchema.optional(),
  })
  .strict();

export const updateUserStatusSchema = z
  .object({
    status: z.enum(ACCOUNT_STATUSES, {
      error: "Durum active veya suspended olmalıdır.",
    }),
    note: noteSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.status === "active" && !input.note?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Hesabı yeniden etkinleştirmek için bir gerekçe yazmalısın.",
      });
    }
  })
  .strict();

export const updateUserRoleSchema = z
  .object({
    role: z.enum(MEMBER_ROLES, {
      error: "Rol member, moderator veya admin olmalıdır.",
    }),
  })
  .strict();

export const listReportsQuerySchema = z
  .object({
    status: z.enum(["pending", "resolved"]).optional(),
  })
  .strict();

export type SubmitReportInput = z.infer<typeof submitReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type ListReportsQueryInput = z.infer<typeof listReportsQuerySchema>;

export function parseModerationInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return parseAuthInput(schema, input);
}
