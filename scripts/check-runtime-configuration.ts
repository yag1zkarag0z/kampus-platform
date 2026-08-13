import { loadEnvConfig } from "@next/env";

import { applyPlatformEnvironmentDefaults } from "@/server/platform-environment";
import { validateRuntimeConfiguration } from "@/server/runtime-configuration-core";

loadEnvConfig(process.cwd(), false);
const source = applyPlatformEnvironmentDefaults();

try {
  validateRuntimeConfiguration({
    ...source,
    NODE_ENV: "production",
  });
  console.log("KAMPÜS production configuration is valid.");
} catch (error) {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown runtime configuration error.";
  console.error(message);
  process.exitCode = 1;
}
