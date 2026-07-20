import { describe, it, expect } from "vitest";
import { validateUpload, MAX_UPLOAD_BYTES } from "./validateUpload";

const pdf = (...rest: number[]) => new Uint8Array([0x25, 0x50, 0x44, 0x46, ...rest]); // %PDF...

describe("validateUpload", () => {
  it("accepts bytes starting with the %PDF magic signature", () => {
    expect(
      validateUpload({ bytes: pdf(0x2d, 0x31), declaredType: "application/pdf", size: 6 }),
    ).toEqual({ ok: true });
  });

  it("accepts a real PDF even if the declared Content-Type lies (magic bytes decide)", () => {
    expect(
      validateUpload({ bytes: pdf(0x0a), declaredType: "text/plain", size: 5 }).ok,
    ).toBe(true);
  });

  it("rejects PNG magic bytes as INVALID_TYPE", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(
      validateUpload({ bytes: png, declaredType: "application/pdf", size: png.length }),
    ).toMatchObject({ ok: false, code: "INVALID_TYPE" });
  });

  it("rejects plain text as INVALID_TYPE", () => {
    const txt = new TextEncoder().encode("hello");
    expect(
      validateUpload({ bytes: txt, declaredType: "application/pdf", size: txt.length }),
    ).toMatchObject({ ok: false, code: "INVALID_TYPE" });
  });

  it("rejects oversized files as FILE_TOO_LARGE", () => {
    // pass a size over the cap with a tiny valid header — no need to allocate 10MB
    expect(
      validateUpload({ bytes: pdf(), declaredType: "application/pdf", size: MAX_UPLOAD_BYTES + 1 }),
    ).toMatchObject({ ok: false, code: "FILE_TOO_LARGE" });
  });

  it("rejects empty files as EMPTY_FILE", () => {
    expect(
      validateUpload({ bytes: new Uint8Array(), declaredType: "application/pdf", size: 0 }),
    ).toMatchObject({ ok: false, code: "EMPTY_FILE" });
  });
});
