/**
 * AccountServicesTab — Full telecom service management workspace
 * View all services with real statuses, plan change, lifecycle actions, linked equipment/address
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Wifi, Tv, Smartphone, Play, Package, MapPin, PlusCircle, MoreHorizontal,
  Pause, RotateCcw, XCircle, Settings, ArrowUpDown, Eye, HardDrive, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AccountServicesTabProps {
  subscriptions: any[];
  serviceAddresses: any[];
  account: any;
  locations: any[];
}

const categoryIcons: Record<string, any> = {
  internet: Wifi, tv: Tv, mobile: Smartphone, streaming: Play,
};
const categoryLabels: Record<string, string> = {
  internet: "Internet", tv: "Télévision", mobile: "Mobile", streaming: "Streaming",
};
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "default" },
  pending: { label: "En attente", variant: "outline" },
  suspended: { label: "Suspendu", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
  expired: { label: "Expiré", variant: "destructive" },
  provisioning: { label: "Provisionnement", variant: "outline" },
  provisioning_failed: { label: "Échec provision.", variant: "destructive" },
  installed: { label: "Installé", variant: "default" },
  awaiting_activation: { label: "Attente activation", variant: "outline" },
};
const filterOptions = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "suspended", label: "Suspendus" },
  { value: "pending", label: "En attente" },
  { value: "cancelled", label: "Annulés" },
];

export function AccountServicesTab({ subscriptions, serviceAddresses, account, locations }: AccountServicesTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionSub, setActionSub] = useState<any>(null);
  const [actionType, setActionType] = useState<"suspend" | "resume" | "cancel" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailSub, setDetailSub] = useState<any>(null);
  const [changePlanSub, setChangePlanSub] = useState<any>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [changePlanReason, setChangePlanReason] = useState("");

  const clientId = account?.client_id;

  // Fetch service_instances for richer status data
  const { data: serviceInstances } = useQuery({
    queryKey: ["account-service-instances", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("service_instances")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Fetch equipment lines for linking display
  const { data: equipmentLines } = useQuery({
    queryKey: ["account-service-equipment", account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("account_id", account.id);
      if (!orders?.length) return [];
      const { data, error } = await supabase
        .from("equipment_order_lines")
        .select("*")
        .in("order_id", orders.map((o: any) => o.id));
      if (error) throw error;
      return data || [];
    },
    enabled: !!account?.id,
  });

  // Filter subscriptions
  const filteredSubs = statusFilter === "all"
    ? subscriptions
    : subscriptions.filter((s: any) => s.status === statusFilter);

  // Group subscriptions by address
  const byAddress: Record<string, { address: any; subs: any[] }> = {};
  const primaryKey = "primary";
  byAddress[primaryKey] = {
    address: {
      label: "Principal",
      service_address: account?.primary_service_address,
      service_city: account?.primary_service_city,
      service_postal_code: account?.primary_service_postal_code,
    },
    subs: [],
  };
  locations.forEach((loc: any) => {
    byAddress[loc.id] = { address: loc, subs: [] };
  });
  filteredSubs.forEach((sub: any) => {
    if (sub.address_id && byAddress[sub.address_id]) {
      byAddress[sub.address_id].subs.push(sub);
    } else {
      byAddress[primaryKey].subs.push(sub);
    }
  });
  const addressGroups = Object.entries(byAddress).filter(
    ([key, val]) => key === primaryKey || val.subs.length > 0
  );

  // Find matching service_instance for a subscription
  const findServiceInstance = (sub: any) => {
    return serviceInstances?.find((si: any) =>
      si.order_id === sub.order_id ||
      (si.plan_name === sub.plan_name && si.service_type === sub.service_category)
    );
  };

  // Find equipment for a subscription's order
  const findEquipment = (sub: any) => {
    if (!sub.order_id) return [];
    return equipmentLines?.filter((eq: any) => eq.order_id === sub.order_id) || [];
  };

  const handleServiceAction = async () => {
    if (!actionSub || !actionType) return;
    setSaving(true);
    try {
      const newStatus = actionType === "suspend" ? "suspended" : actionType === "resume" ? "active" : "cancelled";
      const { error } = await supabase
        .from("billing_subscriptions")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", actionSub.id);
      if (error) throw error;

      // Also update service_instance if exists
      const si = findServiceInstance(actionSub);
      if (si) {
        await supabase.from("service_instances").update({
          status: newStatus,
          status_changed_at: new Date().toISOString(),
          status_changed_by: user?.id || null,
          status_reason: actionReason || null,
        }).eq("id", si.id);
      }

      // Audit trail
      await supabase.from("billing_subscription_trace_audit").insert({
        subscription_id: actionSub.id,
        customer_id: actionSub.customer_id,
        action: `service_${actionType}`,
        reason: actionReason || null,
        actor_admin_id: user?.id || null,
        details: { plan: actionSub.plan_name, previous_status: actionSub.status, new_status: newStatus },
      });

      // Activity log
      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        action_type: `service_${actionType}`,
        summary: `Service "${actionSub.plan_name}" ${actionType === "suspend" ? "suspendu" : actionType === "resume" ? "réactivé" : "annulé"}. Raison: ${actionReason || "N/A"}`,
      });

      toast.success(
        actionType === "suspend" ? "Service suspendu" : actionType === "resume" ? "Service réactivé" : "Service annulé"
      );
      setActionSub(null);
      setActionType(null);
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["account-profile-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["account-service-instances"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePlan = async () => {
    if (!changePlanSub || !newPlanName.trim() || !newPlanCode.trim()) return;
    setSaving(true);
    try {
      const oldPlan = { name: changePlanSub.plan_name, code: changePlanSub.plan_code, price: changePlanSub.plan_price };
      const priceNum = parseFloat(newPlanPrice) || changePlanSub.plan_price;

      const { error } = await supabase
        .from("billing_subscriptions")
        .update({
          plan_name: newPlanName.trim(),
          plan_code: newPlanCode.trim(),
          plan_price: priceNum,
          updated_at: new Date().toISOString(),
        })
        .eq("id", changePlanSub.id);
      if (error) throw error;

      // Update service_instance if exists
      const si = findServiceInstance(changePlanSub);
      if (si) {
        await supabase.from("service_instances").update({
          plan_name: newPlanName.trim(),
          monthly_price: priceNum,
          updated_at: new Date().toISOString(),
        }).eq("id", si.id);
      }

      // Audit trail
      await supabase.from("billing_subscription_trace_audit").insert({
        subscription_id: changePlanSub.id,
        customer_id: changePlanSub.customer_id,
        action: "plan_change",
        reason: changePlanReason || null,
        actor_admin_id: user?.id || null,
        details: {
          old_plan: oldPlan,
          new_plan: { name: newPlanName.trim(), code: newPlanCode.trim(), price: priceNum },
        },
      });

      await supabase.from("client_activity_logs").insert({
        client_id: clientId,
        actor_user_id: user?.id || "",
        actor_role: "admin",
        action_type: "plan_change",
        summary: `Changement de forfait: "${oldPlan.name}" → "${newPlanName.trim()}" (${priceNum.toFixed(2)} $/mois). Raison: ${changePlanReason || "N/A"}`,
      });

      toast.success("Forfait modifié avec succès");
      setChangePlanSub(null);
      setNewPlanName("");
      setNewPlanCode("");
      setNewPlanPrice("");
      setChangePlanReason("");
      queryClient.invalidateQueries({ queryKey: ["account-profile-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["account-service-instances"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          Services par adresse ({subscriptions.length} total)
        </h3>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm" className="gap-1.5 text-xs"
            onClick={() => navigate(`/admin/orders?new=true&client=${clientId}`)}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Ajouter un service
          </Button>
        </div>
      </div>

      {addressGroups.map(([key, { address, subs }]) => (
        <Card key={key}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Badge variant={key === primaryKey ? "default" : "outline"} className="text-[10px]">
                {address.label || "Service"}
              </Badge>
              <span className="text-muted-foreground font-normal text-xs">
                {address.service_address}
                {address.service_city && `, ${address.service_city}`}
                {address.service_postal_code && ` ${address.service_postal_code}`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun service à cette adresse</p>
            ) : (
              <div className="space-y-2">
                {subs.map((sub: any) => {
                  const Icon = categoryIcons[sub.service_category] || Package;
                  const si = findServiceInstance(sub);
                  const realStatus = si?.status || sub.status || "active";
                  const st = statusConfig[realStatus] || { label: realStatus, variant: "outline" as const };
                  const eqLines = findEquipment(sub);
                  const addons = sub.billing_subscription_services?.filter((s: any) => s.is_active) || [];

                  return (
                    <div key={sub.id} className="p-3 rounded-md border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{sub.plan_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>{categoryLabels[sub.service_category] || sub.service_category}</span>
                              <span>•</span>
                              <span className="font-mono">{sub.plan_code}</span>
                              {sub.cycle_start_date && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-0.5">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(sub.cycle_start_date), "d MMM yyyy", { locale: fr })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">{sub.plan_price?.toFixed(2)} $/mois</p>
                            <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailSub(sub)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Détails du service
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setChangePlanSub(sub);
                                setNewPlanName(sub.plan_name);
                                setNewPlanCode(sub.plan_code);
                                setNewPlanPrice(sub.plan_price?.toString() || "");
                              }}>
                                <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Changer de forfait
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(realStatus === "active" || realStatus === "installed") && (
                                <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("suspend"); }}>
                                  <Pause className="h-3.5 w-3.5 mr-2" /> Suspendre
                                </DropdownMenuItem>
                              )}
                              {realStatus === "suspended" && (
                                <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("resume"); }}>
                                  <RotateCcw className="h-3.5 w-3.5 mr-2" /> Réactiver
                                </DropdownMenuItem>
                              )}
                              {!["cancelled", "expired"].includes(realStatus) && (
                                <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("cancel"); }} className="text-destructive">
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Annuler
                                </DropdownMenuItem>
                              )}
                              {sub.order_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navigate(`/admin/orders/${sub.order_id}`)}>
                                    <Settings className="h-3.5 w-3.5 mr-2" /> Voir la commande
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={() => navigate(`/admin/subscriptions/${sub.id}`)}>
                                <Eye className="h-3.5 w-3.5 mr-2" /> Voir l'abonnement
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Service detail row: equipment + addons */}
                      {(eqLines.length > 0 || addons.length > 0) && (
                        <div className="mt-2 pl-12 flex items-center gap-2 flex-wrap">
                          {eqLines.map((eq: any) => (
                            <Badge key={eq.id} variant="outline" className="text-[10px] gap-1">
                              <HardDrive className="h-2.5 w-2.5" />
                              {eq.equipment_name}{eq.serial_number ? ` (${eq.serial_number})` : ""}
                            </Badge>
                          ))}
                          {addons.map((addon: any) => (
                            <Badge key={addon.id} variant="secondary" className="text-[10px]">
                              + {addon.service_name} ({addon.unit_price?.toFixed(2)} $)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Service Detail Dialog */}
      <Dialog open={!!detailSub} onOpenChange={() => setDetailSub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détails du service</DialogTitle>
          </DialogHeader>
          {detailSub && (() => {
            const si = findServiceInstance(detailSub);
            const eqLines = findEquipment(detailSub);
            const addons = detailSub.billing_subscription_services?.filter((s: any) => s.is_active) || [];
            return (
              <div className="space-y-3 text-sm">
                <DetailRow label="Forfait" value={detailSub.plan_name} />
                <DetailRow label="Code" value={detailSub.plan_code} />
                <DetailRow label="Catégorie" value={categoryLabels[detailSub.service_category] || detailSub.service_category} />
                <DetailRow label="Prix mensuel" value={`${detailSub.plan_price?.toFixed(2)} $`} />
                <DetailRow label="Statut abonnement" value={(statusConfig[detailSub.status] || { label: detailSub.status }).label} />
                {si && <DetailRow label="Statut service (provisioning)" value={(statusConfig[si.status] || { label: si.status }).label} />}
                <DetailRow label="Début cycle" value={detailSub.cycle_start_date ? format(new Date(detailSub.cycle_start_date), "d MMM yyyy", { locale: fr }) : "—"} />
                <DetailRow label="Fin cycle" value={detailSub.cycle_end_date ? format(new Date(detailSub.cycle_end_date), "d MMM yyyy", { locale: fr }) : "—"} />
                <DetailRow label="Facturation auto" value={detailSub.auto_billing_enabled ? "Oui" : "Non"} />
                {detailSub.order_id && <DetailRow label="Commande liée" value={detailSub.order_id.slice(0, 8)} />}
                {eqLines.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Équipements liés</p>
                    {eqLines.map((eq: any) => (
                      <p key={eq.id} className="text-xs text-foreground">
                        {eq.equipment_name} {eq.serial_number && `— S/N: ${eq.serial_number}`}
                      </p>
                    ))}
                  </div>
                )}
                {addons.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Options actives</p>
                    {addons.map((a: any) => (
                      <p key={a.id} className="text-xs text-foreground">
                        {a.service_name} — {a.unit_price?.toFixed(2)} $/mois
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailSub(null)}>Fermer</Button>
            {detailSub?.order_id && (
              <Button onClick={() => { setDetailSub(null); navigate(`/admin/orders/${detailSub.order_id}`); }}>
                Voir la commande
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanSub} onOpenChange={() => setChangePlanSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer de forfait</DialogTitle>
          </DialogHeader>
          {changePlanSub && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-muted/50 border text-xs">
                <p><strong>Forfait actuel:</strong> {changePlanSub.plan_name} ({changePlanSub.plan_code}) — {changePlanSub.plan_price?.toFixed(2)} $/mois</p>
              </div>
              <div>
                <Label>Nouveau nom du forfait</Label>
                <Input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder="Ex: Internet 500 Mbps" />
              </div>
              <div>
                <Label>Nouveau code forfait</Label>
                <Input value={newPlanCode} onChange={e => setNewPlanCode(e.target.value)} placeholder="Ex: INT-500" />
              </div>
              <div>
                <Label>Nouveau prix mensuel ($)</Label>
                <Input type="number" step="0.01" value={newPlanPrice} onChange={e => setNewPlanPrice(e.target.value)} placeholder="Ex: 75.00" />
              </div>
              <div>
                <Label>Raison du changement</Label>
                <Textarea value={changePlanReason} onChange={e => setChangePlanReason(e.target.value)} rows={2} placeholder="Upgrade demandé par le client..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanSub(null)}>Annuler</Button>
            <Button onClick={handleChangePlan} disabled={saving || !newPlanName.trim() || !newPlanCode.trim()}>
              {saving ? "Modification..." : "Appliquer le changement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Action Confirmation */}
      <AlertDialog open={!!actionType} onOpenChange={() => { setActionType(null); setActionSub(null); setActionReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "suspend" ? "Suspendre le service" : actionType === "resume" ? "Réactiver le service" : "Annuler le service"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionSub?.plan_name} — {actionSub?.plan_code}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Raison</Label>
            <Textarea value={actionReason} onChange={e => setActionReason(e.target.value)} rows={2} placeholder="Raison (optionnel)..." />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleServiceAction} disabled={saving}>
              {saving ? "En cours..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
