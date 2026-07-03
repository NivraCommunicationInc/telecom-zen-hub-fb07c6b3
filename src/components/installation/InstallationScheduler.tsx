/**
 * InstallationScheduler — Full flow component
 * 1. Cabling questionnaire
 * 2. Decision display
 * 3. Smart slot picker (or auto-install confirmation)
 * 
 * Drop-in replacement for the old installation method + date picker sections.
 */
import { useState, useCallback, useEffect } from "react";
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
import { createAppointmentHold, restoreAppointmentHold, type AppointmentHold } from "@/lib/appointmentHold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

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
  confirmedAppointment?: boolean;
  onAppointmentConfirmedChange?: (confirmed: boolean) => void;
  /** "choice" = show questionnaire + verdict only; "schedule" = show verdict recap + calendar */
  phase?: "choice" | "schedule";
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
  confirmedAppointment,
  onAppointmentConfirmedChange,
  phase = "choice",
}: Props) {
  const showQuestionnaire = phase === "choice";
  const showSchedule = phase === "schedule";
  const [cablingAnswers, setCablingAnswers] = useState<CablingData | null>(null);
  const [decision, setDecision] = useState<InstallationDecision | null>(null);
  const [overrideToTech, setOverrideToTech] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<SlotData[]>([]);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [activeHold, setActiveHold] = useState<AppointmentHold | null>(null);
  const [holdLoading, setHoldLoading] = useState(false);
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(confirmedAppointment ?? false);

  useEffect(() => {
    if (typeof confirmedAppointment === "boolean") {
      setAppointmentConfirmed(confirmedAppointment);
    }
  }, [confirmedAppointment]);

  // Restore existing hold on mount
  useEffect(() => {
    const restore = async () => {
      const hold = await restoreAppointmentHold();
      if (hold) {
        setActiveHold(hold);
        setAppointmentConfirmed(true);
        onAppointmentConfirmedChange?.(true);
        const normalizedDate = new Date(hold.scheduledAt).toISOString();
        onDateTimeChange(normalizedDate, hold.timeSlot);
        console.log("[InstallationScheduler] Restored hold:", hold.appointmentId, "date:", normalizedDate, "time:", hold.timeSlot);
      }
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    setAppointmentConfirmed(false);
    onAppointmentConfirmedChange?.(false);
    setHoldLoading(true);

    try {
      const hold = await createAppointmentHold({
        scheduledAt: date,
        timeSlot: time,
        serviceType: "Internet",
        installationMethod: decision?.installationType || "auto",
        installationId: installationId || undefined,
        slotId: slotId || undefined,
      });

      if (hold) {
        setActiveHold(hold);
        console.log("[InstallationScheduler] Hold created:", hold.appointmentId);
      }
    } finally {
      setHoldLoading(false);
    }
  }, [onDateTimeChange, installationId, decision, onAppointmentConfirmedChange]);

  const handleConfirmAppointment = useCallback(() => {
    setAppointmentConfirmed(true);
    onAppointmentConfirmedChange?.(true);
    onDateTimeChange(selectedDate, selectedTime);
    console.log("[InstallationScheduler] Appointment confirmed by user:", selectedDate, selectedTime);
  }, [onDateTimeChange, selectedDate, selectedTime, onAppointmentConfirmedChange]);

  return (
    <div className="space-y-4">
      {/* Step 1: Questionnaire — only in "choice" phase */}
      {showQuestionnaire && (
        <CablingQuestionnaire
          isFrench={isFrench}
          onComplete={handleQuestionnaireComplete}
          initialValues={cablingAnswers || undefined}
        />
      )}

      {/* Step 2: Decision — always visible once computed */}
      {decision && (
        <InstallationDecisionDisplay
          decision={decision}
          isFrench={isFrench}
          distanceKm={distanceKm}
          onChooseAutoInstall={showQuestionnaire && decision.messageKey === "remote_auto" ? handleChooseAuto : undefined}
          onChooseTechnician={showQuestionnaire && decision.messageKey === "remote_auto" ? handleChooseTechnician : undefined}
        />
      )}

      {/* Step 3: Slot picker — only in "schedule" phase for technician installs */}
      {showSchedule && decision && (decision.installationType === "technician" || overrideToTech) && (
        <>
          {activeHold && !holdLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0066CC]/[0.06] border border-[#0066CC]/25">
              <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0" />
              <span className="text-sm font-semibold text-[#1A1A2E]">
                {isFrench ? "Plage réservée pendant 30 minutes" : "Slot held for 30 minutes"}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white text-[#374151] border border-[#E5E7EB]">
                <Clock className="w-3 h-3" />
                {isFrench ? "En attente" : "Pending"}
              </span>
            </div>
          )}
          {holdLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F5F7FA] border border-[#E5E7EB]">
              <Clock className="w-4 h-4 text-[#0066CC] animate-pulse" />
              <span className="text-sm text-[#374151]">
                {isFrench ? "Réservation en cours..." : "Reserving slot..."}
              </span>
            </div>
          )}
          <SmartSlotPicker
            decision={decision}
            isFrench={isFrench}
            availableSlots={availableSlots}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelect={handleSlotSelect}
          />
          {appointmentConfirmed && activeHold && !holdLoading && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-[#ECFDF5] border border-[#10B981]">
              <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#065F46]">
                  {isFrench ? "Rendez-vous confirmé ✓" : "Appointment confirmed ✓"}
                </p>
                <p className="text-xs text-[#047857]">
                  {isFrench ? "Votre plage horaire est réservée." : "Your time slot is reserved."}
                </p>
              </div>
            </div>
          )}

          {/* Confirm button — only when hold exists but not yet confirmed */}
          {selectedDate && selectedTime && activeHold && !holdLoading && !appointmentConfirmed && (
            <div className="pt-2">
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={handleConfirmAppointment}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {isFrench ? "Confirmer le rendez-vous" : "Confirm appointment"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
