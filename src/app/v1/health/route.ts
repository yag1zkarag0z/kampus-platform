import { checkDatabaseHealth } from "@/server/db/health";
import {
  errorLogFields,
  logEvent,
} from "@/server/observability/logger";
import { checkRuntimeConfiguration } from "@/server/runtime-configuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const [database, configuration] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(
      checkRuntimeConfiguration(process.env, (error) => {
        logEvent("error", "health.configuration.invalid", {
          ...errorLogFields(error),
        });
      }),
    ),
  ]);
  const isHealthy = database === "up" && configuration === "up";

  return Response.json(
    {
      status: isHealthy ? "ok" : "degraded",
      checks: {
        configuration,
        database,
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: responseHeaders,
    },
  );
}
