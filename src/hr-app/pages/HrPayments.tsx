/**
 * HrPayments — Espace employé "Mes paiements" (portail Nivra HR).
 * Lecture seule, RLS scope l'utilisateur courant.
 * A1 — stats YTD, filtres avancés, recherche, téléchargement groupé, timeline détaillée.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Banknote, FileText, CheckCircle2, Clock, XCircle, Send, AlertTriangle, Ban, RotateCcw,
  ShieldCheck, Loader2, Mail, Search, Download, Eye, Calendar, TrendingUp, History,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft:            { label: "Brouillon", color: "bg-muted text-muted-foreground border-border", icon: FileText },
  scheduled:        { label: "Programmé", color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300", icon: Clock },
  pending_approval: { label: "Approbation requise", color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300", icon: ShieldCheck },
  approved:         { label: "Approuvé", color: "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950 dark:text-violet-300", icon: CheckCircle2 },
  processing:       { label: "En traitement", color: "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300", icon: Loader2 },
  sent:             { label: "Envoyé", color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300", icon: Send },
  confirmed:        { label: "Confirmé", color: "bg-emerald-200 text-emerald-800 border-emerald-400 dark:bg-emerald-900 dark:text-emerald-300", icon: CheckCircle2 },
  failed:           { label: "Échoué", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300", icon: XCircle },
  bounced:          { label: "Retourné", color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300", icon: AlertTriangle },
  cancelled:        { label: "Annulé", color: "bg-muted text-muted-foreground border-border", icon: Ban },
  reversed:         { label: "Renversé", color: "bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300", icon: RotateCcw },
  disputed:         { label: "En litige", color: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300", icon: AlertTriangle },
  on_hold:          { label: "En attente", color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-950 dark:text-slate-300", icon: Clock },
};

const METHOD_LABEL: Record<string, string> = {
  interac: "Interac e-Transfer", direct_deposit: "Dépôt direct", cheque: "Chèque",
  cash: "Comptant", wire_transfer: "Virement bancaire", paypal: "PayPal", other: "Autre",
};

const fmtMoney = (n: any) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("fr-CA") : "—";
const fmtDateTime = (d: any) => d ? new Date(d).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function HrPayments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()));
  const [detailFor, setDetailFor] = useState<any | null>(null);

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["my-payroll-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel("my_payroll_payments_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_payments" }, () => {
        qc.invalidateQueries({ queryKey: ["my-payroll-payments"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // ── Years derived from data ──
  const years = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => p.created_at && set.add(String(new Date(p.created_at).getFullYear())));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort().reverse();
  }, [payments]);

  // ── Filter ──
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (yearFilter && p.created_at && String(new Date(p.created_at).getFullYear()) !== yearFilter) return false;
      if (statusFilter && p.payment_status !== statusFilter) return false;
      if (methodFilter && p.payment_method !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(
          (p.payment_number || "").toLowerCase().includes(q) ||
          (p.bank_reference || "").toLowerCase().includes(q) ||
          (p.transaction_id || "").toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });
  }, [payments, yearFilter, statusFilter, methodFilter, search]);

  // ── Stats YTD (sur année filtrée) ──
  const stats = useMemo(() => {
    const yearPayments = payments.filter((p) =>
      p.created_at && String(new Date(p.created_at).getFullYear()) === yearFilter
    );
    const sent = yearPayments.filter((p) => ["sent", "confirmed"].includes(p.payment_status));
    const pending = yearPayments.filter((p) => !["sent", "confirmed", "cancelled", "reversed", "failed"].includes(p.payment_status));
    const failed = yearPayments.filter((p) => ["failed", "bounced"].includes(p.payment_status));
    const totalNet = sent.reduce((s, p) => s + Number(p.net_amount || 0), 0);
    const totalGross = sent.reduce((s, p) => s + Number(p.gross_amount || 0), 0);
    const next = pending.sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""))[0];
    const last = sent.sort((a, b) => (b.sent_date || "").localeCompare(a.sent_date || ""))[0];
    return { totalNet, totalGross, sentCount: sent.length, pendingCount: pending.length, failedCount: failed.length, next, last };
  }, [payments, yearFilter]);

  const downloadFromUrl = async (url: string, filename: string) => {
    if (!url) return;
    try {
      const path = url.includes("/documents/") ? url.split("/documents/").pop()! : null;
      const direct = url.startsWith("http") && !path ? url : null;
      const { data } = direct
        ? { data: { signedUrl: direct } }
        : await supabase.storage.from("documents").createSignedUrl(path!, 300);
      if (!data?.signedUrl) throw new Error("Lien indisponible");
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = filename; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {
      toast.error("Téléchargement impossible");
    }
  };

  const downloadAllFiltered = async () => {
    if (filtered.length === 0) return;
    toast.success(`Téléchargement de ${filtered.length} document(s)…`);
    for (const p of filtered) {
      if (p.pdf_avis_url) await downloadFromUrl(p.pdf_avis_url, `avis-paiement-${p.payment_number}.pdf`);
      if (p.pdf_paystub_url) await downloadFromUrl(p.pdf_paystub_url, `talon-paie-${p.payment_number}.pdf`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Banknote className="w-6 h-6 text-violet-500" /> Mes paiements
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique complet, statut en temps réel et documents officiels — synchronisé avec Nivra Core
        </p>
      </div>

      {/* Stats YTD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          label={`Net reçu ${yearFilter}`}
          value={fmtMoney(stats.totalNet)}
          sub={`${stats.sentCount} paiement(s) reçus`}
        />
        <StatCard
          icon={<Banknote className="w-4 h-4 text-blue-500" />}
          label={`Brut ${yearFilter}`}
          value={fmtMoney(stats.totalGross)}
          sub={`avant déductions`}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          label="Prochain paiement"
          value={stats.next ? fmtMoney(stats.next.net_amount) : "—"}
          sub={stats.next ? `Prévu ${fmtDate(stats.next.scheduled_date)}` : "Aucun à venir"}
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-violet-500" />}
          label="Dernier paiement"
          value={stats.last ? fmtMoney(stats.last.net_amount) : "—"}
          sub={stats.last ? `Reçu le ${fmtDate(stats.last.sent_date || stats.last.confirmed_date)}` : "—"}
        />
      </div>

      {stats.failedCount > 0 && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-700">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-semibold text-red-700 dark:text-red-300">{stats.failedCount} paiement(s) en échec</span>
              <span className="text-red-600/80 dark:text-red-400/80"> — l'équipe HR a été notifiée et vous recontactera.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="Rechercher (numéro, référence…)"
              />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={methodFilter || "all"} onValueChange={(v) => setMethodFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Méthode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes méthodes</SelectItem>
                {Object.entries(METHOD_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={downloadAllFiltered} disabled={filtered.length === 0}>
              <Download className="w-4 h-4 mr-1.5" /> Télécharger tout
            </Button>
            {(search || statusFilter || methodFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setMethodFilter(""); }}>
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              Aucun paiement pour ces critères
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead className="text-right">Brut</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const meta = STATUS_META[p.payment_status] || STATUS_META.draft;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.sent_date || p.scheduled_date || p.created_at)}</TableCell>
                      <TableCell className="text-xs">{METHOD_LABEL[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmtMoney(p.gross_amount)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtMoney(p.net_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.color}>
                          <Icon className="w-3 h-3 mr-1" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {p.bank_reference || p.transaction_id || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {p.email_sent_at && (
                            <span title={`Notification envoyée ${fmtDateTime(p.email_sent_at)}`}>
                              <Mail className="w-4 h-4 text-emerald-500" />
                            </span>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailFor(p)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {p.pdf_paystub_url && (
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => downloadFromUrl(p.pdf_paystub_url, `talon-paie-${p.payment_number}.pdf`)}
                              title="Télécharger talon de paie">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {p.pdf_avis_url && (
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => downloadFromUrl(p.pdf_avis_url, `avis-paiement-${p.payment_number}.pdf`)}
                              title="Télécharger avis de paiement">
                              <Download className="w-3.5 h-3.5" />
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

      {/* Detail drawer */}
      <Sheet open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-violet-500" />
              Paiement {detailFor?.payment_number}
            </SheetTitle>
          </SheetHeader>
          {detailFor && <PaymentDetail payment={detailFor} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PaymentDetail({ payment: p }: { payment: any }) {
  const meta = STATUS_META[p.payment_status] || STATUS_META.draft;
  const Icon = meta.icon;
  const { data: events = [] } = useQuery({
    queryKey: ["payment-events", p.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_payment_events")
        .select("*").eq("payment_id", p.id).order("created_at", { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

  return (
    <div className="space-y-4 pt-4">
      {/* Status */}
      <div className="rounded-lg border border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Statut actuel</span>
          <Badge variant="outline" className={meta.color}>
            <Icon className="w-3 h-3 mr-1" />{meta.label}
          </Badge>
        </div>
      </div>

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Brut" value={fmtMoney(p.gross_amount)} />
        <Field label="Net" value={fmtMoney(p.net_amount)} highlight />
        <Field label="Méthode" value={METHOD_LABEL[p.payment_method] || p.payment_method} />
        <Field label="Devise" value={p.currency || "CAD"} />
      </div>

      {/* Dates */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Calendrier</h4>
        <div className="space-y-1.5 text-xs">
          <Field label="Créé le" value={fmtDateTime(p.created_at)} inline />
          <Field label="Programmé pour" value={fmtDate(p.scheduled_date)} inline />
          <Field label="Envoyé le" value={fmtDateTime(p.sent_date)} inline />
          <Field label="Confirmé le" value={fmtDateTime(p.confirmed_date)} inline />
        </div>
      </div>

      {/* Reference */}
      {(p.bank_reference || p.transaction_id || p.recipient_account_last4 || p.recipient_bank_name) && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Référence bancaire</h4>
          <div className="space-y-1.5 text-xs">
            {p.bank_reference && <Field label="Référence" value={p.bank_reference} inline />}
            {p.transaction_id && <Field label="Transaction" value={p.transaction_id} inline />}
            {p.recipient_account_last4 && <Field label="Compte" value={`****${p.recipient_account_last4}`} inline />}
            {p.recipient_bank_name && <Field label="Banque" value={p.recipient_bank_name} inline />}
          </div>
        </div>
      )}

      {/* Notes visibles client */}
      {p.client_visible_notes && (
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Note</h4>
          <p className="text-sm text-foreground whitespace-pre-wrap">{p.client_visible_notes}</p>
        </div>
      )}

      {/* Notifications */}
      {p.email_sent_at && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-700 p-3 bg-emerald-50 dark:bg-emerald-950/40">
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
            <Mail className="w-4 h-4" />
            <span>Notification envoyée le {fmtDateTime(p.email_sent_at)}</span>
          </div>
          {p.email_opened_at && <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1">Ouvert le {fmtDateTime(p.email_opened_at)}</p>}
        </div>
      )}

      {/* Failure */}
      {p.failure_reason && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 p-3 bg-red-50 dark:bg-red-950/40">
          <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-semibold mb-1">
            <XCircle className="w-4 h-4" />Échec
          </div>
          <p className="text-xs text-red-700 dark:text-red-300">{p.failure_reason}</p>
          {p.failure_code && <p className="text-[10px] text-red-600/80 mt-1">Code: {p.failure_code}</p>}
        </div>
      )}

      {/* Timeline */}
      {events.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Historique
          </h4>
          <ol className="border-l-2 border-border pl-3 space-y-2">
            {events.map((e: any) => (
              <li key={e.id} className="text-xs">
                <span className="font-medium text-foreground">{e.event_type}</span>
                <span className="text-muted-foreground"> — {fmtDateTime(e.created_at)}</span>
                {e.notes && <p className="text-[10px] text-muted-foreground mt-0.5">{e.notes}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight, inline }: { label: string; value: string; highlight?: boolean; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className={highlight ? "font-bold text-emerald-600" : "font-medium text-foreground"}>{value}</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={highlight ? "text-base font-bold text-emerald-600" : "text-sm font-semibold text-foreground"}>{value}</p>
    </div>
  );
}
