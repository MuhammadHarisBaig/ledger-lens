export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB — named cap, no magic number

// PDF files begin with the bytes "%PDF" (0x25 0x50 0x44 0x46). This is the authoritative
// signature: unlike the Content-Type header or filename (both client-controlled), the leading
// bytes describe what the file actually IS, not what it claims to be.
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const;

export type UploadValidation =
  | { ok: true }
  | { ok: false; code: "EMPTY_FILE" | "FILE_TOO_LARGE" | "INVALID_TYPE"; message: string };

export function validateUpload(input: {
  bytes: Uint8Array;
  declaredType: string | null; // Content-Type from the client — ADVISORY ONLY, never trusted
  size: number; // caller passes bytes.length
}): UploadValidation {
  const { bytes, size } = input;

  if (size <= 0 || bytes.length === 0) {
    return { ok: false, code: "EMPTY_FILE", message: "The uploaded file is empty." };
  }
  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "File exceeds the 10 MB limit." };
  }

  const isPdf =
    bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((b, i) => bytes[i] === b);
  if (!isPdf) {
    return { ok: false, code: "INVALID_TYPE", message: "File is not a valid PDF." };
  }

  // declaredType is intentionally NOT used to accept/reject — the magic bytes above decide.
  return { ok: true };
}
