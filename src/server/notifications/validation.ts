import { z } from "zod";

import { parseAuthInput } from "@/server/auth/validation";

export const listNotificationsQuerySchema = z
  .object({
    limit: z.coerce
      .number({ error: "Limit geçersiz." })
      .int()
      .min(1)
      .max(50)
      .optional(),
  })
  .strict();

export type ListNotificationsQueryInput = z.infer<
  typeof listNotificationsQuerySchema
>;

export function parseNotificationsInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return parseAuthInput(schema, input);
}

const MENTION_TOKEN_PATTERN = /@([a-zA-Z0-9._]{1,24})/g;
const USERNAME_FORMAT_PATTERN = /^[a-z0-9]+(?:[._][a-z0-9]+)*$/;
const MENTION_LIMIT = 10;

export function extractMentionedUsernames(body: string): string[] {
  const usernames = new Set<string>();

  for (const match of body.matchAll(MENTION_TOKEN_PATTERN)) {
    if (usernames.size >= MENTION_LIMIT) {
      break;
    }

    const candidate = match[1]!.toLowerCase();

    if (USERNAME_FORMAT_PATTERN.test(candidate)) {
      usernames.add(candidate);
    }
  }

  return [...usernames];
}
