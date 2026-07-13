import { supabase } from "@/integrations/supabase/client";

export interface ResolvedTechnician {
  id: string;
  full_name: string;
  status?: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

export function isTechnicianUuid(value: string | null | undefined): boolean {
  return UUID_RE.test(String(value || "").trim());
}

export async function resolveTechnicianInput(input: string): Promise<{
  technician: ResolvedTechnician | null;
  error?: string;
}> {
  const value = normalizeName(input || "");
  if (!value) return { technician: null, error: "Nom du technicien manquant" };

  if (isTechnicianUuid(value)) {
    const { data } = await supabase
      .from("technicians")
      .select("id, full_name, status")
      .eq("id", value)
      .maybeSingle();

    return {
      technician: {
        id: value,
        full_name: (data as any)?.full_name || `Technicien ${value.slice(0, 8)}`,
        status: (data as any)?.status || null,
      },
    };
  }

  const { data: exactRows, error: exactError } = await supabase
    .from("technicians")
    .select("id, full_name, status")
    .ilike("full_name", value)
    .limit(4);

  if (exactError) return { technician: null, error: "Impossible de vérifier le technicien" };

  const exact = (exactRows || []).filter((t: any) => normalizeName(t.full_name || "").toLowerCase() === value.toLowerCase());
  if (exact.length === 1) return { technician: exact[0] as ResolvedTechnician };
  if (exact.length > 1) return { technician: null, error: `Plusieurs techniciens portent ce nom: ${exact.map((t: any) => t.full_name).join(", ")}` };

  const { data: partialRows, error: partialError } = await supabase
    .from("technicians")
    .select("id, full_name, status")
    .ilike("full_name", `%${value}%`)
    .limit(6);

  if (partialError) return { technician: null, error: "Impossible de vérifier le technicien" };
  const partial = (partialRows || []) as ResolvedTechnician[];
  if (partial.length === 1) return { technician: partial[0] };
  if (partial.length > 1) {
    return {
      technician: null,
      error: `Nom ambigu. Choisis un technicien précis: ${partial.slice(0, 5).map((t) => t.full_name).join(", ")}`,
    };
  }

  return { technician: null, error: `Technicien introuvable: ${value}` };
}