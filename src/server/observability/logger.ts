type LogLevel = "debug" | "info" | "warn" | "error";

type LogValue = boolean | number | string | null | undefined;

export type LogFields = Record<string, LogValue>;

const SERVICE_NAME = "kampus-web";
const MAX_ERROR_MESSAGE_LENGTH = 2_000;
const MAX_STACK_LENGTH = 12_000;

function cleanFields(fields: LogFields) {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([key, value]) => {
      if (value === undefined) return [];
      if (typeof value === "number" && !Number.isFinite(value)) return [];

      return [[key, value]];
    }),
  );
}

function deploymentEnvironment() {
  return (
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "unknown"
  );
}

export function createLogRecord(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  timestamp = new Date(),
) {
  return {
    ...cleanFields(fields),
    timestamp: timestamp.toISOString(),
    level,
    service: SERVICE_NAME,
    environment: deploymentEnvironment(),
    event,
  };
}

export function errorLogFields(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
      errorStack: error.stack?.slice(0, MAX_STACK_LENGTH),
    };
  }

  return {
    errorName: "NonErrorThrown",
    errorMessage: String(error).slice(0, MAX_ERROR_MESSAGE_LENGTH),
  };
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
) {
  if (process.env.NODE_ENV === "test") return;

  const line = JSON.stringify(createLogRecord(level, event, fields));

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    console.debug(line);
  } else {
    console.info(line);
  }
}
