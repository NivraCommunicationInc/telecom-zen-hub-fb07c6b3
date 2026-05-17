/**
 * HrPaymentsPage — Page dédiée de gestion des paiements de paie (Nivra Core).
 * Synchronisé Core / RH / Field / Employé via realtime sur payroll_payments.
 * A1 — dashboard, filtres avancés, 12 statuts, bulk actions, timeline, notifications.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2, Clock, AlertTriangle, XCircle, Send, RefreshCw, FileText, Eye, Search, Mail,
  Banknote, DollarSign, Filter, Download, Loader2, History, ShieldCheck, Ban, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

// ──────── Constants ────────
const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  draft:            { label: "Brouillon",         color: "bg-gray-500/20 text-gray-300 border-gray-500/40",        icon: FileText },
  scheduled:        { label: "Programmé",         color: "bg-blue-500/20 text-blue-300 border-blue-500/40",        icon: Clock },
  pending_approval: { label: "Approbation requise", color: "bg-amber-500/20 text-amber-300 border-amber-500/40",   icon: ShieldCheck },
  approved:         { label: "Approuvé",          color: "bg-violet-500/20 text-violet-300 border-violet-500/40",   icon: CheckCircle2 },
  processing:       { label: "En traitement",     color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",        icon: Loader2 },
  sent:             { label: "Envoyé",            color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: Send },
  confirmed:        { label: "Confirmé",          color: "bg-emerald-600/30 text-emerald-200 border-emerald-600/60", icon: CheckCircle2 },
  failed:           { label: "Échoué",            color: "bg-red-500/20 text-red-300 border-red-500/40",           icon: XCircle },
  bounced:          { label: "Retourné",          color: "bg-orange-500/20 text-orange-300 border-orange-500/40",  icon: AlertTriangle },
  cancelled:        { label: "Annulé",            color: "bg-gray-600/30 text-gray-300 border-gray-600/60",        icon: Ban },
  reversed:         { label: "Renversé",          color: "bg-pink-500/20 text-pink-300 border-pink-500/40",        icon: RotateCcw },
  disputed:         { label: "En litige",         color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",  icon: AlertTriangle },
  on_hold:          { label: "En attente",        color: "bg-slate-500/20 text-slate-300 border-slate-500/40",     icon: Clock },
};

const METHOD_LABEL: Record<string, string> = {
  interac: "Interac e-Transfer",
  direct_deposit: "Dépôt direct",
  cheque: "Chèque",
  cash: "Comptant",
  wire_transfer: "Virement bancaire",
  paypal: "PayPal",
  other: "Autre",
};

const fmtMoney = (n: any) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtDateShort = (d: any) => d ? new Date(d).toLocaleDateString("fr-CA") : "—";

type Payment = any;

export default function HrPaymentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState<string | null>(null);
  const [markSentFor, setMarkSentFor] = useState<Payment | null>(null);
  const [confirmFor, setConfirmFor] = useState<Payment | null>(null);
  const [failFor, setFailFor] = useState<Payment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // ──────── Fetch payments ────────
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["payroll-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // ──────── Realtime sync ────────
  useEffect(() => {
    const ch = supabase.channel("payroll_payments_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payroll_payments" }, () => {
        qc.invalidateQueries({ queryKey: ["payroll-payments"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // ──────── Fetch payroll entries without payment (to allow creation) ────────
  const { data: entriesWithoutPayment = [] } = useQuery<any[]>({
    queryKey: ["payroll-entries-without-payment"],
    queryFn: async () => {
      const { data: existing } = await supabase.from("payroll_payments").select("payroll_entry_id");
      const usedIds = new Set((existing || []).map((r: any) => r.payroll_entry_id).filter(Boolean));
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("id, payroll_number, user_id, employee_id, agent_number, net_pay, gross_pay, total_gross, deductions_total, federal_tax, quebec_tax, rrq, ae, rqap, disability_insurance, ytd_gross, ytd_net, payment_method, status, payment_status, pay_period_id, created_at")
        .in("status", ["approved", "paid"]).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const entries = (data || []).filter((e: any) => !usedIds.has(e.id));
      // Hydrate profile + period info
      const uids = [...new Set(entries.map((e: any) => e.employee_id || e.user_id).filter(Boolean))];
      const pids = [...new Set(entries.map((e: any) => e.pay_period_id).filter(Boolean))];
      const [{ data: profs }, { data: periods }] = await Promise.all([
        uids.length ? supabase.from("profiles").select("user_id, full_name, email, agent_number").in("user_id", uids) : Promise.resolve({ data: [] as any[] }),
        pids.length ? supabase.from("pay_periods").select("id, period_start, period_end, pay_date").in("id", pids) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pmap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const permap = new Map((periods || []).map((p: any) => [p.id, p]));
      return entries.map((e: any) => ({
        ...e,
        _profile: pmap.get(e.employee_id || e.user_id) || null,
        _period: permap.get(e.pay_period_id) || null,
      }));
    },
    enabled: createOpen,
  });

  // ──────── Filter ────────
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter && p.payment_status !== statusFilter) return false;
      if (methodFilter && p.payment_method !== methodFilter) return false;
      if (dateFrom && (!p.created_at || p.created_at < dateFrom)) return false;
      if (dateTo && (!p.created_at || p.created_at > dateTo + "T23:59:59")) return false;
      if (minAmount && Number(p.net_amount) < Number(minAmount)) return false;
      if (maxAmount && Number(p.net_amount) > Number(maxAmount)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(
          (p.payment_number || "").toLowerCase().includes(q) ||
          (p.employee_name || "").toLowerCase().includes(q) ||
          (p.employee_number || "").toLowerCase().includes(q) ||
          (p.employee_email || "").toLowerCase().includes(q) ||
          (p.bank_reference || "").toLowerCase().includes(q) ||
          (p.transaction_id || "").toLowerCase().includes(q)
        )) return false;
      }
      return true;
    });
  }, [payments, statusFilter, methodFilter, dateFrom, dateTo, minAmount, maxAmount, search]);

  // ──────── Stats ────────
  const stats = useMemo(() => {
    const by = (s: string) => payments.filter((p) => p.payment_status === s);
    const sum = (arr: Payment[]) => arr.reduce((a, p) => a + Number(p.net_amount || 0), 0);
    const thisMonth = payments.filter((p) => p.created_at && new Date(p.created_at).getMonth() === new Date().getMonth() && new Date(p.created_at).getFullYear() === new Date().getFullYear());
    return {
      totalCount: payments.length,
      pendingApproval: by("pending_approval").length,
      scheduled: by("scheduled").length,
      processing: by("processing").length + by("approved").length,
      sent: by("sent").length,
      confirmed: by("confirmed").length,
      failed: by("failed").length + by("bounced").length,
      totalToPay: sum(payments.filter((p) => !["sent", "confirmed", "cancelled", "reversed"].includes(p.payment_status))),
      totalSent: sum(payments.filter((p) => ["sent", "confirmed"].includes(p.payment_status))),
      totalThisMonth: sum(thisMonth),
    };
  }, [payments]);

  // ──────── Mutations ────────
  const invokeAction = useMutation({
    mutationFn: async (body: any) => {
      const { data, error } = await supabase.functions.invoke("payroll-payments", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll-payments"] });
      qc.invalidateQueries({ queryKey: ["payroll-payment-timeline"] });
    },
    onError: (e: any) => toast.error(e.message || "Échec de l'opération"),
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  // ──────── Bulk actions ────────
  const bulkApprove = async () => {
    if (selected.size === 0) return;
    await invokeAction.mutateAsync({ action: "bulk_transition", payment_ids: [...selected], next_status: "approved" });
    toast.success(`${selected.size} paiement(s) approuvé(s)`);
    setSelected(new Set());
  };
  const bulkResend = async () => {
    if (selected.size === 0) return;
    await invokeAction.mutateAsync({ action: "bulk_send_notification", payment_ids: [...selected] });
    toast.success(`Notifications envoyées (${selected.size})`);
    setSelected(new Set());
  };
  const exportCSV = () => {
    const rows = [
      ["# Paiement","Employé","# Employé","Email","Méthode","Statut","Brut","Net","Date prog.","Date envoi","Référence"],
      ...filtered.map((p) => [
        p.payment_number, p.employee_name, p.employee_number || "", p.employee_email || "",
        METHOD_LABEL[p.payment_method] || p.payment_method,
        STATUS_META[p.payment_status]?.label || p.payment_status,
        Number(p.gross_amount).toFixed(2), Number(p.net_amount).toFixed(2),
        fmtDateShort(p.scheduled_date), fmtDateShort(p.sent_date),
        p.bank_reference || p.transaction_id || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `paiements-paie-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-violet-500" />
            Paiements de paie
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestion centralisée des virements aux employés — synchronisé Core / RH / Field / Portail Employé
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <DollarSign className="w-4 h-4 mr-1.5" /> Nouveau paiement
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="À payer" value={fmtMoney(stats.totalToPay)} sub={`${stats.totalCount} paiement(s)`} accent="text-violet-400" />
        <StatCard label="Approbation" value={String(stats.pendingApproval)} sub="en attente" accent="text-amber-400" />
        <StatCard label="Programmés" value={String(stats.scheduled)} sub="à envoyer" accent="text-blue-400" />
        <StatCard label="Traitement" value={String(stats.processing)} sub="en cours" accent="text-cyan-400" />
        <StatCard label="Envoyés/Confirmés" value={fmtMoney(stats.totalSent)} sub={`${stats.sent + stats.confirmed} paiement(s)`} accent="text-emerald-400" />
        <StatCard label="Échoués" value={String(stats.failed)} sub="à réviser" accent="text-red-400" />
      </div>

      {/* Filters */}
      <Card className="bg-card/40 border-border">
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex-1 min-w-[260px] flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" placeholder="# paiement, employé, référence…" />
            </div>
            <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
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
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px] h-9" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px] h-9" />
            <Input type="number" placeholder="Min $" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="w-[100px] h-9" />
            <Input type="number" placeholder="Max $" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className="w-[100px] h-9" />
            {(search || statusFilter || methodFilter || dateFrom || dateTo || minAmount || maxAmount) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setMethodFilter(""); setDateFrom(""); setDateTo(""); setMinAmount(""); setMaxAmount(""); }}>
                Réinitialiser
              </Button>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{selected.size} sélectionné(s)</span>
              <Button size="sm" variant="outline" onClick={bulkApprove}>
                <ShieldCheck className="w-4 h-4 mr-1.5" /> Approuver
              </Button>
              <Button size="sm" variant="outline" onClick={bulkResend}>
                <Mail className="w-4 h-4 mr-1.5" /> Renotifier
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Désélectionner</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun paiement trouvé</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Employé</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Programmé</TableHead>
                  <TableHead>Envoyé</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const meta = STATUS_META[p.payment_status] || STATUS_META.draft;
                  const Icon = meta.icon;
                  return (
                    <TableRow key={p.id}>
                      <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{p.employee_name}</div>
                        <div className="text-xs text-muted-foreground">{p.employee_number || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{METHOD_LABEL[p.payment_method] || p.payment_method}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmtMoney(p.net_amount)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.color}>
                          <Icon className="w-3 h-3 mr-1" />{meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{fmtDateShort(p.scheduled_date)}</TableCell>
                      <TableCell className="text-xs">{fmtDateShort(p.sent_date)}</TableCell>
                      <TableCell className="text-xs font-mono">{p.bank_reference || p.transaction_id || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailOpen(p.id)} title="Voir détails">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {["draft", "pending_approval", "approved", "scheduled", "processing", "failed", "on_hold"].includes(p.payment_status) && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMarkSentFor(p)} title="Marquer envoyé">
                              <Send className="w-3.5 h-3.5 text-emerald-500" />
                            </Button>
                          )}
                          {p.payment_status === "sent" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setConfirmFor(p)} title="Confirmer">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </Button>
                          )}
                          {["sent", "confirmed"].includes(p.payment_status) && (
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => invokeAction.mutate({ action: "resend_notification", payment_id: p.id }, { onSuccess: () => toast.success("Notification renvoyée") })}
                              title="Renotifier">
                              <Mail className="w-3.5 h-3.5 text-blue-500" />
                            </Button>
                          )}
                          {!["cancelled", "reversed", "confirmed"].includes(p.payment_status) && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFailFor(p)} title="Marquer échoué/annulé">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
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

      {/* Detail Drawer */}
      <PaymentDetailDrawer
        paymentId={detailOpen}
        onClose={() => setDetailOpen(null)}
        onAction={(body) => invokeAction.mutate(body)}
      />

      {/* Mark Sent Dialog */}
      <MarkSentDialog
        payment={markSentFor}
        onClose={() => setMarkSentFor(null)}
        onConfirm={(payload) => {
          invokeAction.mutate(
            { action: "transition", payment_id: markSentFor!.id, next_status: "sent", send_notification: true, ...payload },
            { onSuccess: () => { toast.success("Paiement marqué envoyé et notification envoyée"); setMarkSentFor(null); } },
          );
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmPaymentDialog
        payment={confirmFor}
        onClose={() => setConfirmFor(null)}
        onConfirm={(payload) => {
          invokeAction.mutate(
            { action: "transition", payment_id: confirmFor!.id, next_status: "confirmed", send_notification: false, ...payload },
            { onSuccess: () => { toast.success("Paiement confirmé"); setConfirmFor(null); } },
          );
        }}
      />

      {/* Fail/Cancel Dialog */}
      <FailDialog
        payment={failFor}
        onClose={() => setFailFor(null)}
        onConfirm={(payload) => {
          invokeAction.mutate(
            { action: "transition", payment_id: failFor!.id, ...payload },
            { onSuccess: () => { toast.success("Statut mis à jour"); setFailFor(null); } },
          );
        }}
      />

      {/* Create Dialog */}
      <CreatePaymentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        entries={entriesWithoutPayment}
        onCreate={async ({ initial_status, bank_reference, transaction_id, recipient_bank_name, recipient_account_last4, client_visible_notes, ...createBody }: any) => {
          try {
            const created = await invokeAction.mutateAsync({ action: "create", ...createBody });
            const paymentId = created?.payment?.id || created?.payment_id;
            if (paymentId) {
              const updates: any = {};
              if (bank_reference) updates.bank_reference = bank_reference;
              if (transaction_id) updates.transaction_id = transaction_id;
              if (recipient_bank_name) updates.recipient_bank_name = recipient_bank_name;
              if (recipient_account_last4) updates.recipient_account_last4 = recipient_account_last4;
              if (client_visible_notes) updates.client_visible_notes = client_visible_notes;
              if (Object.keys(updates).length) {
                await invokeAction.mutateAsync({ action: "update", payment_id: paymentId, ...updates });
              }
              if (initial_status && !["draft", "pending_approval"].includes(initial_status)) {
                await invokeAction.mutateAsync({ action: "transition", payment_id: paymentId, next_status: initial_status });
              }
            }
            toast.success("Paiement créé");
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ["payroll-entries-without-payment"] });
          } catch (e: any) {
            toast.error(e?.message || "Échec de création");
          }
        }}
      />
    </div>
  );
}

// ──────── Sub-components ────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold mt-1 ${accent}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MarkSentDialog({ payment, onClose, onConfirm }: any) {
  const [method, setMethod] = useState("interac");
  const [bankRef, setBankRef] = useState("");
  const [txId, setTxId] = useState("");
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  useEffect(() => {
    if (payment) {
      setMethod(payment.payment_method || "interac");
      setBankRef(payment.bank_reference || "");
      setTxId(payment.transaction_id || "");
      setBankName(payment.recipient_bank_name || "");
      setLast4(payment.recipient_account_last4 || "");
    }
  }, [payment]);
  if (!payment) return null;
  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Marquer le paiement envoyé</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm bg-muted/40 rounded p-2">
            <div><strong>{payment.employee_name}</strong> — {payment.payment_number}</div>
            <div className="font-mono text-emerald-400 text-lg">{fmtMoney(payment.net_amount)}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Méthode</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Référence bancaire</Label>
            <Input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="Ex: INT-20260517-001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ID de transaction</Label>
            <Input value={txId} onChange={(e) => setTxId(e.target.value)} placeholder="Optionnel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Banque destinataire</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex: Desjardins" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">4 derniers chiffres</Label>
              <Input value={last4} onChange={(e) => setLast4(e.target.value.slice(0, 4))} maxLength={4} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/30 rounded p-2">
            <Mail className="w-3 h-3 inline mr-1" />
            L'employé recevra automatiquement un email avec l'Avis de paiement PDF et son talon de paie.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onConfirm({
            payment_method: method, bank_reference: bankRef, transaction_id: txId,
            recipient_bank_name: bankName, recipient_account_last4: last4,
          })}>
            <Send className="w-4 h-4 mr-1.5" /> Envoyer & notifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPaymentDialog({ payment, onClose, onConfirm }: any) {
  const [confNum, setConfNum] = useState("");
  if (!payment) return null;
  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Confirmer le paiement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Marquer comme <strong className="text-emerald-400">confirmé</strong> — le paiement a été reçu par la banque.
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Numéro de confirmation banque</Label>
            <Input value={confNum} onChange={(e) => setConfNum(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => onConfirm({ confirmation_number: confNum })}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FailDialog({ payment, onClose, onConfirm }: any) {
  const [status, setStatus] = useState("failed");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  if (!payment) return null;
  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Modifier le statut</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nouveau statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="failed">Échoué</SelectItem>
                <SelectItem value="bounced">Retourné</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
                <SelectItem value="reversed">Renversé</SelectItem>
                <SelectItem value="disputed">En litige</SelectItem>
                <SelectItem value="on_hold">Mis en attente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Raison</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Description..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Code erreur (optionnel)</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" onClick={() => onConfirm({ next_status: status, failure_reason: reason, failure_code: code })}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePaymentDialog({ open, onClose, entries, onCreate }: any) {
  const [entryId, setEntryId] = useState("");
  const [method, setMethod] = useState("interac");
  const [scheduled, setScheduled] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (!open) { setEntryId(""); setMethod("interac"); setScheduled(""); setNotes(""); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau paiement de paie</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Entrée de paie (talon)</Label>
            <Select value={entryId} onValueChange={setEntryId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {entries.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">Aucune entrée disponible</div>
                ) : entries.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.payroll_number || e.id.slice(0, 8)} — {fmtMoney(e.net_pay)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Méthode</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date programmée</Label>
            <Input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes internes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button disabled={!entryId} onClick={() => onCreate({
            payroll_entry_id: entryId, payment_method: method,
            scheduled_date: scheduled || null, internal_notes: notes || null,
          })}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDetailDrawer({ paymentId, onClose, onAction }: any) {
  const { data: payment } = useQuery({
    queryKey: ["payroll-payment", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_payments").select("*").eq("id", paymentId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!paymentId,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["payroll-payment-timeline", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_payment_events")
        .select("*").eq("payment_id", paymentId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!paymentId,
  });

  if (!paymentId) return null;
  const meta = payment ? STATUS_META[payment.payment_status] || STATUS_META.draft : null;

  return (
    <Sheet open={!!paymentId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Détail du paiement</SheetTitle>
        </SheetHeader>
        {!payment ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement…
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Numéro</div>
                <div className="font-mono text-sm">{payment.payment_number}</div>
              </div>
              {meta && (
                <Badge variant="outline" className={meta.color}>
                  <meta.icon className="w-3 h-3 mr-1" />{meta.label}
                </Badge>
              )}
            </div>

            <Card className="bg-muted/30 border-border">
              <CardContent className="p-3 space-y-1">
                <div className="text-xs text-muted-foreground">Bénéficiaire</div>
                <div className="font-semibold">{payment.employee_name}</div>
                <div className="text-xs text-muted-foreground">{payment.employee_email}</div>
                <div className="text-xs text-muted-foreground">N° employé: {payment.employee_number || "—"}</div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-2">
              <DetailField label="Brut" value={fmtMoney(payment.gross_amount)} />
              <DetailField label="Déductions" value={fmtMoney(payment.deductions_total)} />
              <DetailField label="Net" value={fmtMoney(payment.net_amount)} highlight />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DetailField label="Méthode" value={METHOD_LABEL[payment.payment_method] || payment.payment_method} />
              <DetailField label="Date programmée" value={fmtDateShort(payment.scheduled_date)} />
              <DetailField label="Envoyé le" value={fmtDate(payment.sent_date)} />
              <DetailField label="Confirmé le" value={fmtDate(payment.confirmed_date)} />
              <DetailField label="Référence bancaire" value={payment.bank_reference || "—"} />
              <DetailField label="ID transaction" value={payment.transaction_id || "—"} />
              <DetailField label="Banque destinataire" value={payment.recipient_bank_name || "—"} />
              <DetailField label="Compte (4 derniers)" value={payment.recipient_account_last4 ? "•••• " + payment.recipient_account_last4 : "—"} />
            </div>

            {payment.failure_reason && (
              <div className="text-xs bg-red-500/10 border border-red-500/30 rounded p-2 text-red-300">
                <strong>Échec:</strong> {payment.failure_reason} {payment.failure_code && `(${payment.failure_code})`}
                <br />Tentatives: {payment.retry_count}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Notes internes</div>
              <div className="text-sm bg-muted/30 rounded p-2 min-h-[40px]">{payment.internal_notes || "—"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Notes visibles employé</div>
              <div className="text-sm bg-muted/30 rounded p-2 min-h-[40px]">{payment.client_visible_notes || "—"}</div>
            </div>

            {payment.email_sent_at && (
              <div className="text-xs text-emerald-300 flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email envoyé le {fmtDate(payment.email_sent_at)}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {payment.pdf_avis_url && (
                <a href={payment.pdf_avis_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" />Avis PDF</Button>
                </a>
              )}
              {payment.pdf_paystub_url && (
                <a href={payment.pdf_paystub_url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline"><FileText className="w-4 h-4 mr-1" />Talon PDF</Button>
                </a>
              )}
              <Button size="sm" variant="outline" onClick={() => onAction({ action: "resend_notification", payment_id: payment.id })}>
                <RefreshCw className="w-4 h-4 mr-1" />Renotifier
              </Button>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <History className="w-3 h-3" />Timeline ({events.length})
              </div>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {events.length === 0 && <div className="text-xs text-muted-foreground">Aucun événement</div>}
                {events.map((e: any) => (
                  <div key={e.id} className="text-xs bg-muted/30 rounded p-2 border-l-2 border-violet-500">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{e.event_type}</span>
                      <span className="text-muted-foreground">{fmtDate(e.created_at)}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Par {e.actor_name || "système"} {e.actor_role && `(${e.actor_role})`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm ${highlight ? "font-bold text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
