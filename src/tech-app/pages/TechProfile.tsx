/**
 * TechProfile — Technician profile with punch history.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
import { useTechAssignments } from "../lib/useTechAssignments";
import { usePunchHistory } from "../lib/usePunch";

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDuration(min: number | null | undefined): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
}

export default function TechProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ email?: string; full_name?: string; first_name?: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const { data: assignments = [] } = useTechAssignments();
  const { data: punches = [] } = usePunchHistory(7);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? { email: user.email ?? "" });
    })();
  }, []);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekKey = weekStart.toISOString().slice(0, 10);
  const weekCompleted = assignments.filter(
    (a) => a.status === "completed" && a.scheduled_date >= weekKey,
  ).length;
  const weekTotal = assignments.filter((a) => a.scheduled_date >= weekKey).length;
  const completionRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const weekMinutes = punches.reduce((sum, p) => sum + (p.total_minutes ?? 0), 0);

  const initials = (profile?.full_name || profile?.first_name || "T").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  async function handleReset() {
    if (!profile?.email) return;
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/portail/creer-mot-de-passe`,
      });
      if (error) throw error;
      toast.success("Email de réinitialisation envoyé");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <TechHeader title="Mon profil" />
      <div className="px-4 py-5 space-y-4">
        {/* Profile card */}
        <section className="rounded-2xl bg-gradient-to-br from-violet-600/20 to-slate-900 border border-violet-600/40 p-5 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-violet-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-violet-500/30">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold text-white truncate">
              {profile?.full_name || profile?.first_name || "Technicien"}
            </p>
            <p className="text-xs text-slate-300 truncate">{profile?.email || ""}</p>
            <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider bg-violet-600/30 text-violet-200 px-2 py-0.5 rounded">
              Technicien Nivra
            </span>
          </div>
        </section>

        {/* Stats this week */}
        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-center">
            <p className="text-xl font-bold text-white">{weekCompleted}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Installations</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-center">
            <p className="text-xl font-bold text-white">{fmtDuration(weekMinutes)}</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Heures</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-3 text-center">
            <p className="text-xl font-bold text-white">{completionRate}%</p>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">Complétion</p>
          </div>
        </section>

        {/* Punch history */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
          <h3 className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-3">
            Pointages (7 derniers jours)
          </h3>
          {punches.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun pointage cette semaine.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {punches.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{fmtDate(p.punch_in_at)}</span>
                  <span className="text-slate-400 tabular-nums">
                    {fmtTime(p.punch_in_at)} → {fmtTime(p.punch_out_at)}
                  </span>
                  <span className="text-white font-semibold tabular-nums w-14 text-right">
                    {fmtDuration(p.total_minutes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Settings */}
        <section className="space-y-3">
          <button
            onClick={handleReset}
            disabled={resetting || !profile?.email}
            className="w-full min-h-[56px] rounded-2xl bg-slate-900 border border-slate-800 px-5 flex items-center gap-3 hover:border-violet-600 active:bg-slate-800 disabled:opacity-60"
          >
            {resetting ? <Loader2 className="h-5 w-5 animate-spin text-violet-400" /> : <KeyRound className="h-5 w-5 text-violet-400" />}
            <span className="flex-1 text-base font-semibold text-white text-left">Changer mon mot de passe</span>
          </button>

          <button
            onClick={async () => {
              if (!confirm("Se déconnecter ?")) return;
              await supabase.auth.signOut();
              navigate("/", { replace: true });
            }}
            className="w-full min-h-[56px] rounded-2xl bg-red-600/15 border border-red-600/50 text-red-300 text-base font-semibold flex items-center justify-center gap-2"
          >
            <LogOut className="h-5 w-5" />
            Se déconnecter
          </button>
        </section>
      </div>
    </div>
  );
}
