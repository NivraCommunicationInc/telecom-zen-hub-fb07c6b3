/**
 * TechProfile — Technician profile page.
 * Hero banner with avatar + KPIs, punch history timeline, settings.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, KeyRound, Loader2, TrendingUp, Timer, Award } from "lucide-react";
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
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
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

  const weekCompleted = assignments.filter((a) => a.status === "completed" && a.scheduled_date >= weekKey).length;
  const weekTotal = assignments.filter((a) => a.scheduled_date >= weekKey).length;
  const completionRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;
  const weekMinutes = punches.reduce((sum, p) => sum + (p.total_minutes ?? 0), 0);
  const allCompleted = assignments.filter((a) => a.status === "completed").length;

  const displayName = profile?.full_name || profile?.first_name || "Technicien";
  const initials = displayName.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

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
      <TechHeader title="Profil" />

      {/* ── Hero banner ───────────────────────────────────────────────────── */}
      <div
        className="relative px-5 pt-6 pb-5 flex items-start gap-4"
        style={{ background: "linear-gradient(180deg, #1E1040 0%, #0A0A12 100%)" }}
      >
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 20% 50%, rgba(124,58,237,0.12) 0%, transparent 70%)" }}
        />
        {/* Avatar */}
        <div
          className="relative h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-xl"
          style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", boxShadow: "0 8px 24px rgba(124,58,237,0.35)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0 relative">
          <p className="text-[18px] font-black text-white tracking-[-0.02em] leading-tight">{displayName}</p>
          <p className="text-[12px] text-slate-400 mt-0.5 truncate">{profile?.email || ""}</p>
          <span
            className="mt-2 inline-flex items-center text-[10px] font-bold text-violet-300 uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
            style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            Technicien Nivra
          </span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── KPIs this week ────────────────────────────────────────────────── */}
        <section>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] mb-2.5">Cette semaine</p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: TrendingUp, label: "Installations", value: String(weekCompleted), color: "text-violet-400", iconColor: "text-violet-500" },
              { icon: Timer, label: "Heures", value: fmtDuration(weekMinutes), color: "text-emerald-400", iconColor: "text-emerald-500" },
              { icon: Award, label: "Complétion", value: `${completionRate}%`, color: weekCompleted === 0 ? "text-slate-400" : completionRate >= 80 ? "text-emerald-400" : "text-amber-400", iconColor: "text-amber-500" },
            ].map(({ icon: Icon, label, value, color, iconColor }) => (
              <div
                key={label}
                className="rounded-xl p-3 flex flex-col gap-1.5"
                style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <p className={`text-[20px] font-black tabular-nums leading-none ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Career total ─────────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-4 flex items-center gap-4"
          style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
          >
            <Award className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.08em]">Total complétées</p>
            <p className="text-[24px] font-black text-white tabular-nums leading-tight">{allCompleted}</p>
          </div>
        </div>

        {/* ── Punch history ─────────────────────────────────────────────────── */}
        <section style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }} className="rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
              Pointages — 7 derniers jours
            </p>
          </div>
          {punches.length === 0 ? (
            <div className="px-4 pb-4">
              <p className="text-[13px] text-slate-500">Aucun pointage cette semaine.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {punches.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-white capitalize w-20 shrink-0">
                    {fmtDate(p.punch_in_at)}
                  </span>
                  <span className="text-[12px] text-slate-500 tabular-nums flex-1 text-center">
                    {fmtTime(p.punch_in_at)} → {fmtTime(p.punch_out_at)}
                  </span>
                  <span className="text-[13px] font-bold text-emerald-400 tabular-nums shrink-0 w-14 text-right">
                    {fmtDuration(p.total_minutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Settings ─────────────────────────────────────────────────────── */}
        <section className="space-y-2.5">
          <button
            onClick={handleReset}
            disabled={resetting || !profile?.email}
            className="w-full h-[56px] rounded-2xl px-5 flex items-center gap-3.5 text-left transition-colors disabled:opacity-50"
            style={{ background: "#0C0C14", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {resetting ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-400 shrink-0" />
            ) : (
              <KeyRound className="h-5 w-5 text-violet-400 shrink-0" />
            )}
            <span className="flex-1 text-[14px] font-semibold text-white">Changer mon mot de passe</span>
            <span className="text-slate-600 text-xs">→</span>
          </button>

          <button
            onClick={async () => {
              if (!confirm("Voulez-vous vous déconnecter ?")) return;
              await supabase.auth.signOut();
              navigate("/nivra-secure-hub-2617-internal/login", { replace: true });
            }}
            className="w-full h-[56px] rounded-2xl px-5 flex items-center justify-center gap-3 text-red-300 text-[14px] font-semibold transition-colors"
            style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <LogOut className="h-5 w-5" />
            Se déconnecter
          </button>
        </section>
      </div>
    </div>
  );
}
