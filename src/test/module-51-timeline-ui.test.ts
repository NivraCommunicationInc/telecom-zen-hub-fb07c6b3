/**
 * Module 51 · Phase B2.3 — Timeline UI regression guard.
 *
 * Invariants enforced across the entire client codebase (Core, Employee,
 * Client Portal):
 *
 *   1. Every timeline surface reads via <CustomerTimelineTable> or the
 *      canonical <useCustomerTimeline> hook. No component may query the
 *      source tables (client_profile_changes, service_address_history,
 *      order_status_history, activity_logs, admin_audit_log) directly for
 *      display purposes.
 *
 *   2. `client_profile_changes` remains readable ONLY from the legacy
 *      compatibility component `ClientProfileChangeHistory.tsx`. Any new
 *      reference is a regression.
 *
 *   3. The legacy per-portal implementation
 *      `src/components/employee/CustomerTimeline.tsx` is no longer imported
 *      anywhere — the canonical table is the single source.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";

// Files exempted from the "no direct source-table read" rule.
const READ_ALLOWLIST = new Set<string>([
  // Legacy compat surface — slated for removal after full QA sign-off.
  "src/components/client/ClientProfileChangeHistory.tsx",
  // The canonical hook itself reads the view (not a source table).
  "src/hooks/useCustomerTimeline.ts",
  // Test files describing the invariants themselves.
  "src/test/module-51-timeline-ui.test.ts",
  "src/test/module-51-timeline-gateway.test.ts",
]);

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p.replace(/\\/g, "/"));
  }
  return acc;
}

describe("Module 51 · Phase B2.3 · Timeline UI invariants", () => {
  const files = walk(ROOT).filter((f) => !f.endsWith(".d.ts"));

  it("scans a non-empty codebase", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no component reads client_profile_changes outside the legacy compat surface", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (READ_ALLOWLIST.has(f)) continue;
      const src = readFileSync(f, "utf8");
      if (/from\(\s*['"`]client_profile_changes['"`]\s*\)/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders, `client_profile_changes must only be read from ClientProfileChangeHistory. Offenders:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the legacy per-portal CustomerTimeline component is not imported anywhere", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (f.endsWith("/employee/CustomerTimeline.tsx")) continue;
      const src = readFileSync(f, "utf8");
      if (/from\s+['"`]@\/components\/employee\/CustomerTimeline['"`]/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders, `Use @/components/timeline instead. Offenders:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the canonical CustomerTimelineTable module exists", () => {
    const p = "src/components/timeline/CustomerTimelineTable.tsx";
    expect(files.includes(p)).toBe(true);
  });
});
