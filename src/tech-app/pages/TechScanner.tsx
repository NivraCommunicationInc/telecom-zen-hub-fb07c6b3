/**
 * TechScanner v2 — Universal equipment lookup (serial / MAC / IMEI / QR).
 * Migrated to tech-core.css (tc-*) with TechPageHeader.
 */
import { useState } from "react";
import { ScanLine, Search, CheckCircle2, XCircle, Package } from "lucide-react";
import TechPageHeader from "../components/TechPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Item = {
  id: string;
  catalog_name: string | null;
  serial_number: string | null;
  mac_address: string | null;
  status: string | null;
  category: string | null;
};

export default function TechScanner() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Item | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const c = code.trim();
    if (!c) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, serial_number, mac_address, status, category")
        .or(`serial_number.eq.${c},mac_address.eq.${c}`)
        .maybeSingle();
      setResult(data as Item | null);
      if (!data) {
        setNotFound(true);
        toast.info("Équipement non trouvé");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TechPageHeader title="Scanner" subtitle="Vérifier un équipement par série, MAC ou QR" />

      <div className="px-4 md:px-6 py-6 space-y-5 max-w-2xl mx-auto">
        <section
          className="tc-mission-hero text-center"
          style={{ padding: "28px 20px" }}
        >
          <div
            className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "hsl(var(--primary) / 0.15)", border: "1px solid hsl(var(--primary) / 0.35)" }}
          >
            <ScanLine className="h-8 w-8" style={{ color: "hsl(var(--primary-glow))" }} />
          </div>
          <h3 className="text-[16px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            Scanner un équipement
          </h3>
          <p className="text-[13px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
            Entrez le numéro de série, l'adresse MAC ou l'IMEI pour identifier.
          </p>
        </section>

        <div className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="N° de série, MAC, IMEI…"
            className="w-full h-12 rounded-lg px-4 text-[14px] tc-focus-ring outline-none"
            style={{
              background: "hsl(var(--input))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--foreground))",
            }}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            autoFocus
          />
          <button
            onClick={lookup}
            disabled={loading || !code.trim()}
            className="w-full tc-btn tc-btn-primary tc-focus-ring disabled:opacity-40"
            style={{ height: 48 }}
          >
            <Search className="h-4 w-4" />
            {loading ? "Recherche…" : "Rechercher"}
          </button>
        </div>

        {result && (
          <section className="tc-surface tc-elev-1 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: "hsl(var(--success))" }} />
              <p className="text-[14px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                {result.catalog_name || "Équipement"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
              {result.serial_number && <p>S/N: <span className="tc-tabular">{result.serial_number}</span></p>}
              {result.mac_address && <p>MAC: <span className="tc-tabular">{result.mac_address}</span></p>}
              {result.category && <p>Catégorie: {result.category}</p>}
            </div>
            <span
              className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
              style={{
                background: "hsl(var(--primary) / 0.14)",
                color: "hsl(var(--primary-glow))",
                border: "1px solid hsl(var(--primary) / 0.35)",
              }}
            >
              {result.status ?? "—"}
            </span>
          </section>
        )}

        {notFound && !result && (
          <section
            className="rounded-lg p-4 flex items-center gap-3"
            style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.35)" }}
          >
            <XCircle className="h-5 w-5 shrink-0" style={{ color: "hsl(var(--destructive))" }} />
            <div>
              <p className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Équipement introuvable
              </p>
              <p className="text-[11.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                Vérifiez la saisie ou contactez le dispatch.
              </p>
            </div>
          </section>
        )}

        <p className="text-[11px] text-center flex items-center justify-center gap-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          <Package className="h-3 w-3" /> Astuce : les lecteurs code-barre USB fonctionnent comme un clavier.
        </p>
      </div>
    </div>
  );
}
