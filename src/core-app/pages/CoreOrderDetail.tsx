/**
 * CoreOrderDetail — Unified professional order file & processing console
 * 
 * Layout: Header → Account Summary → Quick Actions → [ Workflow Nav | Processing Steps | Order File ]
 * → Activity Timeline
 */
import { useParams, Link } from "react-router-dom";
import { useOrderProcessing, WorkflowStepId } from "@/core-app/hooks/useOrderProcessing";
import { corePath } from "@/core-app/lib/corePaths";
import { CoreOrderHeader } from "@/core-app/components/order-detail/CoreOrderHeader";
import { CoreAccountSummary } from "@/core-app/components/order-detail/CoreAccountSummary";
import { CoreQuickActions } from "@/core-app/components/order-detail/CoreQuickActions";
import { CoreWorkflowNav } from "@/core-app/components/order-detail/CoreWorkflowNav";
import { CoreOrderFilePanel } from "@/core-app/components/order-detail/CoreOrderFilePanel";
import { CoreActivityTimeline } from "@/core-app/components/order-detail/CoreActivityTimeline";
import { CoreKycPanel } from "@/core-app/components/order-detail/CoreKycPanel";
import { CoreOrderQuickInfo } from "@/core-app/components/order-detail/CoreOrderQuickInfo";
import { StepContent } from "@/core-app/components/order-processing/StepContent";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-3 text-xs text-muted-foreground">Chargement du dossier…</span>
      </div>
    );
  }

  if (proc.error || !proc.order) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-destructive font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-muted-foreground mt-1">
          {proc.error instanceof Error ? proc.error.message : "Commande introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-primary text-xs mt-3 inline-block hover:opacity-80">
          ← Retour aux commandes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ═══ BACK NAV ═══ */}
      <Link
        to={corePath("/orders")}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Commandes
      </Link>

      {/* ═══ HEADER ═══ */}
      <CoreOrderHeader
        order={proc.order}
        profile={proc.profile}
        account={proc.account}
        appointment={proc.appointment}
        onRefresh={() => proc.refetch()}
      />

      {/* ═══ ACCOUNT SUMMARY ═══ */}
      <CoreAccountSummary account={proc.account} />

      {/* ═══ QUICK ACTIONS ═══ */}
      <CoreQuickActions proc={proc} />

      {/* ═══ KYC PANEL (manual identity verification) ═══ */}
      <CoreKycPanel order={proc.order} onRefresh={() => proc.refetch()} />

      {/* ═══ QUICK INFO (DOB, service address, equipment, appointment, promo, discount) ═══ */}
      <CoreOrderQuickInfo proc={proc} />

      {/* ═══ MAIN LAYOUT: Workflow | Steps | Order File ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_300px] gap-3">
        {/* LEFT: Workflow Navigation */}
        <CoreWorkflowNav
          steps={proc.workflow}
          activeStep={proc.activeStep}
          onStepClick={(id: WorkflowStepId) => proc.setActiveStep(id)}
        />

        <div className="rounded-lg border border-border bg-card p-5 min-h-[520px]">
          <StepContent proc={proc} />
        </div>

        {/* RIGHT: Order File Panel */}
        <CoreOrderFilePanel proc={proc} />
      </div>

      {/* ═══ BOTTOM: Activity Timeline ═══ */}
      <CoreActivityTimeline logs={proc.activityLogs} onAddNote={proc.addNote} />
    </div>
  );
}

export default CoreOrderDetail;
