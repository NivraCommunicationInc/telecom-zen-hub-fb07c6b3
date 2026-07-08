/**
 * PlanChangeModule — Client 360 Upgrade/Downgrade command center.
 *
 * Un véritable module métier (Lot 1.1 module-pilote) :
 *  - Onglet État: forfait actuel, services actifs, équipements, promotions, cycle, MRR
 *  - Onglet Historique: derniers changements de forfait (service_change_requests)
 *  - Onglet Audit: admin_audit_log filtré via ClientModuleShell
 *  - Onglet Actions: sélection nouveau forfait + simulation impact multi-domaine + confirmation
 *
 * Aucune écriture directe : passe par `core-apply-plan-change` (Edge Function)
 * qui wrap la RPC canonique `apply_plan_change`.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Package, ArrowRightCircle, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

export function PlanChangeModule({ open, onClose, accountId, clientId, clientName, subscriptions }: Props) {
  const qc = useQueryClient();
  const activeSubs = useMemo(
    () => (subscriptions || []).filter((s) => s.status === "active" || s.status === "trial"),
    [subscriptions],
  );

  const [subscriptionId, setSubscriptionId] = useState<string>(activeSubs[0]?.id ?? "");
  const [changeType, setChangeType] = useState<"upgrade" | "downgrade" | "add_service" | "remove_service">("upgrade");
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  const selectedSub = activeSubs.find((s) => s.id === subscriptionId);

  // ── Live simulation (RPC canonique) ─────────────────────
  const simQuery = useQuery({
    queryKey: ["core-sim-plan-change", accountId, subscriptionId, newPlanCode, newPlanName, newPlanPrice, changeType],
    enabled: open && !!accountId && !!newPlanName && newPlanPrice !== "" && Number(newPlanPrice) >= 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("core_simulate_plan_change" as any, {
        p_account_id: accountId,
        p_subscription_id: subscriptionId || null,
        p_new_plan_code: newPlanCode || newPlanName,
        p_new_plan_name: newPlanName,
        p_new_plan_price: Number(newPlanPrice),
        p_change_type: changeType,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const sim = simQuery.data;
  const ctx = sim?.current_context;
  const impact = sim?.impact;

  // ── Onglet ÉTAT ─────────────────────────────────────────
  const stateTab = (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="MRR actuel" value={fmtCAD(activeSubs.reduce((s, x) => s + Number(x.plan_price || 0), 0))} accent />
        <StatCard label="Services actifs" value={String(activeSubs.length)} />
      </div>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Abonnements actifs</h4>
        <div className="space-y-2">
          {activeSubs.length === 0 && <p className="text-muted-foreground">Aucun abonnement actif.</p>}
          {activeSubs.map((s) => (
            <div key={s.id} className="border rounded-md p-2 flex justify-between items-start">
              <div>
                <div className="font-medium">{s.plan_name || s.frozen_name || "Forfait"}</div>
                <div className="text-xs text-muted-foreground">
                  {s.service_category || "—"} · Cycle {s.cycle_start_date} → {s.cycle_end_date}
                </div>
              </div>
              <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
              <div className="text-right font-semibold">{fmtCAD(s.plan_price)}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
          <Package className="h-3 w-3" /> Équipements actuellement reliés
        </h4>
        <EquipmentList clientId={clientId} />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Promotions actives sur le compte</h4>
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
        <div key={h.id} className="border rounded-md p-2">
          <div className="flex justify-between text-xs">
            <span className="font-semibold uppercase">{h.change_type}</span>
            <span className="text-muted-foreground">
              {format(new Date(h.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
            </span>
          </div>
          <div className="mt-1">
            <span className="text-muted-foreground">{h.current_plan_name || "—"}</span>
            <ArrowRightCircle className="inline h-3 w-3 mx-1" />
            <span className="font-medium">{h.requested_plan_name}</span>
            <span className="ml-2 text-primary">{fmtCAD(h.requested_plan_price)}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs">
            <Badge variant={h.status === "approved" ? "default" : h.status === "pending" ? "secondary" : "outline"}>
              {h.status}
            </Badge>
            {h.effective_date && <span className="text-muted-foreground">Effectif: {h.effective_date}</span>}
          </div>
          {h.notes && <p className="mt-1 text-xs text-muted-foreground italic">{h.notes}</p>}
        </div>
      ))}
    </div>
  );

  // ── Onglet ACTIONS + Simulation ─────────────────────────
  const actionsTab = (
    <div className="space-y-4 text-sm">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          La simulation se met à jour en direct pendant que tu remplis le formulaire.
          Aucune écriture n'est effectuée avant que tu cliques <b>Confirmer</b>.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type de changement</Label>
          <Select value={changeType} onValueChange={(v: any) => setChangeType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upgrade">Upgrade (immédiat, prorata)</SelectItem>
              <SelectItem value="downgrade">Downgrade (prochain renouvellement)</SelectItem>
              <SelectItem value="add_service">Ajouter un service (immédiat)</SelectItem>
              <SelectItem value="remove_service">Retirer un service (prochain renouvellement)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Abonnement concerné</Label>
          <Select value={subscriptionId} onValueChange={setSubscriptionId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
            <SelectContent>
              {activeSubs.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.plan_name || s.frozen_name} — {fmtCAD(s.plan_price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Code du nouveau forfait</Label>
          <Input value={newPlanCode} onChange={(e) => setNewPlanCode(e.target.value)} placeholder="ex: INT-FIBRE-1G" />
        </div>
        <div>
          <Label>Nom du nouveau forfait</Label>
          <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="Internet Fibre 1 Gbps" />
        </div>
        <div>
          <Label>Prix mensuel nouveau forfait ($ CAD)</Label>
          <Input type="number" step="0.01" value={newPlanPrice}
            onChange={(e) => setNewPlanPrice(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        {selectedSub && (
          <div>
            <Label>Prix mensuel actuel</Label>
            <div className="h-10 flex items-center px-3 border rounded-md bg-muted/40">
              {fmtCAD(selectedSub.plan_price)}
            </div>
          </div>
        )}
      </div>

      {simQuery.isFetching && (
        <p className="text-xs text-muted-foreground italic">Calcul de la simulation…</p>
      )}
      {simQuery.error && (
        <Alert variant="destructive">
          <AlertDescription>Erreur simulation : {(simQuery.error as any).message}</AlertDescription>
        </Alert>
      )}

      {impact && (
        <div className="border-2 border-primary/40 rounded-md p-3 bg-primary/5 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            {changeType === "upgrade" && <ArrowUpCircle className="h-4 w-4 text-green-600" />}
            {changeType === "downgrade" && <ArrowDownCircle className="h-4 w-4 text-amber-600" />}
            Simulation d'impact — ce qui va se produire à la confirmation
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Delta prix mensuel" value={fmtCAD(impact.price_delta_monthly)} />
            <Metric label="Prorata immédiat" value={impact.prorata_immediate ? fmtCAD(impact.prorata_amount) : "—"} />
            <Metric label="Prochaine facture" value={fmtCAD(impact.next_invoice_impact)} />
            <Metric label="MRR après" value={fmtCAD(ctx?.mrr_after_change)} accent />
          </div>

          {(impact.equipment_to_ship?.length > 0) && (
            <div>
              <div className="text-xs font-semibold text-amber-600">📦 Équipement à expédier</div>
              <ul className="text-xs list-disc pl-4">
                {impact.equipment_to_ship.map((e: any, i: number) => (
                  <li key={i}>{e.catalog_hint} × {e.quantity} — {e.reason} ({fmtCAD(e.unit_price)})</li>
                ))}
              </ul>
            </div>
          )}
          {(impact.equipment_to_return?.length > 0) && (
            <div>
              <div className="text-xs font-semibold text-red-600">↩️ Équipement à retourner</div>
              <ul className="text-xs list-disc pl-4">
                {impact.equipment_to_return.map((e: any) => (
                  <li key={e.id}>{e.catalog_name} (SN: {e.serial_number || "—"}) — {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold">📧 Communications planifiées</div>
            <ul className="text-xs list-disc pl-4">
              {impact.communications_planned?.map((c: any, i: number) => (
                <li key={i}>Template <code>{c.template}</code> → {c.to}</li>
              ))}
            </ul>
          </div>
          {impact.requires_provisioning && (
            <Badge variant="secondary">Provisioning requis</Badge>
          )}
          {impact.requires_appointment && (
            <Badge variant="secondary" className="ml-2">Rendez-vous suggéré (installation)</Badge>
          )}
        </div>
      )}
    </div>
  );

  const impactRows: ImpactRow[] = impact ? [
    { label: "Forfait", before: ctx?.previous_plan_name || "—", after: newPlanName || "—", delta: changeType },
    { label: "Prix mensuel", before: fmtCAD(ctx?.previous_plan_price), after: fmtCAD(newPlanPrice || 0), delta: fmtCAD(impact.price_delta_monthly) },
    { label: "MRR", before: fmtCAD(ctx?.mrr_current), after: fmtCAD(ctx?.mrr_after_change), delta: fmtCAD((ctx?.mrr_after_change || 0) - (ctx?.mrr_current || 0)) },
    ...(impact.prorata_immediate ? [{ label: "Prorata facturé", before: "—", after: fmtCAD(impact.prorata_amount), delta: "immédiat" }] : []),
  ] : [];

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Upgrade / Downgrade de forfait"
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
      disabled={!sim || !newPlanName || newPlanPrice === ""}
      confirmLabel="Confirmer et appliquer"
      onConfirm={async (reason) => {
        if (!sim) return;
        setLoading(true);
        const res = await callCoreAction("core-apply-plan-change", {
          account_id: accountId,
          subscription_id: subscriptionId || null,
          new_plan_code: newPlanCode || newPlanName,
          new_plan_name: newPlanName,
          new_plan_price: Number(newPlanPrice),
          change_type: changeType,
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`border rounded-md p-3 ${accent ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-bold text-primary" : "font-medium"}>{value}</span>
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
        <div key={e.id} className="border rounded p-2 text-xs flex justify-between">
          <div>
            <span className="font-medium">{e.catalog_name}</span>
            <span className="text-muted-foreground"> · SN {e.serial_number || "—"}</span>
            {e.mac_address && <span className="text-muted-foreground"> · MAC {e.mac_address}</span>}
          </div>
          <Badge variant="outline">{e.category || "—"}</Badge>
          <Badge>{e.status}</Badge>
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
        <div key={p.id} className="border rounded p-2 text-xs flex justify-between">
          <div>
            <span className="font-medium">{p.label || p.promo_code}</span>
            <span className="text-muted-foreground"> · {p.promotion_type || "—"}</span>
            {p.months_remaining != null && <span className="text-muted-foreground"> · {p.months_remaining} mois restants</span>}
          </div>
          <span className="font-semibold text-primary">−{fmtCAD(p.amount)}</span>
        </div>
      ))}
    </div>
  );
}
