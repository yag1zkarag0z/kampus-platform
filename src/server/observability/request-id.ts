export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function createRequestId() {
  return crypto.randomUUID();
}

export function normalizeRequestId(value: string | null | undefined) {
  const candidate = value?.trim().toLowerCase();

  return candidate && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : null;
}

type HeadersReader = Pick<Headers, "get">;

export function requestIdFromHeaders(headers: HeadersReader) {
  return normalizeRequestId(headers.get(REQUEST_ID_HEADER));
}

export function requestIdFromRequest(request?: Request) {
  return requestIdFromHeaders(request?.headers ?? new Headers()) ??
    createRequestId();
}
