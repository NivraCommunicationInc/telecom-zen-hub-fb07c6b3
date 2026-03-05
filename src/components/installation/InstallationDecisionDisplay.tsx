import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Wrench, Package, Clock, MapPin } from "lucide-react";
import type { InstallationDecision } from "@/lib/installationLogic";
import { INSTALLATION_MESSAGES } from "@/lib/installationLogic";

interface Props {
  decision: InstallationDecision;
  isFrench: boolean;
  distanceKm: number;
  /** Called when user wants auto-install (Zone C) instead of technician */
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
    zone_a: isFrench ? "Zone A — Grand Montréal" : "Zone A — Greater Montreal",
    zone_b: isFrench ? "Zone B — Câblage requis" : "Zone B — Cabling required",
    zone_c: isFrench ? "Zone C — Région éloignée" : "Zone C — Remote region",
  };

  const levelLabels: Record<string, string> = {
    level_1: isFrench ? "Technicien Niveau 1" : "Level 1 Technician",
    level_2: isFrench ? "Technicien Niveau 2 (spécialisé)" : "Level 2 Technician (specialized)",
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

  const badgeColor = {
    rapid: "bg-emerald-500",
    uncertain: "bg-amber-500",
    heavy_work: "bg-orange-500",
    remote_auto: "bg-blue-500",
    remote_tech: "bg-orange-500",
  };

  return (
    <Card className={`${colorMap[decision.messageKey]} border-2`}>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-background/80 shadow-sm">
            <Icon className="w-6 h-6 text-primary" />
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
            <Badge className={badgeColor[decision.messageKey]}>
              {levelLabels[decision.technicianLevel]}
            </Badge>
          )}
          {decision.installationType === "auto" && (
            <Badge className="bg-blue-500">
              {isFrench ? "Auto-installation" : "Self-installation"}
            </Badge>
          )}
        </div>

        {/* Zone C: offer choice between auto and technician */}
        {decision.messageKey === "remote_auto" && onChooseAutoInstall && onChooseTechnician && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button onClick={onChooseAutoInstall} className="gap-2">
              <Package className="w-4 h-4" />
              {isFrench ? "Recevoir le modem" : "Receive the modem"}
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
