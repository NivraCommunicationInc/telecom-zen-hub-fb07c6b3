/**
 * InstallSlotPicker — shared installation date/time picker used by every
 * checkout flow (Field, Core, OneView, public client).
 *
 * Reads the real availability from the `get_available_installation_slots`
 * RPC (recurring rules + overrides + blocked dates + existing bookings).
 */
import { useMemo, useState } from "react";
import { Loader2, CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInstallationSlots, groupSlotsByDay, type InstallationSlot } from "@/hooks/useInstallationSlots";

interface Props {
  value?: { date: string; time_slot: string } | null;
  onChange: (slot: { date: string; time_slot: string } | null) => void;
  className?: string;
  /** compact = for embedded field/POS tunnels; full = for public checkout */
  variant?: "compact" | "full";
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

export default function InstallSlotPicker({ value, onChange, className, variant = "compact" }: Props) {
  const { data: slots = [], isLoading, error } = useInstallationSlots();
  const [selectedDate, setSelectedDate] = useState<string | null>(value?.date ?? null);

  const grouped = useMemo(() => groupSlotsByDay(slots), [slots]);
  const daysWithOpenSlots = useMemo(
    () => grouped.filter((g) => g.slots.some((s) => s.status === "open")),
    [grouped],
  );

  const activeDay = selectedDate ?? daysWithOpenSlots[0]?.date ?? null;
  const daySlots = grouped.find((g) => g.date === activeDay)?.slots ?? [];

  const isDark = variant === "compact";
  const cardBg = isDark ? "bg-white/5" : "bg-white";
  const borderBase = isDark ? "border-white/10" : "border-neutral-200";
  const textPrim = isDark ? "text-white" : "text-neutral-900";
  const textMuted = isDark ? "text-white/60" : "text-neutral-500";
  const accent = isDark
    ? "bg-violet-500/20 border-violet-400 text-violet-100"
    : "bg-violet-600 border-violet-600 text-white";

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-6", textMuted, className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Chargement des disponibilités…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-xl border p-4 text-sm", "border-amber-500/40 bg-amber-500/10 text-amber-300", className)}>
        Impossible de charger le calendrier. Réessayez ou contactez le support.
      </div>
    );
  }

  if (daysWithOpenSlots.length === 0) {
    return (
      <div className={cn("rounded-xl border p-4 text-sm text-center space-y-1", borderBase, cardBg, textMuted, className)}>
        <CalendarClock className={cn("h-6 w-6 mx-auto mb-1", textMuted)} />
        Aucun créneau disponible pour les 30 prochains jours. Contactez votre représentant.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {daysWithOpenSlots.map((g) => {
          const isSel = g.date === activeDay;
          return (
            <button
              key={g.date}
              type="button"
              onClick={() => {
                setSelectedDate(g.date);
                if (value?.date !== g.date) onChange(null);
              }}
              className={cn(
                "flex-shrink-0 px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap",
                isSel ? accent : cn(cardBg, borderBase, textPrim, "hover:bg-white/10"),
              )}
            >
              {formatDayLabel(g.date)}
            </button>
          );
        })}
      </div>

      {/* Time slots for selected day */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {daySlots.map((s: InstallationSlot) => {
          const isSel = value?.date === activeDay && value?.time_slot === s.time_slot;
          const disabled = s.status !== "open";
          return (
            <button
              key={s.time_slot}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ date: activeDay!, time_slot: s.time_slot })}
              className={cn(
                "px-3 py-3 rounded-xl border text-sm font-medium transition-colors flex flex-col items-start gap-0.5",
                disabled && "opacity-40 cursor-not-allowed",
                isSel ? accent : cn(cardBg, borderBase, textPrim, !disabled && "hover:bg-white/10"),
              )}
            >
              <span>{s.time_slot}</span>
              <span className={cn("text-[10px]", isSel ? "text-white/80" : textMuted)}>
                {s.status === "open" && s.available <= 3 ? `${s.available} place${s.available > 1 ? "s" : ""}` : s.status === "full" ? "Complet" : s.status === "closed" ? "Fermé" : "Disponible"}
              </span>
            </button>
          );
        })}
      </div>

      {value && (
        <div className={cn("flex items-center gap-2 text-xs", textMuted)}>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Créneau sélectionné : {formatDayLabel(value.date)} — {value.time_slot}
        </div>
      )}
    </div>
  );
}
