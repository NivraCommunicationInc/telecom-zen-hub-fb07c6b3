import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * address-qualify — Service qualification endpoint.
 * 
 * Given a postal code (and optionally city/province), returns:
 *   - serviceable: boolean
 *   - network_type: "fibre" | "cable" | "dsl" | "none"
 *   - max_speed_mbps: number
 *   - existing_services: array of active services at this address
 *   - available_categories: which service categories can still be added
 * 
 * This is the SINGLE source of truth for both public checkout and admin POS.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ ok: false, message: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { postal_code, city, province, address_line } = body as {
      postal_code?: string;
      city?: string;
      province?: string;
      address_line?: string;
    };

    if (!postal_code || postal_code.replace(/\s/g, "").length < 3) {
      return new Response(
        JSON.stringify({ ok: false, message: "postal_code is required (min 3 chars)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPostal = postal_code.replace(/\s/g, "").toUpperCase();
    const fsa = cleanPostal.slice(0, 3); // Forward Sortation Area

    // ── Network qualification by FSA ──
    // Quebec residential coverage zones for Nivra (FTTH/Cable via wholesale)
    // This is the authoritative qualification logic.
    const qualification = qualifyByFSA(fsa);

    // ── Check existing services at address ──
    let existingServices: any[] = [];
    let availableCategories = ["Internet", "TV", "Mobile"];

    if (address_line) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, supabaseKey);

      // Check service_addresses for matching address
      const normalizedAddress = address_line.trim().toLowerCase();
      
      const { data: existingAddresses } = await admin
        .from("service_addresses")
        .select("id, full_address, city, postal_code")
        .ilike("full_address", `%${normalizedAddress.slice(0, 20)}%`)
        .limit(5);

      if (existingAddresses && existingAddresses.length > 0) {
        const addressIds = existingAddresses.map((a: any) => a.id);
        
        // Find active subscriptions at these addresses
        const { data: subs } = await admin
          .from("billing_subscriptions")
          .select("id, plan_name, plan_code, service_category, status, address_id")
          .in("address_id", addressIds)
          .in("status", ["active", "pending", "suspended"]);

        if (subs && subs.length > 0) {
          existingServices = subs.map((s: any) => ({
            subscription_id: s.id,
            plan_name: s.plan_name,
            category: s.service_category,
            status: s.status,
          }));

          // Remove categories that already have active services (constraint: 1 per category per address)
          const usedCategories = new Set(subs.map((s: any) => s.service_category).filter(Boolean));
          availableCategories = availableCategories.filter(c => !usedCategories.has(c));
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        serviceable: qualification.serviceable,
        network_type: qualification.network_type,
        max_speed_mbps: qualification.max_speed_mbps,
        technology_label: qualification.technology_label,
        existing_services: existingServices,
        available_categories: availableCategories,
        fsa,
        notes: qualification.notes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[address-qualify] error:", msg);
    return new Response(
      JSON.stringify({ ok: false, message: "Internal error", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────
// FSA-based qualification logic
// ─────────────────────────────────────────────

interface QualificationResult {
  serviceable: boolean;
  network_type: "fibre" | "cable" | "dsl" | "none";
  max_speed_mbps: number;
  technology_label: string;
  notes: string;
}

function qualifyByFSA(fsa: string): QualificationResult {
  // Quebec FSAs start with G, H, J
  const quebecPrefixes = ["G", "H", "J"];
  if (!quebecPrefixes.includes(fsa[0])) {
    return {
      serviceable: false,
      network_type: "none",
      max_speed_mbps: 0,
      technology_label: "Hors zone",
      notes: "Services disponibles au Québec uniquement",
    };
  }

  // Greater Montreal / Laval / South Shore — FTTH coverage
  const ftthZones = [
    // Laval
    "H7A", "H7B", "H7C", "H7E", "H7G", "H7H", "H7K", "H7L", "H7M", "H7N",
    "H7P", "H7R", "H7S", "H7T", "H7V", "H7W", "H7X", "H7Y",
    // Montreal core
    "H1A", "H1B", "H1C", "H1E", "H1G", "H1H", "H1J", "H1K", "H1L", "H1M",
    "H1N", "H1P", "H1R", "H1S", "H1T", "H1V", "H1W", "H1X", "H1Y", "H1Z",
    "H2A", "H2B", "H2C", "H2E", "H2G", "H2H", "H2J", "H2K", "H2L", "H2M",
    "H2N", "H2P", "H2R", "H2S", "H2T", "H2V", "H2W", "H2X", "H2Y", "H2Z",
    "H3A", "H3B", "H3C", "H3E", "H3G", "H3H", "H3J", "H3K", "H3L", "H3M",
    "H3N", "H3P", "H3R", "H3S", "H3T", "H3V", "H3W", "H3X", "H3Y", "H3Z",
    "H4A", "H4B", "H4C", "H4E", "H4G", "H4H", "H4J", "H4K", "H4L", "H4M",
    "H4N", "H4P", "H4R", "H4S", "H4T", "H4V", "H4W", "H4X", "H4Y", "H4Z",
    // West Island, Dorval, Pointe-Claire, etc.
    "H8N", "H8P", "H8R", "H8S", "H8T", "H8Y", "H8Z",
    "H9A", "H9B", "H9C", "H9E", "H9G", "H9H", "H9J", "H9K", "H9P", "H9R",
    "H9S", "H9W", "H9X",
    // South Shore
    "J4B", "J4G", "J4H", "J4J", "J4K", "J4L", "J4M", "J4N", "J4P", "J4R",
    "J4S", "J4T", "J4V", "J4W", "J4X", "J4Y", "J4Z",
    // Longueuil, Brossard, Saint-Hubert
    "J3Y", "J3Z",
  ];

  // Cable zones — wider Quebec coverage
  const cableZones = [
    // Quebec City area
    "G1A", "G1B", "G1C", "G1E", "G1G", "G1H", "G1J", "G1K", "G1L", "G1M",
    "G1N", "G1P", "G1R", "G1S", "G1T", "G1V", "G1W", "G1X", "G1Y",
    "G2A", "G2B", "G2C", "G2E", "G2G", "G2J", "G2K", "G2L", "G2M", "G2N",
    // Trois-Rivières
    "G8T", "G8V", "G8W", "G8Y", "G8Z", "G9A", "G9B", "G9C",
    // Sherbrooke
    "J1E", "J1G", "J1H", "J1J", "J1K", "J1L", "J1M", "J1N",
    // Gatineau
    "J8P", "J8R", "J8T", "J8V", "J8X", "J8Y", "J8Z",
    "J9A", "J9B", "J9H", "J9J",
  ];

  const fsaUpper = fsa.toUpperCase();

  if (ftthZones.includes(fsaUpper)) {
    return {
      serviceable: true,
      network_type: "fibre",
      max_speed_mbps: 1010,
      technology_label: "Fibre FTTH",
      notes: "Couverture fibre complète — tous les forfaits Internet et TV disponibles",
    };
  }

  if (cableZones.includes(fsaUpper)) {
    return {
      serviceable: true,
      network_type: "cable",
      max_speed_mbps: 500,
      technology_label: "Câble hybride",
      notes: "Couverture câble — forfaits jusqu'à 500 Mbps disponibles",
    };
  }

  // Other Quebec FSAs — DSL fallback or no coverage
  if (quebecPrefixes.includes(fsaUpper[0])) {
    return {
      serviceable: true,
      network_type: "dsl",
      max_speed_mbps: 100,
      technology_label: "DSL / VDSL",
      notes: "Couverture limitée — forfait Internet 100 Mbps disponible, TV non disponible",
    };
  }

  return {
    serviceable: false,
    network_type: "none",
    max_speed_mbps: 0,
    technology_label: "Hors zone",
    notes: "Adresse hors zone de couverture Nivra",
  };
}
