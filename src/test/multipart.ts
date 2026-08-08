import { Buffer } from "node:buffer";

const TEST_MULTIPART_BOUNDARY = "----kampus-test-boundary-7MA4YWxk";

function isFileEntry(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value
  );
}

/** Encodes jsdom FormData as a real multipart body for Route Handler tests. */
export async function encodeTestMultipartFormData(formData: FormData) {
  const chunks: Buffer[] = [];

  for (const [name, value] of formData.entries()) {
    chunks.push(Buffer.from(`--${TEST_MULTIPART_BOUNDARY}\r\n`, "utf8"));

    if (isFileEntry(value)) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${name}"; filename="${value.name}"\r\n` +
            `Content-Type: ${value.type || "application/octet-stream"}\r\n\r\n`,
          "utf8",
        ),
        Buffer.from(await value.arrayBuffer()),
        Buffer.from("\r\n", "utf8"),
      );
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
          "utf8",
        ),
      );
    }
  }

  chunks.push(
    Buffer.from(`--${TEST_MULTIPART_BOUNDARY}--\r\n`, "utf8"),
  );

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${TEST_MULTIPART_BOUNDARY}`,
  };
}
