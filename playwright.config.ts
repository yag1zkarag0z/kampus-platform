import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

import { getE2eDatabaseUrl } from "./e2e/helpers/database";
import { E2E_APP_ORIGIN } from "./e2e/helpers/environment";

config({ path: ".env.test", quiet: true });

const appUrl = new URL(E2E_APP_ORIGIN);
const port = appUrl.port || "3100";
const hostname = appUrl.hostname;
const baseURL = E2E_APP_ORIGIN;
const e2eDatabaseUrl = getE2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "list",
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `node ./node_modules/next/dist/bin/next dev --hostname ${hostname} --port ${port}`,
    port: Number(port),
    env: {
      APP_ORIGIN: baseURL,
      DATABASE_URL: e2eDatabaseUrl,
      NEXT_E2E: "true",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "webkit-homepage",
      testMatch: "**/homepage-polish.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-webkit-homepage",
      testMatch: "**/homepage-polish.spec.ts",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
