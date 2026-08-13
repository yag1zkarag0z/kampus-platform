import {
  getAuthEnvironment,
  getServerEnvironment,
} from "@/server/env";
import { createImageModerator } from "@/server/media/moderation-core";
import { createMediaStorage } from "@/server/media/storage-core";

export type RuntimeConfigurationStatus = "up" | "down";

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

  createMediaStorage(source);
  createImageModerator(source);

  return { auth, server };
}

export function checkRuntimeConfiguration(
  source: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeConfigurationStatus {
  try {
    validateRuntimeConfiguration(source);
    return "up";
  } catch {
    return "down";
  }
}
