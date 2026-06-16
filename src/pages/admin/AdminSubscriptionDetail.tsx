/**
 * AdminSubscriptionDetail — Full subscription detail page.
 * Features: view all service lines, delete a line, change plan, add a line.
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { SectionCard } from "@/components/admin/ui/SectionCard";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { useAdminSubscriptionDetail } from "@/hooks/admin/useAdminSubscriptionDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  MapPin, User, FileText, Package, History,
  ToggleRight, ExternalLink, Pencil, Plus, Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient } from "@/integrations/backend/adminClient";

// ── helpers ─────────────────────────────────────────────────────────────────

function money(n: number | string | null | undefined) {
  return Number(n ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

function nowIso() { return new Date().toISOString(); }

// ── main page ───────────────────────────────────────────────────────────────

export default function AdminSubscriptionDetail() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const qc = useQueryClient();
  const { subscription, customer, address, invoices, audit, accountNumber, isLoading } =
    useAdminSubscriptionDetail(subscriptionId);

  // dialog states
  const [deleteSvc, setDeleteSvc] = useState<any>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showAddSvc, setShowAddSvc] = useState(false);

  // plan change form
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  // add service form
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcCode, setNewSvcCode] = useState("");
  const [newSvcType, setNewSvcType] = useState<"recurring" | "one_time" | "streaming">("recurring");
  const [newSvcPrice, setNewSvcPrice] = useState("");
  const [newSvcQty, setNewSvcQty] = useState("1");
  const [savingSvc, setSavingSvc] = useState(false);

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["admin-subscription-detail", subscriptionId] });
  };

  // ── delete service ─────────────────────────────────────────────────────
  async function handleDeleteService() {
    if (!deleteSvc) return;
    const { error } = await adminClient
      .from("billing_subscription_services")
      .update({ is_active: false, removed_at: nowIso() })
      .eq("id", deleteSvc.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Service "${deleteSvc.service_name}" désactivé`);
    setDeleteSvc(null);
    refetch();
  }

  // ── change plan ────────────────────────────────────────────────────────
  function openChangePlan() {
    setPlanName(subscription?.plan_name ?? "");
    setPlanPrice(String(subscription?.plan_price ?? ""));
    setShowChangePlan(true);
  }

  async function handleChangePlan() {
    if (!subscriptionId) return;
    const price = parseFloat(planPrice);
    if (!planName.trim() || isNaN(price) || price < 0) {
      toast.error("Nom et prix valides requis");
      return;
    }
    setSavingPlan(true);
    const { error } = await adminClient
      .from("billing_subscriptions")
      .update({ plan_name: planName.trim(), plan_price: price, updated_at: nowIso() })
      .eq("id", subscriptionId);
    setSavingPlan(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Forfait mis à jour — reflété à la prochaine facture");
    setShowChangePlan(false);
    refetch();
  }

  // ── add service ────────────────────────────────────────────────────────
  function openAddService() {
    setNewSvcName(""); setNewSvcCode(""); setNewSvcType("recurring");
    setNewSvcPrice(""); setNewSvcQty("1");
    setShowAddSvc(true);
  }

  async function handleAddService() {
    if (!subscriptionId) return;
    if (!newSvcName.trim()) { toast.error("Nom du service requis"); return; }
    const price = parseFloat(newSvcPrice || "0");
    const qty = parseInt(newSvcQty || "1", 10);
    setSavingSvc(true);
    const { error } = await adminClient
      .from("billing_subscription_services")
      .insert({
        subscription_id: subscriptionId,
        service_name: newSvcName.trim(),
        service_code: newSvcCode.trim() || newSvcName.trim().toLowerCase().replace(/\s+/g, "_"),
        service_type: newSvcType,
        unit_price: isNaN(price) ? 0 : price,
        quantity: isNaN(qty) || qty < 1 ? 1 : qty,
        is_active: newSvcType === "recurring" || newSvcType === "streaming",
        added_at: nowIso(),
      });
    setSavingSvc(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Service "${newSvcName.trim()}" ajouté`);
    setShowAddSvc(false);
    refetch();
  }

  // ── render ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-4 py-8">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AdminLayout>
    );
  }

  if (!subscription) {
    return (
      <AdminLayout>
        <div className="py-20 text-center text-muted-foreground">Abonnement introuvable</div>
      </AdminLayout>
    );
  }

  const services = [...(subscription.billing_subscription_services || [])].sort((a, b) => {
    // active recurring first
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return (a.service_name || "").localeCompare(b.service_name || "", "fr");
  });

  const clientName = customer ? `${customer.first_name} ${customer.last_name}` : "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title={subscription.plan_name}
          subtitle={`Code: ${subscription.plan_code}`}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Abonnements", href: "/admin/subscriptions" },
            { label: subscription.plan_name },
          ]}
          badge={
            <StatusBadge label={subscription.status || "—"} variant={statusToVariant(subscription.status || "")} size="md" />
          }
        />

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox label="Prix mensuel" value={money(subscription.plan_price)} />
          <MetricBox label="Début cycle" value={format(new Date(subscription.cycle_start_date), "d MMM yyyy", { locale: fr })} />
          <MetricBox label="Fin cycle" value={format(new Date(subscription.cycle_end_date), "d MMM yyyy", { locale: fr })} />
          <MetricBox label="Auto-facturation" value={subscription.auto_billing_enabled ? "Activée" : "Désactivée"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Client */}
          <SectionCard title="Client" icon={User}>
            <div className="space-y-2 text-sm">
              <Row label="Nom" value={clientName} />
              <Row label="Email" value={customer?.email || "—"} />
              <Row label="Téléphone" value={customer?.phone || "—"} />
              {accountNumber && <Row label="N° compte" value={accountNumber} mono />}
            </div>
          </SectionCard>

          {/* Address */}
          <SectionCard title="Adresse de service" icon={MapPin}>
            {address ? (
              <div className="space-y-2 text-sm">
                <Row label="Adresse" value={address.address_line1 || "—"} />
                {address.address_line2 && <Row label="" value={address.address_line2} />}
                <Row label="Ville" value={address.city || "—"} />
                <Row label="Province" value={address.province || "QC"} />
                <Row label="Code postal" value={address.postal_code || "—"} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune adresse liée</p>
            )}
          </SectionCard>
        </div>

        {/* ── Services ───────────────────────────────────────────────────── */}
        <SectionCard
          title={`Lignes de service (${services.length})`}
          icon={Package}
          noPadding
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openChangePlan}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Changer forfait
              </Button>
              <Button size="sm" onClick={openAddService}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter service
              </Button>
            </div>
          }
        >
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun service</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Service</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Prix</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-center">Qté</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc: any) => (
                  <tr key={svc.id} className={`border-b border-border/40 ${!svc.is_active ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3">
                      <span className="font-medium">{svc.service_name}</span>
                      {svc.service_code && (
                        <span className="block font-mono text-[11px] text-muted-foreground">{svc.service_code}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={svc.service_type === "recurring" ? "default" : "secondary"} className="text-[10px]">
                        {svc.service_type || "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{money(svc.unit_price)}</td>
                    <td className="px-5 py-3 text-center">{svc.quantity ?? 1}</td>
                    <td className="px-5 py-3">
                      {svc.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
                          <ToggleRight className="h-3.5 w-3.5" /> Actif
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Inactif</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {svc.is_active && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteSvc(svc)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Source commande */}
        {subscription.order_id && (
          <SectionCard title="Commande source" icon={Package}>
            <Link to={`/admin/orders/${subscription.order_id}`} className="text-sm text-primary hover:underline flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Voir la commande
            </Link>
          </SectionCard>
        )}

        {/* Factures */}
        <SectionCard title="Historique des factures" icon={FileText} noPadding>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune facture</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">N° facture</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Total</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground text-right">Solde dû</th>
                  <th className="px-5 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border/40 hover:bg-primary/5">
                    <td className="px-5 py-3">
                      <Link to={`/admin/invoices/${inv.id}`} className="font-mono text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge label={inv.status || "—"} variant={statusToVariant(inv.status || "")} size="sm" />
                    </td>
                    <td className="px-5 py-3 text-xs">{inv.type || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{money(inv.total)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {inv.balance_due > 0 ? (
                        <span className="text-red-400 font-medium">{money(inv.balance_due)}</span>
                      ) : (
                        <span className="text-muted-foreground">0,00 $</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Audit */}
        <SectionCard title="Journal d'audit" icon={History} noPadding>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucun événement</p>
          ) : (
            <div className="divide-y divide-border/40">
              {audit.map((entry: any) => (
                <div key={entry.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{entry.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {entry.created_at ? format(new Date(entry.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                    </span>
                  </div>
                  {entry.reason && <p className="text-xs text-muted-foreground mt-0.5">{entry.reason}</p>}
                  {entry.details && typeof entry.details === "object" && (
                    <pre className="text-[11px] text-muted-foreground mt-1 bg-muted/30 rounded p-2 overflow-x-auto">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Dialog: Supprimer service ──────────────────────────────────── */}
      <AlertDialog open={!!deleteSvc} onOpenChange={(o) => { if (!o) setDeleteSvc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver ce service ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteSvc?.service_name}</strong> sera marqué inactif dans cet abonnement.
              Cette action n'est pas irréversible — vous pouvez rajouter le service manuellement.
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
              <Label htmlFor="plan-name">Nom du forfait</Label>
              <Input
                id="plan-name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Ex: Internet Giga"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Prix mensuel ($)</Label>
              <Input
                id="plan-price"
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
            <Button variant="outline" onClick={() => setShowChangePlan(false)}>Annuler</Button>
            <Button onClick={handleChangePlan} disabled={savingPlan}>
              {savingPlan ? "Enregistrement…" : "Enregistrer"}
            </Button>
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
              <Label htmlFor="svc-name">Nom du service *</Label>
              <Input
                id="svc-name"
                value={newSvcName}
                onChange={(e) => setNewSvcName(e.target.value)}
                placeholder="Ex: Internet Giga"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-code">Code (optionnel)</Label>
              <Input
                id="svc-code"
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
                <Label htmlFor="svc-price">Prix ($)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newSvcPrice}
                  onChange={(e) => setNewSvcPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-qty">Quantité</Label>
                <Input
                  id="svc-qty"
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
            <Button variant="outline" onClick={() => setShowAddSvc(false)}>Annuler</Button>
            <Button onClick={handleAddService} disabled={savingSvc}>
              {savingSvc ? "Ajout…" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// ── sub-components ───────────────────────────────────────────────────────────

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {label && <span className="text-muted-foreground shrink-0">{label}</span>}
      <span className={`text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
