import {
  E2E_APP_ORIGIN,
  E2E_SHUTDOWN_PATH,
  E2E_SHUTDOWN_TOKEN,
} from "./helpers/environment";

const SHUTDOWN_TIMEOUT_MS = 10_000;

export default async function globalTeardown() {
  const shutdownUrl = new URL(E2E_SHUTDOWN_PATH, E2E_APP_ORIGIN);

  try {
    const response = await fetch(shutdownUrl, {
      method: "POST",
      headers: { "x-e2e-shutdown-token": E2E_SHUTDOWN_TOKEN },
      signal: AbortSignal.timeout(2_000),
    });

    if (response.status !== 204) {
      throw new Error(`E2E server shutdown returned ${response.status}.`);
    }
  } catch (error) {
    // The server may already have exited after an early setup failure.
    if (await isServerAvailable()) throw error;
    return;
  }

  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (!(await isServerAvailable())) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("E2E server did not stop within 10 seconds.");
}

async function isServerAvailable() {
  try {
    await fetch(E2E_APP_ORIGIN, {
      method: "HEAD",
      signal: AbortSignal.timeout(500),
    });
    return true;
  } catch {
    return false;
  }
}
