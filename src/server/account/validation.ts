import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

import { getCampusAcademicIssues } from "./academic-validation";

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z0-9]+(?:[._][a-z0-9]+)*$/);

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(1).max(40).optional(),
    department: z.string().trim().min(1).max(60).optional(),
    year: z.string().trim().min(1).max(30).optional(),
    bio: z.string().trim().max(160).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
  .superRefine((value, context) => {
    for (const issue of getCampusAcademicIssues(value)) {
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: [issue.field],
      });
    }
  });

export const updateSettingsSchema = z
  .object({
    showDepartment: z.boolean().optional(),
    notifyReplies: z.boolean().optional(),
    notifyLikes: z.boolean().optional(),
    notifyAnnouncements: z.boolean().optional(),
    notifyComments: z.boolean().optional(),
    notifyFollows: z.boolean().optional(),
    notifyMentions: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export function parseAccountInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return parseAuthInput(schema, input);
}

export type UpdateProfileInput = z.infer<
  typeof updateProfileSchema
>;
export type UpdateSettingsInput = z.infer<
  typeof updateSettingsSchema
>;
