/**
 * KycSessionChoice — Presents user with explicit choice when a pending/approved KYC session exists.
 * Never silently bypasses. Always requires user action.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, RefreshCw, FileCheck, Clock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type KycChoice = "reuse" | "restart" | null;

interface KycSessionChoiceProps {
  sessionStatus: string; // approved, submitted, manual_review, created
  sessionId: string;
  caseNumber?: string;
  onChoice: (choice: KycChoice) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  approved: { label: "Approuvée", color: "text-emerald-600", icon: ShieldCheck },
  manual_review: { label: "En révision", color: "text-amber-600", icon: Clock },
  submitted: { label: "Soumise", color: "text-amber-600", icon: FileCheck },
  created: { label: "En cours", color: "text-muted-foreground", icon: Clock },
};

export function KycSessionChoice({ sessionStatus, sessionId, caseNumber, onChoice }: KycSessionChoiceProps) {
  const statusInfo = STATUS_LABELS[sessionStatus] || STATUS_LABELS.created;
  const StatusIcon = statusInfo.icon;
  const isApproved = sessionStatus === "approved";

  return (
    <Card className="border-border bg-card">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-start gap-3">
          <StatusIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statusInfo.color}`} />
          <div className="space-y-1">
            <p className="font-medium text-sm">
              Vérification d'identité existante
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {caseNumber || sessionId.slice(0, 8)}
              </Badge>
              <span className={`text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            {isApproved ? (
              <p className="text-xs text-muted-foreground mt-1">
                Votre identité a été vérifiée et approuvée. Vous pouvez réutiliser cette vérification.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Une vérification est en cours de traitement. Vous pouvez l'utiliser ou en démarrer une nouvelle.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="gap-2 h-auto py-3 justify-start text-left"
            onClick={() => onChoice("reuse")}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {isApproved ? "Utiliser cette vérification" : "Utiliser la vérification en cours"}
              </p>
              <p className="text-xs text-muted-foreground font-normal">
                {isApproved ? "Aucun document supplémentaire requis" : "Documents déjà soumis"}
              </p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="gap-2 h-auto py-3 justify-start text-left"
            onClick={() => onChoice("restart")}
          >
            <RefreshCw className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Nouvelle vérification</p>
              <p className="text-xs text-muted-foreground font-normal">
                Soumettre de nouveaux documents
              </p>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
