/**
 * CoreOrderDetail — Order processing console (rebuilt visual layer).
 *
 * Layout (per spec):
 *   ┌──────────────────────────────────────────────────┐
 *   │ TOPBAR: #order — Client | Status | $ | SLA       │
 *   ├──────────────────────────────────────────────────┤
 *   │ HORIZONTAL STEP BAR (11 step pills, scrollable)  │
 *   ├────────────┬─────────────────────────────────────┤
 *   │ SIDEBAR    │ Quick info strip                    │
 *   │ Step list  │ + StepContent (active step)         │
 *   └────────────┴─────────────────────────────────────┘
 *   + KYC panel + Activity timeline below
 *
 * All hooks (useOrderProcessing), Supabase queries, step components,
 * StepContent routing, signature/contract/PayPal/billing logic preserved.
 */
import { useParams, Link } from "react-router-dom";
import { useOrderProcessing, WorkflowStepId, WorkflowStep } from "@/core-app/hooks/useOrderProcessing";
import { corePath } from "@/core-app/lib/corePaths";
import { CoreActivityTimeline } from "@/core-app/components/order-detail/CoreActivityTimeline";
import { CoreKycPanel } from "@/core-app/components/order-detail/CoreKycPanel";
import { CoreQuickActions } from "@/core-app/components/order-detail/CoreQuickActions";
import { StepContent } from "@/core-app/components/order-processing/StepContent";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { ImpersonateButton } from "@/core-app/components/ImpersonateButton";
import {
  ArrowLeft, Loader2, ShoppingCart, RefreshCw, Copy,
  Timer, CheckCircle2, AlertTriangle, Circle,
} from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { toast } from "sonner";

const CoreOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground text-xs">Commande introuvable</p>
        <Link to={corePath("/orders")} className="text-primary text-xs mt-2 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  return <OrderConsole orderId={orderId} />;
};

function OrderConsole({ orderId }: { orderId: string }) {
  const proc = useOrderProcessing(orderId);

  if (proc.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-core-accent" />
        <span className="ml-3 text-xs text-core-muted">Chargement du dossier…</span>
      </div>
    );
  }

  if (proc.error || !proc.order) {
    return (
      <div className="rounded-lg border border-core-danger/25 bg-core-danger/5 p-8 text-center">
        <p className="text-core-danger font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-core-muted mt-1">
          {proc.error instanceof Error ? proc.error.message : "Commande introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-core-accent text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  const order = proc.order;
  const profile = proc.profile;
  const account = proc.account;

  const clientName =
    profile?.full_name ||
    [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") ||
    order.client_full_name ||
    "—";
  const clientEmail = order.client_email || profile?.email || "—";
  const orderNumber = order.order_number || `#${order.id.slice(0, 8)}`;
  const totalAmount = order.total_amount != null
    ? `${Number(order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
    : "—";
  const installationType =
    order.installation_type ||
    order.fulfillment_type ||
    (order.requires_technician ? "Technicien" : "Auto-installation");

  const slaInfo = computeSlaCountdown(order.sla_deadline, order.sla_status, order.status);

  return (
    <div className="space-y-3">
      {/* ═══ BACK NAV ═══ */}
      <Link
        to={corePath("/orders")}
        className="inline-flex items-center gap-1.5 text-[11px] text-core-muted hover:text-core-fg transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* ═══ TOPBAR ═══ */}
      <div className="rounded-xl border border-core-border bg-core-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-core-accent/15 border border-core-accent/30 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-4.5 w-4.5 text-core-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold text-core-fg tracking-tight font-mono truncate">
                {orderNumber}
              </h1>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(order.order_number || order.id);
                  toast.success("Copié");
                }}
                className="text-core-muted-soft hover:text-core-fg transition-colors"
                title="Copier"
              >
                <Copy className="h-3 w-3" />
              </button>
              <span className="text-[13px] font-semibold text-core-fg">— {clientName}</span>
            </div>
            <p className="text-[11px] text-core-muted mt-0.5">
              {order.service_type || "—"} · {clientEmail}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <StatusBadge label={order.status} variant={statusToVariant(order.status)} size="sm" />
          {order.payment_status && (
            <StatusBadge label={order.payment_status} variant={statusToVariant(order.payment_status)} size="sm" />
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-core-success/10 border border-core-success/25 px-2.5 py-1 text-[12px] font-semibold text-core-success tabular-nums">
            {totalAmount}
          </span>
          {slaInfo && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono font-semibold tabular-nums ${slaInfo.className}`}
            >
              <Timer className={`h-3 w-3 ${slaInfo.urgency === "overdue" ? "animate-pulse" : ""}`} />
              {slaInfo.label}
            </span>
          )}
          {(profile?.user_id || order.user_id) && (
            <ImpersonateButton
              variant="compact"
              clientId={profile?.user_id || order.user_id}
              clientEmail={clientEmail}
              clientName={clientName}
            />
          )}
          <button
            onClick={() => proc.refetch()}
            className="inline-flex items-center gap-1 rounded-full border border-core-border bg-core-card-raised px-2.5 py-1 text-[11px] text-core-muted hover:text-core-fg hover:border-core-accent/30 transition-colors"
            title="Actualiser"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ═══ HORIZONTAL STEP BAR ═══ */}
      <HorizontalStepBar
        steps={proc.workflow}
        activeStep={proc.activeStep}
        onStepClick={(id) => proc.setActiveStep(id)}
      />

      {/* ═══ MAIN: SIDEBAR | RIGHT CONTENT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-3">
        {/* LEFT SIDEBAR */}
        <SidebarStepList
          steps={proc.workflow}
          activeStep={proc.activeStep}
          onStepClick={(id) => proc.setActiveStep(id)}
        />

        {/* RIGHT CONTENT AREA */}
        <div className="space-y-3 min-w-0">
          {/* Quick client info strip — always visible */}
          <div
            style={{
              display: "flex",
              gap: "16px",
              padding: "12px",
              background: "#111",
              borderRadius: "8px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#666", fontSize: "11px" }}>
              Client: <strong style={{ color: "white" }}>{clientName}</strong>
            </span>
            <span style={{ color: "#666", fontSize: "11px" }}>
              Email: <strong style={{ color: "white" }}>{clientEmail}</strong>
            </span>
            <span style={{ color: "#666", fontSize: "11px" }}>
              Commande: <strong style={{ color: "white" }}>#{order.order_number || order.id.slice(0, 8)}</strong>
            </span>
            <span style={{ color: "#666", fontSize: "11px" }}>
              Montant: <strong style={{ color: "#10B981" }}>{totalAmount}</strong>
            </span>
            <span style={{ color: "#666", fontSize: "11px" }}>
              Type: <strong style={{ color: "#a78bfa" }}>{installationType}</strong>
            </span>
          </div>

          {/* Quick Actions row (preserved) */}
          <CoreQuickActions proc={proc} />

          {/* Active step content — UNCHANGED routing */}
          <div className="rounded-xl border border-core-border bg-core-card p-5 min-h-[520px]">
            <StepContent proc={proc} />
          </div>

          {/* KYC panel (preserved) */}
          <CoreKycPanel order={proc.order} onRefresh={() => proc.refetch()} />
        </div>
      </div>

      {/* ═══ BOTTOM: Activity Timeline ═══ */}
      <CoreActivityTimeline logs={proc.activityLogs} onAddNote={proc.addNote} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * HORIZONTAL STEP BAR — 11 step pills, scrollable
 * ═══════════════════════════════════════════════════════ */
function HorizontalStepBar({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}) {
  return (
    <div className="rounded-xl border border-core-border bg-core-card px-3 py-3">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";

          let pillClass =
            "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap border ";
          if (isActive) {
            pillClass +=
              "bg-core-accent text-white border-core-accent shadow-[0_0_18px_-4px_hsl(var(--core-accent)/0.6)]";
          } else if (isCompleted) {
            pillClass +=
              "bg-core-success/10 text-core-success border-core-success/30 hover:bg-core-success/15";
          } else if (isBlocked) {
            pillClass +=
              "bg-core-danger/10 text-core-danger border-core-danger/30 hover:bg-core-danger/15";
          } else {
            pillClass +=
              "bg-core-card-raised text-core-muted border-core-border hover:text-core-fg hover:border-core-accent/30";
          }

          return (
            <button key={step.id} onClick={() => onStepClick(step.id)} className={pillClass} title={step.label}>
              {isCompleted && !isActive ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : isBlocked && !isActive ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold bg-black/20">
                  {idx + 1}
                </span>
              )}
              {step.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 * LEFT SIDEBAR — Step list with status dots
 * ═══════════════════════════════════════════════════════ */
function SidebarStepList({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}) {
  const completedCount = steps.filter((s) => s.status === "completed").length;

  return (
    <aside className="rounded-xl border border-core-border bg-core-card overflow-hidden self-start">
      <div className="px-3.5 py-3 border-b border-core-border flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-core-muted">Étapes</h3>
        <span className="text-[10px] font-mono text-core-accent tabular-nums">
          {completedCount}/{steps.length}
        </span>
      </div>

      <nav className="p-1.5 space-y-0.5">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";

          let rowClass =
            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 border ";
          if (isActive) {
            rowClass += "bg-core-accent/15 border-core-accent/30";
          } else {
            rowClass += "border-transparent hover:bg-core-card-raised hover:border-core-border";
          }

          return (
            <button key={step.id} onClick={() => onStepClick(step.id)} className={rowClass}>
              <span className="shrink-0">
                {isActive ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-core-accent text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                ) : isCompleted ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-core-success" />
                ) : isBlocked ? (
                  <AlertTriangle className="w-[18px] h-[18px] text-core-danger" />
                ) : (
                  <Circle className="w-[18px] h-[18px] text-core-muted-soft" />
                )}
              </span>

              <span
                className={`text-[12px] truncate flex-1 ${
                  isActive
                    ? "text-core-accent font-semibold"
                    : isCompleted
                    ? "text-core-fg/80"
                    : isBlocked
                    ? "text-core-danger"
                    : "text-core-muted"
                }`}
              >
                {step.label}
              </span>

              {/* Status dot */}
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isCompleted
                    ? "bg-core-success"
                    : isBlocked
                    ? "bg-core-danger"
                    : isActive
                    ? "bg-core-accent"
                    : "bg-core-border-strong"
                }`}
              />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════
 * SLA helper
 * ═══════════════════════════════════════════════════════ */
function computeSlaCountdown(
  deadline: string | null | undefined,
  status: string | null | undefined,
  orderStatus: string,
): { label: string; className: string; urgency: "ok" | "warning" | "overdue" } | null {
  if (["activated", "completed", "cancelled", "installation_completed", "delivered"].includes(orderStatus)) {
    return null;
  }
  if (!deadline) return null;

  const minsLeft = differenceInMinutes(new Date(deadline), new Date());

  if (status === "overdue" || minsLeft < 0) {
    const overdue = Math.abs(minsLeft);
    const label = overdue >= 60 ? `DÉPASSÉ ${Math.floor(overdue / 60)}h` : `DÉPASSÉ ${overdue}min`;
    return { label, className: "bg-core-danger/15 text-core-danger border-core-danger/30", urgency: "overdue" };
  }
  if (minsLeft < 60 || status === "warning") {
    return { label: `${minsLeft} min`, className: "bg-core-warning/15 text-core-warning border-core-warning/30", urgency: "warning" };
  }
  const hoursLeft = Math.floor(minsLeft / 60);
  return {
    label: `${hoursLeft}h restantes`,
    className: "bg-core-success/15 text-core-success border-core-success/30",
    urgency: "ok",
  };
}

export default CoreOrderDetail;
