import "server-only";

import { AuthError } from "@/server/auth/errors";

type MultipartField = "document" | "image";

type LimitedMultipartOptions = {
  field: MultipartField;
  invalidMessage: string;
  maxBytes: number;
  tooLargeHint: string;
  tooLargeMessage: string;
};

function invalidMultipartError(message: string) {
  return new AuthError("INVALID_REQUEST", message, { status: 400 });
}

function multipartTooLargeError(options: LimitedMultipartOptions) {
  return new AuthError("INVALID_REQUEST", options.tooLargeMessage, {
    fieldErrors: { [options.field]: [options.tooLargeHint] },
    status: 413,
  });
}

function declaredContentLength(request: Request, invalidMessage: string) {
  const rawValue = request.headers.get("content-length");

  if (rawValue === null) return null;

  const normalizedValue = rawValue.trim();

  if (!/^\d+$/u.test(normalizedValue)) {
    throw invalidMultipartError(invalidMessage);
  }

  const value = Number(normalizedValue);

  if (!Number.isSafeInteger(value)) {
    throw invalidMultipartError(invalidMessage);
  }

  return value;
}

/**
 * Reads a multipart body through a hard byte ceiling before invoking the
 * platform parser. This also protects requests without Content-Length, such as
 * chunked uploads, which a header-only check cannot bound.
 */
export async function readLimitedMultipartFormData(
  request: Request,
  options: LimitedMultipartOptions,
): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? "";

  if (
    !/^multipart\/form-data(?:\s*;|$)/iu.test(contentType) ||
    !/boundary=/iu.test(contentType)
  ) {
    throw invalidMultipartError(options.invalidMessage);
  }

  const declaredBytes = declaredContentLength(
    request,
    options.invalidMessage,
  );

  if (declaredBytes !== null && declaredBytes > options.maxBytes) {
    throw multipartTooLargeError(options);
  }

  if (!request.body) {
    throw invalidMultipartError(options.invalidMessage);
  }

  // Count on a clone so the original body remains available to the platform's
  // multipart parser. The unread branch is explicitly cancelled on overflow.
  const validationBody = request.clone().body;

  if (!validationBody) {
    throw invalidMultipartError(options.invalidMessage);
  }

  const reader = validationBody.getReader();
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > options.maxBytes) {
        await Promise.all([
          reader.cancel().catch(() => undefined),
          request.body?.cancel().catch(() => undefined),
        ]);
        throw multipartTooLargeError(options);
      }
    }
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw invalidMultipartError(options.invalidMessage);
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw invalidMultipartError(options.invalidMessage);
  }

  try {
    return await request.formData();
  } catch {
    throw invalidMultipartError(options.invalidMessage);
  }
}

export function isUploadedFile(
  value: FormDataEntryValue | null,
): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number"
  );
}
