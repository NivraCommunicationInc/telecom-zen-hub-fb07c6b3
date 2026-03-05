import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
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
  availableSlots?: SlotData[];
  selectedDate: string;
  selectedTime: string;
  onSelect: (date: string, time: string, slotId?: string) => void;
}

const LEAD_TIME_HOURS = 4;

const TIME_SLOTS = [
  { value: "09h - 12h", startHour: 9, labelFr: "9h - 12h (Matin)", labelEn: "9AM - 12PM (Morning)" },
  { value: "12h - 15h", startHour: 12, labelFr: "12h - 15h (Après-midi)", labelEn: "12PM - 3PM (Afternoon)" },
  { value: "15h - 18h", startHour: 15, labelFr: "15h - 18h (Fin d'après-midi)", labelEn: "3PM - 6PM (Late afternoon)" },
  { value: "18h - 20h", startHour: 18, labelFr: "18h - 20h (Soir)", labelEn: "6PM - 8PM (Evening)" },
];

export function SmartSlotPicker({
  decision,
  isFrench,
  availableSlots,
  selectedDate,
  selectedTime,
  onSelect,
}: Props) {
  // Live clock — updates every 60s so slots disable dynamically
  const [now, setNow] = useState(() => new Date());
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

    // For today: filter out past slots + enforce 2h lead time
    const filtered = TIME_SLOTS.filter((slot) => {
      if (isToday(date)) {
        const currentHour = now.getHours() + now.getMinutes() / 60;
        // Slot start must be > current time + lead time
        if (slot.startHour <= currentHour + LEAD_TIME_HOURS) return false;
      }

      // If DB slots exist, also check capacity
      if (availableSlots && availableSlots.length > 0) {
        const match = availableSlots.find(
          (s) => s.slot_date === dateStr && s.time_slot === slot.value
        );
        return match ? match.booked < match.capacity : false;
      }

      return true;
    });

    return filtered;
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
        {/* Check if ALL dates have zero valid slots */}
        {dates.length === 0 || dates.every(d => getTimeSlotsForDate(d).length === 0) ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-muted-foreground">
              {isFrench
                ? "Aucun créneau disponible aujourd'hui. Les prochaines disponibilités sont affichées ci-dessous."
                : "No installation slots available today. Next available slots are shown below."}
            </p>
          </div>
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
                      <Badge variant="outline" className="text-xs">
                        {isFrench ? "Rapide" : "Fast"}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isActive = isSelected && selectedTime === slot.value;
                      return (
                        <button
                          key={`${dateStr}-${slot.value}`}
                          onClick={() => {
                            const dbSlot = availableSlots?.find(
                              (s) => s.slot_date === format(date, "yyyy-MM-dd") && s.time_slot === slot.value
                            );
                            onSelect(dateStr, slot.value, dbSlot?.id);
                          }}
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
