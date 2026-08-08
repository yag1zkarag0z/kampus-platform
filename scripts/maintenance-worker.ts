import "dotenv/config";

import {
  maintenanceHasFailures,
  runMaintenance,
  type MaintenanceMode,
} from "../src/server/maintenance/service";
import { DATA_RETENTION_POLICY } from "../src/server/maintenance/policy";

function numericOption(name: string, fallback: number) {
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith(`--${name}=`));
  const rawValue = argument?.slice(name.length + 3);
  const parsed = Number(rawValue ?? fallback);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${name} must be a positive integer.`);
  }

  return parsed;
}

function modeOption(): MaintenanceMode {
  const argument = process.argv
    .slice(2)
    .find((value) => value.startsWith("--mode="));
  const mode = argument?.slice("--mode=".length) ?? "all";

  if (mode !== "all" && mode !== "cleanup" && mode !== "reconcile") {
    throw new Error("--mode must be all, cleanup, or reconcile.");
  }

  return mode;
}

function waitForNextRun(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, durationMs);

    signal.addEventListener("abort", finish, { once: true });
  });
}

async function main() {
  const argumentsSet = new Set(process.argv.slice(2));
  const dryRun = argumentsSet.has("--dry-run");
  const once = argumentsSet.has("--once") || dryRun;
  const mode = modeOption();
  const batchSize = numericOption(
    "batch-size",
    DATA_RETENTION_POLICY.defaultBatchSize,
  );
  const intervalMs = numericOption(
    "interval-ms",
    Number(
      process.env.MAINTENANCE_INTERVAL_MS ??
        DATA_RETENTION_POLICY.workerIntervalMs,
    ),
  );
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  do {
    const report = await runMaintenance({ dryRun, mode, batchSize });

    console.log(
      JSON.stringify({ event: "maintenance.completed", ...report }),
    );

    if (maintenanceHasFailures(report)) {
      if (once) process.exitCode = 1;
      console.error(
        JSON.stringify({
          event: "maintenance.anomaly",
          storageDeleteFailures:
            report.cleanup.storageDeleteFailures +
            report.reconciliation.orphanDeleteFailures,
          sizeMismatches: report.reconciliation.sizeMismatches,
        }),
      );
    }

    if (once || controller.signal.aborted) return;
    await waitForNextRun(intervalMs, controller.signal);
  } while (!controller.signal.aborted);
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: "maintenance.failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }),
  );
  process.exitCode = 1;
});
