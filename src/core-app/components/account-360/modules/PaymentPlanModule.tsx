/**
 * PaymentPlanModule — Client 360 "Plan de paiement" command center.
 *
 * Standard identique à PlanChange / RecordPayment / Refund / Autopay / Adjustments /
 * CollectionsDispute :
 *  - Contexte compte complet (solde, factures ouvertes, paiements échoués,
 *    dossiers de recouvrement, AutoPay, méthode de paiement)
 *  - Historique des plans (actifs, annulés, complétés)
 *  - Simulation d'échéancier AVANT création (montant, fréquence, dates, impact)
 *  - Confirmation avec motif obligatoire + audit admin_audit_log
 *  - Écriture unique via Edge Function `billing-account-actions`
 *      → action `create_payment_plan` (canonique)
 *      → action `cancel_payment_plan` (canonique)
 *    Aucun système parallèle. La table cible `client_payment_plans` et les
 *    emails brandés `client_payment_plan_created` / `_cancelled` restent la
 *    seule source de vérité.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  CalendarClock, Wallet, AlertTriangle, Info, Repeat, XOctagon, CheckCircle2,
} from "lucide-react";
import { format, addDays, addMonths } from "date-fns";
import { fr } from "date-fns/locale";

type Frequency = "weekly" | "biweekly" | "monthly";
type Mode = "create" | "cancel";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;          // auth user id = client_user_id
  clientName: string;
  clientEmail?: string | null;
  canonicalData: any;
}

const CLOSED = ["paid", "paid_by_promo", "void", "cancelled", "refunded", "written_off", "bad_debt"];

const FREQ_LABEL: Record<Frequency, string> = {
  weekly:   "Hebdomadaire (7 jours)",
  biweekly: "Aux 2 semaines (14 jours)",
  monthly:  "Mensuel",
};

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

const addByFreq = (base: Date, freq: Frequency, i: number) => {
  if (freq === "weekly")   return addDays(base, 7 * i);
  if (freq === "biweekly") return addDays(base, 14 * i);
  return addMonths(base, i);
};

export function PaymentPlanModule({
  open, onClose, accountId, clientId, clientName, clientEmail, canonicalData,
}: Props) {
  const qc = useQueryClient();

  // ── Context from canonical snapshot ────────────────────────────────────
  const invoices: any[] = canonicalData?.invoices ?? [];
  const payments: any[] = canonicalData?.payments ?? [];

  const unpaid = useMemo(
    () => invoices
      .filter((i) => !CLOSED.includes(String(i.status)) && Number(i.balance_due ?? 0) > 0)
      .sort((a, b) => new Date(a.due_date || a.created_at).getTime()
                    - new Date(b.due_date || b.created_at).getTime()),
    [invoices],
  );
  const totalDue = unpaid.reduce((s, i) => s + Number(i.balance_due ?? 0), 0);
  const failedPayments = payments.filter((p) =>
    ["failed", "declined", "error"].includes(String(p.status ?? "").toLowerCase()));

  // ── Live context: plans, autopay, méthode, recouvrement ────────────────
  const ctxQ = useQuery({
    queryKey: ["core-payment-plan-ctx", accountId, clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const [plans, autopay, methods, collections] = await Promise.all([
        supabase.from("client_payment_plans")
          .select("id, invoice_id, total_amount, installment_count, installment_amount, frequency, first_due_date, status, reason, created_at, cancelled_at, cancelled_reason")
          .eq("user_id", clientId)
          .order("created_at", { ascending: false }),
        supabase.from("client_autopay_settings")
          .select("enabled, retry_count, last_attempt_at, payment_method_id")
          .eq("account_id", accountId).maybeSingle(),
        supabase.from("client_payment_methods")
          .select("id, brand, last4, is_default, is_active")
          .eq("account_id", accountId).eq("is_active", true)
          .order("is_default", { ascending: false }),
        supabase.from("collections_actions")
          .select("id, action_type, status, amount, notes, created_at")
          .eq("user_id", clientId)
          .in("status", ["open", "in_progress", "escalated"])
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return {
        plans: plans.data ?? [],
        autopay: autopay.data ?? null,
        methods: methods.data ?? [],
        collections: collections.data ?? [],
      };
    },
  });

  const plans = ctxQ.data?.plans ?? [];
  const activePlans = plans.filter((p: any) => p.status === "active");
  const pastPlans = plans.filter((p: any) => p.status !== "active");

  // ── Form state ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("create");
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [installments, setInstallments] = useState<number>(3);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [firstDue, setFirstDue] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [cancelPlanId, setCancelPlanId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = unpaid[0];
    if (first) {
      setInvoiceId(first.id);
      setTotalAmount(String(Number(first.balance_due).toFixed(2)));
    } else {
      setInvoiceId("");
      setTotalAmount(totalDue > 0 ? String(totalDue.toFixed(2)) : "");
    }
    setInstallments(3);
    setFrequency("monthly");
    setFirstDue(new Date().toISOString().slice(0, 10));
    setCancelPlanId(activePlans[0]?.id ?? "");
    setMode(activePlans.length > 0 && unpaid.length === 0 ? "cancel" : "create");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unpaid.length, activePlans.length]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);
  const total = Number(totalAmount || 0);
  const each = installments > 0 ? Math.round((total / installments) * 100) / 100 : 0;

  // ── Simulation (schedule) ──────────────────────────────────────────────
  const schedule = useMemo(() => {
    if (mode !== "create" || total <= 0 || installments < 2) return [];
    const base = new Date(firstDue + "T00:00:00");
    if (isNaN(base.getTime())) return [];
    const rows: Array<{ n: number; date: Date; amount: number }> = [];
    let remaining = total;
    for (let i = 0; i < installments; i++) {
      const amt = i === installments - 1
        ? Math.round(remaining * 100) / 100                       // last one absorbs rounding
        : each;
      rows.push({ n: i + 1, date: addByFreq(base, frequency, i), amount: amt });
      remaining -= amt;
    }
    return rows;
  }, [mode, total, installments, frequency, firstDue, each]);

  const lastDate = schedule.length ? schedule[schedule.length - 1].date : null;

  // ── Guards ─────────────────────────────────────────────────────────────
  const invalidTotal = mode === "create" && (!Number.isFinite(total) || total <= 0);
  const invalidCount = mode === "create" && (installments < 2 || installments > 24);
  const invalidDate  = mode === "create" && isNaN(new Date(firstDue + "T00:00:00").getTime());
  const overCap      = mode === "create" && selectedInvoice
    && total > Number(selectedInvoice.balance_due ?? 0) + 0.01;
  const noActivePlan = mode === "cancel" && !cancelPlanId;
  const disabled =
    loading ||
    (mode === "create" && (invalidTotal || invalidCount || invalidDate)) ||
    (mode === "cancel" && noActivePlan);

  // ── Impact rows ────────────────────────────────────────────────────────
  const impact: ImpactRow[] = mode === "create" ? [
    {
      label: "Plans actifs",
      before: String(activePlans.length),
      after: String(activePlans.length + 1),
      delta: "+1",
    },
    {
      label: "Montant total planifié",
      before: fmtCAD(activePlans.reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0)),
      after:  fmtCAD(activePlans.reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0) + total),
      delta: `+${fmtCAD(total)}`,
    },
    {
      label: "Nombre d'échéances",
      before: "—",
      after: String(installments),
    },
    {
      label: "Montant par échéance",
      before: "—",
      after: fmtCAD(each),
    },
    {
      label: "Fréquence",
      before: "—",
      after: FREQ_LABEL[frequency],
    },
    {
      label: "Première échéance",
      before: "—",
      after: firstDue ? format(new Date(firstDue + "T00:00:00"), "dd MMM yyyy", { locale: fr }) : "—",
    },
    {
      label: "Dernière échéance",
      before: "—",
      after: lastDate ? format(lastDate, "dd MMM yyyy", { locale: fr }) : "—",
    },
    ...(selectedInvoice ? [{
      label: `Facture ${selectedInvoice.invoice_number ?? selectedInvoice.id.slice(0, 8)}`,
      before: fmtCAD(selectedInvoice.balance_due),
      after: fmtCAD(selectedInvoice.balance_due),
      delta: "solde inchangé jusqu'aux versements",
    }] : []),
  ] : (() => {
    const p = activePlans.find((x: any) => x.id === cancelPlanId);
    return p ? [
      { label: "Plan", before: "actif", after: "annulé" },
      { label: "Total du plan", before: fmtCAD(p.total_amount), after: fmtCAD(p.total_amount) },
      { label: "Échéances", before: String(p.installment_count), after: String(p.installment_count) },
      { label: "Créé le", before: "—", after: format(new Date(p.created_at), "dd MMM yyyy", { locale: fr }) },
    ] : [];
  })();

  const impactedTables: ImpactedTable[] = mode === "create"
    ? [
        { table: "client_payment_plans", rows: 1, note: "insert status=active" },
        { table: "admin_audit_log",      rows: 1, note: "create_payment_plan" },
        { table: "email_queue",          rows: 1, note: "client_payment_plan_created" },
      ]
    : [
        { table: "client_payment_plans", rows: 1, note: "update status=cancelled" },
        { table: "admin_audit_log",      rows: 1, note: "cancel_payment_plan" },
        { table: "email_queue",          rows: 1, note: "client_payment_plan_cancelled" },
      ];

  const plannedEmails: PlannedEmail[] = [{
    template: mode === "create" ? "client_payment_plan_created" : "client_payment_plan_cancelled",
    recipient: clientEmail ?? "—",
    note: "via billing-account-actions (enqueueEmail)",
  }];

  // ── Confirm ────────────────────────────────────────────────────────────
  const onConfirm = async (reason: string) => {
    if (disabled) return;
    setLoading(true);
    try {
      if (mode === "create") {
        const res = await callCoreAction("billing-account-actions", {
          action: "create_payment_plan",
          client_user_id: clientId,
          account_id: accountId,
          invoice_id: invoiceId || null,
          total_amount: total,
          installment_count: installments,
          installment_amount: each,
          frequency,
          first_due_date: firstDue,
          reason,
          idempotency_key: `pp-${clientId}-${Date.now()}`,
        }, {
          reason,
          queryClient: qc,
          successMessage: `Plan de ${installments}× ${fmtCAD(each)} créé`,
        });
        if (res.ok) {
          ctxQ.refetch();
          onClose();
        }
      } else {
        const res = await callCoreAction("billing-account-actions", {
          action: "cancel_payment_plan",
          client_user_id: clientId,
          account_id: accountId,
          plan_id: cancelPlanId,
          reason,
        }, {
          reason,
          queryClient: qc,
          successMessage: "Plan de paiement annulé",
        });
        if (res.ok) {
          ctxQ.refetch();
          onClose();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Client context banner ──────────────────────────────────────────────
  const ap = ctxQ.data?.autopay;
  const pmDefault = ctxQ.data?.methods?.find((m: any) => m.is_default) ?? ctxQ.data?.methods?.[0];
  const openCollections = ctxQ.data?.collections ?? [];

  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Solde total dû</div>
        <div className="font-semibold text-lg">{fmtCAD(totalDue)}</div>
        <div className="text-muted-foreground">
          {unpaid.length} facture(s) · {failedPayments.length} échec(s)
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Plans</div>
        <div className="font-medium">
          {activePlans.length > 0
            ? <Badge variant="secondary">{activePlans.length} actif(s)</Badge>
            : <Badge variant="outline">Aucun</Badge>}
        </div>
        <div className="text-muted-foreground">{pastPlans.length} historique</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">AutoPay / recouvrement</div>
        <div className="font-medium">
          {ap?.enabled
            ? <Badge variant="secondary">AutoPay ON</Badge>
            : <Badge variant="outline">AutoPay OFF</Badge>}
        </div>
        <div className="text-muted-foreground">
          {pmDefault ? `${pmDefault.brand ?? "Carte"} •••• ${pmDefault.last4 ?? "—"}` : "Aucune méthode"} ·{" "}
          {openCollections.length} dossier(s)
        </div>
      </div>
    </div>
  );

  // ── État ───────────────────────────────────────────────────────────────
  const state = (
    <>
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Wallet className="h-3 w-3" /> Factures admissibles
        </div>
        {unpaid.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune facture avec solde impayé.</p>
        )}
        <div className="space-y-1">
          {unpaid.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{i.invoice_number ?? i.id.slice(0, 8)}</div>
                <div className="text-muted-foreground">
                  {i.due_date ? `Échéance ${format(new Date(i.due_date), "dd MMM yyyy", { locale: fr })}` : "—"} · {i.status}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmtCAD(i.balance_due)}</div>
                <div className="text-muted-foreground">total {fmtCAD(i.total)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Repeat className="h-3 w-3" /> Plans actifs
        </div>
        {activePlans.length === 0
          ? <p className="text-xs text-muted-foreground">Aucun plan actif.</p>
          : activePlans.map((p: any) => (
              <div key={p.id} className="flex justify-between text-xs border-b last:border-0 py-1">
                <div>
                  <div className="font-medium">
                    {p.installment_count}× {fmtCAD(p.installment_amount)} · {FREQ_LABEL[p.frequency as Frequency] ?? p.frequency}
                  </div>
                  <div className="text-muted-foreground">
                    Début {p.first_due_date ? format(new Date(p.first_due_date), "dd MMM yyyy", { locale: fr }) : "—"}
                    {p.reason ? ` · ${p.reason}` : ""}
                  </div>
                </div>
                <div className="font-semibold">{fmtCAD(p.total_amount)}</div>
              </div>
            ))}
      </div>

      {openCollections.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <b>{openCollections.length}</b> dossier(s) de recouvrement ouvert(s).
            La création d'un plan doit être coordonnée avec le recouvrement pour éviter
            les relances contradictoires.
          </AlertDescription>
        </Alert>
      )}

      {failedPayments.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {failedPayments.length} paiement(s) récent(s) en échec — un plan peut aider à régulariser
            avant d'escalader vers recouvrement.
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  // ── Historique ─────────────────────────────────────────────────────────
  const history = (
    <div className="space-y-1">
      {plans.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun historique de plan de paiement.</p>
      )}
      {plans.slice(0, 20).map((p: any) => (
        <div key={p.id} className="flex justify-between text-xs border-b last:border-0 py-1">
          <div>
            <div className="font-medium">
              {p.installment_count}× {fmtCAD(p.installment_amount)} · {FREQ_LABEL[p.frequency as Frequency] ?? p.frequency}
            </div>
            <div className="text-muted-foreground">
              Créé {format(new Date(p.created_at), "dd MMM yyyy", { locale: fr })}
              {p.cancelled_at ? ` · Annulé ${format(new Date(p.cancelled_at), "dd MMM yyyy", { locale: fr })}` : ""}
              {p.cancelled_reason ? ` · ${p.cancelled_reason}` : ""}
            </div>
          </div>
          <Badge variant={p.status === "active" ? "secondary" : "outline"}>{p.status}</Badge>
        </div>
      ))}
    </div>
  );

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Utilise exclusivement les actions canoniques <code>create_payment_plan</code> /
          <code> cancel_payment_plan</code> de <b>billing-account-actions</b>. La table cible
          est <code>client_payment_plans</code>. Aucune écriture parallèle.
        </AlertDescription>
      </Alert>

      <div>
        <Label className="mb-2 block">Action</Label>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="grid md:grid-cols-2 gap-2">
          <label className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer ${mode === "create" ? "border-primary bg-muted/40" : ""}`}>
            <RadioGroupItem value="create" id="pp-create" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="h-3 w-3" /> Créer un plan
              </div>
              <div className="text-[11px] text-muted-foreground">Étale un solde sur 2 à 24 versements.</div>
            </div>
          </label>
          <label className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer ${mode === "cancel" ? "border-primary bg-muted/40" : ""} ${activePlans.length === 0 ? "opacity-50 pointer-events-none" : ""}`}>
            <RadioGroupItem value="cancel" id="pp-cancel" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <XOctagon className="h-3 w-3" /> Annuler un plan actif
              </div>
              <div className="text-[11px] text-muted-foreground">
                {activePlans.length === 0 ? "Aucun plan actif." : `${activePlans.length} plan(s) actif(s).`}
              </div>
            </div>
          </label>
        </RadioGroup>
      </div>

      {mode === "create" && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Facture liée (optionnel)</Label>
              <Select value={invoiceId || "none"} onValueChange={(v) => {
                if (v === "none") { setInvoiceId(""); return; }
                setInvoiceId(v);
                const inv = invoices.find((i) => i.id === v);
                if (inv) setTotalAmount(String(Number(inv.balance_due).toFixed(2)));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (plan sur solde global)</SelectItem>
                  {unpaid.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_number ?? i.id.slice(0, 8)} — {fmtCAD(i.balance_due)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant total (CAD)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Nombre d'échéances</Label>
              <Input
                type="number" min={2} max={24} step={1}
                value={installments}
                onChange={(e) => setInstallments(Math.max(2, Math.min(24, Number(e.target.value) || 0)))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Entre 2 et 24.</p>
            </div>
            <div>
              <Label>Fréquence</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                    <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Première échéance</Label>
              <Input
                type="date"
                value={firstDue}
                onChange={(e) => setFirstDue(e.target.value)}
              />
            </div>
          </div>

          {overCap && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Le total dépasse le solde de la facture sélectionnée ({fmtCAD(selectedInvoice?.balance_due)}).
                Réduis le montant ou choisis « Aucune facture ».
              </AlertDescription>
            </Alert>
          )}

          {schedule.length > 0 && (
            <div className="border rounded-md p-3">
              <div className="text-xs font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" /> Échéancier prévu
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {schedule.map((s) => (
                  <div key={s.n} className="flex justify-between text-xs border-b last:border-0 py-1">
                    <div className="text-muted-foreground">
                      #{s.n} · {format(s.date, "EEE dd MMM yyyy", { locale: fr })}
                    </div>
                    <div className="font-semibold">{fmtCAD(s.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === "cancel" && (
        <div>
          <Label>Plan à annuler</Label>
          <Select value={cancelPlanId} onValueChange={setCancelPlanId}>
            <SelectTrigger><SelectValue placeholder="Choisir un plan actif" /></SelectTrigger>
            <SelectContent>
              {activePlans.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.installment_count}× {fmtCAD(p.installment_amount)} ·
                  {" "}{FREQ_LABEL[p.frequency as Frequency] ?? p.frequency} ·
                  {" "}{fmtCAD(p.total_amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const badges = mode === "create"
    ? [
        { label: `${installments}× ${fmtCAD(each)}` },
        { label: FREQ_LABEL[frequency] },
        ...(overCap ? [{ label: "Dépassement", variant: "destructive" as const }] : []),
      ]
    : [{ label: "Annulation", variant: "destructive" as const }];

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Plan de paiement"
      subtitle={`${clientName} · ${activePlans.length} plan(s) actif(s) · ${fmtCAD(totalDue)} dus`}
      clientId={clientId}
      moduleTag="payment_plan"
      badges={badges}
      clientContext={clientContext}
      state={state}
      history={history}
      actions={actions}
      impact={impact}
      impactedTables={impactedTables}
      plannedEmails={plannedEmails}
      requireReason
      disabled={disabled}
      loading={loading}
      confirmLabel={mode === "create"
        ? `Créer le plan (${installments}× ${fmtCAD(each)})`
        : "Annuler le plan sélectionné"}
      onConfirm={onConfirm}
    />
  );
}
