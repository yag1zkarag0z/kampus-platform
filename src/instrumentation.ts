import type { Instrumentation } from "next";

import {
  errorLogFields,
  logEvent,
} from "@/server/observability/logger";
import {
  createRequestId,
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/server/observability/request-id";

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
) {
  const value = headers[name] ?? headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
}

function pathname(value: string) {
  return value.split("?", 1)[0] || "/";
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const requestId =
    normalizeRequestId(headerValue(request.headers, REQUEST_ID_HEADER)) ??
    createRequestId();
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;

  logEvent("error", "next.request.unhandled_error", {
    requestId,
    method: request.method,
    path: pathname(request.path),
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    digest,
    ...errorLogFields(error),
  });
};
