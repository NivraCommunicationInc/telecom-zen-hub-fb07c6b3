/**
 * CANONICAL DATA INTEGRITY REGRESSION GUARD
 * 
 * This test scans the codebase to ensure NO component or hook reads
 * `profiles.account_number` as a display/identity source.
 * 
 * The ONLY canonical source for account_number is the `accounts` table,
 * resolved via `canonicalAccountResolver.ts`.
 * 
 * If this test fails, a non-canonical read path has been reintroduced.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

const PROJECT_ROOT = process.cwd();

/**
 * Searches the src directory for forbidden patterns.
 * Returns matching file:line entries.
 */
function grepForbidden(pattern: string, excludeFiles: string[] = []): string[] {
  try {
    const excludeArgs = [
      "--exclude-dir=node_modules",
      "--exclude-dir=.git",
      "--exclude-dir=dist",
      "--exclude=*.test.ts",
      "--exclude=types.ts",
      ...excludeFiles.map(f => `--exclude=${f}`),
    ].join(" ");
    const result = execSync(
      `grep -rn "${pattern}" ${PROJECT_ROOT}/src ${excludeArgs} 2>/dev/null || true`,
      { encoding: "utf-8" },
    );
    return result
      .split("\n")
      .filter(Boolean)
      .filter(line => !line.includes("canonical-data-integrity.test.ts"));
  } catch {
    return [];
  }
}

describe("Canonical Data Integrity Guard", () => {
  it("MUST NOT read profile.account_number for display in hooks (non-canonical)", () => {
    const violations = grepForbidden("profile\\.account_number\\|profile\\?\\.account_number");
    // Filter out the canonical resolver itself and test files
    const real = violations.filter(
      v =>
        !v.includes("canonicalAccountResolver") &&
        !v.includes(".test.ts") &&
        !v.includes("// canonical") &&
        !v.includes("// NOTE:"),
    );
    expect(real, `Non-canonical profile.account_number reads found:\n${real.join("\n")}`).toHaveLength(0);
  });

  it("MUST NOT select account_number from profiles table in queries", () => {
    const violations = grepForbidden('select.*account_number.*profiles\\|from.*profiles.*account_number');
    const real = violations.filter(
      v =>
        !v.includes(".test.ts") &&
        !v.includes("// canonical") &&
        !v.includes("// NOTE:"),
    );
    expect(real, `Queries selecting account_number from profiles:\n${real.join("\n")}`).toHaveLength(0);
  });

  it("canonicalAccountResolver.ts must exist as the single resolution point", () => {
    const fs = require("fs");
    expect(fs.existsSync(`${PROJECT_ROOT}/src/lib/canonicalAccountResolver.ts`)).toBe(true);
  });

  it("MUST NOT use id.slice() as fallback for invoice_number or payment_number", () => {
    // These are financial identifiers that must always come from the DB
    const invoiceViolations = grepForbidden("invoice.*id\\.slice\\|id\\.slice.*invoice");
    const paymentViolations = grepForbidden("payment.*id\\.slice\\|id\\.slice.*payment");
    const all = [...invoiceViolations, ...paymentViolations].filter(
      v => !v.includes(".test.ts"),
    );
    expect(all, `id.slice() used as fallback for financial identifiers:\n${all.join("\n")}`).toHaveLength(0);
  });
});
