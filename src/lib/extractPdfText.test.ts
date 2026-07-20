import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted so the mock fns exist when vi.mock's factory is hoisted above the imports.
const { extractText, getDocumentProxy } = vi.hoisted(() => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}));
vi.mock("unpdf", () => ({ extractText, getDocumentProxy }));

import { extractPdfText, PdfExtractionError } from "./extractPdfText";

beforeEach(() => {
  vi.clearAllMocks();
  getDocumentProxy.mockResolvedValue({}); // opaque proxy; its shape doesn't matter to our code
});

describe("extractPdfText", () => {
  it("returns joined text, page count, hasText=true for a normal PDF", async () => {
    // mergePages:false => unpdf returns one string per page; extractPdfText joins them with "\n".
    extractText.mockResolvedValue({ totalPages: 3, text: ["ACME BANK statement", "page two"] });
    const r = await extractPdfText(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(r).toMatchObject({ pageCount: 3, hasText: true });
    expect(r.text).toBe("ACME BANK statement\npage two");
  });

  it("flags whitespace-only extraction as hasText=false (scanned/image PDF)", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: ["   \n\t  "] });
    const r = await extractPdfText(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(r.hasText).toBe(false);
  });

  it("wraps unpdf failures in a typed PdfExtractionError", async () => {
    extractText.mockRejectedValue(new Error("corrupt xref"));
    await expect(extractPdfText(new Uint8Array([0x25]))).rejects.toBeInstanceOf(PdfExtractionError);
  });
});
