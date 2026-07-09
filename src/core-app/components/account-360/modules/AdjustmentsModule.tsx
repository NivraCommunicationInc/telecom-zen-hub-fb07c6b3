/**
 * AdjustmentsModule — Client 360 unified "Ajustements compte" center.
 *
 * Fusionne 4 workflows canoniques en un seul centre de contrôle :
 *   - Crédit récurrent   → account_adjustments (type=credit)
 *   - Frais récurrent    → account_adjustments (type=fee)
 *   - Promotion durée    → account_promotions
 *   - Radiation facture  → collections_actions (writeoff, admin only)
 *
 * Aucune logique parallèle :
 *  - Les crédits/frais sont appliqués mensuellement par billing-lifecycle.
 *  - Les promotions sont consommées par generate_account_renewal_invoice.
 *  - Le write-off est délégué à collections-account-actions.
 *
 * Écriture unique via Edge Function core-apply-adjustment. Simulation
 * serveur via RPC core_simulate_adjustment. Audit + réactivité identiques
 * au standard PlanChange / RecordPayment / Refund.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Minus, Tag as TagIcon, Ban, Info, AlertTriangle,
  DollarSign, Calendar, Gift, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Kind = "credit" | "fee" | "promotion" | "invoice_writeoff";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  clientUserId?: string | null;   // auth user id — required for writeoff via collections
  clientName: string;
  clientEmail?: string | null;
  canonicalData: any;
}

const KIND_META: Record<Kind, { label: string; icon: any; color: string; hint: string }> = {
  credit:           { label: "Crédit récurrent",       icon: Minus,   color: "emerald", hint: "Réduit la facture du client pendant N cycles. Appliqué automatiquement par billing-lifecycle." },
  fee:              { label: "Frais récurrent",        icon: Plus,    color: "amber",   hint: "Ajoute une ligne de frais sur les N prochaines factures (ré-installation, matériel non retourné, etc.)." },
  promotion:        { label: "Promotion durée",        icon: TagIcon, color: "violet",  hint: "Rabais mensuel appliqué automatiquement à la facturation de renouvellement pendant N mois." },
  invoice_writeoff: { label: "Radiation de facture",   icon: Ban,     color: "red",     hint: "Marque une facture impayée comme radiée (bad debt). Réservé aux admins — passe par collections_actions." },
};

const PROMOTION_TYPES = [
  { value: "monthly_discount", label: "Rabais mensuel" },
  { value: "credit",           label: "Crédit promotionnel" },
  { value: "promo",            label: "Promo code" },
];

const MONTH_OPTIONS = [1, 3, 6, 12, 24];
const CLOSED = ["paid", "paid_by_promo", "void", "cancelled", "refunded", "written_off", "bad_debt"];

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

export function AdjustmentsModule({
  open, onClose, accountId, clientId, clientUserId, clientName, clientEmail, canonicalData,
}: Props) {
  const qc = useQueryClient();

  const invoices: any[] = canonicalData?.invoices ?? [];
  const openInvoices = useMemo(
    () => invoices
      .filter((i) => !CLOSED.includes(String(i.status)) && Number(i.balance_due ?? 0) > 0)
      .sort((a, b) => new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime()),
    [invoices],
  );

  const [kind, setKind] = useState<Kind>("credit");
  const [amount, setAmount] = useState<string>("");
  const [months, setMonths] = useState<number>(3);
  const [description, setDescription] = useState<string>("");
  const [promotionType, setPromotionType] = useState<string>("monthly_discount");
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("credit"); setAmount(""); setMonths(3);
      setDescription(""); setPromotionType("monthly_discount");
      setInvoiceId(openInvoices[0]?.id ?? "");
    }
  }, [open, openInvoices.length]);

  // ── Contexte : ajustements + promotions actifs ─────────────────────────
  const ctxQ = useQuery({
    queryKey: ["core-adjustments-ctx", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const [adj, promo] = await Promise.all([
        supabase.from("account_adjustments")
          .select("id, type, amount, description, months_total, months_remaining, applied_count, status, created_at")
          .eq("account_id", accountId).order("created_at", { ascending: false }).limit(50),
        supabase.from("account_promotions")
          .select("id, label, promotion_type, amount, duration_months, months_remaining, is_active, started_at, expires_at")
          .eq("account_id", accountId).order("started_at", { ascending: false }).limit(50),
      ]);
      return { adjustments: adj.data ?? [], promotions: promo.data ?? [] };
    },
  });

  const adjustments = ctxQ.data?.adjustments ?? [];
  const promotions = ctxQ.data?.promotions ?? [];
  const activeCredits = adjustments.filter((a: any) => a.type === "credit" && a.status === "active");
  const activeFees    = adjustments.filter((a: any) => a.type === "fee"    && a.status === "active");
  const activePromos  = promotions.filter((p: any) => p.is_active && p.months_remaining > 0);

  const sumMonthly = (arr: any[]) => arr.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const activeCreditMonthly = sumMonthly(activeCredits);
  const activeFeeMonthly    = sumMonthly(activeFees);
  const activePromoMonthly  = sumMonthly(activePromos);

  // ── Simulation ─────────────────────────────────────────────────────────
  const amt = Number(amount || 0);
  const simEnabled = open && (
    kind === "invoice_writeoff"
      ? !!invoiceId
      : amt > 0 && months >= 1 && months <= 24
  );

  const simQ = useQuery({
    queryKey: ["core-simulate-adjustment", accountId, kind, amt, months, invoiceId],
    enabled: simEnabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("core_simulate_adjustment", {
        p_account_id: accountId,
        p_kind:       kind,
        p_amount:     kind === "invoice_writeoff" ? 0 : amt,
        p_months:     kind === "invoice_writeoff" ? 1 : months,
        p_invoice_id: kind === "invoice_writeoff" ? invoiceId : null,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  // ── Impact chiffré ─────────────────────────────────────────────────────
  const impact: ImpactRow[] = useMemo(() => {
    if (!simQ.data) return [];
    if (kind === "invoice_writeoff") {
      const inv = simQ.data.invoice ?? {};
      return [
        { label: "Facture",     before: inv.invoice_number ?? "—", after: inv.invoice_number ?? "—" },
        { label: "Solde",       before: fmtCAD(inv.balance_due), after: fmtCAD(inv.balance_due), delta: "inchangé" },
        { label: "Statut",      before: String(inv.status ?? "—"), after: "radiée (collections)", delta: "→ bad debt" },
      ];
    }
    const b = simQ.data.before ?? {};
    const a = simQ.data.after ?? {};
    return [
      { label: "Crédits actifs / mois",   before: fmtCAD(b.active_credits_monthly), after: fmtCAD(a.active_credits_monthly) },
      { label: "Frais actifs / mois",     before: fmtCAD(b.active_fees_monthly),    after: fmtCAD(a.active_fees_monthly) },
      { label: "Promotions actives / mois", before: fmtCAD(b.active_promos_monthly), after: fmtCAD(a.active_promos_monthly) },
      { label: "Durée",                   before: "—",  after: `${months} mois`, delta: `total ${fmtCAD(amt * months)}` },
    ];
  }, [simQ.data, kind, amt, months]);

  const impactedTables: ImpactedTable[] = useMemo(() => {
    if (kind === "invoice_writeoff") {
      return [
        { table: "collections_actions", rows: 1, note: "action=writeoff" },
        { table: "admin_audit_log",     rows: 1, note: "core_adjustment_writeoff" },
      ];
    }
    if (kind === "promotion") {
      return [
        { table: "account_promotions", rows: 1, note: `${promotionType} × ${months} mois` },
        { table: "admin_audit_log",    rows: 1, note: "core_adjustment_promotion" },
        { table: "billing_invoices (renewal)", note: "appliqué à chaque facture de renouvellement" },
      ];
    }
    return [
      { table: "account_adjustments", rows: 1, note: `type=${kind} · months=${months}` },
      { table: "admin_audit_log",     rows: 1, note: `core_adjustment_${kind}` },
      { table: "billing_invoices (lifecycle)", note: "ligne insérée à chaque cycle par billing-lifecycle" },
    ];
  }, [kind, months, promotionType]);

  // Aucun template client officiel n'existe pour ces ajustements
  // → aucun email transactionnel n'est envoyé (portail sync uniquement).
  const plannedEmails: PlannedEmail[] = [];

  // ── Guards ─────────────────────────────────────────────────────────────
  const disabled =
    loading ||
    (kind === "invoice_writeoff"
      ? !invoiceId || !clientUserId
      : amt <= 0 || months < 1 || months > 24 || description.trim().length < 3);

  const onConfirm = async (reason: string) => {
    if (disabled) return;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { kind, client_id: clientId };
      if (kind === "invoice_writeoff") {
        payload.invoice_id = invoiceId;
        payload.client_user_id = clientUserId;
        payload.account_id = accountId;
      } else {
        payload.account_id = accountId;
        payload.amount = amt;
        payload.months = months;
        payload.description = description.trim();
        if (kind === "promotion") {
          payload.label = description.trim();
          payload.promotion_type = promotionType;
        }
      }
      const res = await callCoreAction("core-apply-adjustment", payload, {
        reason,
        queryClient: qc,
        successMessage:
          kind === "invoice_writeoff"
            ? "Facture radiée (collections)"
            : `${KIND_META[kind].label} appliqué`,
      });
      if (res.ok) onClose();
    } finally {
      setLoading(false);
    }
  };

  // ── Bandeau contexte ───────────────────────────────────────────────────
  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Crédits actifs / mois</div>
        <div className="font-semibold text-lg">{fmtCAD(activeCreditMonthly)}</div>
        <div className="text-muted-foreground">{activeCredits.length} actif(s)</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Frais actifs / mois</div>
        <div className="font-semibold text-lg">{fmtCAD(activeFeeMonthly)}</div>
        <div className="text-muted-foreground">{activeFees.length} actif(s)</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Promotions actives / mois</div>
        <div className="font-semibold text-lg">{fmtCAD(activePromoMonthly)}</div>
        <div className="text-muted-foreground">{activePromos.length} en cours</div>
      </div>
    </div>
  );

  // ── État actuel ────────────────────────────────────────────────────────
  const state = (
    <div className="space-y-3">
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Gift className="h-3 w-3" /> Crédits & Frais actifs</div>
        {adjustments.filter((a: any) => a.status === "active").length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun ajustement actif.</p>
        )}
        <div className="space-y-1">
          {adjustments.filter((a: any) => a.status === "active").map((a: any) => (
            <div key={a.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {a.type === "credit"
                    ? <Badge variant="secondary">Crédit</Badge>
                    : <Badge variant="outline" className="text-amber-500 border-amber-500/40">Frais</Badge>}
                  {a.description ?? "—"}
                </div>
                <div className="text-muted-foreground">
                  {a.applied_count ?? 0}/{a.months_total ?? "?"} appliqué(s) · reste {a.months_remaining ?? 0} mois
                </div>
              </div>
              <div className="font-semibold">{fmtCAD(a.amount)}/mois</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-3 w-3" /> Promotions actives</div>
        {activePromos.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune promotion en cours.</p>
        )}
        <div className="space-y-1">
          {activePromos.map((p: any) => (
            <div key={p.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{p.label} <Badge variant="outline">{p.promotion_type}</Badge></div>
                <div className="text-muted-foreground">
                  Reste {p.months_remaining}/{p.duration_months} mois · démarrée {p.started_at ? format(new Date(p.started_at), "dd MMM yyyy", { locale: fr }) : "—"}
                </div>
              </div>
              <div className="font-semibold">{fmtCAD(p.amount)}/mois</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2"><DollarSign className="h-3 w-3" /> Factures ouvertes (candidates radiation)</div>
        {openInvoices.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune facture ouverte.</p>
        )}
        <div className="space-y-1">
          {openInvoices.map((i) => (
            <div key={i.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{i.invoice_number ?? i.id.slice(0, 8)}</div>
                <div className="text-muted-foreground">
                  {i.due_date ? `Échéance ${format(new Date(i.due_date), "dd MMM yyyy", { locale: fr })}` : "—"} · {i.status}
                </div>
              </div>
              <div className="font-semibold">{fmtCAD(i.balance_due)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Historique ─────────────────────────────────────────────────────────
  const history = (
    <div className="space-y-1">
      {[...adjustments, ...promotions.map((p: any) => ({
        id: `p-${p.id}`, type: "promotion", description: p.label,
        amount: p.amount, applied_count: (p.duration_months ?? 0) - (p.months_remaining ?? 0),
        months_total: p.duration_months, status: p.is_active ? "active" : "ended",
        created_at: p.started_at,
      }))]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30)
        .map((x: any) => (
          <div key={x.id} className="flex justify-between text-xs border-b last:border-0 py-1">
            <div>
              <div className="font-medium flex items-center gap-2">
                <Badge variant="outline">{x.type}</Badge>
                {x.description ?? "—"}
              </div>
              <div className="text-muted-foreground">
                {x.created_at ? format(new Date(x.created_at), "dd MMM yyyy", { locale: fr }) : "—"}
                {" · "}{x.applied_count ?? 0}/{x.months_total ?? "?"} · {x.status}
              </div>
            </div>
            <div className="font-semibold">{fmtCAD(x.amount)}</div>
          </div>
        ))}
      {adjustments.length === 0 && promotions.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun ajustement enregistré pour ce compte.</p>
      )}
    </div>
  );

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Centre unifié — un seul module orchestre les 4 workflows Nivra existants
          (account_adjustments · account_promotions · collections_actions).
          Aucune écriture parallèle : les crédits/frais sont appliqués par billing-lifecycle,
          les promotions par generate_account_renewal_invoice, la radiation par collections-account-actions.
        </AlertDescription>
      </Alert>

      <div>
        <Label className="mb-2 block">Type d'ajustement</Label>
        <div className="grid md:grid-cols-4 gap-2">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const M = KIND_META[k];
            const Icon = M.icon;
            const active = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`text-left border rounded-md p-2 transition-all ${active ? "border-primary bg-muted/40" : "hover:border-muted-foreground/40"}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-3 w-3" /> {M.label}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{M.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {kind !== "invoice_writeoff" ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label>Montant / mois (CAD)</Label>
              <Input
                type="number" step="0.01" min="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Durée (mois)</Label>
              <Input
                type="number" min={1} max={24}
                value={months}
                onChange={(e) => setMonths(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
              />
              <div className="flex gap-1 mt-1">
                {MONTH_OPTIONS.map(m => (
                  <button
                    key={m} onClick={() => setMonths(m)}
                    className={`text-[10px] rounded border px-2 py-0.5 ${months === m ? "border-primary text-primary" : "text-muted-foreground"}`}
                  >{m}m</button>
                ))}
              </div>
            </div>
            {kind === "promotion" && (
              <div>
                <Label>Sous-type promotion</Label>
                <Select value={promotionType} onValueChange={setPromotionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROMOTION_TYPES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label>Libellé (affiché sur la facture)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "credit"     ? "Ex: Crédit dédommagement panne du 3 avril"
                : kind === "fee"      ? "Ex: Frais de ré-installation"
                : "Ex: Rabais fidélité 20 $ / mois"
              }
            />
            {description.trim().length < 3 && (
              <p className="text-[11px] text-muted-foreground mt-1">Min. 3 caractères — texte visible par le client.</p>
            )}
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>Facture à radier</Label>
            <Select value={invoiceId} onValueChange={setInvoiceId}>
              <SelectTrigger><SelectValue placeholder="Choisir une facture ouverte" /></SelectTrigger>
              <SelectContent>
                {openInvoices.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.invoice_number ?? i.id.slice(0, 8)} — {fmtCAD(i.balance_due)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedInvoice && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Solde impayé {fmtCAD(selectedInvoice.balance_due)} · statut {selectedInvoice.status}
              </p>
            )}
          </div>
          {!clientUserId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Impossible de radier : le compte n'a pas d'utilisateur portail lié (client_user_id manquant).
                Passer par le module Recouvrement à la place.
              </AlertDescription>
            </Alert>
          )}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Réservé aux admins. Action journalisée dans <code>collections_actions</code> (action=writeoff)
              — le module Recouvrement voit immédiatement l'entrée.
            </AlertDescription>
          </Alert>
        </>
      )}

      {simQ.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Simulation impossible : {(simQ.error as any)?.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  const kindMeta = KIND_META[kind];

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Ajustements compte"
      subtitle={`${clientName} · ${activeCredits.length} crédit(s) · ${activeFees.length} frais · ${activePromos.length} promo · ${openInvoices.length} facture(s) ouverte(s)`}
      clientId={clientId}
      moduleTag="adjustments"
      badges={[
        { label: kindMeta.label },
        ...(kind === "invoice_writeoff" ? [{ label: "Admin only", variant: "destructive" as const }] : []),
      ]}
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
      confirmLabel={
        kind === "invoice_writeoff"
          ? "Confirmer la radiation"
          : `Appliquer ${fmtCAD(amt)} × ${months} mois`
      }
      onConfirm={onConfirm}
    />
  );
}
