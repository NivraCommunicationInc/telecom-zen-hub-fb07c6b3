/**
 * TechScanner — Quick scanner / equipment lookup landing.
 * For now: simple manual entry. Camera-based QR scan would require an extra lib.
 */
import { useState } from "react";
import { ScanLine, Search } from "lucide-react";
import TechTopBar from "../components/TechTopBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function TechScanner() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async () => {
    const c = code.trim();
    if (!c) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, serial_number, mac_address, status, category")
        .or(`serial_number.eq.${c},mac_address.eq.${c}`)
        .maybeSingle();
      setResult(data);
      if (!data) toast.info("Équipement non trouvé");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <TechTopBar title="Scanner" />
      <div className="px-4 py-5 space-y-4">
        <section className="rounded-2xl bg-blue-600/10 border border-blue-600/30 p-5 text-center">
          <ScanLine className="h-12 w-12 text-sky-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Scanner un équipement</h3>
          <p className="text-sm text-slate-300 mt-1">
            Entrez le numéro de série ou l'adresse MAC pour vérifier un équipement.
          </p>
        </section>

        <div className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="N° de série ou MAC..."
            className="w-full min-h-[56px] rounded-full bg-slate-900 border border-slate-800 text-white px-5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button
            onClick={lookup}
            disabled={loading || !code.trim()}
            className="w-full min-h-[56px] rounded-full bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Search className="h-5 w-5" />
            Rechercher
          </button>
        </div>

        {result && (
          <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
            <p className="text-base font-semibold text-white">{result.catalog_name || "Équipement"}</p>
            <p className="text-xs text-slate-400">S/N: {result.serial_number}</p>
            {result.mac_address && <p className="text-xs text-slate-400">MAC: {result.mac_address}</p>}
            <p className="text-xs">
              <span className="inline-block px-2 py-1 rounded-full bg-blue-600/20 text-sky-300 font-medium uppercase">
                {result.status}
              </span>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
