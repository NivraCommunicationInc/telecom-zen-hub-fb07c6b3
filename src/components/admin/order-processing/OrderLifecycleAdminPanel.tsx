/**
 * OrderLifecycleAdminPanel (Phase 3)
 *
 * Affiche la timeline lifecycle (variant=admin) + boutons de transition rapide.
 * Appelle le RPC `transition_order_status` (admin/staff role required).
 *
 * Règle Phase 3 :
 *  - variant=admin → on affiche TOUJOURS l'audit complet (shipment même en pro).
 *  - Les boutons d'expédition restent accessibles à l'admin pour la logistique
 *    interne, même quand `installation_type = technician` (juste avec un
 *    avertissement visuel "non exposé client").
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Truck, PackageCheck, Zap, Wrench, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  OrderLifecycleTimeline,
  type OrderLifecycleData,
} from "@/components/orders/OrderLifecycleTimeline";

interface Props {
  orderId: string;
  installationType?: string | null;
}

type TransitionDomain = "order" | "shipment" | "activation";

interface TransitionAction {
  key: string;
  label: string;
  domain: TransitionDomain;
  newStatus: string;
  Icon: typeof Truck;
  /** Si true → on demande tracking_number + carrier dans un mini-form */
  requiresShipmentInputs?: boolean;
  /** Limite : visible uniquement pour ce type d'installation */
  installScope?: "self" | "pro" | "all";
  variant?: "default" | "secondary" | "outline";
}

const ACTIONS: TransitionAction[] = [
  {
    key: "mark-preparing",
    label: "Marquer en préparation",
    domain: "order",
    newStatus: "processing",
    Icon: PackageCheck,
    installScope: "all",
    variant: "outline",
  },
  {
    key: "mark-shipped",
    label: "Marquer expédiée",
    domain: "shipment",
    newStatus: "shipped",
    Icon: Truck,
    requiresShipmentInputs: true,
    installScope: "all", // admin peut quand même expédier pour logistique pro
  },
  {
    key: "mark-delivered",
    label: "Marquer livrée",
    domain: "shipment",
    newStatus: "delivered",
    Icon: PackageCheck,
    installScope: "all",
    variant: "outline",
  },
  {
    key: "mark-installed",
    label: "Installation terminée",
    domain: "order",
    newStatus: "installed",
    Icon: Wrench,
    installScope: "all",
    variant: "outline",
  },
  {
    key: "mark-activated",
    label: "Activer le service",
    domain: "activation",
    newStatus: "completed",
    Icon: Zap,
    installScope: "all",
  },
];

function isSelfInstall(installationType?: string | null): boolean {
  if (installationType == null) return true;
  return installationType === "auto" || installationType === "ship_to_home";
}

export function OrderLifecycleAdminPanel({ orderId, installationType }: Props) {
  const queryClient = useQueryClient();
  const [shipmentForm, setShipmentForm] = useState<{ tracking_number: string; carrier: string }>({
    tracking_number: "",
    carrier: "",
  });
  const [activeShipForm, setActiveShipForm] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-order-lifecycle", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_lifecycle" as any)
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as OrderLifecycleData | null;
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (vars: {
      domain: TransitionDomain;
      newStatus: string;
      reason?: string;
      metadata?: Record<string, any>;
    }) => {
      const { data, error } = await supabase.rpc("transition_order_status" as any, {
        p_order_id: orderId,
        p_domain: vars.domain,
        p_new_status: vars.newStatus,
        p_reason: vars.reason ?? null,
        p_metadata: vars.metadata ?? {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Statut ${vars.domain} mis à jour : ${vars.newStatus}`);
      queryClient.invalidateQueries({ queryKey: ["admin-order-lifecycle", orderId] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-overview", orderId] });
      setActiveShipForm(false);
      setShipmentForm({ tracking_number: "", carrier: "" });
    },
    onError: (err: any) => {
      toast.error("Échec de la transition : " + (err?.message ?? "erreur inconnue"));
    },
  });

  const effectiveInstallationType = installationType ?? data?.installation_type ?? null;
  const selfInstall = isSelfInstall(effectiveInstallationType);

  const visibleActions = useMemo(() => {
    return ACTIONS.filter((a) => {
      if (a.installScope === "all") return true;
      if (a.installScope === "self") return selfInstall;
      if (a.installScope === "pro") return !selfInstall;
      return true;
    });
  }, [selfInstall]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 bg-card rounded-lg border border-border">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="inline h-4 w-4 mr-2" />
        Impossible de charger le suivi : {(error as any)?.message ?? "erreur"}
      </div>
    );
  }

  // Fallback : la vue n'existe pas / pas encore de données → on affiche timeline minimaliste
  const lifecycleData: OrderLifecycleData = data ?? {
    order_id: orderId,
    installation_type: effectiveInstallationType,
    is_self_install: selfInstall,
    current_step: 1,
    progress_percent: 10,
  };

  const handleAction = (action: TransitionAction) => {
    if (action.requiresShipmentInputs && !activeShipForm) {
      setActiveShipForm(true);
      return;
    }
    const metadata: Record<string, any> = {};
    if (action.requiresShipmentInputs) {
      if (!shipmentForm.tracking_number || !shipmentForm.carrier) {
        toast.error("Numéro de suivi et transporteur requis");
        return;
      }
      metadata.tracking_number = shipmentForm.tracking_number;
      metadata.carrier = shipmentForm.carrier;
    }
    transitionMutation.mutate({
      domain: action.domain,
      newStatus: action.newStatus,
      reason: `admin_quick_transition:${action.key}`,
      metadata,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Suivi & cycle de vie
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {selfInstall ? "Auto-installation" : "Installation pro"}
        </span>
      </div>

      <OrderLifecycleTimeline data={lifecycleData} variant="admin" />

      {/* Quick actions */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Transitions rapides
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleActions.map((a) => {
            const Icon = a.Icon;
            return (
              <Button
                key={a.key}
                size="sm"
                variant={a.variant ?? "default"}
                className="h-8 gap-1.5 text-xs"
                disabled={transitionMutation.isPending}
                onClick={() => handleAction(a)}
              >
                <Icon className="h-3.5 w-3.5" />
                {a.label}
              </Button>
            );
          })}
        </div>

        {/* Mini-form expédition */}
        {activeShipForm && (
          <div className="mt-3 rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Détails d'expédition</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Transporteur</Label>
                <Input
                  value={shipmentForm.carrier}
                  onChange={(e) =>
                    setShipmentForm((s) => ({ ...s, carrier: e.target.value }))
                  }
                  placeholder="Postes Canada, Purolator..."
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px]">Numéro de suivi</Label>
                <Input
                  value={shipmentForm.tracking_number}
                  onChange={(e) =>
                    setShipmentForm((s) => ({ ...s, tracking_number: e.target.value }))
                  }
                  placeholder="1Z..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  handleAction(ACTIONS.find((a) => a.key === "mark-shipped")!)
                }
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Confirmer expédition"
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setActiveShipForm(false)}
              >
                Annuler
              </Button>
            </div>

            {!selfInstall && (
              <p className="text-[10px] text-warning-foreground bg-warning/10 border border-warning/30 rounded p-1.5">
                ⚠ Installation pro : ce shipment reste interne et n'est pas exposé au client.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderLifecycleAdminPanel;
