/**
 * AccountServicesTab — Services grouped by address with operational actions
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Wifi, Tv, Smartphone, Play, Package, MapPin, PlusCircle, MoreHorizontal, Pause, RotateCcw, XCircle, Settings } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

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
};

export function AccountServicesTab({ subscriptions, serviceAddresses, account, locations }: AccountServicesTabProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionSub, setActionSub] = useState<any>(null);
  const [actionType, setActionType] = useState<"suspend" | "resume" | "cancel" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [saving, setSaving] = useState(false);

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
  subscriptions.forEach((sub: any) => {
    if (sub.address_id && byAddress[sub.address_id]) {
      byAddress[sub.address_id].subs.push(sub);
    } else {
      byAddress[primaryKey].subs.push(sub);
    }
  });
  const addressGroups = Object.entries(byAddress).filter(
    ([key, val]) => key === primaryKey || val.subs.length > 0
  );

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

      // Audit trail
      await supabase.from("billing_subscription_trace_audit").insert({
        subscription_id: actionSub.id,
        customer_id: actionSub.customer_id,
        action: `service_${actionType}`,
        reason: actionReason || null,
        actor_admin_id: user?.id || null,
        details: { plan: actionSub.plan_name, previous_status: actionSub.status, new_status: newStatus },
      });

      toast.success(
        actionType === "suspend" ? "Service suspendu" : actionType === "resume" ? "Service réactivé" : "Service annulé"
      );
      setActionSub(null);
      setActionType(null);
      setActionReason("");
      queryClient.invalidateQueries({ queryKey: ["account-profile-subscriptions"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Services par adresse ({subscriptions.length} total)
        </h3>
        <Button
          variant="outline" size="sm" className="gap-1.5 text-xs"
          onClick={() => navigate(`/admin/orders?new=true&client=${account?.client_id}`)}
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Ajouter un service
        </Button>
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
                  const st = statusConfig[sub.status] || statusConfig.active;
                  return (
                    <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sub.plan_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{categoryLabels[sub.service_category] || sub.service_category}</span>
                            <span>•</span>
                            <span>{sub.plan_code}</span>
                            {sub.cycle_start_date && (
                              <>
                                <span>•</span>
                                <span>Depuis {format(new Date(sub.cycle_start_date), "d MMM yyyy", { locale: fr })}</span>
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
                            {sub.status === "active" && (
                              <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("suspend"); }}>
                                <Pause className="h-3.5 w-3.5 mr-2" /> Suspendre
                              </DropdownMenuItem>
                            )}
                            {sub.status === "suspended" && (
                              <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("resume"); }}>
                                <RotateCcw className="h-3.5 w-3.5 mr-2" /> Réactiver
                              </DropdownMenuItem>
                            )}
                            {sub.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => { setActionSub(sub); setActionType("cancel"); }} className="text-destructive">
                                <XCircle className="h-3.5 w-3.5 mr-2" /> Annuler
                              </DropdownMenuItem>
                            )}
                            {sub.order_id && (
                              <DropdownMenuItem onClick={() => navigate(`/admin/orders/${sub.order_id}`)}>
                                <Settings className="h-3.5 w-3.5 mr-2" /> Voir la commande
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

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
