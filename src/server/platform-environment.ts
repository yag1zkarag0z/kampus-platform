type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function present(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isLoopbackOrigin(value: string | undefined) {
  if (!value) return false;

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function normalizedExplicitOrigin(value: string | undefined) {
  const normalized = present(value);
  if (!normalized) return undefined;

  try {
    return new URL(normalized).origin;
  } catch {
    // Railway shows generated domains without a scheme in parts of its UI.
    // Accept a bare hostname (including an optional port), but never try to
    // repair values containing paths, credentials, queries, or whitespace.
    if (
      /\s/u.test(normalized) ||
      /[/?#@]/u.test(normalized) ||
      !normalized.includes(".")
    ) {
      return undefined;
    }

    try {
      const candidate = new URL(`https://${normalized}`);
      return candidate.origin;
    } catch {
      return undefined;
    }
  }
}

function railwayPublicOrigin(source: EnvironmentSource) {
  const domain = present(source.RAILWAY_PUBLIC_DOMAIN);
  if (!domain || domain.includes("://") || /[/?#]/u.test(domain)) {
    return undefined;
  }

  return `https://${domain}`;
}

function databaseUrlFromPgVariables(source: EnvironmentSource) {
  const host = present(source.PGHOST);
  const user = present(source.PGUSER);
  const password = present(source.PGPASSWORD);
  const database = present(source.PGDATABASE);

  if (!host || !user || !password || !database) return undefined;

  const port = present(source.PGPORT) ?? "5432";
  const urlHost = host.includes(":") && !host.startsWith("[")
    ? `[${host}]`
    : host;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${urlHost}:${port}/${encodeURIComponent(database)}`;
}

/**
 * Railway exposes platform metadata automatically, but service references still
 * arrive under user-selected names. Normalize the common Railway forms without
 * inventing secrets or weakening production validation.
 */
export function withPlatformEnvironmentDefaults(source: EnvironmentSource) {
  const resolved: Record<string, string | undefined> = { ...source };
  const isRailway = Boolean(
    present(source.RAILWAY_PROJECT_ID) ||
      present(source.RAILWAY_ENVIRONMENT_ID) ||
      present(source.RAILWAY_SERVICE_ID) ||
      present(source.RAILWAY_PUBLIC_DOMAIN),
  );
  const publicOrigin = railwayPublicOrigin(source);
  const explicitOrigin = normalizedExplicitOrigin(source.APP_ORIGIN);

  if (explicitOrigin) {
    resolved.APP_ORIGIN = explicitOrigin;
  }

  if (
    publicOrigin &&
    (!explicitOrigin || isLoopbackOrigin(explicitOrigin))
  ) {
    resolved.APP_ORIGIN = publicOrigin;
  }

  if (isRailway && !present(source.TRUSTED_CLIENT_IP_HEADER)) {
    resolved.TRUSTED_CLIENT_IP_HEADER = "x-forwarded-for";
  }

  if (!present(source.DATABASE_URL)) {
    resolved.DATABASE_URL =
      present(source.DATABASE_PRIVATE_URL) ??
      present(source.DATABASE_PUBLIC_URL) ??
      present(source.POSTGRES_URL) ??
      databaseUrlFromPgVariables(source);
  }

  // Railway Buckets can auto-inject these short names. Keep their credentials
  // separate from AWS credentials used by Rekognition.
  const bucket = present(source.BUCKET);
  const endpoint = present(source.ENDPOINT);
  if (bucket && endpoint) {
    resolved.MEDIA_STORAGE_DRIVER ??= "s3";
    resolved.AWS_S3_BUCKET ??= bucket;
    resolved.AWS_S3_ENDPOINT ??= endpoint;
    resolved.AWS_S3_REGION ??= present(source.REGION) ?? "auto";
    resolved.AWS_S3_ACCESS_KEY_ID ??= present(source.ACCESS_KEY_ID);
    resolved.AWS_S3_SECRET_ACCESS_KEY ??= present(
      source.SECRET_ACCESS_KEY,
    );
  }

  return resolved;
}

export function resolveApplicationOrigin(source: EnvironmentSource) {
  const resolved = withPlatformEnvironmentDefaults(source);
  const configured = normalizedExplicitOrigin(resolved.APP_ORIGIN);

  return configured ?? railwayPublicOrigin(source) ?? "http://localhost:3000";
}

export function applyPlatformEnvironmentDefaults(
  target: NodeJS.ProcessEnv = process.env,
) {
  const resolved = withPlatformEnvironmentDefaults(target);

  for (const [name, value] of Object.entries(resolved)) {
    if (value !== undefined) target[name] = value;
  }

  return resolved;
}
