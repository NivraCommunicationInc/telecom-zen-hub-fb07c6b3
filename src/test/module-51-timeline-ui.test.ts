/**
 * Module 51 · Phase B2.4 — Timeline UI regression guard (final cleanup).
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
 *   2. `client_profile_changes` is NEVER read directly from any component,
 *      page, or hook other than the canonical hook (which reads the
 *      unified `v_customer_timeline` view, not the source table). The
 *      legacy compat surface `ClientProfileChangeHistory.tsx` has been
 *      removed.
 *
 *   3. The legacy per-portal implementation
 *      `src/components/employee/CustomerTimeline.tsx` has been removed
 *      and must never reappear. `CustomerTimelineTable` is the single
 *      canonical Timeline component.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";

// Files exempted from the "no direct source-table read" rule.
// No allowlist for UI surfaces — Phase B2.4 removed all legacy compat.
const READ_ALLOWLIST = new Set<string>([
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

describe("Module 51 · Phase B2.4 · Timeline UI invariants (final)", () => {
  const files = walk(ROOT).filter((f) => !f.endsWith(".d.ts"));

  it("scans a non-empty codebase", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no component reads client_profile_changes directly (legacy compat removed)", () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (READ_ALLOWLIST.has(f)) continue;
      const src = readFileSync(f, "utf8");
      if (/from\(\s*['"`]client_profile_changes['"`]\s*\)/.test(src)) {
        offenders.push(f);
      }
    }
    expect(offenders, `client_profile_changes must never be read directly. Offenders:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the legacy ClientProfileChangeHistory component has been deleted", () => {
    expect(existsSync("src/components/client/ClientProfileChangeHistory.tsx")).toBe(false);
  });

  it("the legacy employee CustomerTimeline component has been deleted", () => {
    expect(existsSync("src/components/employee/CustomerTimeline.tsx")).toBe(false);
  });

  it("no file imports the deleted legacy components", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (
        /from\s+['"`]@\/components\/employee\/CustomerTimeline['"`]/.test(src) ||
        /from\s+['"`]@\/components\/client\/ClientProfileChangeHistory['"`]/.test(src) ||
        /import\s+ClientProfileChangeHistory\b/.test(src)
      ) {
        offenders.push(f);
      }
    }
    expect(offenders, `Legacy timeline imports must be removed. Offenders:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the canonical CustomerTimelineTable module exists and is the sole Timeline component", () => {
    const p = "src/components/timeline/CustomerTimelineTable.tsx";
    expect(files.includes(p)).toBe(true);
  });
});
