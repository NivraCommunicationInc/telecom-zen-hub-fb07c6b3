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
import { StepContent } from "@/core-app/components/order-processing/StepContent";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";

import "@/core-app/styles/core-dark-processing.css";

const CoreOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();

  if (!orderId) {
    return (
      <div className="py-20 text-center">
        <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-[hsl(220,10%,40%)] text-xs">Commande introuvable</p>
        <Link to={corePath("/orders")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">
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
        <Loader2 className="h-6 w-6 animate-spin text-[hsl(220,10%,40%)]" />
        <span className="ml-3 text-xs text-[hsl(220,10%,50%)]">Chargement du dossier…</span>
      </div>
    );
  }

  if (proc.error || !proc.order) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400 font-medium text-sm">Erreur de chargement</p>
        <p className="text-xs text-[hsl(220,10%,45%)] mt-1">
          {proc.error instanceof Error ? proc.error.message : "Commande introuvable"}
        </p>
        <Link to={corePath("/orders")} className="text-blue-400 text-xs mt-3 inline-block hover:underline">
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
        className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors"
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

      {/* ═══ MAIN LAYOUT: Workflow | Steps | Order File ═══ */}
      <div className="core-dark-processing grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-3">
        {/* LEFT: Workflow Navigation */}
        <CoreWorkflowNav
          steps={proc.workflow}
          activeStep={proc.activeStep}
          onStepClick={(id: WorkflowStepId) => proc.setActiveStep(id)}
        />

        {/* CENTER: Active Step Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 min-h-[520px]">
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
