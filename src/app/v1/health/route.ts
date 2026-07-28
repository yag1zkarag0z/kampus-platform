import { checkDatabaseHealth } from "@/server/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "no-store",
};

export async function GET() {
  const database = await checkDatabaseHealth();
  const isHealthy = database === "up";

  return Response.json(
    {
      status: isHealthy ? "ok" : "degraded",
      checks: {
        database,
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: responseHeaders,
    },
  );
}
