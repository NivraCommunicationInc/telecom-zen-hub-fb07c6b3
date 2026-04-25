/**
 * check-coverage — Public service availability checker.
 *
 * Input:  { postal_code: string, address?: string }
 * Logic:  Extract FSA (first 3 chars), look up service_coverage_areas.
 * Output: { covered, postal_code, city, province, services{...}, message }
 *
 * Public endpoint — no JWT required. Uses service-role to bypass RLS for the read,
 * but only returns coverage information (no PII).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CoverageRow {
  postal_prefix: string;
  city: string | null;
  province: string | null;
  coverage_type: string | null;
  internet_available: boolean;
  internet_max_speed: string | null;
  tv_available: boolean;
  mobile_available: boolean;
  network_provider: string | null;
  notes: string | null;
  is_active: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    const postalRaw = (body?.postal_code ?? "").toString();
    const cleaned = postalRaw.replace(/\s+/g, "").toUpperCase().trim();

    if (cleaned.length < 3) {
      return new Response(
        JSON.stringify({
          ok: false,
          covered: false,
          message: "Code postal invalide. Veuillez entrer un code postal complet (ex: H1A 1A1).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fsa = cleaned.slice(0, 3);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const { data, error } = await admin
      .from("service_coverage_areas")
      .select("postal_prefix, city, province, coverage_type, internet_available, internet_max_speed, tv_available, mobile_available, network_provider, notes, is_active")
      .eq("postal_prefix", fsa)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[check-coverage] DB error:", error);
      return new Response(
        JSON.stringify({
          ok: false,
          covered: false,
          message: "Erreur lors de la vérification. Veuillez réessayer.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({
          ok: true,
          covered: false,
          postal_code: fsa,
          message:
            "Service non disponible dans cette zone. Nous travaillons à étendre notre couverture. Contactez-nous à support@nivra-telecom.ca",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const row = data as CoverageRow;
    const isUnavailable = row.coverage_type === "unavailable";
    const covered =
      !isUnavailable && (row.internet_available || row.tv_available || row.mobile_available);

    return new Response(
      JSON.stringify({
        ok: true,
        covered,
        postal_code: fsa,
        city: row.city,
        province: row.province ?? "QC",
        coverage_type: row.coverage_type,
        services: {
          internet: row.internet_available,
          internet_max_speed: row.internet_max_speed ?? "1 Gbps",
          tv: row.tv_available,
          mobile: row.mobile_available,
        },
        network_provider: row.network_provider,
        notes: row.notes,
        message: covered
          ? `Services disponibles à ${row.city ?? "votre adresse"} !`
          : "Service non disponible dans cette zone. Contactez-nous à support@nivra-telecom.ca",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[check-coverage] error:", msg);
    return new Response(
      JSON.stringify({ ok: false, covered: false, message: "Erreur interne.", details: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
