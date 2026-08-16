import { performance } from "node:perf_hooks";

type ScenarioName = "public" | "health" | "guest-session" | "member-read";

type RequestSpec = {
  label: string;
  path: string;
  method?: "GET" | "POST";
  expectedStatuses: readonly number[];
};

type Sample = {
  durationMs: number;
  label: string;
  status: number | null;
  ok: boolean;
  bytes: number;
  error?: string;
};

const args = process.argv.slice(2);

function argumentValue(name: string) {
  const inlinePrefix = `--${name}=`;
  const inline = args.find((argument) => argument.startsWith(inlinePrefix));

  if (inline) {
    return inline.slice(inlinePrefix.length);
  }

  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

function numberArgument(name: string, fallback: number) {
  const rawValue = argumentValue(name);
  const value = rawValue === undefined ? fallback : Number(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} pozitif bir sayı olmalıdır.`);
  }

  return value;
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil(sortedValues.length * ratio) - 1,
  );
  return sortedValues[Math.max(0, index)]!;
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function printHelp() {
  console.log(`KAMPÜS güvenli yük testi

Kullanım:
  npm run test:load -- --scenario health --base-url http://127.0.0.1:3000

Senaryolar:
  public         Statik/public sayfalar
  health         Vercel Function + veritabanı health endpoint'i
  guest-session  Misafir oturumu oluşturma ve okuma
  member-read    Feed, öneri ve okunmamış sayaçları (oturum çerezi gerekir)

Seçenekler:
  --concurrency  Eşzamanlı sanal kullanıcı (varsayılan: 5, en fazla: 250)
  --duration     Saniye (varsayılan: 15, en fazla: 600)
  --p95          Kabul edilen p95 milisaniye eşiği
  --max-error-rate Kabul edilen hata oranı (varsayılan: 0.01)
  --allow-production Production/non-local hedef kilidini açar

member-read için LOAD_TEST_SESSION_COOKIE ortam değişkenine yalnızca Cookie
header değerini ver. Bu değeri dosyaya kaydetme veya commit etme.`);
}

if (args.includes("--help")) {
  printHelp();
  process.exit(0);
}

const scenario = (argumentValue("scenario") ?? "health") as ScenarioName;
const supportedScenarios = new Set<ScenarioName>([
  "public",
  "health",
  "guest-session",
  "member-read",
]);

if (!supportedScenarios.has(scenario)) {
  throw new Error(`Bilinmeyen senaryo: ${scenario}`);
}

const baseUrl = new URL(
  argumentValue("base-url") ??
    process.env.LOAD_TEST_BASE_URL ??
    "http://127.0.0.1:3000",
);

if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
  throw new Error("Yük testi hedefi http veya https olmalıdır.");
}

const allowProduction =
  args.includes("--allow-production") ||
  process.env.LOAD_TEST_ALLOW_PRODUCTION === "true";

if (!isLocalHost(baseUrl.hostname) && !allowProduction) {
  throw new Error(
    "Non-local hedef kilitli. Bilinçli bir production testi için --allow-production kullan.",
  );
}

const concurrency = Math.floor(numberArgument("concurrency", 5));
const durationSeconds = numberArgument("duration", 15);
const requestTimeoutMs = numberArgument("request-timeout", 10_000);
const maxErrorRate = numberArgument("max-error-rate", 0.01);
const defaultP95Limits: Record<ScenarioName, number> = {
  public: 750,
  health: 1_000,
  "guest-session": 1_000,
  "member-read": 1_500,
};
const p95LimitMs = numberArgument("p95", defaultP95Limits[scenario]);

if (concurrency > 250) {
  throw new Error("Tek çalıştırmada en fazla 250 eşzamanlı kullanıcıya izin verilir.");
}

if (durationSeconds > 600) {
  throw new Error("Tek çalıştırmada süre en fazla 600 saniye olabilir.");
}

if (maxErrorRate > 1) {
  throw new Error("--max-error-rate 0 ile 1 arasında olmalıdır.");
}

const memberCookie = process.env.LOAD_TEST_SESSION_COOKIE?.trim();

if (scenario === "member-read" && !memberCookie) {
  throw new Error(
    "member-read için LOAD_TEST_SESSION_COOKIE ortam değişkeni gereklidir.",
  );
}

const requestSets: Record<Exclude<ScenarioName, "guest-session">, RequestSpec[]> = {
  public: [
    { label: "homepage", path: "/", expectedStatuses: [200] },
    { label: "homepage", path: "/", expectedStatuses: [200] },
    { label: "login", path: "/giris", expectedStatuses: [200] },
    { label: "register", path: "/kayit", expectedStatuses: [200] },
    { label: "privacy", path: "/kvkk", expectedStatuses: [200] },
  ],
  health: [
    { label: "health", path: "/v1/health", expectedStatuses: [200] },
  ],
  "member-read": [
    {
      label: "feed-newest",
      path: "/v1/posts?sort=newest&scope=global&limit=20",
      expectedStatuses: [200],
    },
    {
      label: "feed-newest",
      path: "/v1/posts?sort=newest&scope=global&limit=20",
      expectedStatuses: [200],
    },
    {
      label: "feed-trending",
      path: "/v1/posts?sort=trending&scope=global&limit=20",
      expectedStatuses: [200],
    },
    {
      label: "suggested-follows",
      path: "/v1/me/suggested-follows?limit=4",
      expectedStatuses: [200],
    },
    {
      label: "notification-count",
      path: "/v1/me/notifications/unread-count",
      expectedStatuses: [200],
    },
    {
      label: "message-count",
      path: "/v1/messages/unread-count",
      expectedStatuses: [200],
    },
  ],
};

async function executeRequest(spec: RequestSpec, cookie?: string): Promise<Sample> {
  const startedAt = performance.now();

  try {
    const response = await fetch(new URL(spec.path, baseUrl), {
      method: spec.method ?? "GET",
      headers: {
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        "User-Agent": "kampus-load-test/1.0",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(spec.method === "POST" ? { Origin: baseUrl.origin } : {}),
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const body = await response.arrayBuffer();

    return {
      durationMs: performance.now() - startedAt,
      label: spec.label,
      status: response.status,
      ok: spec.expectedStatuses.includes(response.status),
      bytes: body.byteLength,
    };
  } catch (error) {
    return {
      durationMs: performance.now() - startedAt,
      label: spec.label,
      status: null,
      ok: false,
      bytes: 0,
      error: error instanceof Error ? error.message : "Bilinmeyen istek hatası",
    };
  }
}

async function createGuestCookie() {
  const response = await fetch(new URL("/v1/auth/guest", baseUrl), {
    method: "POST",
    headers: { Origin: baseUrl.origin, "User-Agent": "kampus-load-test/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  await response.arrayBuffer();
  const setCookie = response.headers.get("set-cookie");
  const cookie = setCookie?.split(";", 1)[0];

  if (response.status !== 201 || !cookie) {
    throw new Error("Misafir oturum çerezi alınamadı.");
  }

  return cookie;
}

async function main() {
const samples: Sample[] = [];
const startedAt = performance.now();
const endsAt = startedAt + durationSeconds * 1_000;

console.log(
  `\nKAMPÜS load test: ${scenario} · ${concurrency} VU · ${durationSeconds}s · ${baseUrl.origin}`,
);

async function runWorker(workerId: number) {
  const guestCookie = scenario === "guest-session" ? await createGuestCookie() : undefined;
  const cookie = scenario === "member-read" ? memberCookie : guestCookie;
  const specs =
    scenario === "guest-session"
      ? ([
          {
            label: "guest-session-read",
            path: "/v1/session",
            expectedStatuses: [200],
          },
        ] satisfies RequestSpec[])
      : requestSets[scenario];
  let requestIndex = workerId % specs.length;

  while (performance.now() < endsAt) {
    const spec = specs[requestIndex % specs.length]!;
    samples.push(await executeRequest(spec, cookie));
    requestIndex += 1;
  }
}

await Promise.all(
  Array.from({ length: concurrency }, (_, workerId) => runWorker(workerId)),
);

const elapsedSeconds = (performance.now() - startedAt) / 1_000;
const latencies = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
const successful = samples.filter((sample) => sample.ok).length;
const failed = samples.length - successful;
const errorRate = samples.length === 0 ? 1 : failed / samples.length;
const totalBytes = samples.reduce((total, sample) => total + sample.bytes, 0);
const average =
  latencies.length === 0
    ? 0
    : latencies.reduce((total, latency) => total + latency, 0) / latencies.length;
const p95 = percentile(latencies, 0.95);

const statusCounts = new Map<string, number>();
for (const sample of samples) {
  const key = sample.status === null ? "network" : String(sample.status);
  statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
}

console.table({
  requests: samples.length,
  successful,
  failed,
  "error-rate": `${(errorRate * 100).toFixed(2)}%`,
  "requests/sec": (samples.length / elapsedSeconds).toFixed(2),
  "data-received": `${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  "latency-avg": `${average.toFixed(1)} ms`,
  "latency-p50": `${percentile(latencies, 0.5).toFixed(1)} ms`,
  "latency-p90": `${percentile(latencies, 0.9).toFixed(1)} ms`,
  "latency-p95": `${p95.toFixed(1)} ms`,
  "latency-p99": `${percentile(latencies, 0.99).toFixed(1)} ms`,
  "latency-max": `${(latencies.at(-1) ?? 0).toFixed(1)} ms`,
});
console.log("HTTP durumları:", Object.fromEntries(statusCounts));

const routeGroups = new Map<string, Sample[]>();
for (const sample of samples) {
  const group = routeGroups.get(sample.label) ?? [];
  group.push(sample);
  routeGroups.set(sample.label, group);
}

for (const [label, routeSamples] of routeGroups) {
  const routeLatencies = routeSamples
    .map((sample) => sample.durationMs)
    .sort((a, b) => a - b);
  const routeErrors = routeSamples.filter((sample) => !sample.ok).length;
  console.log(
    `${label.padEnd(20)} ${String(routeSamples.length).padStart(6)} req · p95 ${percentile(routeLatencies, 0.95).toFixed(1).padStart(8)} ms · hata ${routeErrors}`,
  );
}

const firstErrors = samples.filter((sample) => !sample.ok).slice(0, 5);
if (firstErrors.length > 0) {
  console.log("İlk hatalar:", firstErrors);
}

const passed = errorRate <= maxErrorRate && p95 <= p95LimitMs;
console.log(
  `Eşikler: hata <= ${(maxErrorRate * 100).toFixed(2)}%, p95 <= ${p95LimitMs} ms → ${passed ? "GEÇTİ" : "KALDI"}\n`,
);

if (!passed) {
  process.exitCode = 1;
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
