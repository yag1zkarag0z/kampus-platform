import { loadEnvConfig } from "@next/env";

import { startCampusServer } from "./campus-server";

const dev = process.argv.includes("--dev");
loadEnvConfig(process.cwd(), dev);

const origin = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
const port = Number((process.env.PORT ?? new URL(origin).port) || 3000);
const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to start KAMPÜS.");
}

let server: Awaited<ReturnType<typeof startCampusServer>> | null = null;
let isShuttingDown = false;

async function shutdown(exitCode: number) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  await server?.close();
  process.exit(exitCode);
}

async function main() {
  server = await startCampusServer({
    dev,
    hostname,
    port,
    origin,
    databaseUrl,
  });
  console.log(`KAMPÜS ready at ${origin}`);
}

process.once("SIGINT", () => void shutdown(130));
process.once("SIGTERM", () => void shutdown(143));

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
