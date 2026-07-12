/**
 * Nivra Core — Subscription Detail (ops-grade)
 * Full subscription view with quick actions.
 */
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAdminSubscriptionDetail } from "@/core-app/hooks/useAdminSubscriptionDetail";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { corePath } from "@/core-app/lib/corePaths";
import {
  ArrowLeft, User, MapPin, Package, FileText, History,
  Zap, ExternalLink, ToggleRight, CreditCard,
  PauseCircle, PlayCircle, XCircle, ShoppingCart, Users,
  Pencil, Plus, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AccountAdjustmentsList } from "@/core-app/components/account-actions/AccountAdjustmentsList";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fmtCAD = (n: number | null | undefined) =>
  n != null ? `${n.toFixed(2)} $` : "—";
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return "—"; }
};
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return format(new Date(d), "d MMM yyyy HH:mm", { locale: fr }); } catch { return "—"; }
};

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription, customer, address, account, invoices, audit, accountNumber, isLoading } =
    useAdminSubscriptionDetail(id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── service line management ──────────────────────────────────────────────
  const [deleteSvc, setDeleteSvc] = useState<any>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showAddSvc, setShowAddSvc] = useState(false);

  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcCode, setNewSvcCode] = useState("");
  const [newSvcType, setNewSvcType] = useState<"recurring" | "one_time" | "streaming">("recurring");
  const [newSvcPrice, setNewSvcPrice] = useState("");
  const [newSvcQty, setNewSvcQty] = useState("1");
  const [savingSvc, setSavingSvc] = useState(false);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-subscription-detail", id] });
  };

  const { data: accountUuid } = useQuery({
    queryKey: ["sub-account-uuid", customer?.user_id],
    queryFn: async () => {
      if (!customer?.user_id) return null;
      const { data } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", customer.user_id)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!customer?.user_id,
  });

  async function handleDeleteService() {
    if (!deleteSvc) return;
    const { error } = await supabase
      .from("billing_subscription_services")
      .update({ is_active: false, removed_at: new Date().toISOString() })
      .eq("id", deleteSvc.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Service "${deleteSvc.service_name}" désactivé`);
    setDeleteSvc(null);
    refetch();
  }

  function openChangePlan() {
    setPlanName(subscription?.plan_name ?? "");
    setPlanPrice(String(subscription?.plan_price ?? ""));
    setShowChangePlan(true);
  }

  async function handleChangePlan() {
    if (!id) return;
    const price = parseFloat(planPrice);
    if (!planName.trim() || isNaN(price) || price < 0) {
      toast.error("Nom et prix valides requis");
      return;
    }
    setSavingPlan(true);
    // Phase 6.2 — canonical: rpc_admin_change_subscription_plan
    const { error } = await supabase.rpc("rpc_admin_change_subscription_plan", {
      p_subscription_id: id,
      p_new_plan_name: planName.trim(),
      p_new_plan_price: price,
      p_new_plan_code: subscription?.plan_code ?? null,
      p_reason: "core_ui_plan_change",
      p_context: { source: "SubscriptionDetailPage" },
    });
    setSavingPlan(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Forfait mis à jour — reflété à la prochaine facture");
    setShowChangePlan(false);
    refetch();
  }

  function openAddService() {
    setNewSvcName(""); setNewSvcCode(""); setNewSvcType("recurring");
    setNewSvcPrice(""); setNewSvcQty("1");
    setShowAddSvc(true);
  }

  async function handleAddService() {
    if (!id) return;
    if (!newSvcName.trim()) { toast.error("Nom du service requis"); return; }
    const price = parseFloat(newSvcPrice || "0");
    const qty = parseInt(newSvcQty || "1", 10);
    setSavingSvc(true);
    const { error } = await supabase
      .from("billing_subscription_services")
      .insert({
        subscription_id: id,
        service_name: newSvcName.trim(),
        service_code: newSvcCode.trim() || newSvcName.trim().toLowerCase().replace(/\s+/g, "_"),
        service_type: newSvcType,
        unit_price: isNaN(price) ? 0 : price,
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
        is_active: newSvcType === "recurring" || newSvcType === "streaming",
        added_at: new Date().toISOString(),
      });
    setSavingSvc(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Service "${newSvcName.trim()}" ajouté`);
    setShowAddSvc(false);
    refetch();
  }

  const updateStatus = async (newStatus: string, label: string) => {
    if (!id || !subscription) return;
    setActionLoading(newStatus);
    try {
      // Phase 6.2 — canonical: state_machine RPCs (audit is written inside the RPC)
      const rpcName =
        newStatus === "suspended" ? "suspend_subscription" :
        newStatus === "active" ? "reactivate_subscription" :
        newStatus === "cancelled" ? "cancel_subscription" :
        null;
      if (!rpcName) throw new Error(`Unsupported status transition: ${newStatus}`);
      const { error } = await supabase.rpc(rpcName as any, {
        p_subscription_id: id,
        p_reason: `core_ui_${label}`,
        p_context: { source: "SubscriptionDetailPage", label },
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-subscription-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      toast.success(`Abonnement ${label.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 rounded bg-[hsl(220,15%,14%)] animate-pulse" />
        <div className="h-40 w-full rounded-lg bg-[hsl(220,15%,14%)] animate-pulse" />
        <div className="h-40 w-full rounded-lg bg-[hsl(220,15%,14%)] animate-pulse" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center py-20">
        <p className="text-[hsl(220,10%,40%)] text-sm">Abonnement introuvable</p>
        <Link to={corePath("/subscriptions")} className="text-emerald-400 text-xs hover:underline mt-2 inline-block">
          ← Retour aux abonnements
        </Link>
      </div>
    );
  }

  const services = subscription.billing_subscription_services || [];
  const clientName = customer ? `${customer.first_name} ${customer.last_name}` : "—";
  const status = subscription.status || "";
  const isActive = status === "active";
  const isSuspended = status === "suspended";
  const isCancelled = status === "cancelled";

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link
          to={corePath("/subscriptions")}
          className="flex items-center gap-1 text-[hsl(220,10%,45%)] hover:text-white text-xs transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Abonnements
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">{subscription.plan_name}</h1>
          <p className="text-[12px] text-[hsl(220,10%,45%)] font-mono mt-0.5">{subscription.plan_code}</p>
        </div>
        <StatusBadge
          label={status || "—"}
          variant={statusToVariant(status)}
          size="md"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions
        status={status}
        isActive={isActive}
        isSuspended={isSuspended}
        isCancelled={isCancelled}
        actionLoading={actionLoading}
        orderId={subscription.order_id}
        customerId={subscription.customer_id}
        customer={customer}
        onSuspend={() => updateStatus("suspended", "Suspendu")}
        onResume={() => updateStatus("active", "Réactivé")}
        onCancel={() => updateStatus("cancelled", "Annulé")}
        navigate={navigate}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="Prix mensuel" value={fmtCAD(subscription.plan_price)} accent />
        <KPI label="Jour de facturation" value={account?.billing_cycle_day ? `Jour ${account.billing_cycle_day}` : fmtDate(subscription.cycle_start_date)} />
        <KPI label="Prochaine facture" value={account?.next_invoice_date ? fmtDate(account.next_invoice_date) : fmtDate(subscription.cycle_end_date)} />
        <KPI
          label="Auto-facturation"
          value={subscription.auto_billing_enabled ? "Activée" : "Désactivée"}
          icon={subscription.auto_billing_enabled ? <Zap className="h-3.5 w-3.5 text-emerald-400" /> : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client */}
        <Section title="Client" icon={User}>
          <Row label="Nom" value={clientName} />
          <Row label="Email" value={customer?.email || "—"} />
          <Row label="Téléphone" value={customer?.phone || "—"} />
          {accountNumber && <Row label="N° compte" value={accountNumber} mono />}
        </Section>

        {/* Address */}
        <Section title="Adresse de service" icon={MapPin}>
          {address ? (
            <>
              <Row label="Adresse" value={address.address_line1 || "—"} />
              {address.address_line2 && <Row label="" value={address.address_line2} />}
              <Row label="Ville" value={address.city || "—"} />
              <Row label="Province" value={address.province || "QC"} />
              <Row label="Code postal" value={address.postal_code || "—"} />
            </>
          ) : account?.primary_service_address ? (
            <>
              <Row label="Adresse" value={account.primary_service_address} />
              <Row label="Ville" value={account.primary_service_city || "—"} />
              <Row label="Province" value={account.primary_service_province || "QC"} />
              <Row label="Code postal" value={account.primary_service_postal_code || "—"} />
            </>
          ) : (
            <p className="text-[hsl(220,10%,35%)] text-xs">Aucune adresse liée</p>
          )}
        </Section>
      </div>

      {/* Subscription details */}
      <Section title="Détails de l'abonnement" icon={Package}>
        <Row label="Type de service" value={subscription.service_category || "—"} />
        <Row label="Plan" value={subscription.plan_name || "—"} />
        <Row label="Date d'activation" value={fmtDate(subscription.created_at)} />
        <Row label="Cycle de facturation" value={`${fmtDate(subscription.cycle_start_date)} → ${fmtDate(subscription.cycle_end_date)}`} />
        <Row label="Jour de facturation" value={account?.billing_cycle_day ? `Jour ${account.billing_cycle_day} du mois` : "—"} />
        <Row label="Prochaine facturation" value={account?.next_invoice_date ? fmtDate(account.next_invoice_date) : fmtDate(subscription.cycle_end_date)} />
        <Row label="Statut" value={status || "—"} />
      </Section>

      {/* Services inclus */}
      <SectionWithActions
        title={`Services inclus (${services.length})`}
        icon={Package}
        actions={
          <div className="flex gap-2">
            <button
              onClick={openChangePlan}
              className="flex items-center gap-1 rounded border border-[hsl(220,15%,20%)] px-2.5 py-1 text-[11px] text-[hsl(220,10%,55%)] hover:text-white hover:border-emerald-500/30 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Changer forfait
            </button>
            <button
              onClick={openAddService}
              className="flex items-center gap-1 rounded border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Plus className="h-3 w-3" /> Ajouter service
            </button>
          </div>
        }
      >
        {services.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucun service inclus</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["Service", "Code", "Type", "Prix unitaire", "Qté", "Statut", ""].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] ${i === 3 ? "text-right" : i === 4 ? "text-center" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...services].sort((a: any, b: any) => (a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1)).map((svc: any) => (
                  <tr key={svc.id} className={`border-b border-[hsl(220,15%,14%)] last:border-0 ${!svc.is_active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 text-white font-medium">{svc.service_name}</td>
                    <td className="px-4 py-2.5 font-mono text-[hsl(220,10%,50%)]">{svc.service_code}</td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,55%)]">{svc.service_type || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{fmtCAD(svc.unit_price)}</td>
                    <td className="px-4 py-2.5 text-center text-white">{svc.quantity}</td>
                    <td className="px-4 py-2.5">
                      {svc.is_active ? (
                        <ToggleRight className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <span className="text-[hsl(220,10%,35%)]">Inactif</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {svc.is_active && (
                        <button
                          onClick={() => setDeleteSvc(svc)}
                          className="text-[hsl(220,10%,35%)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionWithActions>

      {/* Rabais et crédits actifs sur ce compte */}
      <AccountAdjustmentsList accountId={accountUuid ?? undefined} />

      {/* Source order */}
      {subscription.order_id && (
        <Section title="Commande source" icon={CreditCard}>
          <Link
            to={corePath(`/orders/${subscription.order_id}`)}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Voir la commande
          </Link>
        </Section>
      )}

      {/* Invoices */}
      <Section title="Historique des factures" icon={FileText} noPad>
        {invoices.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucune facture</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(220,15%,16%)]">
                  {["N° facture", "Statut", "Type", "Total", "Solde dû", "Date"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] ${i === 3 || i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={corePath(`/invoices/${inv.id}`)} className="font-mono text-emerald-400 hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,55%)]">{inv.type || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtCAD(inv.total)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {inv.balance_due > 0 ? (
                        <span className="text-red-400 font-medium">{fmtCAD(inv.balance_due)}</span>
                      ) : (
                        <span className="text-[hsl(220,10%,35%)]">0,00 $</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[hsl(220,10%,45%)] whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Audit trail */}
      <Section title="Journal d'audit" icon={History} noPad>
        {audit.length === 0 ? (
          <p className="text-[hsl(220,10%,35%)] text-xs text-center py-6">Aucun événement</p>
        ) : (
          <div className="divide-y divide-[hsl(220,15%,14%)]">
            {audit.map((entry: any) => (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{entry.action}</span>
                  <span className="text-[10px] text-[hsl(220,10%,40%)]">{fmtDateTime(entry.created_at)}</span>
                </div>
                {entry.reason && <p className="text-[11px] text-[hsl(220,10%,45%)] mt-0.5">{entry.reason}</p>}
                {entry.details && typeof entry.details === "object" && (
                  <pre className="text-[10px] text-[hsl(220,10%,40%)] mt-1 bg-[hsl(220,20%,8%)] rounded p-2 overflow-x-auto">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Dialog: Désactiver service ─────────────────────────────────── */}
      <AlertDialog open={!!deleteSvc} onOpenChange={(o) => { if (!o) setDeleteSvc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver ce service ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteSvc?.service_name}</strong> sera marqué inactif dans cet abonnement.
              Vous pouvez le rajouter manuellement si nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteService} className="bg-destructive hover:bg-destructive/90">
              Désactiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Changer forfait ────────────────────────────────────── */}
      <Dialog open={showChangePlan} onOpenChange={setShowChangePlan}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Changer le forfait principal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="core-plan-name">Nom du forfait</Label>
              <Input
                id="core-plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Ex: Internet Giga"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="core-plan-price">Prix mensuel ($)</Label>
              <Input
                id="core-plan-price"
                type="number"
                min="0"
                step="0.01"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Le changement s'applique à la prochaine facture générée.
            </p>
          </div>
          <DialogFooter>
            <button onClick={() => setShowChangePlan(false)} className="rounded border border-[hsl(220,15%,20%)] px-3 py-1.5 text-xs text-[hsl(220,10%,55%)] hover:text-white transition-colors">
              Annuler
            </button>
            <button onClick={handleChangePlan} disabled={savingPlan} className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs text-white font-medium disabled:opacity-50 transition-colors">
              {savingPlan ? "Enregistrement…" : "Enregistrer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Ajouter service ────────────────────────────────────── */}
      <Dialog open={showAddSvc} onOpenChange={setShowAddSvc}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter une ligne de service</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="core-svc-name">Nom du service *</Label>
              <Input
                id="core-svc-name"
                value={newSvcName}
                onChange={(e) => setNewSvcName(e.target.value)}
                placeholder="Ex: Internet Giga"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="core-svc-code">Code (optionnel)</Label>
              <Input
                id="core-svc-code"
                value={newSvcCode}
                onChange={(e) => setNewSvcCode(e.target.value)}
                placeholder="internet_giga"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newSvcType} onValueChange={(v) => setNewSvcType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Récurrent</SelectItem>
                  <SelectItem value="one_time">Frais unique</SelectItem>
                  <SelectItem value="streaming">Streaming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="core-svc-price">Prix ($)</Label>
                <Input
                  id="core-svc-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSvcPrice}
                  onChange={(e) => setNewSvcPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="core-svc-qty">Quantité</Label>
                <Input
                  id="core-svc-qty"
                  type="number"
                  min="1"
                  value={newSvcQty}
                  onChange={(e) => setNewSvcQty(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Les lignes récurrentes seront incluses dans la prochaine facture.
            </p>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAddSvc(false)} className="rounded border border-[hsl(220,15%,20%)] px-3 py-1.5 text-xs text-[hsl(220,10%,55%)] hover:text-white transition-colors">
              Annuler
            </button>
            <button onClick={handleAddService} disabled={savingSvc} className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs text-white font-medium disabled:opacity-50 transition-colors">
              {savingSvc ? "Ajout…" : "Ajouter"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Quick Actions Bar ── */
function QuickActions({
  status, isActive, isSuspended, isCancelled, actionLoading,
  orderId, customerId, customer, onSuspend, onResume, onCancel, navigate,
}: {
  status: string;
  isActive: boolean;
  isSuspended: boolean;
  isCancelled: boolean;
  actionLoading: string | null;
  orderId: string | null;
  customerId: string;
  customer: any;
  onSuspend: () => void;
  onResume: () => void;
  onCancel: () => void;
  navigate: (path: string) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const handleConfirm = (action: string, fn: () => void) => {
    if (confirmAction === action) {
      fn();
      setConfirmAction(null);
    } else {
      setConfirmAction(action);
    }
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium mb-2.5">Actions rapides</p>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Suspend */}
        {isActive && (
          <ActionBtn
            icon={PauseCircle}
            label={confirmAction === "suspend" ? "Confirmer suspension" : "Suspendre"}
            variant={confirmAction === "suspend" ? "warning-confirm" : "warning"}
            loading={actionLoading === "suspended"}
            onClick={() => handleConfirm("suspend", onSuspend)}
          />
        )}

        {/* Resume */}
        {isSuspended && (
          <ActionBtn
            icon={PlayCircle}
            label={confirmAction === "resume" ? "Confirmer réactivation" : "Réactiver"}
            variant={confirmAction === "resume" ? "success-confirm" : "success"}
            loading={actionLoading === "active"}
            onClick={() => handleConfirm("resume", onResume)}
          />
        )}

        {/* Cancel */}
        {!isCancelled && (
          <ActionBtn
            icon={XCircle}
            label={confirmAction === "cancel" ? "Confirmer annulation" : "Annuler l'abonnement"}
            variant={confirmAction === "cancel" ? "danger-confirm" : "danger"}
            loading={actionLoading === "cancelled"}
            onClick={() => handleConfirm("cancel", onCancel)}
          />
        )}

        {/* Divider */}
        <div className="h-5 w-px bg-[hsl(220,15%,18%)] mx-1" />

        {/* Open linked order */}
        {orderId && (
          <ActionBtn
            icon={ShoppingCart}
            label="Voir la commande"
            variant="neutral"
            onClick={() => navigate(corePath(`/orders/${orderId}`))}
          />
        )}

        {/* Open account */}
        {customer?.user_id && (
          <ActionBtn
            icon={Users}
            label="Voir le compte"
            variant="neutral"
            onClick={() => navigate(corePath(`/accounts/${customer.user_id}`))}
          />
        )}
      </div>
    </div>
  );
}

/* ── Action Button ── */
type ActionVariant = "warning" | "warning-confirm" | "success" | "success-confirm" | "danger" | "danger-confirm" | "neutral";

function ActionBtn({ icon: Icon, label, variant, loading, onClick }: {
  icon: any; label: string; variant: ActionVariant; loading?: boolean; onClick: () => void;
}) {
  const styles: Record<ActionVariant, string> = {
    warning: "border-amber-500/20 text-amber-400 hover:bg-amber-500/10",
    "warning-confirm": "border-amber-500/40 bg-amber-500/15 text-amber-300 font-semibold",
    success: "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10",
    "success-confirm": "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-semibold",
    danger: "border-red-500/20 text-red-400 hover:bg-red-500/10",
    "danger-confirm": "border-red-500/40 bg-red-500/15 text-red-300 font-semibold",
    neutral: "border-[hsl(220,15%,18%)] text-[hsl(220,10%,55%)] hover:text-white hover:border-emerald-500/30",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {loading ? "..." : label}
    </button>
  );
}

/* ── Reusable sub-components ── */

function KPI({ label, value, accent, icon }: { label: string; value: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[hsl(220,10%,40%)] font-medium">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {icon}
        <p className={`text-lg font-bold tabular-nums ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, noPad }: { title: string; icon: any; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[hsl(220,15%,16%)]">
        <Icon className="h-4 w-4 text-[hsl(220,10%,45%)]" />
        <h2 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className={noPad ? "" : "px-4 py-3 space-y-2"}>
        {children}
      </div>
    </div>
  );
}

function SectionWithActions({ title, icon: Icon, children, actions }: {
  title: string; icon: any; children: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(220,15%,16%)]">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[hsl(220,10%,45%)]" />
          <h2 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h2>
        </div>
        {actions && <div>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      {label && <span className="text-[hsl(220,10%,45%)] shrink-0">{label}</span>}
      <span className={`text-white ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
