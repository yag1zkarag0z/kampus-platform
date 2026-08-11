import {
  E2E_APP_ORIGIN,
  E2E_SHUTDOWN_PATH,
  E2E_SHUTDOWN_TOKEN,
} from "../e2e/helpers/environment";
import { startCampusServer } from "./campus-server";

if (process.env.NEXT_E2E !== "true") {
  throw new Error("The E2E server can only run with NEXT_E2E=true.");
}

async function main() {
  const appUrl = new URL(E2E_APP_ORIGIN);
  const hostname = appUrl.hostname;
  const port = Number(appUrl.port || "3100");
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the E2E server.");
  }

  const server = await startCampusServer({
    dev: true,
    hostname,
    port,
    origin: appUrl.origin,
    databaseUrl,
    controlledShutdown: {
      path: E2E_SHUTDOWN_PATH,
      token: E2E_SHUTDOWN_TOKEN,
      exitProcess: true,
    },
  });
  let isShuttingDown = false;

  async function shutdown(exitCode: number) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    await server.close();
    process.exit(exitCode);
  }

  process.once("SIGINT", () => void shutdown(130));
  process.once("SIGTERM", () => void shutdown(143));

  console.log(`E2E server ready at ${E2E_APP_ORIGIN}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
