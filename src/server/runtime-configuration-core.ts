import {
  getAuthEnvironment,
  getServerEnvironment,
} from "@/server/env";
import { createImageModerator } from "@/server/media/moderation-core";
import { createMediaStorage } from "@/server/media/storage-core";
import { ZodError } from "zod";

export type RuntimeConfigurationStatus = "up" | "down";

export class InvalidRuntimeComponentConfigurationError extends Error {
  constructor(component: string, fields: readonly string[]) {
    const detail = fields.length > 0 ? ` Check: ${fields.join(", ")}.` : "";
    super(`The ${component} configuration is missing or invalid.${detail}`);
    this.name = "InvalidRuntimeComponentConfigurationError";
  }
}

function validateComponent(component: string, validate: () => void) {
  try {
    validate();
  } catch (error) {
    if (!(error instanceof ZodError)) throw error;

    const fields = [
      ...new Set(
        error.issues
          .map((issue) => issue.path[0])
          .filter((field): field is string => typeof field === "string"),
      ),
    ];
    throw new InvalidRuntimeComponentConfigurationError(component, fields);
  }
}

/**
 * Shared with the custom Node.js entrypoint. It deliberately has no
 * `server-only` marker because that marker is transformed by Next.js but the
 * Railway start command executes this module directly through tsx.
 */
export function validateRuntimeConfiguration(
  source: Readonly<Record<string, string | undefined>> = process.env,
) {
  const server = getServerEnvironment(source);
  const auth = getAuthEnvironment(source);

  validateComponent("media storage", () => {
    createMediaStorage(source);
  });
  validateComponent("image moderation", () => {
    createImageModerator(source);
  });

  return { auth, server };
}

export function checkRuntimeConfiguration(
  source: Readonly<Record<string, string | undefined>> = process.env,
  onError?: (error: unknown) => void,
): RuntimeConfigurationStatus {
  try {
    validateRuntimeConfiguration(source);
    return "up";
  } catch (error) {
    onError?.(error);
    return "down";
  }
}
