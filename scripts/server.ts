import { loadEnvConfig } from "@next/env";

import { validateRuntimeConfiguration } from "@/server/runtime-configuration";

import { startCampusServer } from "./campus-server";

const dev = process.argv.includes("--dev");
loadEnvConfig(process.cwd(), dev);

if (dev && !process.env.APP_ORIGIN) {
  process.env.APP_ORIGIN = `http://localhost:${process.env.PORT ?? "3000"}`;
}

const environment = validateRuntimeConfiguration({
  ...process.env,
  NODE_ENV: dev ? "development" : "production",
});
const origin = new URL(environment.auth.APP_ORIGIN).origin;
const port = Number((process.env.PORT ?? new URL(origin).port) || 3000);
const hostname = process.env.HOSTNAME?.trim() || "0.0.0.0";
const databaseUrl = environment.server.DATABASE_URL;

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
