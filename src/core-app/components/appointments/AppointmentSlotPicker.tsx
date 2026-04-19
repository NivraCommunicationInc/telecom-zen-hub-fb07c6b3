/**
 * AppointmentSlotPicker — Reusable date + time-window picker backed by
 * `appointment_slot_rules` and live capacity from `appointments`.
 *
 * Calls the SECURITY DEFINER RPC `get_appointment_slot_availability(date)`
 * to compute, for each weekday rule:
 *   - capacity
 *   - bookings_count (active appointments overlapping that window)
 *   - remaining
 *   - is_blocked / block_reason (full-day blackout)
 *
 * The picker disables full and blocked slots, and surfaces blackout reasons.
 * `value` and `onChange` use a single ISO string at the slot's start time.
 */
import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2, Lock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SlotRow {
  rule_id: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  capacity: number;
  bookings_count: number;
  remaining: number;
  is_blocked: boolean;
  block_reason: string | null;
}

interface Props {
  /** Selected scheduled_at (ISO) — start of slot. */
  value?: string | null;
  onChange: (iso: string | null, slot?: { start: string; end: string }) => void;
  /** Min lead time in days (default 1 = tomorrow earliest). */
  minLeadDays?: number;
  /** Max horizon (default 60 days). */
  maxDays?: number;
  /** Compact dark theme styling for Core. */
  variant?: "core" | "light";
  className?: string;
  disabled?: boolean;
}

const fmtTime = (t: string) => t.slice(0, 5).replace(":", "h");

export function AppointmentSlotPicker({
  value,
  onChange,
  minLeadDays = 1,
  maxDays = 60,
  variant = "core",
  className,
  disabled,
}: Props) {
  const initial = value ? new Date(value) : undefined;
  const [date, setDate] = React.useState<Date | undefined>(initial);
  const [open, setOpen] = React.useState(false);

  const minDate = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + minLeadDays);
    return d;
  }, [minLeadDays]);

  const maxDate = React.useMemo(() => {
    const d = new Date(minDate);
    d.setDate(d.getDate() + maxDays);
    return d;
  }, [minDate, maxDays]);

  const dateKey = date ? format(date, "yyyy-MM-dd") : null;

  const { data: slots = [], isLoading } = useQuery<SlotRow[]>({
    queryKey: ["appointment-slot-availability", dateKey],
    enabled: !!dateKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_appointment_slot_availability", {
        p_date: dateKey!,
      });
      if (error) throw error;
      return (data || []) as SlotRow[];
    },
  });

  const selectedTime = value ? format(new Date(value), "HH:mm") : null;

  const handleSelectSlot = (slot: SlotRow) => {
    if (!date) return;
    const [hh, mm] = slot.start_time.split(":");
    const d = new Date(date);
    d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    onChange(d.toISOString(), { start: slot.start_time, end: slot.end_time });
  };

  const isCore = variant === "core";

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal h-9 text-sm",
                isCore && "bg-[#0d1421] border-slate-700 text-slate-100 hover:bg-[#111827]",
                !date && "text-slate-400"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "Choisir une date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                onChange(null);
                setOpen(false);
              }}
              disabled={(d) => d < minDate || d > maxDate}
              initialFocus
              locale={fr}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {date && (
        <div>
          <p className={cn("text-[10px] uppercase tracking-wider mb-2", isCore ? "text-slate-500" : "text-gray-500")}>
            Plage horaire
          </p>
          {isLoading ? (
            <div className={cn("flex items-center gap-2 text-xs py-2", isCore ? "text-slate-400" : "text-gray-500")}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des disponibilités…
            </div>
          ) : slots.length === 0 ? (
            <div className={cn("text-xs py-2", isCore ? "text-slate-400" : "text-gray-500")}>
              Aucune plage configurée pour ce jour. Veuillez choisir un autre jour ou configurer les règles dans
              <span className="font-mono text-[11px]"> /core/appointments/slots</span>.
            </div>
          ) : slots[0]?.is_blocked ? (
            <div className="flex items-start gap-2 text-xs rounded-md border border-amber-700/50 bg-amber-950/30 text-amber-300 p-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Journée bloquée</p>
                <p className="opacity-90 mt-0.5">{slots[0].block_reason || "Aucune installation possible ce jour."}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((s) => {
                const label = `${fmtTime(s.start_time)} - ${fmtTime(s.end_time)}`;
                const isFull = s.remaining <= 0;
                const isSelected = selectedTime === s.start_time.slice(0, 5);
                return (
                  <button
                    key={s.rule_id}
                    type="button"
                    disabled={isFull || disabled}
                    onClick={() => handleSelectSlot(s)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-all",
                      isSelected
                        ? isCore
                          ? "bg-emerald-600/20 border-emerald-500 text-emerald-200"
                          : "bg-emerald-50 border-emerald-500 text-emerald-900"
                        : isCore
                          ? "bg-[#0d1421] border-slate-700 text-slate-200 hover:border-emerald-600/60"
                          : "bg-white border-gray-200 text-gray-900 hover:border-emerald-500",
                      isFull && "opacity-40 cursor-not-allowed hover:border-slate-700"
                    )}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <span className={cn(
                      "text-[10px] flex items-center gap-1",
                      isFull
                        ? "text-red-400"
                        : s.remaining === 1
                          ? "text-amber-400"
                          : isCore ? "text-slate-400" : "text-gray-500"
                    )}>
                      {isFull ? (
                        <><AlertTriangle className="h-3 w-3" /> Complet</>
                      ) : (
                        <>{s.remaining} / {s.capacity} places</>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AppointmentSlotPicker;
