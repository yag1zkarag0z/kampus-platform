import "server-only";

import {
  getAuthEnvironment,
  getServerEnvironment,
} from "@/server/env";
import { createImageModerator } from "@/server/media/moderation";
import { createMediaStorage } from "@/server/media/storage-core";

export type RuntimeConfigurationStatus = "up" | "down";

/**
 * Validates every security-sensitive runtime dependency without performing
 * network I/O. Production deliberately fails closed when storage or image
 * moderation would fall back to their local development drivers.
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
