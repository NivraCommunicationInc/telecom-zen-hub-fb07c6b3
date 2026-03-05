import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Wrench, Package, Clock, MapPin, AlertTriangle } from "lucide-react";
import type { InstallationDecision } from "@/lib/installationLogic";
import { INSTALLATION_MESSAGES } from "@/lib/installationLogic";

interface Props {
  decision: InstallationDecision;
  isFrench: boolean;
  distanceKm: number;
  /** Called when user wants auto-install (Zone C) */
  onChooseAutoInstall?: () => void;
  /** Called when user wants technician (Zone C fallback) */
  onChooseTechnician?: () => void;
}

export function InstallationDecisionDisplay({
  decision,
  isFrench,
  distanceKm,
  onChooseAutoInstall,
  onChooseTechnician,
}: Props) {
  const msg = INSTALLATION_MESSAGES[decision.messageKey];
  const text = isFrench ? msg.fr : msg.en;

  const zoneLabels: Record<string, string> = {
    zone_a: isFrench ? "Grand Montréal" : "Greater Montreal",
    zone_b: isFrench ? "Câblage requis" : "Cabling required",
    zone_c: isFrench ? "Région éloignée" : "Remote region",
  };

  const iconMap = {
    rapid: Zap,
    uncertain: Clock,
    heavy_work: Wrench,
    remote_auto: Package,
    remote_tech: Wrench,
  };
  const Icon = iconMap[decision.messageKey];

  const colorMap = {
    rapid: "border-emerald-500/50 bg-emerald-500/5",
    uncertain: "border-amber-500/50 bg-amber-500/5",
    heavy_work: "border-orange-500/50 bg-orange-500/5",
    remote_auto: "border-blue-500/50 bg-blue-500/5",
    remote_tech: "border-orange-500/50 bg-orange-500/5",
  };

  const iconColor = {
    rapid: "text-emerald-600",
    uncertain: "text-amber-600",
    heavy_work: "text-orange-600",
    remote_auto: "text-blue-600",
    remote_tech: "text-orange-600",
  };

  return (
    <Card className={`${colorMap[decision.messageKey]} border-2`}>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-background/80 shadow-sm">
            <Icon className={`w-6 h-6 ${iconColor[decision.messageKey]}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{text.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{text.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <MapPin className="w-3 h-3" />
            {zoneLabels[decision.zone]} ({Math.round(distanceKm)} km)
          </Badge>
          {decision.installationType === "technician" && (
            <Badge variant="secondary">
              {decision.technicianLevel === "level_1"
                ? (isFrench ? "Technicien" : "Technician")
                : (isFrench ? "Technicien spécialisé" : "Specialized technician")}
            </Badge>
          )}
          {decision.installationType === "auto" && (
            <Badge variant="secondary">
              {isFrench ? "Auto-installation" : "Self-installation"}
            </Badge>
          )}
        </div>

        {/* Auto-install fallback notice */}
        {decision.needsFallbackTicket && decision.installationType === "auto" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-background/60 border border-border text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              {isFrench
                ? "Si l'activation ne fonctionne pas après réception de l'équipement, un rendez-vous avec un technicien spécialisé (3-5 jours) sera automatiquement proposé."
                : "If activation doesn't work after receiving the equipment, an appointment with a specialized technician (3-5 days) will be automatically offered."}
            </p>
          </div>
        )}

        {/* Zone C: offer choice between auto and technician */}
        {decision.messageKey === "remote_auto" && onChooseAutoInstall && onChooseTechnician && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button onClick={onChooseAutoInstall} className="gap-2">
              <Package className="w-4 h-4" />
              {isFrench ? "Recevoir l'équipement" : "Receive equipment"}
            </Button>
            <Button variant="outline" onClick={onChooseTechnician} className="gap-2">
              <Wrench className="w-4 h-4" />
              {isFrench ? "Technicien (3-5 jours)" : "Technician (3-5 days)"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
