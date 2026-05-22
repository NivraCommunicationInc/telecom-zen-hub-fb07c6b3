/**
 * FieldPunchCard — Punch-in / punch-out card for the Field Portal dashboard.
 * Uses public.attendance_records (RLS: user can manage their own rows).
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, LogIn, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PunchRecord {
  id: string;
  user_id: string;
  punch_in_at: string;
  punch_out_at: string | null;
  total_minutes: number | null;
}

function fmtElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function FieldPunchCard() {
  const qc = useQueryClient();
  const [now, setNow] = useState<number>(Date.now());

  const { data: open, isLoading } = useQuery({
    queryKey: ["field-open-punch"],
    refetchInterval: 30_000,
    queryFn: async (): Promise<PunchRecord | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .is("punch_out_at", null)
        .order("punch_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as PunchRecord) ?? null;
    },
  });

  const { data: today } = useQuery({
    queryKey: ["field-punch-today"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<PunchRecord[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("punch_in_at", start.toISOString())
        .order("punch_in_at", { ascending: false });
      return (data as PunchRecord[]) ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const punchIn = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("attendance_records")
        .insert({ user_id: user.id, punch_in_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pointage d'entrée enregistré — bonne journée !");
      qc.invalidateQueries({ queryKey: ["field-open-punch"] });
      qc.invalidateQueries({ queryKey: ["field-punch-today"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur de pointage"),
  });

  const punchOut = useMutation({
    mutationFn: async (id: string) => {
      const out = new Date();
      const { data: existing } = await supabase
        .from("attendance_records")
        .select("punch_in_at")
        .eq("id", id)
        .maybeSingle();
      const inAt = existing ? new Date(existing.punch_in_at) : out;
      const total = Math.max(0, Math.round((out.getTime() - inAt.getTime()) / 60000));
      const { error } = await supabase
        .from("attendance_records")
        .update({ punch_out_at: out.toISOString(), total_minutes: total })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fin de journée enregistrée");
      qc.invalidateQueries({ queryKey: ["field-open-punch"] });
      qc.invalidateQueries({ queryKey: ["field-punch-today"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  const isOpen = !!open;
  const elapsedMs = open ? now - new Date(open.punch_in_at).getTime() : 0;
  const todayTotalMin = (today ?? []).reduce(
    (acc, r) => acc + (r.total_minutes ?? (r.punch_out_at ? 0 : Math.round((now - new Date(r.punch_in_at).getTime()) / 60000))),
    0,
  );
  const totalH = Math.floor(todayTotalMin / 60);
  const totalM = todayTotalMin % 60;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "hsl(var(--field-card))",
        border: "1px solid hsl(var(--field-border) / 0.15)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: isOpen ? "hsl(var(--field-success) / 0.15)" : "hsl(var(--field-accent) / 0.15)",
              color: isOpen ? "hsl(var(--field-success))" : "hsl(var(--field-accent))",
            }}
          >
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-white/80">
              Pointage de la journée
            </div>
            <div className="text-[11px]" style={{ color: "hsl(var(--field-text-muted))" }}>
              {isOpen ? "Session en cours" : "Aucune session active"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--field-text-dim))" }}>
            Total aujourd'hui
          </div>
          <div className="text-sm font-bold text-white tabular-nums">
            {totalH}h {String(totalM).padStart(2, "0")}m
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="tabular-nums">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(var(--field-text-dim))" }}>
            {isOpen ? "Temps écoulé" : "Prêt à commencer"}
          </div>
          <div className={cn("text-3xl font-extrabold tracking-tight", isOpen ? "text-white" : "text-white/60")}>
            {isOpen ? fmtElapsed(elapsedMs) : "00:00:00"}
          </div>
        </div>

        {isLoading ? (
          <button
            disabled
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white/70 bg-white/5"
            style={{ minHeight: 44 }}
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </button>
        ) : isOpen ? (
          <button
            onClick={() => open && punchOut.mutate(open.id)}
            disabled={punchOut.isPending}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
            style={{
              minHeight: 44,
              background: "linear-gradient(135deg, hsl(var(--field-danger)) 0%, hsl(var(--field-danger) / 0.8) 100%)",
            }}
          >
            {punchOut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Terminer ma journée
          </button>
        ) : (
          <button
            onClick={() => punchIn.mutate()}
            disabled={punchIn.isPending}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white field-glow transition-all hover:scale-[1.02] disabled:opacity-60"
            style={{
              minHeight: 44,
              background: "linear-gradient(135deg, hsl(var(--field-success)) 0%, hsl(var(--field-success) / 0.8) 100%)",
            }}
          >
            {punchIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Commencer ma journée
          </button>
        )}
      </div>

      {(today ?? []).length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1.5">
          {(today ?? []).slice(0, 3).map((r) => {
            const start = new Date(r.punch_in_at);
            const end = r.punch_out_at ? new Date(r.punch_out_at) : null;
            const fmt = (d: Date) =>
              `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const mins = r.total_minutes ?? (end ? Math.round((end.getTime() - start.getTime()) / 60000) : 0);
            return (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span style={{ color: "hsl(var(--field-text-muted))" }}>
                  {fmt(start)} → {end ? fmt(end) : "en cours"}
                </span>
                <span className="tabular-nums font-semibold text-white/80">
                  {end ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
