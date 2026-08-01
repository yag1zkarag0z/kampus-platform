import { z } from "zod";

import { getCampusAcademicIssues } from "@/server/account/academic-validation";

import { OTP_PURPOSES } from "./constants";
import { AuthError } from "./errors";

const studentEmailSchema = z
  .email()
  .trim()
  .transform((value) => value.toLowerCase())
  .refine(
    (value) => /^\d+@stu\.yasar\.edu\.tr$/.test(value),
    {
      message:
        "E-posta adresi öğrenci numarasıyla başlamalıdır.",
    },
  );

export const requestCodeSchema = z.object({
  email: studentEmailSchema,
  purpose: z.enum(OTP_PURPOSES),
});

export const verifyCodeSchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/),
  purpose: z.enum(OTP_PURPOSES),
});

export const registerSchema = z
  .object({
    registrationToken: z.string().min(32).max(2_048),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:[._][a-z0-9]+)*$/)
      .min(3)
      .max(24),
    displayName: z.string().trim().max(40).default(""),
    department: z.string().trim().min(1).max(60),
    yearLabel: z.string().trim().min(1).max(30),
    bio: z.string().trim().max(160).default(""),
    showDepartment: z.boolean(),
    termsAccepted: z.literal(true),
  })
  .superRefine((value, context) => {
    for (const issue of getCampusAcademicIssues({
      department: value.department,
      year: value.yearLabel,
    })) {
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: [issue.field === "year" ? "yearLabel" : issue.field],
      });
    }
  });

export function parseAuthInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const fieldErrors = Object.fromEntries(
    Object.entries(result.error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );

  throw new AuthError(
    "INVALID_REQUEST",
    "Gönderilen bilgileri kontrol edip yeniden dene.",
    {
      fieldErrors,
      status: 400,
    },
  );
}
