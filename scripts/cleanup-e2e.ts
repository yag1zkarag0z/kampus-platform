import { config } from "dotenv";

import { cleanupE2eAuthData } from "../e2e/helpers/database";

config({ path: ".env.test", quiet: true });

async function main() {
  await cleanupE2eAuthData();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
