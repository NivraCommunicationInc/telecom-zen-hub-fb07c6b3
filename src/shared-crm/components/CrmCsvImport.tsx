/**
 * CrmCsvImport — Admin tool to bulk-import prospects from CSV.
 * Accepts headers: first_name,last_name,phone,email,address,city,postal_code,source,territory,priority
 * Phone is required. Inserts in batches of 100.
 */
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props { isDark?: boolean; onDone?: () => void }

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur); return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

export function CrmCsvImport({ isDark, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ ok: number; skipped: number; failed: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cardCls = isDark ? "rounded-xl bg-gray-900/60 border border-gray-800" : "rounded-xl bg-card border border-border";
  const titleCls = isDark ? "text-white" : "text-foreground";
  const mutedCls = isDark ? "text-gray-400" : "text-muted-foreground";

  const handleFile = async (file: File) => {
    setBusy(true); setReport(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error("CSV vide ou invalide"); setBusy(false); return; }

      const valid = rows.filter((r) => (r.phone ?? "").replace(/\D/g, "").length >= 10);
      const skipped = rows.length - valid.length;

      let ok = 0; let failed = 0;
      for (let i = 0; i < valid.length; i += 100) {
        const batch = valid.slice(i, i + 100).map((r) => ({
          first_name: r.first_name || null,
          last_name: r.last_name || null,
          full_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
          phone: r.phone,
          email: r.email || null,
          address: r.address || null,
          city: r.city || null,
          postal_code: r.postal_code || null,
          source: r.source || "csv_import",
          territory: r.territory || null,
          priority: r.priority ? Number(r.priority) || null : null,
          call_status: "not_called",
        }));
        const { error, count } = await (supabase.from as any)("crm_contacts")
          .insert(batch, { count: "exact" });
        if (error) { failed += batch.length; console.error("[csv-import]", error); }
        else ok += count ?? batch.length;
      }

      setReport({ ok, skipped, failed });
      if (ok > 0) toast.success(`${ok} prospects importés`);
      if (failed > 0) toast.error(`${failed} échecs (voir console)`);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'import");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn(cardCls, "p-4")}>
      <h3 className={cn("text-sm font-bold flex items-center gap-2 mb-2", titleCls)}>
        <FileSpreadsheet className="h-4 w-4 text-violet-500" />
        Import CSV de prospects
      </h3>
      <p className={cn("text-[11px] mb-3", mutedCls)}>
        Colonnes : first_name, last_name, phone (requis), email, address, city, postal_code, source, territory, priority
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        className="hidden"
        id="crm-csv-input"
      />
      <label
        htmlFor="crm-csv-input"
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold cursor-pointer border",
          busy ? "opacity-60 cursor-not-allowed" : "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
        )}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Choisir un fichier CSV
      </label>
      {report && (
        <div className={cn("mt-3 text-[11px]", mutedCls)}>
          ✓ {report.ok} importés · ⚠ {report.skipped} sans téléphone valide · ✗ {report.failed} échecs
        </div>
      )}
    </div>
  );
}
