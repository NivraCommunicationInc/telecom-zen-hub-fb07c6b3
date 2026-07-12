import { useMemo, useState, useEffect } from "react";
import { Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
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

const dateKey = (date: Date) => format(date, "yyyy-MM-dd");

const slotStartHour = (value: string, fallback: number) => {
  const match = value.match(/(\d{1,2})\s*h/);
  return match ? Number(match[1]) : fallback;
};

const periodLabel = (value: string) => {
  const hour = slotStartHour(value, 12);
  if (hour < 12) return "Matin";
  if (hour < 16) return "Après-midi";
  if (hour < 18) return "Fin d'après-midi";
  return "Soir";
};

export function SmartSlotPicker({
  decision,
  isFrench,
  availableSlots,
  selectedDate,
  selectedTime,
  onSelect,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [activeDate, setActiveDate] = useState<string | null>(null);

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
    const dateStr = dateKey(date);

    if (availableSlots && availableSlots.length > 0) {
      return availableSlots
        .filter((slot) => slot.slot_date === dateStr)
        .filter((slot) => slot.booked < slot.capacity)
        .filter((slot) => {
          if (!isToday(date)) return true;
          const currentHour = now.getHours() + now.getMinutes() / 60;
          return slotStartHour(slot.time_slot, 9) > currentHour + LEAD_TIME_HOURS;
        })
        .map((slot) => ({
          value: slot.time_slot,
          labelFr: slot.time_slot,
          labelEn: slot.time_slot,
          period: periodLabel(slot.time_slot),
          dbSlot: slot,
        }));
    }

    return [];
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
    if (!activeDate && dates.length > 0) {
      const firstAvailable = dates.find(d => getTimeSlotsForDate(d).length > 0);
      if (firstAvailable) setActiveDate(firstAvailable.toISOString());
    }
  }, [dates, activeDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableDates = dates.filter(d => getTimeSlotsForDate(d).length > 0);
  const selectedDateKey = selectedDate ? dateKey(new Date(selectedDate)) : "";
  const activeDateObj = activeDate ? new Date(activeDate) : availableDates[0];
  const activeSlots = activeDateObj ? getTimeSlotsForDate(activeDateObj) : [];

  return (
    <div className="bg-white border border-[#D7E4F2] rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-[#D7E4F2]" style={{ background: '#F0F6FC' }}>
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

      <div className="p-5 sm:p-6 space-y-5">
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {availableDates.slice(0, 10).map((date) => {
              const dateStr = date.toISOString();
              const slots = getTimeSlotsForDate(date);
              const isActiveDate = activeDate === dateStr;
              const isSelectedDate = selectedDateKey === dateKey(date);
              const dateBadge = getDateBadge(date);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setActiveDate(dateStr)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    isActiveDate || isSelectedDate
                      ? "border-[#0066CC] bg-[#0066CC] text-white shadow-sm"
                      : "border-[#D7E4F2] bg-white text-[#1A1A2E] hover:border-[#0066CC]/50 hover:bg-[#F0F6FC]"
                  }`}
                >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center text-center shrink-0 ${
                        isActiveDate || isSelectedDate ? "bg-white/15 text-white" : "bg-[#F5F7FA] text-[#1A1A2E] border border-[#E5E7EB]"
                      }`}>
                        <span className="text-[10px] font-semibold uppercase leading-none">
                          {format(date, "MMM", { locale: frLocale })}
                        </span>
                        <span className="text-lg font-bold leading-none mt-0.5">
                          {format(date, "d")}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold capitalize truncate ${isActiveDate || isSelectedDate ? "text-white" : "text-[#1A1A2E]"}`}>
                          {formatDateLabel(date)}
                        </p>
                        <p className={`text-xs ${isActiveDate || isSelectedDate ? "text-white/85" : "text-[#4B5563]"}`}>
                          {slots.length} créneau{slots.length > 1 ? "x" : ""} disponible{slots.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                      {dateBadge && (
                        <span className={`inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isActiveDate || isSelectedDate ? "bg-white/15 text-white" : dateBadge.className}`}>
                          {dateBadge.label}
                        </span>
                      )}
                </button>
              );
            })}
            </div>

            <AnimatePresence mode="wait">
              {activeDateObj && (
                      <motion.div
                        key={dateKey(activeDateObj)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-xl border border-[#D7E4F2] bg-[#F8FBFF] p-3.5"
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <p className="text-sm font-semibold text-[#1A1A2E] capitalize">
                            {formatDateLabel(activeDateObj)}
                          </p>
                          <span className="text-xs font-medium text-[#4B5563]">Places restantes</span>
                        </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {activeSlots.map((slot) => {
                              const isActive = selectedDateKey === dateKey(activeDateObj) && selectedTime === slot.value;
                              const spotsLeft = slot.dbSlot ? slot.dbSlot.capacity - slot.dbSlot.booked : null;

                              return (
                                <button
                                  key={`${dateKey(activeDateObj)}-${slot.value}`}
                                  type="button"
                                  onClick={() => onSelect(activeDateObj.toISOString(), slot.value, slot.dbSlot?.id)}
                                  className={`relative flex min-h-[92px] flex-col items-start justify-between gap-2 p-3 rounded-lg border-2 text-sm transition-all ${
                                    isActive
                                      ? "border-[#0066CC] bg-[#0066CC] text-white shadow-sm"
                                      : "border-[#D7E4F2] bg-white hover:border-[#0066CC]/50 hover:bg-[#0066CC]/[0.03] text-[#1A1A2E]"
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
                                  {spotsLeft !== null && (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      isActive
                                        ? "bg-white/15 text-white"
                                        : spotsLeft <= 2
                                          ? "bg-[#FEE2E2] text-[#D93025]"
                                          : "bg-[#EEF2F7] text-[#4B5563]"
                                    }`}>
                                      {spotsLeft === 1 ? "Dernière place" : `${spotsLeft} places restantes`}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                      </motion.div>
              )}
            </AnimatePresence>
          </>
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
