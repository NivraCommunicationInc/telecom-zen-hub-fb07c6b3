/**
 * Real serviceability check against service_coverage_areas table.
 * Replaces the mock postal-code-length check.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CoverageResult {
  status: "available" | "limited" | "unavailable" | "unknown";
  coverageType?: string;
  availableServices?: string[];
  notes?: string | null;
}

/**
 * Check service availability by postal code.
 * Normalizes postal code and looks up the first 3 characters (FSA).
 */
export async function checkServiceCoverage(postalCode: string): Promise<CoverageResult> {
  const normalized = postalCode.replace(/\s+/g, "").toUpperCase().trim();

  if (normalized.length < 3) {
    return { status: "unknown" };
  }

  const prefix = normalized.substring(0, 3);

  const { data, error } = await supabase
    .from("service_coverage_areas" as any)
    .select("coverage_type, available_services, notes")
    .eq("postal_prefix", prefix)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[ServiceCoverage] DB error:", error);
    return { status: "unknown" };
  }

  if (!data) {
    return { status: "unavailable" };
  }

  const row = data as any;
  const coverageType = row.coverage_type as string;
  const availableServices = (row.available_services || []) as string[];

  if (coverageType === "unavailable") {
    return { status: "unavailable", coverageType, availableServices, notes: row.notes };
  }

  if (coverageType === "limited") {
    return { status: "limited", coverageType, availableServices, notes: row.notes };
  }

  return { status: "available", coverageType, availableServices, notes: row.notes };
}
