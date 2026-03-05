/**
 * E2E Installation Test Harness — DEV ONLY
 * Renders all 5 installation scenarios side by side for screenshot validation.
 * No auth required. Stripped from production builds.
 */
import { useState, useCallback } from "react";
import { CablingQuestionnaire } from "@/components/installation/CablingQuestionnaire";
import { InstallationDecisionDisplay } from "@/components/installation/InstallationDecisionDisplay";
import { SmartSlotPicker } from "@/components/installation/SmartSlotPicker";
import {
  determineInstallation,
  type CablingQuestionnaire as CablingData,
  type InstallationDecision,
} from "@/lib/installationLogic";

interface ScenarioProps {
  label: string;
  distanceKm: number;
  prefilledAnswers?: CablingData;
}

function Scenario({ label, distanceKm, prefilledAnswers }: ScenarioProps) {
  const [decision, setDecision] = useState<InstallationDecision | null>(
    prefilledAnswers ? determineInstallation(distanceKm, prefilledAnswers) : null
  );
  const [overrideToTech, setOverrideToTech] = useState(false);

  const handleComplete = useCallback(
    (answers: CablingData) => {
      const result = determineInstallation(distanceKm, answers);
      setDecision(result);
    },
    [distanceKm]
  );

  const handleChooseTechnician = useCallback(() => {
    if (!decision) return;
    setOverrideToTech(true);
    setDecision({ ...decision, installationType: "technician", messageKey: "remote_tech" });
  }, [decision]);

  return (
    <div className="border-2 border-border rounded-xl p-4 space-y-4 bg-background">
      <h2 className="text-lg font-bold text-foreground">{label}</h2>
      <p className="text-xs text-muted-foreground">Distance: {distanceKm} km</p>

      {/* Show questionnaire only if no prefilled answers */}
      {!prefilledAnswers && (
        <CablingQuestionnaire isFrench onComplete={handleComplete} />
      )}

      {/* Decision display */}
      {decision && (
        <InstallationDecisionDisplay
          decision={decision}
          isFrench
          distanceKm={distanceKm}
          onChooseAutoInstall={decision.messageKey === "remote_auto" ? () => {} : undefined}
          onChooseTechnician={decision.messageKey === "remote_auto" ? handleChooseTechnician : undefined}
        />
      )}

      {/* Slot picker: ONLY if decision exists AND is technician */}
      {decision && (decision.installationType === "technician" || overrideToTech) && (
        <SmartSlotPicker
          decision={decision}
          isFrench
          selectedDate=""
          selectedTime=""
          onSelect={() => {}}
        />
      )}

      {/* Guard proof: Show explicit "no slots" when no decision */}
      {!decision && (
        <div className="p-4 rounded-lg bg-muted/50 border border-dashed border-border text-center">
          <p className="text-sm text-muted-foreground font-medium">
            ⛔ Aucun créneau — Veuillez compléter le questionnaire
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            decision = null | SmartSlotPicker non rendu
          </p>
        </div>
      )}

      {/* Debug info */}
      {decision && (
        <pre className="text-[10px] bg-zinc-900 text-green-400 p-3 rounded-lg overflow-x-auto">
{JSON.stringify({
  zone: decision.zone,
  installationType: decision.installationType,
  technicianLevel: decision.technicianLevel,
  sameDayPossible: decision.sameDayPossible,
  minLeadDays: decision.minLeadDays,
  maxLeadDays: decision.maxLeadDays,
  riskyCoax: decision.riskyCoax,
  readinessScore: decision.readinessScore,
  needsFallbackTicket: decision.needsFallbackTicket,
  messageKey: decision.messageKey,
}, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function E2eInstallTest() {
  if (import.meta.env.PROD) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center">🧪 E2E Installation Test Harness</h1>
      <p className="text-center text-zinc-400 text-sm">5 scénarios — Preuves UI pour validation coax quick-check</p>

      <div className="grid grid-cols-1 gap-8 max-w-3xl mx-auto">
        {/* Scenario 1: Before questionnaire — NO slots */}
        <Scenario
          label="CAS 1 — Avant questionnaire (aucun créneau)"
          distanceKm={20}
        />

        {/* Scenario 2: Zone A — coax OK */}
        <Scenario
          label="CAS 2 — Zone A: Coax OK + Service récent"
          distanceKm={20}
          prefilledAnswers={{ hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" }}
        />

        {/* Scenario 3: Zone A — RISKY_COAX */}
        <Scenario
          label="CAS 3 — Zone A: RISKY_COAX (câble absent, service inconnu)"
          distanceKm={30}
          prefilledAnswers={{ hasCoaxial: "yes", cableStatus: "no", previousService: "unknown" }}
        />

        {/* Scenario 4: Zone A — Coax absent */}
        <Scenario
          label="CAS 4 — Zone A: Coax absent (N2 requis)"
          distanceKm={25}
          prefilledAnswers={{ hasCoaxial: "no", cableStatus: "no", previousService: "no" }}
        />

        {/* Scenario 5: Zone C — Auto-install */}
        <Scenario
          label="CAS 5 — Zone C (>70km): Auto-install + fallback"
          distanceKm={120}
          prefilledAnswers={{ hasCoaxial: "yes", cableStatus: "yes", previousService: "yes" }}
        />
      </div>
    </div>
  );
}
