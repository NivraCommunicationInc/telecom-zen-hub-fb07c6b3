/**
 * Module 51 — Phase B1 timeline coverage guard.
 *
 * Every edge function under supabase/functions/** that writes a
 * client-scoped event to `admin_audit_log` MUST also mirror it in the
 * canonical account journal (`client_activity_logs` via
 * `writeAccountJournal`). Otherwise the event never surfaces in
 * `v_customer_timeline` and Client 360 loses visibility.
 *
 * Detection rule (heuristic, deliberately conservative):
 *   - The file inserts into `admin_audit_log` (`.from("admin_audit_log").insert`).
 *   - AND the file references any client-scoped target signal:
 *       target_type: "user" | "account" | "client"
 *       OR literal action prefix "account_ops." / "client_self." /
 *          "client_account." / "account."
 *   - THEN the file MUST also import & call `writeAccountJournal`.
 *
 * Exemptions live in ALLOWLIST for functions where the admin_audit_log
 * entry is not client-scoped (e.g. staff impersonation onboarding).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FUNCTIONS_ROOT = "supabase/functions";

/** Functions whose admin_audit_log writes are provably NOT client-scoped. */
const ALLOWLIST = new Set<string>([
  // Staff-only surfaces (no client_id in details): add as needed.
]);

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (name === "index.ts") acc.push(p);
  }
  return acc;
}

const CLIENT_SCOPE_SIGNALS = [
  /target_type\s*:\s*['"`](user|account|client)['"`]/,
  /action\s*:\s*['"`](account_ops|client_self|client_account|account)\./,
  /details\s*:\s*\{[^}]*\bclient_id\b/,
];

describe("Module 51 · timeline gateway coverage", () => {
  const files = walk(FUNCTIONS_ROOT);
  it("scans at least one function", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.replace(/\\/g, "/");
    const funcDir = rel.split("/").slice(0, -1).join("/");
    const funcName = funcDir.split("/").pop() ?? funcDir;
    if (ALLOWLIST.has(funcName)) continue;

    it(`${funcName}: admin_audit_log writes are mirrored to timeline`, () => {
      const src = readFileSync(file, "utf8");
      const writesAdminAudit = /\.from\(\s*['"`]admin_audit_log['"`]\s*\)\s*\.insert\b/.test(src);
      if (!writesAdminAudit) return; // not concerned

      const clientScoped = CLIENT_SCOPE_SIGNALS.some((rx) => rx.test(src));
      if (!clientScoped) return; // pure staff/admin surface

      const hasJournal =
        /writeAccountJournal\s*\(/.test(src) ||
        /rpc_account_journal_write/.test(src);

      expect(
        hasJournal,
        `${funcName} writes to admin_audit_log with a client-scoped target ` +
          `but never calls writeAccountJournal (Module 51 timeline coverage).`,
      ).toBe(true);
    });
  }
});
