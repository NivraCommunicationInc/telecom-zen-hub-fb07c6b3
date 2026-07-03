import { Button } from "@/components/ui/button";
import { Zap, Wrench, Package, Clock, MapPin, AlertTriangle } from "lucide-react";
import type { InstallationDecision } from "@/lib/installationLogic";
import { INSTALLATION_MESSAGES } from "@/lib/installationLogic";

interface Props {
  decision: InstallationDecision;
  isFrench: boolean;
  distanceKm: number;
  onChooseAutoInstall?: () => void;
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

  // High-contrast palette — all on white card, dark text guaranteed readable
  const themeMap = {
    rapid:       { bg: "#ECFDF5", border: "#10B981", icon: "#047857", accent: "#047857" },
    uncertain:   { bg: "#FFFBEB", border: "#F59E0B", icon: "#B45309", accent: "#B45309" },
    heavy_work:  { bg: "#FFF7ED", border: "#F97316", icon: "#C2410C", accent: "#C2410C" },
    remote_auto: { bg: "#EFF6FF", border: "#3B82F6", icon: "#1D4ED8", accent: "#1D4ED8" },
    remote_tech: { bg: "#FFF7ED", border: "#F97316", icon: "#C2410C", accent: "#C2410C" },
  };
  const theme = themeMap[decision.messageKey];

  return (
    <div
      className="rounded-xl border-2 p-5 space-y-4"
      style={{ background: theme.bg, borderColor: theme.border }}
    >
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-white shadow-sm border border-[#E5E7EB]">
          <Icon className="w-6 h-6" style={{ color: theme.icon }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[#1A1A2E]">{text.title}</h3>
          <p className="text-sm text-[#374151] mt-1 leading-relaxed">{text.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-white text-[#1A1A2E] border border-[#E5E7EB]">
          <MapPin className="w-3 h-3" />
          {zoneLabels[decision.zone]} ({Math.round(distanceKm)} km)
        </span>
        {decision.installationType === "technician" && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-[#0066CC] border border-[#0066CC]/30">
            {decision.technicianLevel === "level_1"
              ? (isFrench ? "Technicien" : "Technician")
              : (isFrench ? "Technicien spécialisé" : "Specialized technician")}
          </span>
        )}
        {decision.installationType === "auto" && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-[#00A651] border border-[#00A651]/30">
            {isFrench ? "Auto-installation" : "Self-installation"}
          </span>
        )}
      </div>

      {decision.needsFallbackTicket && decision.installationType === "auto" && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-white border border-[#E5E7EB] text-sm">
          <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
          <p className="text-[#374151] leading-relaxed">
            {isFrench
              ? "Si l'activation ne fonctionne pas après réception de l'équipement, un rendez-vous avec un technicien spécialisé (3-5 jours) sera automatiquement proposé."
              : "If activation doesn't work after receiving the equipment, an appointment with a specialized technician (3-5 days) will be automatically offered."}
          </p>
        </div>
      )}

      {decision.messageKey === "remote_auto" && onChooseAutoInstall && onChooseTechnician && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button onClick={onChooseAutoInstall} className="gap-2 bg-[#0066CC] hover:bg-[#0052A3] text-white">
            <Package className="w-4 h-4" />
            {isFrench ? "Recevoir l'équipement" : "Receive equipment"}
          </Button>
          <Button variant="outline" onClick={onChooseTechnician} className="gap-2 border-[#0066CC] text-[#0066CC] hover:bg-[#0066CC]/5">
            <Wrench className="w-4 h-4" />
            {isFrench ? "Technicien (3-5 jours)" : "Technician (3-5 days)"}
          </Button>
        </div>
      )}
    </div>
  );
}
