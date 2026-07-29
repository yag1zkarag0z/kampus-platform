import { config } from "dotenv";

import { cleanupE2eAuthData } from "./helpers/database";

config({ path: ".env.test", quiet: true });

export default async function globalSetup() {
  await cleanupE2eAuthData();
}
