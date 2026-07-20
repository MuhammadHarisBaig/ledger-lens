export type PdfExtraction = { text: string; pageCount: number; hasText: boolean };

export class PdfExtractionError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PdfExtractionError";
  }
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtraction> {
  // Lazy dynamic import — NOT a top-level import. Keeps unpdf out of the route's cold-start
  // bundle; it's only loaded when an upload actually needs extraction. This is also the
  // pattern that avoids the import-time native-dependency crashes pdf-parse caused.
  let extractText: typeof import("unpdf").extractText;
  let getDocumentProxy: typeof import("unpdf").getDocumentProxy;
  try {
    ({ extractText, getDocumentProxy } = await import("unpdf"));
  } catch (e) {
    throw new PdfExtractionError("Failed to load the PDF library.", { cause: e });
  }

  try {
    const pdf = await getDocumentProxy(bytes);
    // mergePages:false returns one string PER PAGE with line breaks preserved. (mergePages:true
    // collapses ALL whitespace incl. newlines via replace(/\s+/g," "), flattening the statement
    // into a single line — which breaks the line-based parseStatement.) Join pages with newlines.
    const { text: pages, totalPages } = await extractText(pdf);
    const text = pages.join("\n");
    return { text, pageCount: totalPages, hasText: text.trim().length > 0 };
  } catch (e) {
    // Don't swallow — surface a typed, message-safe error (no raw internals leak out).
    throw new PdfExtractionError("Could not extract text from the PDF.", { cause: e });
  }
}
