/**
 * TechSchedule — Horaire de la semaine + Punch in/out avec géoloc.
 */
import { useMemo, useState } from "react";
import { Play, Square, Clock, MapPin, Coffee } from "lucide-react";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
import { usePunchHistory, useOpenPunch } from "../lib/usePunch";
import { supabase } from "@/integrations/supabase/client";

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(d: Date) {
  return d.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}

export default function TechSchedule() {
  const { data: open } = useOpenPunch();
  const { data: history = [] } = usePunchHistory(14);
  const [busy, setBusy] = useState(false);

  const week = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const entries = (history as any[]).filter((h) => (h.punch_in || "").slice(0, 10) === key);
      const mins = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
      return { date: d, mins, entries };
    });
  }, [history]);

  const weekTotal = week.reduce((s, d) => s + d.mins, 0);

  async function getCoords(): Promise<{ lat: number | null; lng: number | null }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    });
  }

  async function togglePunch() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée");
      const coords = await getCoords();
      if (open) {
        const { error } = await supabase
          .from("time_entries")
          .update({ punch_out: new Date().toISOString(), punch_out_lat: coords.lat, punch_out_lng: coords.lng })
          .eq("id", (open as any).id);
        if (error) throw error;
        toast.success("Punch out enregistré");
      } else {
        const { error } = await supabase.from("time_entries").insert({
          user_id: user.id,
          punch_in: new Date().toISOString(),
          punch_in_lat: coords.lat,
          punch_in_lng: coords.lng,
        } as any);
        if (error) throw error;
        toast.success("Punch in enregistré");
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TechHeader title="Horaire" subtitle="Semaine & pointage" />

      <section className="px-4 mt-4">
        <div className="rounded-2xl bg-zinc-900 p-5 text-white">
          <p className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Statut actuel</p>
          <div className="mt-1 flex items-baseline gap-3">
            <p className="text-2xl font-black italic uppercase">
              {open ? "En service" : "Hors service"}
            </p>
            {open && (
              <span className="text-xs text-zinc-400">depuis {fmtTime((open as any).punch_in)}</span>
            )}
          </div>
          <button
            onClick={togglePunch}
            disabled={busy}
            className="mt-4 w-full h-14 rounded-xl font-black italic uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: open ? "#dc2626" : "#fbbf24", color: open ? "#fff" : "#18181b" }}
          >
            {open ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            {open ? "Punch out" : "Punch in"}
          </button>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
            <MapPin className="h-3.5 w-3.5" /> Position GPS incluse à chaque pointage
          </p>
        </div>
      </section>

      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500">Cette semaine</h2>
          <span className="text-[11px] font-black italic text-zinc-900">
            Total : {Math.floor(weekTotal / 60)}h{String(weekTotal % 60).padStart(2, "0")}
          </span>
        </div>
        <div className="space-y-1.5">
          {week.map((d) => (
            <div key={d.date.toISOString()} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-zinc-200">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span className="flex-1 text-[13px] font-bold italic uppercase text-zinc-900">{fmtDay(d.date)}</span>
              <span className="text-[13px] font-black italic text-zinc-900">
                {d.mins ? `${Math.floor(d.mins / 60)}h${String(d.mins % 60).padStart(2, "0")}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 mt-5 mb-8">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Pauses</h2>
        <button className="w-full h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center gap-2 text-[13px] font-black italic uppercase text-zinc-900">
          <Coffee className="h-4 w-4 text-amber-500" /> Démarrer une pause
        </button>
      </section>
    </>
  );
}
