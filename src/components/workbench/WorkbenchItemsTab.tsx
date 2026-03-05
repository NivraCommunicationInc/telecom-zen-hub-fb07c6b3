/**
 * WorkbenchItemsTab - Order items with per-item status, dependencies, owner role
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, Tv, Smartphone, Film, Wrench } from "lucide-react";
import { getOwnerRole, OWNER_ROLE_LABELS } from "@/lib/workbenchRoles";

interface Props {
  orderItems: any[];
  provisioningJobs: any[];
}

const SERVICE_ICONS: Record<string, any> = {
  internet: Wifi,
  tv: Tv,
  mobile: Smartphone,
  streaming: Film,
  installation: Wrench,
};

const ITEM_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Brouillon" },
  submitted: { color: "bg-blue-500/20 text-blue-400", label: "Soumis" },
  kyc_required: { color: "bg-purple-500/20 text-purple-400", label: "KYC requis" },
  payment_pending: { color: "bg-amber-500/20 text-amber-400", label: "Paiement en attente" },
  fulfillment_pending: { color: "bg-cyan-500/20 text-cyan-400", label: "Fulfillment" },
  provisioning_pending: { color: "bg-blue-500/20 text-blue-400", label: "Provisioning" },
  provisioning_in_progress: { color: "bg-blue-500/20 text-blue-400", label: "En activation" },
  active: { color: "bg-emerald-500/20 text-emerald-400", label: "Actif" },
  on_hold: { color: "bg-orange-500/20 text-orange-400", label: "En attente" },
  cancelled: { color: "bg-red-500/20 text-red-400", label: "Annulé" },
  failed: { color: "bg-red-500/20 text-red-400", label: "Échoué" },
};

export function WorkbenchItemsTab({ orderItems, provisioningJobs }: Props) {
  if (orderItems.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucun item — la commande n'a pas encore été orchestrée.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orderItems.map((item: any) => {
        const Icon = SERVICE_ICONS[item.service_category] || Wrench;
        const statusCfg = ITEM_STATUS_CONFIG[item.status] || { color: "bg-muted text-muted-foreground", label: item.status };
        const owner = getOwnerRole(item.status);
        const ownerCfg = OWNER_ROLE_LABELS[owner] || { label: owner, color: "bg-muted text-muted-foreground" };
        const relatedJobs = provisioningJobs.filter((j: any) => j.order_item_id === item.id);
        const deps = item.depends_on_item_ids;

        return (
          <Card key={item.id} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-700/50">
                    <Icon className="h-5 w-5 text-teal-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{item.service_name || item.service_category}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.plan_code && <span className="font-mono">{item.plan_code}</span>}
                      {item.quantity > 1 && <span className="ml-2">×{item.quantity}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={ownerCfg.color}>{ownerCfg.label}</Badge>
                  <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                </div>
              </div>

              {/* Dependencies */}
              {deps && deps.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="text-amber-400">⚠ Dépend de :</span>{" "}
                  {deps.map((depId: string) => {
                    const depItem = orderItems.find((i: any) => i.id === depId);
                    return depItem?.service_name || depId.slice(0, 8);
                  }).join(", ")}
                </div>
              )}

              {/* Related jobs */}
              {relatedJobs.length > 0 && (
                <div className="mt-3 border-t border-slate-700/50 pt-2 space-y-1">
                  {relatedJobs.map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{job.job_type}</span>
                      <Badge variant="outline" className="text-xs">
                        {job.status} {job.attempts > 0 && `(${job.attempts}x)`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Price */}
              {item.unit_price > 0 && (
                <div className="mt-2 text-right text-sm text-white">
                  {Number(item.unit_price).toFixed(2)} $/mois
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
