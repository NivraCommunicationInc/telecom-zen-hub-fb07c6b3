/**
 * WorkbenchSummaryTab - Next Best Action + Order overview
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, Shield, CreditCard, Truck, Wifi, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { canPerformAction, WorkbenchAction } from "@/lib/workbenchRoles";

interface Props {
  order: any;
  profile: any;
  nextActions: any;
  orderItems: any[];
  provisioningJobs: any[];
  role: string | null;
  onAction: (action: string, payload?: any) => void;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Brouillon" },
  submitted: { color: "bg-blue-500/20 text-blue-400", label: "Soumise" },
  kyc_required: { color: "bg-purple-500/20 text-purple-400", label: "KYC requis" },
  kyc_in_review: { color: "bg-purple-500/20 text-purple-400", label: "KYC en révision" },
  kyc_approved: { color: "bg-emerald-500/20 text-emerald-400", label: "KYC approuvé" },
  kyc_rejected: { color: "bg-red-500/20 text-red-400", label: "KYC rejeté" },
  payment_pending: { color: "bg-amber-500/20 text-amber-400", label: "Paiement en attente" },
  paid: { color: "bg-emerald-500/20 text-emerald-400", label: "Payé" },
  payment_failed: { color: "bg-red-500/20 text-red-400", label: "Paiement échoué" },
  fulfillment_pending: { color: "bg-cyan-500/20 text-cyan-400", label: "Fulfillment en attente" },
  provisioning_pending: { color: "bg-blue-500/20 text-blue-400", label: "Provisioning en attente" },
  provisioning_in_progress: { color: "bg-blue-500/20 text-blue-400", label: "Provisioning en cours" },
  active: { color: "bg-emerald-500/20 text-emerald-400", label: "Actif" },
  partial_active: { color: "bg-amber-500/20 text-amber-400", label: "Partiellement actif" },
  on_hold: { color: "bg-orange-500/20 text-orange-400", label: "En attente" },
  cancelled: { color: "bg-red-500/20 text-red-400", label: "Annulé" },
  failed: { color: "bg-red-500/20 text-red-400", label: "Échoué" },
  // Legacy statuses
  pending: { color: "bg-amber-500/20 text-amber-400", label: "En attente" },
  confirmed: { color: "bg-emerald-500/20 text-emerald-400", label: "Confirmé" },
  completed: { color: "bg-emerald-500/20 text-emerald-400", label: "Terminé" },
};

function getStatusBadge(status: string) {
  const cfg = STATUS_CONFIG[status] || { color: "bg-muted text-muted-foreground", label: status };
  return <Badge className={cfg.color}>{cfg.label}</Badge>;
}

function computeNBA(order: any, nextActions: any, orderItems: any[], provisioningJobs: any[]): { icon: any; label: string; action: WorkbenchAction; priority: string }[] {
  const result: { icon: any; label: string; action: WorkbenchAction; priority: string }[] = [];

  // From order_next_actions table if available
  if (nextActions?.next_actions) {
    const a = nextActions.next_actions;
    if (a.kyc_pending) result.push({ icon: Shield, label: "KYC à approuver", action: "approve_kyc", priority: "high" });
    if (a.payment_pending) result.push({ icon: CreditCard, label: "Paiement échoué – relancer", action: "capture_payment", priority: "high" });
    if (a.inventory_needed) result.push({ icon: Truck, label: "Stock manquant – assigner équipement", action: "assign_inventory", priority: "medium" });
    if (a.shipment_pending) result.push({ icon: Truck, label: "Expédition à préparer", action: "manage_shipment", priority: "medium" });
    if (a.appointment_needed) result.push({ icon: Clock, label: "Rendez-vous à confirmer", action: "create_ticket", priority: "medium" });
    if (a.provisioning_blocked) result.push({ icon: Wifi, label: "Provisioning bloqué – retry", action: "retry_provisioning", priority: "high" });
  }

  // Dynamic computation from actual state (fills gaps when order_next_actions is empty)
  if (result.length === 0) {
    const status = order?.status || "";
    const payStatus = order?.payment_status || "";

    // KYC check
    if (["kyc_required", "kyc_in_review"].includes(status) || order?.id_verification_status === "submitted") {
      result.push({ icon: Shield, label: "KYC à approuver", action: "approve_kyc", priority: "high" });
    }

    // Payment check
    if (["payment_pending", "payment_failed"].includes(status) || payStatus === "pending" || payStatus === "failed") {
      result.push({ icon: CreditCard, label: "Paiement à capturer", action: "capture_payment", priority: "high" });
    }

    // Provisioning failures
    const failedJobs = provisioningJobs.filter((j: any) => j.status === "failed" || j.status === "blocked");
    if (failedJobs.length > 0) {
      result.push({ icon: Wifi, label: `${failedJobs.length} job(s) provisioning en échec`, action: "retry_provisioning", priority: "high" });
    }

    // Fulfillment pending
    if (status === "fulfillment_pending" || status === "submitted") {
      const hasItemsNeedingFulfillment = orderItems.some((i: any) => ["fulfillment_pending", "submitted", "payment_pending"].includes(i.status));
      if (hasItemsNeedingFulfillment || orderItems.length === 0) {
        result.push({ icon: Truck, label: "Fulfillment à traiter", action: "manage_shipment", priority: "medium" });
      }
    }

    // Items stuck in early stages
    const kycItems = orderItems.filter((i: any) => i.status === "kyc_required");
    if (kycItems.length > 0 && !result.some(r => r.action === "approve_kyc")) {
      result.push({ icon: Shield, label: `${kycItems.length} item(s) en attente KYC`, action: "approve_kyc", priority: "high" });
    }

    const payItems = orderItems.filter((i: any) => i.status === "payment_pending");
    if (payItems.length > 0 && !result.some(r => r.action === "capture_payment")) {
      result.push({ icon: CreditCard, label: `${payItems.length} item(s) en attente paiement`, action: "capture_payment", priority: "high" });
    }
  }

  return result;
}

export function WorkbenchSummaryTab({ order, profile, nextActions, orderItems, provisioningJobs, role, onAction }: Props) {
  const nba = computeNBA(order, nextActions, orderItems, provisioningJobs);
  const orderStatus = order?.status || "pending";
  const createdAt = order?.created_at ? format(new Date(order.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—";

  const jobsFailed = provisioningJobs.filter((j: any) => j.status === "failed").length;
  const jobsActive = provisioningJobs.filter((j: any) => ["pending", "in_progress"].includes(j.status)).length;
  const itemsActive = orderItems.filter((i: any) => i.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Next Best Action */}
      {nba.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Actions requises
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nba.map((action, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3">
                  <action.icon className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-slate-200">{action.label}</span>
                  <Badge variant="outline" className={action.priority === "high" ? "border-red-500 text-red-400" : "border-amber-500 text-amber-400"}>
                    {action.priority === "high" ? "Urgent" : "Normal"}
                  </Badge>
                </div>
                {canPerformAction(role, action.action) && (
                  <Button size="sm" variant="outline" onClick={() => onAction(action.action)} className="gap-1">
                    Traiter <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {nba.length === 0 && orderStatus !== "cancelled" && orderStatus !== "failed" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <span className="text-sm text-emerald-300">Aucune action requise — commande en bonne voie</span>
          </CardContent>
        </Card>
      )}

      {/* Order Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Commande</p>
            <p className="font-mono text-lg text-white">{order?.order_number || "—"}</p>
            <p className="text-xs text-muted-foreground mt-2">Créée le {createdAt}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Statut</p>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge(orderStatus)}
              {order?.payment_status && (
                <Badge variant="outline" className="text-xs">Paiement: {order.payment_status}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Client</p>
            <p className="text-white font-medium">{profile?.full_name || order?.client_email || "—"}</p>
            <p className="text-xs text-muted-foreground">{profile?.email || order?.client_email}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-white">{orderItems.length}</p>
            <p className="text-xs text-muted-foreground">Items</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{itemsActive}</p>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{jobsActive}</p>
            <p className="text-xs text-muted-foreground">Jobs actifs</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-2xl font-bold text-red-400">{jobsFailed}</p>
            <p className="text-xs text-muted-foreground">Jobs échoués</p>
          </CardContent>
        </Card>
      </div>

      {/* Amount */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold text-white">{Number(order?.total_amount || 0).toFixed(2)} $</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Service</p>
              <p className="text-sm text-white">{order?.service_type || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
