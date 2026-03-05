/**
 * InstallationScheduler — Full flow component
 * 1. Cabling questionnaire
 * 2. Decision display
 * 3. Smart slot picker (or auto-install confirmation)
 * 
 * Drop-in replacement for the old installation method + date picker sections.
 */
import { useState, useCallback } from "react";
import { format, addDays } from "date-fns";
import { portalClient } from "@/integrations/backend/portalClient";
import { CablingQuestionnaire } from "./CablingQuestionnaire";
import { InstallationDecisionDisplay } from "./InstallationDecisionDisplay";
import { SmartSlotPicker } from "./SmartSlotPicker";
import {
  determineInstallation,
  distanceFromMontreal,
  isSameDayStillAvailable,
  type CablingQuestionnaire as CablingData,
  type InstallationDecision,
} from "@/lib/installationLogic";

interface SlotData {
  id: string;
  slot_date: string;
  time_slot: string;
  capacity: number;
  booked: number;
}

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
  const [availableSlots, setAvailableSlots] = useState<SlotData[]>([]);
  const [installationId, setInstallationId] = useState<string | null>(null);

  const distanceKm =
    lat && lng ? distanceFromMontreal(lat, lng) : (fallbackDistanceKm ?? 20);

  const fetchSlots = useCallback(async (targetDecision: InstallationDecision) => {
    if (targetDecision.installationType !== "technician") {
      setAvailableSlots([]);
      return;
    }

    const startDay = targetDecision.sameDayPossible && !targetDecision.riskyCoax && isSameDayStillAvailable()
      ? 0
      : targetDecision.minLeadDays;

    const fromDate = format(addDays(new Date(), startDay), "yyyy-MM-dd");
    const toDate = format(addDays(new Date(), targetDecision.maxLeadDays), "yyyy-MM-dd");

    let query = portalClient
      .from("technician_slots")
      .select("id, slot_date, time_slot, capacity, booked")
      .eq("is_active", true)
      .eq("technician_level", targetDecision.technicianLevel)
      .gte("slot_date", fromDate)
      .lte("slot_date", toDate)
      .order("slot_date", { ascending: true })
      .order("time_slot", { ascending: true });

    if (targetDecision.zone === "zone_a" || targetDecision.zone === "zone_b") {
      query = query.eq("region", "montreal");
    }

    const { data } = await query;
    setAvailableSlots((data || []) as SlotData[]);
  }, []);

  const recordInstallation = useCallback(async (answers: CablingData, targetDecision: InstallationDecision) => {
    const { data: authData } = await portalClient.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return null;

    const { data } = await portalClient.from("installations").insert({
      client_id: userId,
      installation_type: targetDecision.installationType,
      technician_level: targetDecision.technicianLevel,
      zone: targetDecision.zone,
      status: "pending",
      distance_km: Number(distanceKm.toFixed(2)),
      has_coaxial: answers.hasCoaxial,
      cable_status: answers.cableStatus,
      previous_service: answers.previousService,
      readiness_score: targetDecision.readinessScore,
      needs_fallback_ticket: targetDecision.needsFallbackTicket,
      notes: "coax_quick_check",
    }).select("id").single();

    if (data?.id) {
      setInstallationId(data.id);
    }
    return data?.id || null;
  }, [distanceKm]);

  const handleQuestionnaireComplete = useCallback(
    async (answers: CablingData) => {
      setCablingAnswers(answers);
      const result = determineInstallation(distanceKm, answers);
      setDecision(result);
      onInstallationTypeChange(result.installationType, result.technicianLevel);
      onDecisionMade?.(result);

      await Promise.all([
        recordInstallation(answers, result),
        fetchSlots(result),
      ]);
    },
    [distanceKm, onInstallationTypeChange, onDecisionMade, recordInstallation, fetchSlots]
  );

  const handleChooseAuto = useCallback(() => {
    if (!decision) return;
    setAvailableSlots([]);
    onInstallationTypeChange("auto", "level_2");
  }, [decision, onInstallationTypeChange]);

  const handleChooseTechnician = useCallback(async () => {
    if (!decision) return;
    setOverrideToTech(true);
    const updated: InstallationDecision = {
      ...decision,
      installationType: "technician",
      messageKey: "remote_tech",
    };
    setDecision(updated);
    onInstallationTypeChange("technician", "level_2");
    await fetchSlots(updated);
  }, [decision, onInstallationTypeChange, fetchSlots]);

  const handleSlotSelect = useCallback(async (date: string, time: string, slotId?: string) => {
    onDateTimeChange(date, time);

    // Atomic booking via RPC if we have slot + installation IDs
    if (slotId && installationId) {
      const { data } = await portalClient.rpc("book_slot", {
        p_slot_id: slotId,
        p_installation_id: installationId,
      });
      console.log("[InstallationScheduler] book_slot result:", data);
    }
  }, [onDateTimeChange, installationId]);

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
          availableSlots={availableSlots}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onSelect={handleSlotSelect}
        />
      )}
    </div>
  );
}
