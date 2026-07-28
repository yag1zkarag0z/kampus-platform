import { config } from "dotenv";

config({ path: ".env.test", quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Copy .env.test.example to .env.test.",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
