import { useMemo, useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { format, addDays, isToday, isTomorrow, isWeekend } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import type { InstallationDecision } from "@/lib/installationLogic";
import { isSameDayStillAvailable } from "@/lib/installationLogic";
import { motion, AnimatePresence } from "framer-motion";

interface SlotData {
  id: string;
  slot_date: string;
  time_slot: string;
  capacity: number;
  booked: number;
}

interface Props {
  decision: InstallationDecision;
  isFrench: boolean;
  availableSlots?: SlotData[];
  selectedDate: string;
  selectedTime: string;
  onSelect: (date: string, time: string, slotId?: string) => void;
}

const LEAD_TIME_HOURS = 4;

const TIME_SLOTS = [
  { value: "09h - 12h", startHour: 9, labelFr: "9h – 12h", labelEn: "9AM – 12PM", period: "Matin" },
  { value: "12h - 15h", startHour: 12, labelFr: "12h – 15h", labelEn: "12PM – 3PM", period: "Après-midi" },
  { value: "15h - 18h", startHour: 15, labelFr: "15h – 18h", labelEn: "3PM – 6PM", period: "Fin d'après-midi" },
  { value: "18h - 20h", startHour: 18, labelFr: "18h – 20h", labelEn: "6PM – 8PM", period: "Soir" },
];

export function SmartSlotPicker({
  decision,
  isFrench,
  availableSlots,
  selectedDate,
  selectedTime,
  onSelect,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const dates = useMemo(() => {
    const result: Date[] = [];
    const startDay = decision.sameDayPossible && isSameDayStillAvailable() ? 0 : decision.minLeadDays;
    for (let i = startDay; i <= decision.maxLeadDays; i++) {
      const d = addDays(now, i);
      if (d.getDay() !== 0) result.push(d);
    }
    return result;
  }, [decision, now]);

  const getTimeSlotsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return TIME_SLOTS.filter((slot) => {
      if (isToday(date)) {
        const currentHour = now.getHours() + now.getMinutes() / 60;
        if (slot.startHour <= currentHour + LEAD_TIME_HOURS) return false;
      }
      if (availableSlots && availableSlots.length > 0) {
        const match = availableSlots.find(
          (s) => s.slot_date === dateStr && s.time_slot === slot.value
        );
        return match ? match.booked < match.capacity : false;
      }
      return true;
    });
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return "Aujourd'hui";
    if (isTomorrow(date)) return "Demain";
    return format(date, "EEEE d MMMM", { locale: frLocale });
  };

  const getDateBadge = (date: Date) => {
    if (isToday(date)) return { label: "Même jour", className: "bg-[#0066CC] text-white" };
    if (isTomorrow(date)) return { label: "Rapide", className: "bg-[#0066CC]/10 text-[#0066CC] border border-[#0066CC]/20" };
    if (isWeekend(date)) return { label: "Fin de semaine", className: "bg-[#F5F7FA] text-[#374151] border border-[#E5E7EB]" };
    return null;
  };

  useEffect(() => {
    if (!expandedDate && dates.length > 0) {
      const firstAvailable = dates.find(d => getTimeSlotsForDate(d).length > 0);
      if (firstAvailable) setExpandedDate(firstAvailable.toISOString());
    }
  }, [dates]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableDates = dates.filter(d => getTimeSlotsForDate(d).length > 0);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0066CC]/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-[#0066CC]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1A1A2E] leading-tight">
              Choisissez votre rendez-vous
            </h3>
            <p className="text-xs text-[#4B5563] mt-0.5">
              {decision.technicianLevel === "level_1"
                ? "Technicien disponible rapidement dans votre secteur"
                : "Technicien spécialisé — délai de 3 à 5 jours ouvrables"}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-3">
        {availableDates.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]">
            <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1A1A2E]">Aucun créneau disponible</p>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Les prochaines disponibilités seront affichées dès qu'elles seront ouvertes.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {availableDates.slice(0, 10).map((date) => {
              const dateStr = date.toISOString();
              const slots = getTimeSlotsForDate(date);
              const isExpanded = expandedDate === dateStr;
              const isSelectedDate = selectedDate === dateStr;
              const dateBadge = getDateBadge(date);

              return (
                <div
                  key={dateStr}
                  className={`rounded-xl border transition-all ${
                    isSelectedDate
                      ? "border-[#0066CC] bg-[#0066CC]/[0.04]"
                      : "border-[#E5E7EB] bg-white hover:border-[#0066CC]/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedDate(isExpanded ? null : dateStr)}
                    className="w-full flex items-center justify-between p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-center shrink-0 ${
                        isSelectedDate ? "bg-[#0066CC] text-white" : "bg-[#F5F7FA] text-[#1A1A2E] border border-[#E5E7EB]"
                      }`}>
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {format(date, "MMM", { locale: frLocale })}
                        </span>
                        <span className="text-lg font-bold leading-none mt-0.5">
                          {format(date, "d")}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A2E] capitalize">
                          {formatDateLabel(date)}
                        </p>
                        <p className="text-xs text-[#4B5563]">
                          {slots.length} créneau{slots.length > 1 ? "x" : ""} disponible{slots.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dateBadge && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dateBadge.className}`}>
                          {dateBadge.label}
                        </span>
                      )}
                      <ChevronRight className={`w-4 h-4 text-[#6B7280] transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-3.5 pt-0">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {slots.map((slot) => {
                              const isActive = isSelectedDate && selectedTime === slot.value;
                              const dbSlot = availableSlots?.find(
                                (s) => s.slot_date === format(date, "yyyy-MM-dd") && s.time_slot === slot.value
                              );
                              const spotsLeft = dbSlot ? dbSlot.capacity - dbSlot.booked : null;

                              return (
                                <button
                                  key={`${dateStr}-${slot.value}`}
                                  type="button"
                                  onClick={() => onSelect(dateStr, slot.value, dbSlot?.id)}
                                  className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm transition-all ${
                                    isActive
                                      ? "border-[#0066CC] bg-[#0066CC] text-white shadow-sm"
                                      : "border-[#E5E7EB] bg-white hover:border-[#0066CC]/50 hover:bg-[#0066CC]/[0.03] text-[#1A1A2E]"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {isActive ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <Clock className="w-3.5 h-3.5 text-[#0066CC]" />
                                    )}
                                    <span className="font-semibold text-xs">
                                      {isFrench ? slot.labelFr : slot.labelEn}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] font-medium ${isActive ? "text-white/90" : "text-[#4B5563]"}`}>
                                    {slot.period}
                                  </span>
                                  {spotsLeft !== null && spotsLeft <= 2 && (
                                    <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      isActive ? "bg-white text-[#0066CC]" : "bg-[#D93025] text-white"
                                    }`}>
                                      {spotsLeft === 1 ? "Dernier" : `${spotsLeft} pl.`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {selectedDate && selectedTime && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0066CC]/[0.06] border border-[#0066CC]/25">
            <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0" />
            <p className="text-sm text-[#1A1A2E]">
              <span className="font-semibold text-[#0066CC]">
                {(() => {
                  const d = new Date(selectedDate);
                  return isToday(d) ? "Aujourd'hui" : isTomorrow(d) ? "Demain" : format(d, "EEEE d MMMM", { locale: frLocale });
                })()}
              </span>
              {" · "}
              <span className="font-medium text-[#374151]">{selectedTime}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
