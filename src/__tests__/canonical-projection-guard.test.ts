import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

const PROJECT_ROOT = process.cwd();

function grepForbidden(pattern: string, path: string): string[] {
  try {
    const result = execSync(
      `grep -rn "${pattern}" ${PROJECT_ROOT}/${path} --exclude=*.test.ts --exclude=*.spec.ts 2>/dev/null || true`,
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
    const fs = require("fs");
    const content = fs.readFileSync("${PROJECT_ROOT}/src/hooks/useCanonicalClientData.ts", "utf-8");
    
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
      "equipment_inventory"
    ];

    const violations: string[] = [];

    CLIENT_PATHS.forEach(path => {
      forbiddenTables.forEach(table => {
        // Look for .from("table_name")
        const results = grepForbidden(`\.from(["']${table}["'])`, path);
        
        // Filter out .update(), .insert(), .upsert(), .delete() if we only want to block SELECTs
        // But usually .from("...").select() is what we want to block.
        // Actually, let's block any .from() that is followed by .select() or just any .from() if it's a read-heavy page.
        results.forEach(line => {
          if (line.includes(".select")) {
             violations.push(line);
          }
        });
      });
    });

    expect(violations, `Forbidden direct reads found in client portal:\n${violations.join("\n")}`).toHaveLength(0);
  });

  it("PREFER_CANONICAL_HOOK: Client portal pages should use useCanonicalClientData", () => {
     // This is a soft check: major pages should have the hook
     const majorPages = [
       "ClientInvoices.tsx",
       "ClientOrders.tsx",
       "ClientPayments.tsx",
       "ClientContracts.tsx",
       "ClientEquipment.tsx"
     ];

     majorPages.forEach(page => {
       const path = `src/pages/client/${page}`;
       const content = execSync(`cat ${PROJECT_ROOT}/${path} 2>/dev/null || true`, { encoding: "utf-8" });
       if (content) {
         expect(content, `${page} should use useCanonicalClientData`).toContain("useCanonicalClientData");
       }
     });
  });
});
