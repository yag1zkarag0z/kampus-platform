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

const optionalNonEmptyString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim().length === 0
      ? undefined
      : value,
  z.string().trim().min(1).optional(),
);

const booleanEnvironmentValue = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return value;
}, z.boolean());

const positiveTimeoutMilliseconds = z.coerce
  .number()
  .int()
  .min(250)
  .max(60_000);

const exampleAuthSecret =
  "replace-this-with-at-least-32-random-characters";

const authEnvironmentSchema = z
  .object({
    AUTH_SECRET: z.string().min(32),
    APP_ORIGIN: z.url(),
    TRUSTED_CLIENT_IP_HEADER: z
      .enum([
        "cf-connecting-ip",
        "x-forwarded-for",
        "x-real-ip",
      ]),
    SMTP_HOST: z.string().trim().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: booleanEnvironmentValue,
    SMTP_REQUIRE_TLS: booleanEnvironmentValue.default(false),
    SMTP_CONNECTION_TIMEOUT_MS:
      positiveTimeoutMilliseconds.default(5_000),
    SMTP_GREETING_TIMEOUT_MS:
      positiveTimeoutMilliseconds.default(5_000),
    SMTP_SOCKET_TIMEOUT_MS:
      positiveTimeoutMilliseconds.default(10_000),
    SMTP_USER: optionalNonEmptyString,
    SMTP_PASSWORD: optionalNonEmptyString,
    EMAIL_FROM: z.string().trim().min(3).max(320),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .optional(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
      context.addIssue({
        code: "custom",
        message: "SMTP_USER and SMTP_PASSWORD must be configured together.",
        path: ["SMTP_USER"],
      });
    }

    let appOrigin: URL;

    try {
      appOrigin = new URL(value.APP_ORIGIN);
    } catch {
      return;
    }

    if (
      appOrigin.username ||
      appOrigin.password ||
      appOrigin.pathname !== "/" ||
      appOrigin.search ||
      appOrigin.hash
    ) {
      context.addIssue({
        code: "custom",
        message: "APP_ORIGIN must contain only scheme, host, and port.",
        path: ["APP_ORIGIN"],
      });
    }

    if (value.NODE_ENV !== "production") {
      return;
    }

    if (value.AUTH_SECRET === exampleAuthSecret) {
      context.addIssue({
        code: "custom",
        message: "Production AUTH_SECRET must not use the example value.",
        path: ["AUTH_SECRET"],
      });
    }

    if (new Set(value.AUTH_SECRET).size < 12) {
      context.addIssue({
        code: "custom",
        message: "Production AUTH_SECRET must be a high-entropy random value.",
        path: ["AUTH_SECRET"],
      });
    }

    if (appOrigin.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        message: "APP_ORIGIN must use HTTPS in production.",
        path: ["APP_ORIGIN"],
      });
    }

    if (!value.SMTP_SECURE && !value.SMTP_REQUIRE_TLS) {
      context.addIssue({
        code: "custom",
        message: "Production SMTP must use implicit TLS or require STARTTLS.",
        path: ["SMTP_REQUIRE_TLS"],
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

export class InvalidServerEnvironmentError extends Error {
  constructor() {
    super("The server database configuration is missing or invalid.");
    this.name = "InvalidServerEnvironmentError";
  }
}

export class InvalidAuthEnvironmentError extends Error {
  constructor() {
    super("The server authentication configuration is missing or invalid.");
    this.name = "InvalidAuthEnvironmentError";
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

export function getAuthEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): AuthEnvironment {
  const isProduction = source.NODE_ENV === "production";
  const result = authEnvironmentSchema.safeParse({
    ...source,
    // Local development keeps the familiar default. Production must name the
    // exact header overwritten by its trusted reverse proxy; silently guessing
    // here would make an attacker-supplied forwarding header authoritative.
    TRUSTED_CLIENT_IP_HEADER:
      source.TRUSTED_CLIENT_IP_HEADER ??
      (isProduction ? undefined : "x-forwarded-for"),
  });

  if (!result.success) {
    throw new InvalidAuthEnvironmentError();
  }

  return result.data;
}
