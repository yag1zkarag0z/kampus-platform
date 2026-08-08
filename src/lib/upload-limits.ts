export const IMAGE_UPLOAD_MAX_BYTES = 1024 * 1024;
export const DOCUMENT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

// Multipart boundaries and part headers count toward the HTTP body size. Keep
// enough room for normal metadata without weakening the actual file limits.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const IMAGE_MULTIPART_MAX_BYTES =
  IMAGE_UPLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;
export const DOCUMENT_MULTIPART_MAX_BYTES =
  DOCUMENT_UPLOAD_MAX_BYTES + MULTIPART_OVERHEAD_BYTES;

export function uploadBodyLimitForPath(pathname: string): number | null {
  if (pathname === "/v1/media" || pathname === "/v1/me/avatar") {
    return IMAGE_MULTIPART_MAX_BYTES;
  }

  if (pathname === "/v1/media/documents") {
    return DOCUMENT_MULTIPART_MAX_BYTES;
  }

  return null;
}
