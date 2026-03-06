/**
 * WorkbenchNBAPanel — Next Best Action banner (always visible)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Shield, CreditCard, Truck, Wifi, Calendar, ArrowRight } from "lucide-react";
import { canPerformAction, WorkbenchAction } from "@/lib/workbenchRoles";

interface Props {
  order: any;
  nextActions: any;
  orderItems: any[];
  provisioningJobs: any[];
  role: string | null;
  onNavigateTab: (tab: string) => void;
}

function computeNBA(order: any, nextActions: any, orderItems: any[], provisioningJobs: any[]) {
  const result: { icon: any; label: string; action: WorkbenchAction; tab: string; priority: "high" | "medium" }[] = [];

  // From DB view first
  if (nextActions?.next_actions) {
    const a = nextActions.next_actions;
    if (a.kyc_pending) result.push({ icon: Shield, label: "KYC à approuver", action: "approve_kyc", tab: "kyc", priority: "high" });
    if (a.payment_pending) result.push({ icon: CreditCard, label: "Paiement à confirmer", action: "capture_payment", tab: "payment", priority: "high" });
    if (a.inventory_needed) result.push({ icon: Truck, label: "Équipement à assigner", action: "assign_inventory", tab: "fulfillment", priority: "medium" });
    if (a.shipment_pending) result.push({ icon: Truck, label: "Expédition à préparer", action: "manage_shipment", tab: "fulfillment", priority: "medium" });
    if (a.appointment_needed) result.push({ icon: Calendar, label: "Rendez-vous à confirmer", action: "create_ticket", tab: "fulfillment", priority: "medium" });
    if (a.provisioning_blocked) result.push({ icon: Wifi, label: "Provisioning bloqué", action: "retry_provisioning", tab: "provisioning", priority: "high" });
  }

  // Fallback heuristics
  if (result.length === 0) {
    const s = order?.status || "";
    const p = order?.payment_status || "";

    if (["kyc_required", "kyc_in_review"].includes(s) || order?.id_verification_status === "submitted")
      result.push({ icon: Shield, label: "KYC à approuver", action: "approve_kyc", tab: "kyc", priority: "high" });
    if (["payment_pending", "payment_failed"].includes(s) || ["pending", "failed", "pre_authorized"].includes(p))
      result.push({ icon: CreditCard, label: "Paiement à confirmer", action: "capture_payment", tab: "payment", priority: "high" });
    if (provisioningJobs.some((j: any) => j.status === "failed" || j.status === "blocked"))
      result.push({ icon: Wifi, label: "Jobs provisioning en échec", action: "retry_provisioning", tab: "provisioning", priority: "high" });
  }

  return result;
}

export function WorkbenchNBAPanel({ order, nextActions, orderItems, provisioningJobs, role, onNavigateTab }: Props) {
  const nba = computeNBA(order, nextActions, orderItems, provisioningJobs);
  const orderStatus = order?.status || "";

  if (nba.length === 0 && !["cancelled", "failed"].includes(orderStatus)) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
        <CheckCircle className="h-5 w-5 text-emerald-500" />
        <span className="text-sm text-emerald-500">Aucune action requise — commande en bonne voie</span>
      </div>
    );
  }

  if (nba.length === 0) return null;

  return (
    <div className="border border-amber-500/30 rounded-lg bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
        <AlertTriangle className="h-4 w-4" /> Actions requises ({nba.length})
      </div>
      {nba.map((action, i) => (
        <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            <action.icon className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-foreground">{action.label}</span>
            <Badge variant="outline" className={action.priority === "high" ? "border-destructive text-destructive" : "border-amber-500 text-amber-400"}>
              {action.priority === "high" ? "Urgent" : "Normal"}
            </Badge>
          </div>
          {canPerformAction(role, action.action) && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onNavigateTab(action.tab)}>
              Traiter <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
