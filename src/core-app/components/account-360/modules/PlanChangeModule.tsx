/**
 * PlanChangeModule — Client 360 Upgrade/Downgrade command center.
 *
 * Vrai centre de contrôle métier :
 *  - En-tête synthèse: forfait actuel, prix, cycle, prochain renouvellement, MRR
 *  - Onglet État: services actifs (détail), équipements, promotions
 *  - Onglet Historique: derniers changements
 *  - Onglet Audit: admin_audit_log via ClientModuleShell
 *  - Onglet Actions:
 *      1. Sélection abonnement source
 *      2. Sélection nouveau forfait depuis le CATALOGUE (pas texte libre)
 *      3. Choix du timing (immédiat / prochain cycle)
 *      4. Comparaison côte à côte avant/après
 *      5. Simulation d'impact multi-domaine
 *
 * Aucune écriture directe — Edge Function `core-apply-plan-change`.
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Info, Package, ArrowRightCircle, ArrowUpCircle, ArrowDownCircle,
  CalendarClock, Zap, Clock, Wallet, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  clientName: string;
  subscriptions: any[];
}

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

const fmtDate = (d: string | null | undefined) =>
  !d ? "—" : format(new Date(d), "dd MMM yyyy", { locale: fr });

export function PlanChangeModule({ open, onClose, accountId, clientId, clientName, subscriptions }: Props) {
  const qc = useQueryClient();
  const activeSubs = useMemo(
    () => (subscriptions || []).filter((s) => s.status === "active" || s.status === "trial"),
    [subscriptions],
  );

  const [subscriptionId, setSubscriptionId] = useState<string>(activeSubs[0]?.id ?? "");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [timing, setTiming] = useState<"immediate" | "next_cycle">("immediate");
  const [loading, setLoading] = useState(false);

  const selectedSub = activeSubs.find((s) => s.id === subscriptionId);
  const currentCategory = selectedSub?.service_category ?? null;
  const currentPrice = Number(selectedSub?.plan_price || 0);

  // ── Catalogue: 100% des forfaits disponibles (catalogue officiel Nivra) ─
  const catalogQ = useQuery({
    queryKey: ["core-plan-catalog-full"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("services")
        .select("id, plan_code, name, category, price, short_description, is_featured, is_recommended, is_active, status")
        .or("is_active.eq.true,status.eq.active")
        .order("category")
        .order("price");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedPlan = catalogQ.data?.find((p: any) => p.id === selectedPlanId);
  const newPrice = Number(selectedPlan?.price || 0);
  const priceDelta = newPrice - currentPrice;
  const inferredType: "upgrade" | "downgrade" | "add_service" =
    priceDelta > 0 ? "upgrade" : priceDelta < 0 ? "downgrade" : "upgrade";
  const changeType = timing === "immediate" ? inferredType : inferredType;

  // reset timing default based on inferred direction
  useEffect(() => {
    if (priceDelta < 0) setTiming("next_cycle");
    else if (priceDelta > 0) setTiming("immediate");
  }, [selectedPlanId, priceDelta]);

  // ── Live simulation (RPC canonique) ─────────────────────
  const simQuery = useQuery({
    queryKey: ["core-sim-plan-change", accountId, subscriptionId, selectedPlanId, timing],
    enabled: open && !!accountId && !!selectedPlan,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("core_simulate_plan_change" as any, {
        p_account_id: accountId,
        p_subscription_id: subscriptionId || null,
        p_new_plan_code: selectedPlan!.plan_code || selectedPlan!.name,
        p_new_plan_name: selectedPlan!.name,
        p_new_plan_price: newPrice,
        p_change_type: changeType,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const sim = simQuery.data;
  const ctx = sim?.current_context;
  const impact = sim?.impact;

  // ── En-tête synthèse ────────────────────────────────────
  const totalMrr = activeSubs.reduce((s, x) => s + Number(x.plan_price || 0), 0);
  const summaryHeader = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <SummaryTile icon={Zap} label="Forfait actuel"
        value={selectedSub?.plan_name || selectedSub?.frozen_name || "—"}
        subtitle={selectedSub?.service_category || ""} />
      <SummaryTile icon={Wallet} label="Prix mensuel" value={fmtCAD(currentPrice)}
        subtitle={`MRR compte: ${fmtCAD(totalMrr)}`} accent />
      <SummaryTile icon={CalendarClock} label="Cycle courant"
        value={selectedSub ? `${fmtDate(selectedSub.cycle_start_date)}` : "—"}
        subtitle={`→ ${fmtDate(selectedSub?.cycle_end_date)}`} />
      <SummaryTile icon={Clock} label="Prochain renouvellement"
        value={fmtDate(selectedSub?.next_renewal_at || selectedSub?.cycle_end_date)}
        subtitle="Base facturation" />
    </div>
  );

  // ── Onglet ÉTAT ─────────────────────────────────────────
  const stateTab = (
    <div className="space-y-4 text-sm">
      {summaryHeader}

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Tous les abonnements actifs ({activeSubs.length})</h4>
        <div className="space-y-2">
          {activeSubs.length === 0 && <p className="text-muted-foreground">Aucun abonnement actif.</p>}
          {activeSubs.map((s) => (
            <button key={s.id} onClick={() => setSubscriptionId(s.id)}
              className={cn(
                "w-full text-left border rounded-md p-3 flex justify-between items-start transition",
                s.id === subscriptionId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
              )}>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">{s.plan_name || s.frozen_name || "Forfait"}</div>
                <div className="text-xs text-muted-foreground">
                  {s.service_category || "—"} · Cycle {fmtDate(s.cycle_start_date)} → {fmtDate(s.cycle_end_date)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                <span className="font-semibold text-foreground">{fmtCAD(s.plan_price)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <Package className="h-3 w-3" /> Équipements rattachés
        </h4>
        <EquipmentList clientId={clientId} />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Promotions actives</h4>
        <PromotionsList accountId={accountId} />
      </section>
    </div>
  );

  // ── Onglet HISTORIQUE ───────────────────────────────────
  const historyQ = useQuery({
    queryKey: ["core-plan-change-history", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_change_requests")
        .select("id, change_type, current_plan_name, requested_plan_name, requested_plan_price, status, effective_date, applied_at, created_at, notes")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
  const historyTab = (
    <div className="space-y-2 text-sm">
      {historyQ.isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {historyQ.data?.length === 0 && <p className="text-muted-foreground">Aucun changement de forfait antérieur.</p>}
      {historyQ.data?.map((h: any) => (
        <div key={h.id} className="border border-border rounded-md p-3 bg-background/40">
          <div className="flex justify-between text-xs">
            <Badge variant="outline" className="uppercase">{h.change_type}</Badge>
            <span className="text-muted-foreground">
              {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">{h.current_plan_name || "—"}</span>
            <ArrowRightCircle className="h-3 w-3" />
            <span className="font-medium">{h.requested_plan_name}</span>
            <span className="text-primary">{fmtCAD(h.requested_plan_price)}</span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <Badge variant={h.status === "approved" ? "default" : h.status === "pending" ? "secondary" : "outline"}>
              {h.status}
            </Badge>
            {h.effective_date && <span className="text-muted-foreground">Effectif: {fmtDate(h.effective_date)}</span>}
          </div>
          {h.notes && <p className="mt-1 text-xs text-muted-foreground italic">{h.notes}</p>}
        </div>
      ))}
    </div>
  );

  // ── Onglet ACTIONS ──────────────────────────────────────
  const DeltaIcon = priceDelta > 0 ? TrendingUp : priceDelta < 0 ? TrendingDown : Minus;
  const deltaColor = priceDelta > 0 ? "text-emerald-500" : priceDelta < 0 ? "text-amber-500" : "text-muted-foreground";

  const actionsTab = (
    <div className="space-y-5 text-sm">
      {summaryHeader}

      <Alert className="bg-primary/5 border-primary/30">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-foreground">
          Sélectionne un forfait du catalogue puis un timing. La simulation se met à jour automatiquement.
          Aucune écriture avant <b>Confirmer</b>.
        </AlertDescription>
      </Alert>

      {/* Étape 1 — Abonnement source */}
      <div>
        <StepHeader n={1} title="Abonnement à modifier" />
        <Select value={subscriptionId} onValueChange={setSubscriptionId}>
          <SelectTrigger><SelectValue placeholder="Sélectionner l'abonnement" /></SelectTrigger>
          <SelectContent>
            {activeSubs.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.plan_name || s.frozen_name} — {fmtCAD(s.plan_price)} — {s.service_category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Étape 2 — Nouveau forfait (catalogue) */}
      <div>
        <StepHeader n={2} title={`Nouveau forfait${currentCategory ? ` — catalogue ${currentCategory}` : ""}`} />
        {catalogQ.isLoading && <p className="text-muted-foreground text-xs">Chargement du catalogue…</p>}
        {catalogQ.data && catalogQ.data.length === 0 && (
          <p className="text-muted-foreground text-xs">Aucun forfait actif dans cette catégorie.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {catalogQ.data?.map((p: any) => {
            const isCurrent = selectedSub && (p.plan_code === selectedSub.plan_code || p.name === selectedSub.plan_name);
            const isSelected = p.id === selectedPlanId;
            const delta = Number(p.price) - currentPrice;
            return (
              <button key={p.id}
                disabled={isCurrent}
                onClick={() => setSelectedPlanId(p.id)}
                className={cn(
                  "text-left border rounded-md p-3 transition relative",
                  isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted/40",
                  isCurrent && "opacity-60 cursor-not-allowed",
                )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.plan_code}</div>
                    {p.short_description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.short_description}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-foreground">{fmtCAD(p.price)}</div>
                    <div className="text-[10px] text-muted-foreground">/ mois</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {isCurrent && <Badge variant="secondary">Forfait actuel</Badge>}
                  {!isCurrent && selectedSub && (
                    <Badge variant={delta > 0 ? "default" : delta < 0 ? "outline" : "secondary"}>
                      {delta > 0 ? `+${fmtCAD(delta)} upgrade` : delta < 0 ? `${fmtCAD(delta)} downgrade` : "Même prix"}
                    </Badge>
                  )}
                  {p.is_recommended && <Badge variant="outline">Recommandé</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Étape 3 — Timing */}
      {selectedPlan && (
        <div>
          <StepHeader n={3} title="Timing d'application" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <TimingCard active={timing === "immediate"} onClick={() => setTiming("immediate")}
              icon={Zap} title="Immédiat" desc="Prise d'effet aujourd'hui. Facturation prorata au différentiel." />
            <TimingCard active={timing === "next_cycle"} onClick={() => setTiming("next_cycle")}
              icon={CalendarClock} title="Prochain cycle"
              desc={`Prise d'effet au ${fmtDate(selectedSub?.cycle_end_date)}. Pas de prorata.`} />
          </div>
        </div>
      )}

      {/* Étape 4 — Comparaison + impact */}
      {selectedPlan && (
        <div>
          <StepHeader n={4} title="Comparaison & impact" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            <ComparisonCard title="Avant" variant="muted"
              planName={selectedSub?.plan_name || "—"}
              planCode={selectedSub?.plan_code}
              price={currentPrice}
              category={selectedSub?.service_category} />
            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <div className={cn("flex items-center gap-1 font-semibold", deltaColor)}>
                <DeltaIcon className="h-5 w-5" />
                {priceDelta > 0 ? "Upgrade" : priceDelta < 0 ? "Downgrade" : "Latéral"}
              </div>
              <div className={cn("text-lg font-bold", deltaColor)}>
                {priceDelta >= 0 ? "+" : ""}{fmtCAD(priceDelta)}
              </div>
              <div className="text-[11px] text-muted-foreground">delta mensuel</div>
            </div>
            <ComparisonCard title="Après" variant="primary"
              planName={selectedPlan.name}
              planCode={selectedPlan.plan_code}
              price={newPrice}
              category={selectedPlan.category} />
          </div>

          {simQuery.isFetching && (
            <p className="text-xs text-muted-foreground italic mt-2">Calcul de la simulation…</p>
          )}
          {simQuery.error && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>Erreur simulation : {(simQuery.error as any).message}</AlertDescription>
            </Alert>
          )}

          {impact && (
            <div className="border-2 border-primary/40 rounded-md p-4 bg-primary/5 space-y-3 mt-3">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                {priceDelta > 0 ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> : <ArrowDownCircle className="h-4 w-4 text-amber-500" />}
                Simulation d'impact — ce qui va se produire à la confirmation
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Delta mensuel" value={fmtCAD(impact.price_delta_monthly)} />
                <Metric label="Prorata immédiat" value={impact.prorata_immediate ? fmtCAD(impact.prorata_amount) : "—"} />
                <Metric label="Prochaine facture" value={fmtCAD(impact.next_invoice_impact)} />
                <Metric label="MRR après" value={fmtCAD(ctx?.mrr_after_change)} accent />
              </div>

              {(impact.equipment_to_ship?.length > 0) && (
                <div className="border-t pt-2">
                  <div className="text-xs font-semibold text-amber-500 mb-1">📦 Équipement à expédier</div>
                  <ul className="text-xs list-disc pl-4 text-foreground">
                    {impact.equipment_to_ship.map((e: any, i: number) => (
                      <li key={i}>{e.catalog_hint} × {e.quantity} — {e.reason} ({fmtCAD(e.unit_price)})</li>
                    ))}
                  </ul>
                </div>
              )}
              {(impact.equipment_to_return?.length > 0) && (
                <div className="border-t pt-2">
                  <div className="text-xs font-semibold text-red-500 mb-1">↩️ Équipement à retourner</div>
                  <ul className="text-xs list-disc pl-4 text-foreground">
                    {impact.equipment_to_return.map((e: any) => (
                      <li key={e.id}>{e.catalog_name} (SN: {e.serial_number || "—"}) — {e.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="border-t pt-2">
                <div className="text-xs font-semibold mb-1 text-foreground">📧 Communications planifiées</div>
                <ul className="text-xs list-disc pl-4 text-muted-foreground">
                  {impact.communications_planned?.map((c: any, i: number) => (
                    <li key={i}>Template <code className="text-foreground">{c.template}</code> → {c.to}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 flex-wrap">
                {impact.requires_provisioning && <Badge variant="secondary">Provisioning requis</Badge>}
                {impact.requires_appointment && <Badge variant="secondary">Rendez-vous suggéré</Badge>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const impactRows: ImpactRow[] = impact && selectedPlan ? [
    { label: "Forfait", before: ctx?.previous_plan_name || "—", after: selectedPlan.name, delta: inferredType },
    { label: "Prix mensuel", before: fmtCAD(ctx?.previous_plan_price), after: fmtCAD(newPrice), delta: fmtCAD(impact.price_delta_monthly) },
    { label: "MRR", before: fmtCAD(ctx?.mrr_current), after: fmtCAD(ctx?.mrr_after_change), delta: fmtCAD((ctx?.mrr_after_change || 0) - (ctx?.mrr_current || 0)) },
    { label: "Timing", before: "—", after: timing === "immediate" ? "Immédiat" : `Prochain cycle (${fmtDate(selectedSub?.cycle_end_date)})`, delta: "" },
    ...(impact.prorata_immediate ? [{ label: "Prorata facturé", before: "—", after: fmtCAD(impact.prorata_amount), delta: "immédiat" }] : []),
  ] : [];

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Upgrade / Downgrade — Centre de contrôle"
      subtitle={`${clientName} — module de gestion complète`}
      clientId={clientId}
      moduleTag="core.plan_change"
      badges={[
        { label: `${activeSubs.length} service(s) actif(s)`, variant: "secondary" },
        ...(sim ? [{ label: "Simulation prête", variant: "default" as const }] : []),
      ]}
      state={stateTab}
      history={historyTab}
      actions={actionsTab}
      impact={impactRows}
      requireReason
      loading={loading}
      disabled={!sim || !selectedPlan}
      confirmLabel="Confirmer et appliquer"
      onConfirm={async (reason) => {
        if (!sim || !selectedPlan) return;
        setLoading(true);
        const res = await callCoreAction("core-apply-plan-change", {
          account_id: accountId,
          subscription_id: subscriptionId || null,
          new_plan_code: selectedPlan.plan_code || selectedPlan.name,
          new_plan_name: selectedPlan.name,
          new_plan_price: newPrice,
          change_type: changeType,
          timing,
          return_equipment_ids: impact?.equipment_to_return?.map((e: any) => e.id) ?? [],
          simulation_snapshot: sim,
        }, {
          reason,
          successMessage: "Changement de forfait appliqué",
          queryClient: qc,
        });
        setLoading(false);
        if (res.ok) onClose();
      }}
    />
  );
}

// ── UI primitives ──────────────────────────────────────────
function SummaryTile({ icon: Icon, label, value, subtitle, accent }: {
  icon: any; label: string; value: string; subtitle?: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-md p-3",
      accent ? "border-primary/40 bg-primary/5" : "border-border bg-background/40",
    )}>
      <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("text-sm font-bold text-foreground truncate", accent && "text-primary")}>{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
    </div>
  );
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{n}</span>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    </div>
  );
}

function TimingCard({ active, onClick, icon: Icon, title, desc }: {
  active: boolean; onClick: () => void; icon: any; title: string; desc: string;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "text-left border rounded-md p-3 transition",
        active ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted/40",
      )}>
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Icon className="h-4 w-4" /> {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}

function ComparisonCard({ title, variant, planName, planCode, price, category }: {
  title: string; variant: "muted" | "primary"; planName: string;
  planCode?: string | null; price: number; category?: string | null;
}) {
  return (
    <div className={cn(
      "border rounded-md p-3 flex flex-col gap-1",
      variant === "primary" ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30",
    )}>
      <div className="text-[10px] uppercase text-muted-foreground">{title}</div>
      <div className="font-semibold text-foreground">{planName}</div>
      {planCode && <div className="text-[11px] text-muted-foreground">{planCode}</div>}
      {category && <Badge variant="outline" className="self-start">{category}</Badge>}
      <div className={cn("text-xl font-bold mt-1", variant === "primary" ? "text-primary" : "text-foreground")}>
        {fmtCAD(price)}<span className="text-[10px] font-normal text-muted-foreground"> /mois</span>
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
      <span className={cn("text-base font-semibold text-foreground", accent && "text-primary")}>{value}</span>
    </div>
  );
}

function EquipmentList({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["module-equipment", clientId],
    queryFn: async () => {
      const { data: orders } = await supabase.from("orders").select("id").eq("user_id", clientId);
      const ids = (orders || []).map((o) => o.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, serial_number, mac_address, category, status")
        .in("order_id", ids);
      return data || [];
    },
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Chargement…</p>;
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">Aucun équipement rattaché.</p>;
  return (
    <div className="space-y-1">
      {data.map((e: any) => (
        <div key={e.id} className="border border-border rounded p-2 text-xs flex justify-between items-center gap-2">
          <div className="min-w-0">
            <span className="font-medium text-foreground">{e.catalog_name}</span>
            <span className="text-muted-foreground"> · SN {e.serial_number || "—"}</span>
            {e.mac_address && <span className="text-muted-foreground"> · MAC {e.mac_address}</span>}
          </div>
          <div className="flex gap-1 shrink-0">
            <Badge variant="outline">{e.category || "—"}</Badge>
            <Badge>{e.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PromotionsList({ accountId }: { accountId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["module-account-promos", accountId],
    queryFn: async () => {
      const { data } = await supabase.from("account_promotions")
        .select("id, label, amount, promo_code, months_remaining, expires_at, promotion_type, is_active")
        .eq("account_id", accountId).eq("is_active", true);
      return data || [];
    },
  });
  if (isLoading) return <p className="text-xs text-muted-foreground">Chargement…</p>;
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground">Aucune promotion active.</p>;
  return (
    <div className="space-y-1">
      {data.map((p: any) => (
        <div key={p.id} className="border border-border rounded p-2 text-xs flex justify-between">
          <div>
            <span className="font-medium text-foreground">{p.label}</span>
            <span className="text-muted-foreground"> · {p.promo_code || p.promotion_type}</span>
          </div>
          <div className="text-right">
            <div className="text-primary font-semibold">{fmtCAD(p.amount)}</div>
            {p.months_remaining != null && <div className="text-muted-foreground">{p.months_remaining} mois restant(s)</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
