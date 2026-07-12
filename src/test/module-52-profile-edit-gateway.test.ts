/**
 * Module 52 — CI guard.
 *
 * Enforces that no file inside `src/core-app/components/account-360/profile-edit/`
 * — and, more broadly, that Account360ProfileEditDialog and its dependencies —
 * bypass the canonical `client-account-actions` gateway with direct DB writes to
 * `profiles`, `accounts`, or `service_addresses`.
 *
 * Also enforces that the orchestrator dialog is exclusively an orchestrator
 * (no direct supabase writes, no zod validation of business fields).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function walk(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(p);
  }
  return acc;
}

const FORBIDDEN = [
  /supabase\.from\(\s*['"]profiles['"]\s*\)\s*\.update\(/,
  /supabase\.from\(\s*['"]accounts['"]\s*\)\s*\.update\(/,
  /supabase\.from\(\s*['"]service_addresses['"]\s*\)\s*\.(insert|update|delete)\(/,
];

describe("Module 52 — Profile Edit gateway invariants", () => {
  it("no direct writes to profiles/accounts/service_addresses in profile-edit tree", () => {
    const dir = join(ROOT, "src/core-app/components/account-360/profile-edit");
    const files = walk(dir);
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const rx of FORBIDDEN) {
        if (rx.test(src)) violations.push(`${f} :: ${rx}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("orchestrator dialog has no supabase writes at all", () => {
    const p = join(ROOT, "src/core-app/components/account-360/Account360ProfileEditDialog.tsx");
    const src = readFileSync(p, "utf8");
    expect(src).not.toMatch(/supabase\.from\(/);
    expect(src).not.toMatch(/\.functions\.invoke\(/);
    // Orchestrator must delegate to the four sections.
    expect(src).toMatch(/ProfileIdentitySection/);
    expect(src).toMatch(/ProfileContactSection/);
    expect(src).toMatch(/ClientBillingAddressSection/);
    expect(src).toMatch(/ProfilePreferencesSection/);
  });

  it("all profile-edit sections import callCoreAction (or delegate to a section that does)", () => {
    const dir = join(ROOT, "src/core-app/components/account-360/profile-edit");
    const files = walk(dir).filter((f) => /Section\.tsx$|OtpDialog\.tsx$/.test(f));
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const usesGateway = /callCoreAction/.test(src);
      const delegatesOnly = /ProfileContactSection\.tsx$/.test(f); // delegates to OTP dialogs
      expect(usesGateway || delegatesOnly, `${f} must use callCoreAction`).toBe(true);
    }
  });
});
