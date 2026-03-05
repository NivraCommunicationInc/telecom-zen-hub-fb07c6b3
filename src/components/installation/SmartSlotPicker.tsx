import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2 } from "lucide-react";
import { format, addDays, isToday, isTomorrow } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import type { InstallationDecision } from "@/lib/installationLogic";
import { isSameDayStillAvailable } from "@/lib/installationLogic";

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
  /** Available slots from DB. If empty, generates local options based on decision. */
  availableSlots?: SlotData[];
  selectedDate: string;
  selectedTime: string;
  onSelect: (date: string, time: string) => void;
}

const TIME_SLOTS = [
  { value: "8h - 12h", labelFr: "8h - 12h (Matin)", labelEn: "8AM - 12PM (Morning)" },
  { value: "12h - 17h", labelFr: "12h - 17h (Après-midi)", labelEn: "12PM - 5PM (Afternoon)" },
  { value: "17h - 20h", labelFr: "17h - 20h (Soir)", labelEn: "5PM - 8PM (Evening)" },
];

export function SmartSlotPicker({
  decision,
  isFrench,
  availableSlots,
  selectedDate,
  selectedTime,
  onSelect,
}: Props) {
  // Generate available dates based on decision
  const dates = useMemo(() => {
    const result: Date[] = [];
    const startDay = decision.sameDayPossible && isSameDayStillAvailable() ? 0 : decision.minLeadDays;
    
    for (let i = startDay; i <= decision.maxLeadDays; i++) {
      const d = addDays(new Date(), i);
      // Skip Sundays
      if (d.getDay() !== 0) {
        result.push(d);
      }
    }
    return result;
  }, [decision]);

  // Filter time slots based on available DB slots (if provided)
  const getTimeSlotsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    
    if (availableSlots && availableSlots.length > 0) {
      return TIME_SLOTS.filter((slot) => {
        const match = availableSlots.find(
          (s) => s.slot_date === dateStr && s.time_slot === slot.value
        );
        return match && match.booked < match.capacity;
      });
    }
    
    // No DB slots: show all time slots (for same-day, only future slots)
    if (isToday(date)) {
      const hour = new Date().getHours();
      return TIME_SLOTS.filter((slot) => {
        if (slot.value === "8h - 12h" && hour >= 7) return false;
        if (slot.value === "12h - 17h" && hour >= 11) return false;
        return true;
      });
    }
    
    return TIME_SLOTS;
  };

  const formatDateLabel = (date: Date) => {
    if (isToday(date)) return isFrench ? "Aujourd'hui" : "Today";
    if (isTomorrow(date)) return isFrench ? "Demain" : "Tomorrow";
    return format(date, "EEEE d MMMM", { locale: isFrench ? frLocale : undefined });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          {isFrench ? "Choisissez votre rendez-vous" : "Choose your appointment"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isFrench
              ? "Aucune disponibilité pour le moment. Veuillez nous contacter."
              : "No availability at the moment. Please contact us."}
          </p>
        ) : (
          <div className="space-y-3">
            {dates.slice(0, 8).map((date) => {
              const dateStr = date.toISOString();
              const slots = getTimeSlotsForDate(date);
              const isSelected = selectedDate === dateStr;

              if (slots.length === 0) return null;

              return (
                <div key={dateStr} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground capitalize">
                      {formatDateLabel(date)}
                    </span>
                    {(isToday(date) || isTomorrow(date)) && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        {isFrench ? "Rapide" : "Fast"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {slots.map((slot) => {
                      const isActive = isSelected && selectedTime === slot.value;
                      return (
                        <button
                          key={`${dateStr}-${slot.value}`}
                          onClick={() => onSelect(dateStr, slot.value)}
                          className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50 hover:bg-accent text-foreground"
                          }`}
                        >
                          {isActive && <CheckCircle2 className="w-4 h-4" />}
                          <Clock className="w-3.5 h-3.5" />
                          {isFrench ? slot.labelFr : slot.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
