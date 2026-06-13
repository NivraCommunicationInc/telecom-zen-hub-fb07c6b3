/**
 * pdfMerge — PDF merge + watermark helpers using pdf-lib.
 * Used by client-dossier-pdf and kyc-ocr-extract.
 */
import { PDFDocument, degrees, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

/** Merge multiple PDF Uint8Arrays into a single PDF. Skips invalid/empty sources. */
export async function mergePdfs(sources: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const src of sources) {
    if (!src || src.length === 0) continue;
    try {
      const doc = await PDFDocument.load(src, { ignoreEncryption: true });
      const copied = await out.copyPages(doc, doc.getPageIndices());
      copied.forEach((p) => out.addPage(p));
    } catch (e) {
      console.warn("[mergePdfs] skipping unreadable PDF:", (e as Error).message);
    }
  }
  return out.save();
}

/**
 * Add a diagonal watermark text to every page of a PDF.
 * text e.g. "COPIE — Nivra Telecom — 2026-06-13"
 */
export async function addWatermarkToPdf(
  pdfBytes: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const grey = rgb(0.65, 0.65, 0.65);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const fontSize = 20;
    const tw = font.widthOfTextAtSize(text, fontSize);

    // Centre diagonal watermark
    page.drawText(text, {
      x: (width - tw) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: grey,
      opacity: 0.38,
      rotate: degrees(42),
    });
    // Second instance lower-left for tall pages
    page.drawText(text, {
      x: (width - tw) / 2 - 40,
      y: height * 0.28,
      size: fontSize - 2,
      font,
      color: grey,
      opacity: 0.25,
      rotate: degrees(42),
    });
  }
  return doc.save();
}

/** Convert base64 string to Uint8Array (handles atob limitations on large strings). */
export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Convert Uint8Array to base64 string. */
export function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}
