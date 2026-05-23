/**
 * ═══════════════════════════════════════════════════════════════════
 * REGRESSION SUITE: PDF text hardening (jsPDF.prototype.text patch)
 * ═══════════════════════════════════════════════════════════════════
 *
 * The Nivra PDF subsystem installs a global patch on `jsPDF.prototype.text`
 * so any `doc.text(null)` / `doc.text(undefined)` etc. silently renders the
 * "—" placeholder instead of the literal strings "null" / "undefined".
 *
 * If a future refactor accidentally bypasses this patch (e.g. someone uses
 * a different PDF library, or removes the bootstrap import), customer-facing
 * PDFs will start showing garbage text — exactly the bug that prompted this
 * hardening.
 *
 * These tests exercise the patch directly and lock the contract.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { jsPDF } from "jspdf";

// Importing this side-effect-only module installs the prototype patch.
// In production, the same import happens transitively via @/lib/pdf/index.
import "@/lib/pdf/_pdfBootstrap";

import { safeText } from "@/lib/pdf/_pdfSanitize";
import { isDocHardened, hardenDoc } from "@/lib/pdf/_pdfHarden";

describe("PDF text hardening — prototype patch", () => {
  let doc: jsPDF;

  beforeAll(() => {
    doc = new jsPDF();
  });

  it("does not throw on doc.text(null)", () => {
    expect(() => doc.text(null as unknown as string, 10, 10)).not.toThrow();
  });

  it("does not throw on doc.text(undefined)", () => {
    expect(() => doc.text(undefined as unknown as string, 10, 20)).not.toThrow();
  });

  it("does not throw on doc.text(NaN)", () => {
    expect(() => doc.text(NaN as unknown as string, 10, 30)).not.toThrow();
  });

  it("does not throw on doc.text({})", () => {
    expect(() => doc.text({} as unknown as string, 10, 40)).not.toThrow();
  });

  it("accepts and processes an array of strings (multi-line)", () => {
    expect(() =>
      doc.text(["valid line", null, undefined, "another valid"] as unknown as string[], 10, 50),
    ).not.toThrow();
  });

  it("still renders real strings normally", () => {
    expect(() => doc.text("Jean Tremblay", 10, 60)).not.toThrow();
  });
});

describe("safeText helper — input coverage", () => {
  it("returns fallback for null", () => {
    expect(safeText(null, "—")).toBe("—");
  });

  it("returns fallback for undefined", () => {
    expect(safeText(undefined, "—")).toBe("—");
  });

  it("returns fallback for empty string", () => {
    expect(safeText("", "—")).toBe("—");
  });

  it("returns fallback for whitespace-only", () => {
    expect(safeText("   ", "—")).toBe("—");
  });

  it("returns fallback for literal 'null' string (upstream serialization leak)", () => {
    expect(safeText("null", "—")).toBe("—");
  });

  it("returns fallback for literal 'undefined' string", () => {
    expect(safeText("undefined", "—")).toBe("—");
  });

  it("returns fallback for '[object Object]' (toString bug)", () => {
    expect(safeText("[object Object]", "—")).toBe("—");
  });

  it("returns fallback for NaN number", () => {
    expect(safeText(Number.NaN, "—")).toBe("—");
  });

  it("converts boolean true to 'Oui' and false to 'Non' (FR convention)", () => {
    expect(safeText(true)).toBe("Oui");
    expect(safeText(false)).toBe("Non");
  });

  it("converts numbers to strings", () => {
    expect(safeText(42, "—")).toBe("42");
    expect(safeText(3.14, "—")).toBe("3.14");
  });

  it("normalises curly quotes to straight (font safety)", () => {
    expect(safeText("it’s nice")).toBe("it's nice");
    expect(safeText("“quoted”")).toBe('"quoted"');
  });

  it("strips ASCII control characters", () => {
    // U+0001 (SOH) — would render as ? in most PDF fonts
    expect(safeText("helloworld")).toBe("helloworld");
  });

  it("preserves accented characters", () => {
    expect(safeText("Léa déjà")).toBe("Léa déjà");
  });
});

describe("hardenDoc helper — manual application", () => {
  it("marks a document as hardened", () => {
    const fresh = new jsPDF();
    // jsPDF is hardened at the prototype level so any instance is already
    // protected. But hardenDoc() can still be called for explicit marking.
    hardenDoc(fresh);
    expect(isDocHardened(fresh)).toBe(true);
  });

  it("is idempotent — second call does not break anything", () => {
    const fresh = new jsPDF();
    hardenDoc(fresh);
    hardenDoc(fresh);
    expect(() => fresh.text(null as unknown as string, 10, 10)).not.toThrow();
  });
});
