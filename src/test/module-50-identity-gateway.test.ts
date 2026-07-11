/**
 * Module 50 — Phase B2 identity double-path guard.
 *
 * Fails CI if anyone reintroduces a direct write to `profiles` / `accounts`
 * or to the legacy `accounts.billing_*` / `accounts.primary_service_*`
 * columns inside the two identity edit surfaces. All mutations MUST go
 * through the `client-account-actions` gateway via `callCoreAction`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  "src/components/admin/account-profile",
  "src/core-app/components/account-360",
];

// Match ONLY write calls to profiles/accounts (updates/inserts/upserts/deletes)
// and identity-legacy column writes. We tolerate READ references
// (`account.primary_service_address` display etc.) — those are display-only
// legacy fields that will be phased out by the service_addresses migration.
const FORBIDDEN = [
  /\.from\(\s*['"`]profiles['"`]\s*\)\s*\.(update|insert|upsert|delete)\b/,
  /\.from\(\s*['"`]accounts['"`]\s*\)\s*\.(update|insert|upsert)\b/,
  // Legacy address column writes (assignment form only, not property reads):
  /\bbilling_(address|city|province|postal_code)\s*:\s*['"`]/,
  /\bprimary_service_(address|city|province|postal_code)\s*:\s*['"`]/,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(name)) acc.push(p);
  }
  return acc;
}

describe("Module 50 · identity gateway integrity", () => {
  for (const root of ROOTS) {
    it(`no direct identity/account writes in ${root}`, () => {
      const files = walk(root);
      const violations: string[] = [];
      for (const f of files) {
        // Out-of-scope surfaces for Module 50 (finance/status, tracked separately):
        if (f.endsWith("AccountProfileHeader.tsx")) continue; // accounts.status
        if (f.endsWith("AccountCreditTab.tsx")) continue;      // accounts.credit_class
        const src = readFileSync(f, "utf8");
        // Strip line comments to avoid false-positives on doc blocks like this file.
        const stripped = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
        for (const rx of FORBIDDEN) {
          if (rx.test(stripped)) {
            violations.push(`${f} :: ${rx}`);
          }
        }
      }
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});
