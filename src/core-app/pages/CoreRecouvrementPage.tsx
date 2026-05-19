/**
 * CoreRecouvrementPage — Collections / dunning workspace (A1).
 *
 * Features:
 * - 4 KPIs (overdue, due soon, total balance, avg days late)
 * - Critical buckets (1-15d / 16-30d / 31-60d / 60+) with click filter
 * - Search by invoice number, customer name, email
 * - Detail dialog with reminder history + collections action log
 * - Quick actions: log contact (email/phone/SMS), promise to pay, escalation, mark resolved, write-off, note
 * - CSV export of filtered list
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Search, DollarSign, Clock, Users, Download,
  Phone, Mail, MessageSquare, Calendar, Shield, FileX, History,
  TrendingUp,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type BucketKey = "all" | "due_soon" | "1_15" | "16_30" | "31_60" | "60_plus";

const ACTION_TYPES = [
  { value: "contact_email", label: "Courriel envoyé", icon: Mail },
  { value: "contact_phone", label: "Appel téléphonique", icon: Phone },
  { value: "contact_sms", label: "SMS envoyé", icon: MessageSquare },
  { value: "promise_to_pay", label: "Promesse de paiement", icon: Calendar },
  { value: "payment_plan", label: "Plan de paiement", icon: TrendingUp },
  { value: "escalation", label: "Escalade", icon: Shield },
  { value: "writeoff", label: "Radiation (write-off)", icon: FileX },
  { value: "resolved", label: "Résolu", icon: Shield },
  { value: "note", label: "Note interne", icon: History },
] as const;

const cardClass = "p-4 rounded-lg border border-core-border bg-core-card";

export default function CoreRecouvrementPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState<BucketKey>("all");
  const [selected, setSelected] = useState<any>(null);
  const [actionType, setActionType] = useState<string>("contact_phone");
  const [actionNotes, setActionNotes] = useState("");
  const [amountPromised, setAmountPromised] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["core-recouvrement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("*, billing_customers(id, first_name, last_name, email, phone)")
        .in("status", ["overdue", "issued"])
        .order("due_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const today = new Date();
  const enriched = useMemo(() => invoices.map((inv: any) => {
    const due = inv.due_date ? new Date(inv.due_date) : null;
    const daysOverdue = due ? differenceInCalendarDays(today, due) : 0;
    return { ...inv, _daysOverdue: daysOverdue };
  }), [invoices]);

  const stats = useMemo(() => {
    const overdue = enriched.filter((i: any) => i._daysOverdue > 0);
    const totalBalance = enriched.reduce((s: number, i: any) => s + Number(i.balance_due ?? i.total ?? 0), 0);
    const avgDays = overdue.length
      ? Math.round(overdue.reduce((s: number, i: any) => s + i._daysOverdue, 0) / overdue.length)
      : 0;
    return {
      overdueCount: overdue.length,
      dueSoonCount: enriched.filter((i: any) => i._daysOverdue <= 0).length,
      totalBalance,
      avgDays,
      b1_15: enriched.filter((i: any) => i._daysOverdue >= 1 && i._daysOverdue <= 15).length,
      b16_30: enriched.filter((i: any) => i._daysOverdue >= 16 && i._daysOverdue <= 30).length,
      b31_60: enriched.filter((i: any) => i._daysOverdue >= 31 && i._daysOverdue <= 60).length,
      b60p: enriched.filter((i: any) => i._daysOverdue > 60).length,
    };
  }, [enriched]);

  const filtered = useMemo(() => enriched.filter((inv: any) => {
    if (search) {
      const c = inv.billing_customers;
      const hay = [c?.first_name, c?.last_name, c?.email, c?.phone, inv.invoice_number]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    const d = inv._daysOverdue;
    if (bucket === "due_soon") return d <= 0;
    if (bucket === "1_15") return d >= 1 && d <= 15;
    if (bucket === "16_30") return d >= 16 && d <= 30;
    if (bucket === "31_60") return d >= 31 && d <= 60;
    if (bucket === "60_plus") return d > 60;
    return true;
  }), [enriched, search, bucket]);

  const { data: history = [] } = useQuery({
    queryKey: ["core-recouvrement-history", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const [actions, reminders] = await Promise.all([
        supabase.from("collections_actions").select("*")
          .eq("invoice_id", selected.id).order("created_at", { ascending: false }),
        supabase.from("overdue_reminder_log").select("*")
          .eq("invoice_id", selected.id).order("reminder_date", { ascending: false }),
      ]);
      return [
        ...((actions.data || []).map((a: any) => ({ ...a, _kind: "action" }))),
        ...((reminders.data || []).map((r: any) => ({
          ...r, _kind: "reminder",
          action_type: "auto_reminder",
          notes: `Relance automatique J+${r.days_overdue} (${r.recipient_email})`,
          created_at: r.created_at,
        }))),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const openInvoice = (inv: any) => {
    setSelected(inv);
    setActionType("contact_phone");
    setActionNotes("");
    setAmountPromised("");
    setPromiseDate("");
  };

  const saveAction = async () => {
    if (!selected) return;
    if (!actionNotes.trim() && actionType !== "resolved") {
      toast.error("Ajoute une note décrivant l'action");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("collections_actions").insert({
        invoice_id: selected.id,
        customer_id: selected.customer_id,
        action_type: actionType,
        notes: actionNotes.trim() || null,
        amount_promised: amountPromised ? Number(amountPromised) : null,
        promise_date: promiseDate || null,
        performed_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Action enregistrée");
      setActionNotes(""); setAmountPromised(""); setPromiseDate("");
      qc.invalidateQueries({ queryKey: ["core-recouvrement-history", selected.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Facture", "Client", "Email", "Téléphone", "Échéance", "Jours retard", "Solde", "Statut"],
      ...filtered.map((i: any) => {
        const c = i.billing_customers;
        return [
          i.invoice_number,
          `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim(),
          c?.email ?? "",
          c?.phone ?? "",
          i.due_date ?? "",
          i._daysOverdue,
          Number(i.balance_due ?? i.total ?? 0).toFixed(2),
          i.status,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `recouvrement_${format(today, "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const bucketBadge = (d: number) => {
    if (d <= 0) return <Badge className="bg-core-accent/15 text-core-accent-soft border-0">À venir</Badge>;
    if (d <= 15) return <Badge className="bg-core-warning/15 text-core-warning border-0">{d}j</Badge>;
    if (d <= 30) return <Badge className="bg-core-warning/25 text-core-warning border-0">{d}j</Badge>;
    if (d <= 60) return <Badge className="bg-core-danger/15 text-core-danger border-0">{d}j</Badge>;
    return <Badge className="bg-core-danger/30 text-core-fg border-0">{d}j ⚠</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-core-text-primary flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-core-warning" /> Recouvrement
          </h1>
          <p className="text-sm text-core-text-secondary">Suivi des factures en souffrance, relances et engagements de paiement</p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Exporter CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-core-danger" /><span className="text-xs text-core-text-label">En souffrance</span></div>
          <p className="text-2xl font-bold text-core-text-primary">{stats.overdueCount}</p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-core-warning" /><span className="text-xs text-core-text-label">À échoir</span></div>
          <p className="text-2xl font-bold text-core-text-primary">{stats.dueSoonCount}</p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-core-accent-soft" /><span className="text-xs text-core-text-label">Solde total</span></div>
          <p className="text-2xl font-bold text-core-text-primary">{stats.totalBalance.toFixed(2)}$</p>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-core-success" /><span className="text-xs text-core-text-label">Retard moyen</span></div>
          <p className="text-2xl font-bold text-core-text-primary">{stats.avgDays}j</p>
        </div>
      </div>

      {/* Bucket filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { k: "all", label: `Tous (${enriched.length})` },
          { k: "due_soon", label: `À venir (${stats.dueSoonCount})` },
          { k: "1_15", label: `1-15j (${stats.b1_15})` },
          { k: "16_30", label: `16-30j (${stats.b16_30})` },
          { k: "31_60", label: `31-60j (${stats.b31_60})` },
          { k: "60_plus", label: `60j+ (${stats.b60p})` },
        ].map(p => (
          <button key={p.k} onClick={() => setBucket(p.k as BucketKey)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition",
              bucket === p.k
                ? "bg-core-accent text-core-fg border-transparent"
                : "border-core-border-strong text-core-text-secondary hover:text-core-text-primary hover:border-core-accent/60"
            )}>{p.label}</button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-core-text-label" />
          <Input placeholder="Facture, nom, email, téléphone…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-core-card-raised border-core-border-strong text-core-text-primary" />
        </div>
        <span className="text-xs text-core-text-label">{filtered.length} résultat(s)</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading && <div className="text-center py-12 text-core-text-label">Chargement…</div>}
        {!isLoading && filtered.map((inv: any) => {
          const c = inv.billing_customers;
          return (
            <button key={inv.id} onClick={() => openInvoice(inv)}
              className="w-full p-3 rounded-lg border border-core-border bg-core-card hover:border-core-border-strong flex items-center justify-between text-left transition">
              <div className="min-w-0">
                <p className="text-sm font-medium text-core-text-primary truncate">
                  {inv.invoice_number} — {c?.first_name} {c?.last_name}
                </p>
                <p className="text-xs text-core-text-secondary truncate">
                  {c?.email} {c?.phone && `· ${c.phone}`} · Échéance:{" "}
                  {inv.due_date && format(new Date(inv.due_date), "d MMM yyyy", { locale: fr })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {bucketBadge(inv._daysOverdue)}
                <span className="text-sm font-semibold text-core-text-primary w-20 text-right">
                  {Number(inv.balance_due ?? inv.total ?? 0).toFixed(2)}$
                </span>
              </div>
            </button>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-core-text-label">Aucune facture dans ce filtre</div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selected.invoice_number} · {selected.billing_customers?.first_name} {selected.billing_customers?.last_name}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className={cardClass}>
                  <p className="text-xs text-core-text-label">Solde dû</p>
                  <p className="text-lg font-bold text-core-text-primary">
                    {Number(selected.balance_due ?? selected.total ?? 0).toFixed(2)}$
                  </p>
                </div>
                <div className={cardClass}>
                  <p className="text-xs text-core-text-label">Échéance</p>
                  <p className="text-sm text-core-text-primary">
                    {selected.due_date && format(new Date(selected.due_date), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                <div className={cardClass}>
                  <p className="text-xs text-core-text-label">Retard</p>
                  <p className="text-sm text-core-text-primary">{selected._daysOverdue}j</p>
                </div>
              </div>

              {/* New action form */}
              <div className="space-y-3 border border-core-border-strong rounded-lg p-3">
                <h3 className="text-sm font-semibold text-core-text-primary">Nouvelle action</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(actionType === "promise_to_pay" || actionType === "payment_plan") && (
                    <>
                      <div>
                        <Label className="text-xs">Montant promis ($)</Label>
                        <Input type="number" step="0.01" value={amountPromised}
                          onChange={(e) => setAmountPromised(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Date promise</Label>
                        <Input type="date" value={promiseDate}
                          onChange={(e) => setPromiseDate(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Détails de l'échange, accord du client…" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveAction} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer l'action"}
                  </Button>
                </div>
              </div>

              {/* History */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-core-text-primary">Historique</h3>
                {history.length === 0 && (
                  <p className="text-xs text-core-text-label">Aucune action enregistrée pour cette facture.</p>
                )}
                {history.map((h: any) => (
                  <div key={h.id} className="text-xs border border-core-border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-core-text-primary">
                        {ACTION_TYPES.find(a => a.value === h.action_type)?.label ?? h.action_type}
                      </span>
                      <span className="text-core-text-label">
                        {h.created_at && format(new Date(h.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    {h.notes && <p className="mt-1 text-core-text-secondary">{h.notes}</p>}
                    {(h.amount_promised || h.promise_date) && (
                      <p className="mt-1 text-core-text-secondary">
                        Promesse: {h.amount_promised ? `${Number(h.amount_promised).toFixed(2)}$` : "—"}
                        {h.promise_date && ` · ${format(new Date(h.promise_date), "d MMM yyyy", { locale: fr })}`}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
