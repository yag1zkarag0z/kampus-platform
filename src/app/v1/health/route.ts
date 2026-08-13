import { checkDatabaseHealth } from "@/server/db/health";
import { checkRuntimeConfiguration } from "@/server/runtime-configuration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const [database, configuration] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(checkRuntimeConfiguration()),
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
