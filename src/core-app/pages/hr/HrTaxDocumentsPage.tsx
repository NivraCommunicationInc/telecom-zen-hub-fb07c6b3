/**
 * HrTaxDocumentsPage — Full HR tax document management hub (T4 / RL-1).
 *
 * Sections:
 *  1. Tax year selector + summary cards
 *  2. Per-employee table with generate / preview / send / download actions
 *  3. Bulk actions (generate all, send all, export CRA / Revenu Québec CSV)
 *  4. Data validation panel (missing SIN, missing address, unfinalized payroll)
 *
 * Backed by:
 *  - employee_records  → employee identity (one row per employee)
 *  - payroll_entries   → period income (joined with pay_periods to scope by year)
 *  - tax_documents     → generated T4 / RL-1 records
 *      ( user_id, document_type 't4'|'rl1', tax_year, status, data_json, …)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle, CheckCircle2, Download, FileText, Loader2, Mail,
  Eye, Sparkles, Send, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ───────────────────────────── helpers ─────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft:        { label: "Brouillon",   variant: "secondary" },
  generated:    { label: "Généré",      variant: "default"   },
  sent:         { label: "Envoyé",      variant: "default"   },
  acknowledged: { label: "Accusé reçu", variant: "default"   },
};

function money(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(2)} $`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadFile(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Estimate Quebec / federal contribution amounts from a gross pay total.
// These are rough internal placeholders — real numbers should come from
// finalized payroll. Document marked clearly as "internal summary only".
function estimateContributions(gross: number, commissions: number) {
  const cpp = +(gross * 0.0595).toFixed(2);            // QPP/CPP est.
  const ei  = +(gross * 0.0163).toFixed(2);            // EI
  const qpip = +(gross * 0.00494).toFixed(2);          // RQAP
  const fedTax = +(gross * 0.15).toFixed(2);           // Fed tax bracket 1 est.
  const qcTax  = +(gross * 0.14).toFixed(2);           // QC tax bracket 1 est.
  return {
    employment_income: gross,
    commissions,
    cpp_contributions: cpp,
    qpp_contributions: cpp,
    ei_premiums: ei,
    qpip_premiums: qpip,
    federal_tax_deducted: fedTax,
    qc_tax_deducted: qcTax,
    total_income: gross,
    total_deductions: +(cpp + ei + qpip + fedTax + qcTax).toFixed(2),
  };
}

// ─────────────────────────── component ─────────────────────────────
export default function HrTaxDocumentsPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(CURRENT_YEAR - 1);
  const [search, setSearch] = useState("");
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);

  // 1. Active employees
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ["hr-tax-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("id, user_id, employee_number, first_name, last_name, work_email, personal_email, status")
        .neq("status", "terminated")
        .order("last_name");
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Tax documents for the selected year
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["hr-tax-documents", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_documents")
        .select("*")
        .eq("tax_year", year);
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Payroll roll-up for the year (used to fill T4 / RL-1)
  const { data: payrollByUser = {}, isLoading: payLoading } = useQuery({
    queryKey: ["hr-tax-payroll", year],
    queryFn: async () => {
      const { data: periods, error: pErr } = await supabase
        .from("pay_periods")
        .select("id, start_date, end_date")
        .gte("start_date", `${year}-01-01`)
        .lte("end_date", `${year}-12-31`);
      if (pErr) throw pErr;
      const periodIds = (periods || []).map((p: any) => p.id);
      if (!periodIds.length) return {} as Record<string, { gross: number; commissions: number; finalized: boolean }>;

      const { data: entries, error: eErr } = await supabase
        .from("payroll_entries")
        .select("user_id, gross_pay, commission_total, status")
        .in("pay_period_id", periodIds);
      if (eErr) throw eErr;

      const map: Record<string, { gross: number; commissions: number; finalized: boolean }> = {};
      for (const e of entries || []) {
        const uid = (e as any).user_id as string;
        if (!map[uid]) map[uid] = { gross: 0, commissions: 0, finalized: true };
        map[uid].gross       += Number((e as any).gross_pay || 0);
        map[uid].commissions += Number((e as any).commission_total || 0);
        if ((e as any).status !== "approved" && (e as any).status !== "paid") {
          map[uid].finalized = false;
        }
      }
      return map;
    },
  });

  // 4. Profiles for SIN / address validation (best-effort; tolerated if absent)
  const { data: profiles = [] } = useQuery({
    queryKey: ["hr-tax-profiles", employees.map((e: any) => e.user_id)],
    enabled: employees.length > 0,
    queryFn: async () => {
      const ids = employees.map((e: any) => e.user_id).filter(Boolean) as string[];
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, address, address_line1, postal_code, city")
        .in("user_id", ids);
      return data || [];
    },
  });

  // ─── derived: per-employee row ─────────────────────────────────
  const rows = useMemo(() => {
    const docMap: Record<string, { t4?: any; rl1?: any }> = {};
    for (const d of documents) {
      const k = (d as any).user_id;
      if (!docMap[k]) docMap[k] = {};
      if ((d as any).document_type === "t4") docMap[k].t4 = d;
      if ((d as any).document_type === "rl1" || (d as any).document_type === "releve1") docMap[k].rl1 = d;
    }
    const profMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));

    return employees
      .filter((e: any) => !!e.user_id)
      .map((e: any) => {
        const d = docMap[e.user_id] || {};
        const pay = payrollByUser[e.user_id] || { gross: 0, commissions: 0, finalized: false };
        const prof = profMap[e.user_id];
        const hasAddress = !!(prof?.address || prof?.address_line1);
        return {
          ...e,
          t4: d.t4,
          rl1: d.rl1,
          gross: pay.gross,
          commissions: pay.commissions,
          finalized: pay.finalized,
          hasAddress,
        };
      })
      .filter((r: any) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
          (r.employee_number || "").toLowerCase().includes(s)
        );
      });
  }, [employees, documents, payrollByUser, profiles, search]);

  // ─── summary counts ────────────────────────────────────────────
  const summary = useMemo(() => {
    const total = employees.length;
    let generated = 0, sent = 0, pending = 0;
    for (const r of rows) {
      const a = r.t4, b = r.rl1;
      if ((a && a.status !== "draft") || (b && b.status !== "draft")) generated++;
      if ((a && a.status === "sent") || (b && b.status === "sent")) sent++;
      if (!a || !b) pending++;
    }
    return { total, generated, sent, pending };
  }, [rows, employees]);

  // ─── validation issues ─────────────────────────────────────────
  const validation = useMemo(() => {
    const noAddress = rows.filter((r: any) => !r.hasAddress);
    const notFinalized = rows.filter((r: any) => r.gross > 0 && !r.finalized);
    const noPayroll = rows.filter((r: any) => r.gross === 0);
    return { noAddress, notFinalized, noPayroll };
  }, [rows]);

  // ─── mutations ─────────────────────────────────────────────────
  async function generateOne(r: any, type: "t4" | "rl1") {
    const computed = estimateContributions(r.gross, r.commissions);
    const payload = {
      user_id: r.user_id,
      document_type: type,
      tax_year: year,
      status: "generated",
      generated_at: new Date().toISOString(),
      data_json: {
        ...computed,
        employee_number: r.employee_number,
        employee_name: `${r.first_name} ${r.last_name}`,
        document_kind: type === "t4" ? "T4" : "RL-1",
        notes: "Sommaire interne — ne constitue pas un document fiscal officiel.",
      },
    };
    const { error } = await supabase
      .from("tax_documents")
      .upsert(payload, { onConflict: "user_id,document_type,tax_year" });
    if (error) throw error;
  }

  const generateMut = useMutation({
    mutationFn: async ({ row, type }: { row: any; type: "t4" | "rl1" }) =>
      generateOne(row, type),
    onSuccess: (_d, v) => {
      toast.success(`${v.type.toUpperCase()} généré`);
      qc.invalidateQueries({ queryKey: ["hr-tax-documents", year] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  async function bulkGenerate(type: "t4" | "rl1") {
    setGenerating(true);
    try {
      const eligible = rows.filter((r: any) => r.gross > 0);
      let ok = 0;
      for (const r of eligible) {
        try { await generateOne(r, type); ok++; } catch { /* skip */ }
      }
      toast.success(`${ok} document(s) ${type.toUpperCase()} générés`);
      qc.invalidateQueries({ queryKey: ["hr-tax-documents", year] });
    } finally {
      setGenerating(false);
    }
  }

  const sendMut = useMutation({
    mutationFn: async (doc: any) => {
      const emp = rows.find((r: any) => r.user_id === doc.user_id);
      const email = emp?.work_email || emp?.personal_email;
      if (!email) throw new Error("Aucun courriel pour cet employé");
      const { error } = await supabase
        .from("tax_documents")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (error) throw error;
      return email;
    },
    onSuccess: (email) => {
      toast.success(`Marqué envoyé à ${email}`);
      qc.invalidateQueries({ queryKey: ["hr-tax-documents", year] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  async function sendAll() {
    let ok = 0;
    for (const r of rows) {
      for (const d of [r.t4, r.rl1]) {
        if (d && d.status === "generated") {
          try { await sendMut.mutateAsync(d); ok++; } catch { /* skip */ }
        }
      }
    }
    toast.success(`${ok} document(s) marqués envoyés`);
  }

  // ─── exports ───────────────────────────────────────────────────
  function exportCRA() {
    const headers = [
      "employee_number", "first_name", "last_name",
      "employment_income", "cpp_contributions", "ei_premiums",
      "federal_tax_deducted", "commissions",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const d = r.t4?.data_json || {};
      lines.push([
        r.employee_number, r.first_name, r.last_name,
        d.employment_income || 0, d.cpp_contributions || 0, d.ei_premiums || 0,
        d.federal_tax_deducted || 0, d.commissions || 0,
      ].map(csvEscape).join(","));
    }
    downloadFile(`sommaire-CRA-T4-${year}.csv`, lines.join("\n"));
    toast.success("Export CRA téléchargé");
  }

  function exportRQ() {
    const headers = [
      "employee_number", "first_name", "last_name",
      "employment_income", "qpp_contributions", "qpip_premiums",
      "qc_tax_deducted", "commissions",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const d = r.rl1?.data_json || {};
      lines.push([
        r.employee_number, r.first_name, r.last_name,
        d.employment_income || 0, d.qpp_contributions || 0, d.qpip_premiums || 0,
        d.qc_tax_deducted || 0, d.commissions || 0,
      ].map(csvEscape).join(","));
    }
    downloadFile(`sommaire-RQ-RL1-${year}.csv`, lines.join("\n"));
    toast.success("Export Revenu Québec téléchargé");
  }

  function downloadDocPdf(doc: any, emp: any) {
    // Lightweight printable HTML (browser's "Save as PDF" handles conversion).
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const d = doc.data_json || {};
    const kind = doc.document_type === "t4" ? "T4" : "RL-1";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${kind} ${year}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{margin:0 0 8px}small{color:#666}
table{border-collapse:collapse;margin-top:16px;width:100%}
td,th{border:1px solid #ddd;padding:6px 10px;font-size:13px;text-align:left}
.note{margin-top:24px;padding:8px;background:#fff7ed;border:1px solid #fed7aa;font-size:12px;color:#9a3412}</style></head><body>
<h1>${kind} — Année ${year}</h1>
<small>Employé : ${esc(emp.first_name)} ${esc(emp.last_name)} (${esc(emp.employee_number || "—")})</small>
<table>
<tr><th>Revenu d'emploi</th><td>${money(d.employment_income)}</td></tr>
<tr><th>Commissions</th><td>${money(d.commissions)}</td></tr>
<tr><th>RPC / RRQ</th><td>${money(d.cpp_contributions)}</td></tr>
<tr><th>AE</th><td>${money(d.ei_premiums)}</td></tr>
<tr><th>RQAP</th><td>${money(d.qpip_premiums)}</td></tr>
<tr><th>Impôt fédéral retenu</th><td>${money(d.federal_tax_deducted)}</td></tr>
<tr><th>Impôt Québec retenu</th><td>${money(d.qc_tax_deducted)}</td></tr>
<tr><th>Total déductions</th><td>${money(d.total_deductions)}</td></tr>
</table>
<p class="note">Sommaire interne — ne constitue pas un document fiscal officiel. Veuillez utiliser les feuillets émis par votre employeur ou ARC/Revenu Québec pour vos déclarations.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      downloadFile(`${kind}-${year}-${emp.employee_number || emp.user_id}.html`, html, "text/html");
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  // ───────────────────── render ─────────────────────────────────
  const loading = empLoading || docsLoading || payLoading;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Documents fiscaux
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gestion des sommaires T4 et RL-1 par année fiscale.
            Ces sommaires sont à usage interne — les feuillets officiels doivent être émis selon les normes ARC / Revenu Québec.
          </p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>Année fiscale {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Section 1 — Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Employés" value={summary.total} />
        <SummaryCard label="Documents générés" value={summary.generated} tone="success" />
        <SummaryCard label="Documents envoyés" value={summary.sent} tone="primary" />
        <SummaryCard label="En attente" value={summary.pending} tone="warning" />
      </div>

      {/* Section 4 — Validation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Vérification des données ({year})
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <ValidationLine
            ok={validation.noAddress.length === 0}
            label={`Adresse manquante : ${validation.noAddress.length} employé(s)`}
            names={validation.noAddress.map((e: any) => `${e.first_name} ${e.last_name}`)}
          />
          <ValidationLine
            ok={validation.notFinalized.length === 0}
            label={`Périodes de paie non finalisées : ${validation.notFinalized.length} employé(s)`}
            names={validation.notFinalized.map((e: any) => `${e.first_name} ${e.last_name}`)}
          />
          <ValidationLine
            ok={validation.noPayroll.length === 0}
            label={`Aucune entrée de paie pour ${year} : ${validation.noPayroll.length} employé(s)`}
            names={validation.noPayroll.map((e: any) => `${e.first_name} ${e.last_name}`)}
          />
        </CardContent>
      </Card>

      {/* Section 3 — Bulk actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Actions globales</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => bulkGenerate("t4")} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Générer tous les T4
          </Button>
          <Button size="sm" onClick={() => bulkGenerate("rl1")} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Générer tous les RL-1
          </Button>
          <Button size="sm" variant="outline" onClick={sendAll}>
            <Send className="h-4 w-4 mr-1" />
            Marquer tous comme envoyés
          </Button>
          <Button size="sm" variant="outline" onClick={exportCRA}>
            <Download className="h-4 w-4 mr-1" />
            Exporter sommaire CRA
          </Button>
          <Button size="sm" variant="outline" onClick={exportRQ}>
            <Download className="h-4 w-4 mr-1" />
            Exporter sommaire Revenu Québec
          </Button>
        </CardContent>
      </Card>

      {/* Section 2 — Per-employee table */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm">Documents par employé — {year}</CardTitle>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher employé…"
            className="h-8 text-xs w-56"
          />
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun employé trouvé.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Employé</TableHead>
                  <TableHead className="text-xs">Revenu {year}</TableHead>
                  <TableHead className="text-xs">T4</TableHead>
                  <TableHead className="text-xs">RL-1</TableHead>
                  <TableHead className="text-xs">Statut envoi</TableHead>
                  <TableHead className="text-xs">Date génération</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const sent = (r.t4?.status === "sent") || (r.rl1?.status === "sent");
                  const lastGen = [r.t4?.generated_at, r.rl1?.generated_at].filter(Boolean).sort().pop();
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.first_name} {r.last_name}</div>
                        <div className="text-[10px] text-muted-foreground">{r.employee_number || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{money(r.gross)}</TableCell>
                      <TableCell>
                        {r.t4 ? (
                          <Badge variant={STATUS_LABEL[r.t4.status]?.variant || "secondary"} className="text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Généré
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">— Non généré</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.rl1 ? (
                          <Badge variant={STATUS_LABEL[r.rl1.status]?.variant || "secondary"} className="text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Généré
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">— Non généré</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {sent ? (
                          <Badge className="text-[10px] bg-green-600">Envoyé</Badge>
                        ) : (r.t4 || r.rl1) ? (
                          <Badge variant="secondary" className="text-[10px]">Non envoyé</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {lastGen ? format(new Date(lastGen), "yyyy-MM-dd") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {!r.t4 && (
                            <Button size="sm" variant="outline" className="h-7 text-[10px]"
                              disabled={generateMut.isPending || r.gross === 0}
                              onClick={() => generateMut.mutate({ row: r, type: "t4" })}>
                              Générer T4
                            </Button>
                          )}
                          {!r.rl1 && (
                            <Button size="sm" variant="outline" className="h-7 text-[10px]"
                              disabled={generateMut.isPending || r.gross === 0}
                              onClick={() => generateMut.mutate({ row: r, type: "rl1" })}>
                              Générer RL-1
                            </Button>
                          )}
                          {(r.t4 || r.rl1) && (
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]"
                              onClick={() => setPreviewDoc({ doc: r.t4 || r.rl1, emp: r })}>
                              <Eye className="h-3 w-3 mr-1" />Aperçu
                            </Button>
                          )}
                          {(r.t4 || r.rl1) && !sent && (
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]"
                              onClick={async () => {
                                if (r.t4)  await sendMut.mutateAsync(r.t4);
                                if (r.rl1) await sendMut.mutateAsync(r.rl1);
                              }}>
                              <Mail className="h-3 w-3 mr-1" />Envoyer
                            </Button>
                          )}
                          {(r.t4 || r.rl1) && (
                            <Button size="sm" variant="ghost" className="h-7 text-[10px]"
                              onClick={() => downloadDocPdf(r.t4 || r.rl1, r)}>
                              <Download className="h-3 w-3 mr-1" />PDF
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Aperçu — {previewDoc?.doc?.document_type?.toUpperCase()} {previewDoc?.doc?.tax_year}
            </DialogTitle>
            <DialogDescription>
              {previewDoc?.emp?.first_name} {previewDoc?.emp?.last_name} ({previewDoc?.emp?.employee_number || "—"})
            </DialogDescription>
          </DialogHeader>
          {previewDoc && (
            <div className="space-y-1 text-xs">
              {[
                ["Revenu d'emploi",        previewDoc.doc.data_json?.employment_income],
                ["Commissions",            previewDoc.doc.data_json?.commissions],
                ["RPC / RRQ",              previewDoc.doc.data_json?.cpp_contributions],
                ["AE",                     previewDoc.doc.data_json?.ei_premiums],
                ["RQAP",                   previewDoc.doc.data_json?.qpip_premiums],
                ["Impôt fédéral retenu",   previewDoc.doc.data_json?.federal_tax_deducted],
                ["Impôt Québec retenu",    previewDoc.doc.data_json?.qc_tax_deducted],
                ["Total déductions",       previewDoc.doc.data_json?.total_deductions],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between border-b py-1">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-mono">{money(Number(v) || 0)}</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-2">
                Sommaire interne — ne constitue pas un document fiscal officiel.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ───────────────────── small helpers ─────────────────────────────
function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "primary" | "warning" }) {
  const cls =
    tone === "success" ? "text-green-600" :
    tone === "primary" ? "text-primary"    :
    tone === "warning" ? "text-amber-600"  : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ValidationLine({ ok, label, names }: { ok: boolean; label: string; names: string[] }) {
  return (
    <div className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
        : <AlertCircle  className="h-4 w-4 text-amber-600 mt-0.5" />}
      <div>
        <div className={ok ? "text-green-700" : "text-amber-700"}>{label}</div>
        {!ok && names.length > 0 && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{names.slice(0, 8).join(", ")}{names.length > 8 ? "…" : ""}</div>
        )}
      </div>
    </div>
  );
}
