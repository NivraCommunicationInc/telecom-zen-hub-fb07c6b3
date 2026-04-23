/**
 * OrderLifecycleTimeline (Phase 3)
 *
 * Timeline de suivi de commande à 6 étapes, conditionnée par installation_type :
 *  - SELF (auto / ship_to_home) : Confirmée → Paiement → Préparation → Expédition → Installation auto → Activée
 *  - PRO (technician)            : Confirmée → Paiement → Préparation → RDV → Installation pro → Activée
 *
 * Variants : "admin" (dense, neutre) | "client" (plus aéré, soft)
 *
 * Côté client, si installation = pro :
 *  - Aucune étape "Expédition" / "tracking" n'est exposée.
 *  - Le bloc tracking (ShipmentBadge) ne s'affiche jamais.
 *
 * Côté admin, on affiche TOUJOURS l'audit complet (y compris shipment en pro)
 * pour la traçabilité opérationnelle interne.
 */
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  Truck,
  Wrench,
  CalendarCheck,
  Zap,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { carrierLabel, resolveTrackingLink } from "@/lib/carrierTracking";

export type LifecycleVariant = "admin" | "client";

export interface OrderLifecycleData {
  order_id: string;
  order_status?: string | null;
  payment_status?: string | null;
  installation_type?: string | null;
  is_self_install?: boolean | null;
  current_step?: number | null;
  progress_percent?: number | null;
  shipment_status?: string | null;
  tracking_number?: string | null;
  carrier?: string | null;
  tracking_url?: string | null;
  activation_status?: string | null;
}

interface Props {
  data: OrderLifecycleData;
  variant?: LifecycleVariant;
  /** Force l'override du type d'installation si non présent dans `data`. */
  installationTypeOverride?: string | null;
}

interface StepDef {
  key: string;
  label: string;
  Icon: typeof Clock;
}

const STEPS_SELF: StepDef[] = [
  { key: "confirmed", label: "Confirmée", Icon: CheckCircle2 },
  { key: "payment", label: "Paiement", Icon: CreditCard },
  { key: "preparation", label: "Préparation", Icon: Package },
  { key: "shipping", label: "Expédition", Icon: Truck },
  { key: "self_install", label: "Installation", Icon: Wrench },
  { key: "activated", label: "Activée", Icon: Zap },
];

const STEPS_PRO: StepDef[] = [
  { key: "confirmed", label: "Confirmée", Icon: CheckCircle2 },
  { key: "payment", label: "Paiement", Icon: CreditCard },
  { key: "preparation", label: "Préparation", Icon: Package },
  { key: "appointment", label: "Rendez-vous", Icon: CalendarCheck },
  { key: "installation", label: "Installation", Icon: Wrench },
  { key: "activated", label: "Activée", Icon: Zap },
];

function isSelfInstall(installationType?: string | null): boolean {
  if (installationType == null) return true; // legacy fallback
  return installationType === "auto" || installationType === "ship_to_home";
}

function shipmentSubBadge(shipmentStatus?: string | null): { label: string; tone: string } | null {
  if (!shipmentStatus) return null;
  const map: Record<string, { label: string; tone: string }> = {
    pending: { label: "En préparation", tone: "bg-muted text-muted-foreground" },
    ready: { label: "Prête à expédier", tone: "status-pill-info" },
    shipped: { label: "Expédiée", tone: "status-pill-info" },
    in_transit: { label: "En transit", tone: "status-pill-info" },
    out_for_delivery: { label: "En livraison", tone: "status-pill-warning" },
    delivered: { label: "Livrée", tone: "status-pill-success" },
    failed: { label: "Échec", tone: "bg-destructive/15 text-destructive" },
  };
  return map[shipmentStatus] ?? { label: shipmentStatus, tone: "bg-muted text-muted-foreground" };
}

export function OrderLifecycleTimeline({ data, variant = "client", installationTypeOverride }: Props) {
  const installationType = installationTypeOverride ?? data.installation_type ?? null;
  const selfInstall = data.is_self_install ?? isSelfInstall(installationType);

  // RÈGLE CRITIQUE : côté client + pro = jamais d'étape expédition.
  // Côté admin = on garde tout (audit interne).
  const showShipmentForClient = variant === "client" ? selfInstall : true;

  const steps = selfInstall ? STEPS_SELF : STEPS_PRO;
  const currentStep = data.current_step ?? 1;
  const progressPercent = Math.min(100, Math.max(0, data.progress_percent ?? 0));

  const isCancelled = data.order_status === "cancelled" || data.order_status === "cancel";

  if (isCancelled) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
        <p className="font-medium text-destructive">Commande annulée</p>
      </div>
    );
  }

  const isAdmin = variant === "admin";
  const containerCls = isAdmin
    ? "rounded-lg border border-border bg-card p-4"
    : "rounded-lg border border-border bg-background p-4";

  const subBadge = shipmentSubBadge(data.shipment_status);

  return (
    <div className={containerCls}>
      {/* En-tête : type d'installation + progression */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              selfInstall ? "status-pill-info" : "bg-primary/10 text-primary",
            )}
          >
            {selfInstall ? <Wrench className="h-3 w-3" /> : <CalendarCheck className="h-3 w-3" />}
            {selfInstall ? "Auto-installation" : "Installation professionnelle"}
          </span>
          <span className="text-xs text-muted-foreground">Étape {currentStep} / 6</span>
        </div>
        <span className="text-xs font-medium text-foreground">{progressPercent}%</span>
      </div>

      {/* Barre de progression */}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Étapes */}
      <div className="relative flex items-start justify-between">
        {/* Ligne de fond */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-border" aria-hidden />
        <div
          className="absolute left-0 top-4 h-0.5 bg-primary transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          aria-hidden
        />

        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const Icon = step.Icon;

          return (
            <div key={step.key} className="relative z-10 flex flex-col items-center" style={{ flex: 1 }}>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isActive && "border-primary bg-background text-primary ring-2 ring-primary/30",
                  !isCompleted && !isActive && "border-border bg-background text-muted-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={cn(
                  "mt-2 max-w-[80px] text-center text-[11px] leading-tight",
                  isCompleted || isActive ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>

              {/* Sous-badge tracking (uniquement self ou variant admin) */}
              {step.key === "shipping" && showShipmentForClient && subBadge && (isActive || isCompleted) && (
                <span
                  className={cn(
                    "mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                    subBadge.tone,
                  )}
                >
                  <CircleDot className="h-2 w-2" />
                  {subBadge.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Détails tracking (admin OU client+self) */}
      {showShipmentForClient && data.tracking_number && (() => {
        const carrierName = carrierLabel(data.carrier);
        const trackingHref = resolveTrackingLink(data.carrier, data.tracking_number, data.tracking_url);
        return (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs">
            <span className="text-muted-foreground">Suivi&nbsp;:</span>
            <span className={cn("font-medium", data.carrier ? "text-foreground" : "text-muted-foreground italic")}>
              {carrierName}
            </span>
            {trackingHref ? (
              <a
                href={trackingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-medium text-primary hover:underline"
                title={`Suivre ${data.tracking_number} sur le site du transporteur`}
              >
                {data.tracking_number} ↗
              </a>
            ) : (
              <span className="font-mono text-foreground">{data.tracking_number}</span>
            )}
          </div>
        );
      })()}

      {/* Côté admin uniquement : si pro mais shipment existe → mention discrète */}
      {isAdmin && !selfInstall && data.shipment_status && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-2 text-[11px] text-foreground">
          <strong>Audit interne :</strong> shipment "{data.shipment_status}" enregistré (logistique
          technicien). Non exposé au client.
        </div>
      )}
    </div>
  );
}

export default OrderLifecycleTimeline;
