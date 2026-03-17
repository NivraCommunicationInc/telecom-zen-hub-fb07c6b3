/**
 * OrderProcessingWorkspace — Main layout for admin order processing
 * White background, professional telecom UI.
 * Layout: Header → [ Left Steps | Center Panel | Right Summary ] → Bottom Timeline
 */
import { useOrderProcessing, WorkflowStepId } from "@/core-app/hooks/useOrderProcessing";
import { OrderProcessingHeader } from "./OrderProcessingHeader";
import { WorkflowStepNav } from "./WorkflowStepNav";
import { StepContent } from "./StepContent";
import { OrderSummaryPanel } from "./OrderSummaryPanel";
import { ActivityTimeline } from "./ActivityTimeline";
import { Loader2 } from "lucide-react";

interface Props {
  orderId: string;
}

export function OrderProcessingWorkspace({ orderId }: Props) {
  const proc = useOrderProcessing(orderId);

  if (proc.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-lg border border-gray-200">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">Chargement de la commande…</span>
      </div>
    );
  }

  if (proc.error || !proc.order) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-8 text-center">
        <p className="text-red-600 font-medium">Erreur de chargement</p>
        <p className="text-sm text-gray-500 mt-1">
          {proc.error instanceof Error ? proc.error.message : "Commande introuvable"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ HEADER ═══ */}
      <OrderProcessingHeader proc={proc} />

      {/* ═══ MAIN LAYOUT: Steps | Content | Summary ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_300px] gap-4">
        {/* LEFT: Workflow Steps */}
        <WorkflowStepNav
          steps={proc.workflow}
          activeStep={proc.activeStep}
          onStepClick={(id: WorkflowStepId) => proc.setActiveStep(id)}
        />

        {/* CENTER: Active Step Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 min-h-[500px]">
          <StepContent proc={proc} />
        </div>

        {/* RIGHT: Order Summary */}
        <OrderSummaryPanel proc={proc} />
      </div>

      {/* ═══ BOTTOM: Activity Timeline ═══ */}
      <ActivityTimeline logs={proc.activityLogs} onAddNote={proc.addNote} />
    </div>
  );
}
