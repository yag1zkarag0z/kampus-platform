import { z } from "zod";

const postgresUrlSchema = z
  .string()
  .trim()
  .min(1)
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "postgres:" || protocol === "postgresql:";
      } catch {
        return false;
      }
    },
    { message: "Expected a PostgreSQL connection URL." },
  );

const serverEnvironmentSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export class InvalidServerEnvironmentError extends Error {
  constructor() {
    super("The server database configuration is missing or invalid.");
    this.name = "InvalidServerEnvironmentError";
  }
}

export function getServerEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(source);

  if (!result.success) {
    throw new InvalidServerEnvironmentError();
  }

  return result.data;
}
