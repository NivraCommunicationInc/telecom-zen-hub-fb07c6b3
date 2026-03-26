import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
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

/* ── Column alias map (lowercase key → canonical field) ── */
const COLUMN_MAP: Record<string, string> = {
  // Exact matches from Nivra workbook
  "nom du client": "full_name",
  "prenom": "first_name",
  "prénom": "first_name",
  "nom": "last_name",
  "telephone": "phone",
  "téléphone": "phone",
  "tel": "phone",
  "email": "email",
  "courriel": "email",
  "mail": "email",
  "adresse 1": "address_line1",
  "adresse1": "address_line1",
  "address_1": "address_line1",
  "adresse 2": "address_line2",
  "adresse2": "address_line2",
  "address_2": "address_line2",
  "ville": "city",
  "city": "city",
  "province/etat": "province",
  "province/état": "province",
  "province": "province",
  "code postal": "postal_code",
  "postal_code": "postal_code",
  // CSV fallback aliases
  "name": "full_name",
  "first_name": "first_name",
  "last_name": "last_name",
  "phone": "phone",
  "nom_famille": "last_name",
};

/**
 * Parse an XLSX file. Tries the "CRM Contacts" sheet first.
 * Uses row 3 as headers (0-indexed row 2) and data from row 4+.
 * Falls back to first sheet with standard row 1 headers.
 */
function parseXlsx(buffer: ArrayBuffer): Record<string, string>[] {
  const wb = XLSX.read(buffer, { type: "array" });

  // Try CRM Contacts sheet first
  const crmSheetName = wb.SheetNames.find(
    (n) => n.toLowerCase().replace(/\s+/g, " ").trim() === "crm contacts"
  );

  if (crmSheetName) {
    const ws = wb.Sheets[crmSheetName];
    // Read full sheet as array of arrays
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (aoa.length < 4) return []; // need at least header row (3) + 1 data row (4)

    // Row 3 = index 2 = headers
    const headers = (aoa[2] as string[]).map((h) =>
      String(h ?? "").trim().toLowerCase()
    );

    // Data rows start at row 4 = index 3
    const rows: Record<string, string>[] = [];
    for (let i = 3; i < aoa.length; i++) {
      const row = aoa[i] as string[];
      // Skip completely empty rows
      if (!row || row.every((c) => !String(c ?? "").trim())) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, ci) => {
        if (h) obj[h] = String(row[ci] ?? "").trim();
      });
      rows.push(obj);
    }
    return rows;
  }

  // Fallback: first sheet, standard row 1 headers
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  return lines.slice(1).map((line) => {
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

/** Map raw row keys through COLUMN_MAP to canonical fields */
function mapColumns(raw: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    const canonical = COLUMN_MAP[key.toLowerCase().trim()];
    if (canonical && val) mapped[canonical] = val;
  }
  return mapped;
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

  const processRawRows = useCallback(
    (rawRows: Record<string, string>[]) => {
      // Clone dedup sets so we can track in-batch duplicates
      const seenEmails = new Set(existingEmails);
      const seenPhones = new Set(existingPhones);

      const parsed: ParsedRow[] = rawRows.map((raw) => {
        const r = mapColumns(raw);

        const firstName = r.first_name || "";
        const lastName = r.last_name || "";
        const name =
          r.full_name?.trim() ||
          [firstName, lastName].filter(Boolean).join(" ").trim();

        const rawEmail = r.email || null;
        const rawPhone = r.phone || null;

        const cleanedEmail =
          rawEmail && validateEmail(rawEmail) ? rawEmail.trim().toLowerCase() : null;
        const cleanedPhone = rawPhone ? normalizePhone(rawPhone) : null;

        if (!cleanedEmail && !cleanedPhone) {
          return {
            name: name || "—",
            email: null,
            phone: null,
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            _valid: false,
            _reason: "Aucun contact valide (email/téléphone)",
          };
        }
        if (!name || name.length < 2) {
          return {
            name: name || "—",
            email: cleanedEmail,
            phone: cleanedPhone,
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            _valid: false,
            _reason: "Nom invalide",
          };
        }

        const dupEmail = cleanedEmail && seenEmails.has(cleanedEmail);
        const dupPhone = cleanedPhone && seenPhones.has(cleanedPhone);

        if (dupEmail || dupPhone) {
          return {
            name: name.trim(),
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            email: cleanedEmail,
            phone: cleanedPhone,
            _valid: false,
            _duplicate: true,
            _reason: dupEmail ? "Courriel déjà existant" : "Téléphone déjà existant",
          };
        }

        // Track for in-batch dedup
        if (cleanedEmail) seenEmails.add(cleanedEmail);
        if (cleanedPhone) seenPhones.add(cleanedPhone);

        return {
          name: name.trim(),
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          email: cleanedEmail,
          phone: cleanedPhone,
          address_line1: r.address_line1 || undefined,
          address_line2: r.address_line2 || undefined,
          city: r.city || undefined,
          province: r.province || undefined,
          postal_code: r.postal_code || undefined,
          _valid: true,
          _duplicate: false,
        };
      });

      setRows(parsed);
      setStep("preview");
    },
    [existingEmails, existingPhones]
  );

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const isXlsx = ext === "xlsx" || ext === "xls";
      const isCsv = ext === "csv";

      if (!isXlsx && !isCsv) {
        toast.error("Format non supporté. Utilisez .xlsx ou .csv");
        return;
      }

      setFileName(file.name);

      if (isXlsx) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const buffer = e.target?.result as ArrayBuffer;
            const rawRows = parseXlsx(buffer);
            if (!rawRows.length) {
              toast.error("Aucune donnée trouvée dans le fichier Excel");
              return;
            }
            processRawRows(rawRows);
          } catch (err) {
            console.error("XLSX parse error:", err);
            toast.error("Erreur de lecture du fichier Excel");
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          const rawRows = parseCsv(text);
          if (!rawRows.length) {
            toast.error("Fichier CSV vide ou mal formaté");
            return;
          }
          processRawRows(rawRows);
        };
        reader.readAsText(file);
      }
    },
    [processRawRows]
  );

  const validRows = rows.filter((r) => r._valid);
  const invalidRows = rows.filter((r) => !r._valid && !r._duplicate);
  const duplicateRows = rows.filter((r) => r._duplicate);

  const handleImport = useCallback(async () => {
    if (!validRows.length) return;
    setStep("importing");
    setProgress(0);

    const allResults: ImportResult[] = [];
    const BATCH = 50;
    const batches = Math.ceil(validRows.length / BATCH);

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH).map((r) => ({
        name: r.name,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        phone: r.phone,
      }));
      setBatchInfo(`Lot ${Math.floor(i / BATCH) + 1} / ${batches}`);

      try {
        const { data, error } = await supabase.functions.invoke(
          "core-csv-import-clients",
          { body: { clients: batch, file_name: fileName } }
        );
        if (error) {
          batch.forEach((c) =>
            allResults.push({ name: c.name, status: "failed", reason: error.message })
          );
        } else if (data?.results) {
          allResults.push(...data.results);
        }
      } catch (err: any) {
        batch.forEach((c) =>
          allResults.push({ name: c.name, status: "failed", reason: err.message })
        );
      }

      setProgress(((i + BATCH) / validRows.length) * 100);
      if (i + BATCH < validRows.length) await new Promise((r) => setTimeout(r, 200));
    }

    setResults(allResults);
    setStep("done");
    queryClient.invalidateQueries({ queryKey: ["core-clients-all"] });

    const imp = allResults.filter((r) => r.status === "imported").length;
    toast.success(
      `Import terminé : ${imp} contact${imp !== 1 ? "s" : ""} importé${imp !== 1 ? "s" : ""}`
    );
  }, [validRows, fileName, queryClient]);

  if (!open) return null;

  const summaryStats =
    step === "done"
      ? {
          imported: results.filter((r) => r.status === "imported").length,
          duplicate: results.filter((r) => r.status === "duplicate").length + duplicateRows.length,
          invalid: results.filter((r) => r.status === "invalid").length + invalidRows.length,
          failed: results.filter((r) => r.status === "failed").length,
        }
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => step !== "importing" && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,9%)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(220,15%,16%)] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Importer des contacts</h2>
              <p className="text-[10px] text-[hsl(220,10%,45%)]">
                {step === "upload" && "CSV ou Excel (.xlsx) supportés"}
                {step === "preview" && `${rows.length} lignes analysées — ${fileName}`}
                {step === "importing" && "Import en cours…"}
                {step === "done" && "Import terminé"}
              </p>
            </div>
          </div>
          {step !== "importing" && (
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-[hsl(220,10%,40%)] hover:text-white hover:bg-[hsl(220,15%,16%)] transition-colors"
            >
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
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <FileText className="h-10 w-10 mx-auto text-[hsl(220,10%,30%)] mb-3" />
              <p className="text-sm text-white font-medium">Glissez un fichier ici</p>
              <p className="text-[11px] text-[hsl(220,10%,40%)] mt-1">ou cliquez pour parcourir</p>
              <div className="mt-3 space-y-1">
                <p className="text-[10px] text-[hsl(220,10%,30%)]">
                  Formats : .xlsx (Excel) ou .csv
                </p>
                <p className="text-[10px] text-[hsl(220,10%,30%)]">
                  Feuille « CRM Contacts » détectée automatiquement
                </p>
                <p className="text-[10px] text-[hsl(220,10%,30%)]">
                  Colonnes : Nom du client, Prenom, Nom, Telephone, Email, Adresse, Ville, Province, Code postal
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
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
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5 text-center">
                    <k.icon className={`h-4 w-4 mx-auto mb-1 ${k.color}`} />
                    <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase tracking-wider">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[hsl(220,20%,11%)]">
                    <tr className="border-b border-[hsl(220,15%,16%)]">
                      {["Statut", "Nom", "Courriel", "Téléphone", "Ville", "Raison"].map((h) => (
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
                        <td className="px-3 py-1.5 text-[hsl(220,10%,50%)] truncate max-w-[140px]">{r.email || "—"}</td>
                        <td className="px-3 py-1.5 text-[hsl(220,10%,50%)] font-mono text-[11px]">{r.phone || "—"}</td>
                        <td className="px-3 py-1.5 text-[hsl(220,10%,50%)] truncate max-w-[100px]">{r.city || "—"}</td>
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
                ].map((k) => (
                  <div key={k.label} className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-2.5 text-center">
                    <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    <p className="text-[9px] text-[hsl(220,10%,40%)] uppercase tracking-wider">{k.label}</p>
                  </div>
                ))}
              </div>

              {results.filter((r) => r.status === "failed").length > 0 && (
                <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden max-h-[200px] overflow-y-auto">
                  <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-400 border-b border-[hsl(220,15%,16%)]">Échecs</p>
                  {results.filter((r) => r.status === "failed").map((r, i) => (
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
          {step === "preview" ? (
            <button onClick={reset} className="flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Changer de fichier
            </button>
          ) : <div />}

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
                Importer {validRows.length} contact{validRows.length !== 1 ? "s" : ""}
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
