/**
 * InstallationScheduler — Full flow component
 * 1. Cabling questionnaire
 * 2. Decision display
 * 3. Smart slot picker (or auto-install confirmation)
 * 
 * Drop-in replacement for the old installation method + date picker sections.
 */
import { useState, useCallback } from "react";
import { CablingQuestionnaire } from "./CablingQuestionnaire";
import { InstallationDecisionDisplay } from "./InstallationDecisionDisplay";
import { SmartSlotPicker } from "./SmartSlotPicker";
import {
  determineInstallation,
  distanceFromMontreal,
  type CablingQuestionnaire as CablingData,
  type InstallationDecision,
} from "@/lib/installationLogic";

interface Props {
  isFrench: boolean;
  /** Client address lat/lng for distance calc */
  lat?: number;
  lng?: number;
  /** Fallback if no lat/lng: assume zone A */
  fallbackDistanceKm?: number;
  /** Currently selected date/time */
  selectedDate: string;
  selectedTime: string;
  /** Callbacks */
  onDateTimeChange: (date: string, time: string) => void;
  onInstallationTypeChange: (type: "auto" | "technician", level: "level_1" | "level_2") => void;
  onDecisionMade?: (decision: InstallationDecision) => void;
}

export function InstallationScheduler({
  isFrench,
  lat,
  lng,
  fallbackDistanceKm,
  selectedDate,
  selectedTime,
  onDateTimeChange,
  onInstallationTypeChange,
  onDecisionMade,
}: Props) {
  const [cablingAnswers, setCablingAnswers] = useState<CablingData | null>(null);
  const [decision, setDecision] = useState<InstallationDecision | null>(null);
  const [overrideToTech, setOverrideToTech] = useState(false);

  const distanceKm =
    lat && lng ? distanceFromMontreal(lat, lng) : (fallbackDistanceKm ?? 20);

  const handleQuestionnaireComplete = useCallback(
    (answers: CablingData) => {
      setCablingAnswers(answers);
      const result = determineInstallation(distanceKm, answers);
      setDecision(result);
      onInstallationTypeChange(result.installationType, result.technicianLevel);
      onDecisionMade?.(result);
    },
    [distanceKm, onInstallationTypeChange, onDecisionMade]
  );

  const handleChooseAuto = useCallback(() => {
    if (!decision) return;
    onInstallationTypeChange("auto", "level_2");
  }, [decision, onInstallationTypeChange]);

  const handleChooseTechnician = useCallback(() => {
    if (!decision) return;
    setOverrideToTech(true);
    const updated: InstallationDecision = {
      ...decision,
      installationType: "technician",
      messageKey: "remote_tech",
    };
    setDecision(updated);
    onInstallationTypeChange("technician", "level_2");
  }, [decision, onInstallationTypeChange]);

  return (
    <div className="space-y-4">
      {/* Step 1: Questionnaire */}
      <CablingQuestionnaire
        isFrench={isFrench}
        onComplete={handleQuestionnaireComplete}
        initialValues={cablingAnswers || undefined}
      />

      {/* Step 2: Decision */}
      {decision && (
        <InstallationDecisionDisplay
          decision={decision}
          isFrench={isFrench}
          distanceKm={distanceKm}
          onChooseAutoInstall={decision.messageKey === "remote_auto" ? handleChooseAuto : undefined}
          onChooseTechnician={decision.messageKey === "remote_auto" ? handleChooseTechnician : undefined}
        />
      )}

      {/* Step 3: Slot picker (only for technician installs) */}
      {decision && (decision.installationType === "technician" || overrideToTech) && (
        <SmartSlotPicker
          decision={decision}
          isFrench={isFrench}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onSelect={onDateTimeChange}
        />
      )}
    </div>
  );
}
