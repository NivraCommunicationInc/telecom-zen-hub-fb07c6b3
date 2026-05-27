import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();

function grepForbidden(pattern: string, relativePath: string): string[] {
  try {
    const fullPath = path.join(PROJECT_ROOT, relativePath);
    // Use ripgrep with proper escaping for shell
    // We want to find cases where .from("table") is followed by .select
    const result = execSync(
      `rg -n "${pattern}" ${fullPath} --ignore-file=.gitignore -g "!*.test.ts" -g "!*.spec.ts" || true`,
      { encoding: "utf-8" }
    );
    return result.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

describe("Canonical Projection Guard", () => {
  const CLIENT_PATHS = ["src/pages/client", "src/components/client"];

  it("CANONICAL_HOOK_INTERFACE: useCanonicalClientData must expose required domains", () => {
    const hookPath = path.join(PROJECT_ROOT, "src/hooks/useCanonicalClientData.ts");
    expect(fs.existsSync(hookPath), "useCanonicalClientData.ts should exist").toBe(true);
    
    const content = fs.readFileSync(hookPath, "utf-8");
    
    const requiredFields = [
      "invoices",
      "orders",
      "payments",
      "contracts",
      "equipment",
      "profile",
      "account"
    ];

    requiredFields.forEach(field => {
      expect(content).toContain(field);
    });
  });

  it("NO_DIRECT_READS: Client portal MUST NOT read directly from core tables", () => {
    const forbiddenTables = [
      "profiles",
      "accounts",
      "orders",
      "billing_invoices",
      "billing_payments",
      "contracts",
      "service_instances",
      "equipment_inventory",
      "billing_customers",
      "billing_subscriptions"
    ];

    const violations: string[] = [];

    CLIENT_PATHS.forEach(relPath => {
      forbiddenTables.forEach(table => {
        // Pattern matches .from("table") or .from('table')
        // We look for .select after it (on the same line or nearby lines, but rg -n usually gives us the line with .from)
        const pattern = `\\.from\\(['"]${table}['"]\\)\\.select`;
        const results = grepForbidden(pattern, relPath);
        violations.push(...results);
      });
    });

    // Known exceptions (migration-only or very specific reasons)
    const filteredViolations = violations.filter(v => 
       !v.includes("LegacyInvoiceImportDialog.tsx") &&
       !v.includes("// ALLOWED_DIRECT_READ")
    );

    expect(filteredViolations, `Forbidden direct reads found in client portal. Use useCanonicalClientData() instead:\n${filteredViolations.join("\n")}`).toHaveLength(0);
  });

  it("PREFER_CANONICAL_HOOK: Major client portal pages should use useCanonicalClientData", () => {
     const majorPages = [
       "ClientInvoices.tsx",
       "ClientOrders.tsx",
       "ClientContracts.tsx",
       "ClientEquipment.tsx",
       "ClientPayments.tsx",
       "ClientProfile.tsx"
     ];

     majorPages.forEach(page => {
       const pagePath = path.join(PROJECT_ROOT, "src/pages/client", page);
       if (fs.existsSync(pagePath)) {
         const content = fs.readFileSync(pagePath, "utf-8");
         expect(content, `${page} should use useCanonicalClientData`).toContain("useCanonicalClientData");
       }
     });
  });
});
