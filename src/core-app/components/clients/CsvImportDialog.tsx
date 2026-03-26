import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  Loader2, X, Users, ArrowRight, RotateCcw,
} from "lucide-react";

interface ParsedRow {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
  _valid: boolean;
  _reason?: string;
  _duplicate?: boolean;
}

interface ImportResult {
  name: string;
  status: "imported" | "duplicate" | "invalid" | "failed";
  reason?: string;
}

type Step = "upload" | "preview" | "importing" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  existingEmails: Set<string>;
  existingPhones: Set<string>;
}

const normalizePhone = (p: string): string | null => {
  let d = p.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d.length === 10 ? d : null;
};

const validateEmail = (e: string): boolean =>
  /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(e.trim());

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  return lines.slice(1).map(line => {
    // Simple CSV parse (handles quoted values)
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });
}

export function CsvImportDialog({ open, onClose, existingEmails, existingPhones }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [batchInfo, setBatchInfo] = useState("");

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setRows([]);
    setResults([]);
    setProgress(0);
    setBatchInfo("");
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Seuls les fichiers .csv sont acceptés");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const raw = parseCsv(text);
      if (!raw.length) { toast.error("Fichier CSV vide ou mal formaté"); return; }

      const parsed: ParsedRow[] = raw.map(r => {
        const name = r.name || r.nom || [r.first_name || r.prenom || r.prénom || "", r.last_name || r.nom_famille || ""].filter(Boolean).join(" ");
        const email = r.email || r.courriel || r.mail || null;
        const phone = r.phone || r.telephone || r.téléphone || r.tel || null;
        const firstName = r.first_name || r.prenom || r.prénom || undefined;
        const lastName = r.last_name || r.nom_famille || undefined;

        const cleanedEmail = email && validateEmail(email) ? email.trim().toLowerCase() : null;
        const cleanedPhone = phone ? normalizePhone(phone) : null;

        if (!cleanedEmail && !cleanedPhone) {
          return { name: name || "—", email: null, phone: null, first_name: firstName, last_name: lastName, _valid: false, _reason: "Aucun contact valide" };
        }
        if (!name || name.trim().length < 2) {
          return { name: name || "—", email: cleanedEmail, phone: cleanedPhone, first_name: firstName, last_name: lastName, _valid: false, _reason: "Nom invalide" };
        }

        const dupEmail = cleanedEmail && existingEmails.has(cleanedEmail);
        const dupPhone = cleanedPhone && existingPhones.has(cleanedPhone);

        return {
          name: name.trim(),
          first_name: firstName,
          last_name: lastName,
          email: cleanedEmail,
          phone: cleanedPhone,
          _valid: !dupEmail && !dupPhone,
          _duplicate: !!(dupEmail || dupPhone),
          _reason: dupEmail ? "Courriel déjà existant" : dupPhone ? "Téléphone déjà existant" : undefined,
        };
      });

      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file);
  }, [existingEmails, existingPhones]);

  const validRows = rows.filter(r => r._valid);
  const invalidRows = rows.filter(r => !r._valid && !r._duplicate);
  const duplicateRows = rows.filter(r => r._duplicate);

  const handleImport = useCallback(async () => {
    if (!validRows.length) return;
    setStep("importing");
    setProgress(0);

    const BATCH = 15;
    const allResults: ImportResult[] = [];
    const batches = Math.ceil(validRows.length / BATCH);

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map(r => ({
        name: r.name,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
      }));
      const batchNum = Math.floor(i / BATCH) + 1;
      setBatchInfo(`Lot ${batchNum} / ${batches}`);

      try {
        const { data, error } = await supabase.functions.invoke("core-csv-import-clients", {
          body: { clients: batch, file_name: fileName },
        });
        if (error) {
          batch.forEach(c => allResults.push({ name: c.name, status: "failed", reason: error.message }));
        } else if (data?.results) {
          allResults.push(...data.results);
        }
      } catch (err: any) {
        batch.forEach(c => allResults.push({ name: c.name, status: "failed", reason: err.message }));
      }

      setProgress(((i + BATCH) / validRows.length) * 100);
      if (i + BATCH < validRows.length) await new Promise(r => setTimeout(r, 400));
    }

    setResults(allResults);
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["core-clients-all"] });

    const imp = allResults.filter(r => r.status === "imported").length;
    toast.success(`Import terminé : ${imp} client${imp !== 1 ? "s" : ""} importé${imp !== 1 ? "s" : ""}`);
  }, [validRows, fileName, queryClient]);

  if (!open) return null;

  const summaryStats = step === "done" ? {
    imported: results.filter(r => r.status === "imported").length,
    duplicate: results.filter(r => r.status === "duplicate").length + duplicateRows.length,
    invalid: results.filter(r => r.status === "invalid").length + invalidRows.length,
    failed: results.filter(r => r.status === "failed").length,
  } : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => step !== "importing" && onClose()}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(220,15%,16%)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Importer des clients CSV</h2>
              <p className="text-[10px] text-[hsl(220,10%,45%)]">
                {step === "upload" && "Sélectionnez un fichier CSV"}
                {step === "preview" && `${rows.length} lignes analysées`}
                {step === "importing" && "Import en cours…"}
                {step === "done" && "Import terminé"}
              </p>
            </div>
          </div>
          {step !== "importing" && (
            <button onClick={onClose} className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(220,10%,40%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* STEP: Upload */}
          {step === "upload" && (
            <div
              className="border-2 border-dashed border-[hsl(220,15%,20%)] rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <FileText className="h-10 w-10 mx-auto text-[hsl(220,10%,30%)] mb-3" />
              <p className="text-sm text-white font-medium">Glissez un fichier CSV ici</p>
              <p className="text-[11px] text-[hsl(220,10%,40%)] mt-1">ou cliquez pour parcourir</p>
              <p className="text-[10px] text-[hsl(220,10%,30%)] mt-3">
                Colonnes supportées : name, email, phone, first_name, last_name
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {/* STEP: Preview */}
          {step === "preview" && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total", value: rows.length, icon: Users, color: "text-white" },
                  { label: "Valides", value: validRows.length, icon: CheckCircle, color: "text-emerald-400" },
                  { label: "Doublons", value: duplicateRows.length, icon: AlertTriangle, color: "text-amber-400" },
                  { label: "Invalides", value: invalidRows.length, icon: XCircle, color: "text-red-400" },
                ].map(k => (
                  <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5 text-center">
                    <k.icon className={`h-4 w-4 mx-auto mb-1 ${k.color}`} />
                    <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase tracking-wider">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[hsl(220,20%,11%)]">
                    <tr className="border-b border-[hsl(220,15%,16%)]">
                      {["Statut", "Nom", "Courriel", "Téléphone", "Raison"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b border-[hsl(220,15%,14%)] last:border-0">
                        <td className="px-3 py-1.5">
                          {r._valid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400"><CheckCircle className="h-3 w-3" />OK</span>
                          ) : r._duplicate ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400"><AlertTriangle className="h-3 w-3" />Doublon</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400"><XCircle className="h-3 w-3" />Invalide</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-white truncate max-w-[140px]">{r.name}</td>
                        <td className="px-3 py-1.5 text-[hsl(220,10%,50%)] truncate max-w-[160px]">{r.email || "—"}</td>
                        <td className="px-3 py-1.5 text-[hsl(220,10%,50%)] font-mono text-[11px]">{r.phone || "—"}</td>
                        <td className="px-3 py-1.5 text-[hsl(220,10%,40%)] text-[10px] truncate max-w-[140px]">{r._reason || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <p className="text-center text-[10px] text-[hsl(220,10%,30%)] py-2">
                    … et {rows.length - 100} autres lignes
                  </p>
                )}
              </div>

              {validRows.length === 0 && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                  <p className="text-xs text-red-400">Aucune ligne valide à importer.</p>
                </div>
              )}
            </>
          )}

          {/* STEP: Importing */}
          {step === "importing" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="h-10 w-10 mx-auto text-emerald-400 animate-spin" />
              <div>
                <p className="text-sm text-white font-medium">Import en cours…</p>
                <p className="text-[11px] text-[hsl(220,10%,45%)] mt-1">{batchInfo}</p>
              </div>
              <div className="mx-auto w-2/3">
                <div className="h-2 rounded-full bg-[hsl(220,15%,16%)] overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <p className="text-[10px] text-[hsl(220,10%,40%)] mt-1.5 tabular-nums">{Math.round(progress)}%</p>
              </div>
            </div>
          )}

          {/* STEP: Done */}
          {step === "done" && summaryStats && (
            <>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-medium text-white">Import terminé</p>
                <p className="text-[11px] text-[hsl(220,10%,45%)] mt-1">{fileName}</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Importés", value: summaryStats.imported, color: "text-emerald-400" },
                  { label: "Doublons", value: summaryStats.duplicate, color: "text-amber-400" },
                  { label: "Invalides", value: summaryStats.invalid, color: "text-red-400" },
                  { label: "Échoués", value: summaryStats.failed, color: "text-red-400" },
                ].map(k => (
                  <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5 text-center">
                    <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase tracking-wider">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Result details (failures only) */}
              {results.filter(r => r.status === "failed").length > 0 && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden max-h-[200px] overflow-y-auto">
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-400 border-b border-[hsl(220,15%,16%)]">Échecs</p>
                  {results.filter(r => r.status === "failed").map((r, i) => (
                    <div key={i} className="px-3 py-1.5 flex items-center gap-2 border-b border-[hsl(220,15%,14%)] last:border-0 text-xs">
                      <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                      <span className="text-white">{r.name}</span>
                      <span className="text-[hsl(220,10%,40%)] text-[10px] truncate">{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[hsl(220,15%,16%)] px-5 py-3 flex items-center justify-between">
          {step === "preview" && (
            <button onClick={reset} className="flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Changer de fichier
            </button>
          )}
          {step !== "preview" && <div />}

          <div className="flex items-center gap-2">
            {step !== "importing" && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-[hsl(220,15%,18%)] text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors"
              >
                {step === "done" ? "Fermer" : "Annuler"}
              </button>
            )}
            {step === "preview" && validRows.length > 0 && (
              <button
                onClick={handleImport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5"
              >
                Importer {validRows.length} client{validRows.length !== 1 ? "s" : ""}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {step === "done" && (
              <button
                onClick={reset}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Nouvel import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
