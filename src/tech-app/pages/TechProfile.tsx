/**
 * TechProfile — Hub complet du technicien.
 * Hero + KPIs semaine + total carrière + pointages 7j + réglages étendus.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, KeyRound, Loader2, TrendingUp, Timer, Award,
  Bell, MapPin as MapPinIcon, Moon, Globe, LifeBuoy, FileText, Phone,
  ChevronRight, ShieldCheck, Zap, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TechHeader from "../components/TechHeader";
import { useTechAssignments } from "../lib/useTechAssignments";
import { usePunchHistory, useOpenPunch } from "../lib/usePunch";

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

interface Prefs {
  notifications: boolean;
  liveLocation: boolean;
  soundOn: boolean;
  autoAccept: boolean;
}
const DEFAULT_PREFS: Prefs = { notifications: true, liveLocation: false, soundOn: true, autoAccept: false };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem("tech-prefs") || "{}") }; }
  catch { return DEFAULT_PREFS; }
}

export default function TechProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ email?: string; full_name?: string; first_name?: string; phone?: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs());
  const { data: assignments = [] } = useTechAssignments();
  const { data: punches = [] } = usePunchHistory(7);
  const { data: openPunch } = useOpenPunch();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name, email, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? { email: user.email ?? "" });
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("tech-prefs", JSON.stringify(prefs));
  }, [prefs]);

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

  async function toggleNotifications(next: boolean) {
    setPrefs((p) => ({ ...p, notifications: next }));
    if (next && "Notification" in window && Notification.permission === "default") {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") toast.info("Notifications système refusées");
      } catch { /* ignore */ }
    }
  }

  const Row = ({
    icon: Icon, label, hint, onClick, right,
  }: {
    icon: any; label: string; hint?: string; onClick?: () => void; right?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className="w-full px-4 py-3.5 flex items-center gap-3 text-left transition-colors active:bg-white/[.03]"
    >
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.22)" }}
      >
        <Icon className="h-4 w-4" style={{ color: "var(--tp-primary-glow)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold" style={{ color: "var(--tp-text)" }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--tp-text-dim)" }}>{hint}</p>}
      </div>
      {right ?? <ChevronRight className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />}
    </button>
  );

  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <button
      role="switch"
      aria-checked={on}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: on ? "var(--tp-primary)" : "rgba(255,255,255,0.14)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );

  return (
    <div>
      <TechHeader title="Profil" />

      {/* Hero banner */}
      <div
        className="relative px-5 pt-6 pb-6 flex items-start gap-4"
        style={{ background: "linear-gradient(180deg, #06162C 0%, #0A0A12 100%)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 80% at 20% 50%, rgba(0,102,204,0.18) 0%, transparent 70%)" }}
        />
        <div
          className="relative h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-xl"
          style={{ background: "linear-gradient(135deg,#0066CC 0%,#004C99 100%)", boxShadow: "0 8px 24px rgba(0,102,204,0.32)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0 relative">
          <p className="tp-display text-[18px] font-black text-white tracking-[-0.02em] leading-tight">{displayName}</p>
          <p className="text-[12px] text-slate-400 mt-0.5 truncate">{profile?.email || ""}</p>
          {profile?.phone && <p className="text-[11px] text-slate-500 mt-0.5">{profile.phone}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0,102,204,0.2)", border: "1px solid rgba(0,102,204,0.35)" }}
            >
              <ShieldCheck className="h-3 w-3" /> Technicien
            </span>
            {openPunch && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}
              >
                <span className="tp-live-dot" /> En service
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* KPIs */}
        <section>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: "var(--tp-text-dim)" }}>Cette semaine</p>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: TrendingUp, label: "Installations", value: String(weekCompleted), color: "text-sky-400", iconColor: "text-blue-500" },
              { icon: Timer, label: "Heures", value: fmtDuration(weekMinutes), color: "text-emerald-400", iconColor: "text-emerald-500" },
              { icon: Award, label: "Complétion", value: `${completionRate}%`, color: weekCompleted === 0 ? "text-slate-400" : completionRate >= 80 ? "text-emerald-400" : "text-amber-400", iconColor: "text-amber-500" },
            ].map(({ icon: Icon, label, value, color, iconColor }) => (
              <div key={label} className="tp-card p-3 flex flex-col gap-1.5">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <p className={`tp-kpi text-[20px] leading-none ${color}`}>{value}</p>
                <p className="text-[10px] leading-tight" style={{ color: "var(--tp-text-dim)" }}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Career total */}
        <div className="tp-card p-4 flex items-center gap-4">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
          >
            <Award className="h-5 w-5" style={{ color: "var(--tp-primary-glow)" }} />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--tp-text-dim)" }}>Total complétées</p>
            <p className="tp-kpi text-[24px] leading-tight" style={{ color: "var(--tp-text)" }}>{allCompleted}</p>
          </div>
        </div>

        {/* Préférences */}
        <section className="tp-card overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--tp-text-dim)" }}>Préférences</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--tp-border)" }}>
            <Row
              icon={Bell}
              label="Notifications"
              hint="Alertes dispatch et missions"
              right={<Toggle on={prefs.notifications} onChange={toggleNotifications} />}
            />
            <Row
              icon={MapPinIcon}
              label="Position en direct"
              hint="Partager ma position au dispatch"
              right={<Toggle on={prefs.liveLocation} onChange={(v) => setPrefs((p) => ({ ...p, liveLocation: v }))} />}
            />
            <Row
              icon={Zap}
              label="Son des alertes"
              hint="Bip à chaque nouvelle mission"
              right={<Toggle on={prefs.soundOn} onChange={(v) => setPrefs((p) => ({ ...p, soundOn: v }))} />}
            />
            <Row
              icon={Moon}
              label="Auto-accepter les missions"
              hint="Prendre automatiquement les jobs du secteur"
              right={<Toggle on={prefs.autoAccept} onChange={(v) => setPrefs((p) => ({ ...p, autoAccept: v }))} />}
            />
          </div>
        </section>

        {/* Punch history */}
        <section className="tp-card overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--tp-text-dim)" }}>
              Pointages — 7 derniers jours
            </p>
            <span className="text-[11px] font-bold" style={{ color: "var(--tp-primary-glow)" }}>
              {fmtDuration(weekMinutes)}
            </span>
          </div>
          {punches.length === 0 ? (
            <div className="px-4 pb-4">
              <p className="text-[13px]" style={{ color: "var(--tp-text-dim)" }}>Aucun pointage cette semaine.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--tp-border)" }}>
              {punches.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold capitalize w-20 shrink-0" style={{ color: "var(--tp-text)" }}>
                    {fmtDate(p.punch_in_at)}
                  </span>
                  <span className="text-[12px] tabular-nums flex-1 text-center" style={{ color: "var(--tp-text-dim)" }}>
                    {fmtTime(p.punch_in_at)} → {fmtTime(p.punch_out_at)}
                  </span>
                  <span className="text-[13px] font-bold tabular-nums shrink-0 w-14 text-right" style={{ color: "var(--tp-success-glow)" }}>
                    {fmtDuration(p.total_minutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Compte */}
        <section className="tp-card overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--tp-text-dim)" }}>Compte</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--tp-border)" }}>
            <Row
              icon={KeyRound}
              label={resetting ? "Envoi en cours…" : "Changer mon mot de passe"}
              hint="Réinitialisation par courriel"
              onClick={handleReset}
              right={resetting ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--tp-primary-glow)" }} /> : undefined}
            />
            <Row
              icon={Globe}
              label="Langue"
              hint="Français (Québec)"
            />
          </div>
        </section>

        {/* Aide & support */}
        <section className="tp-card overflow-hidden">
          <div className="px-4 pt-3.5 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--tp-text-dim)" }}>Aide</p>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--tp-border)" }}>
            <Row
              icon={Phone}
              label="Contacter le dispatch"
              hint="Appel direct au bureau"
              onClick={() => { window.location.href = "tel:+18005551234"; }}
            />
            <Row
              icon={LifeBuoy}
              label="Signaler un problème"
              hint="Bug, incident, question"
              onClick={() => { window.location.href = "mailto:support@nivra-telecom.ca"; }}
            />
            <Row
              icon={FileText}
              label="Procédures & guides"
              hint="Manuels d'installation"
            />
            <Row
              icon={Info}
              label="À propos"
              hint="Nivra Tech v1.2 · build 2026.07"
            />
          </div>
        </section>

        {/* Logout */}
        <button
          onClick={async () => {
            if (!confirm("Voulez-vous vous déconnecter ?")) return;
            await supabase.auth.signOut();
            navigate("/nivra-secure-hub-2617-internal/login", { replace: true });
          }}
          className="w-full h-[52px] rounded-2xl px-5 flex items-center justify-center gap-3 text-[14px] font-bold transition-colors"
          style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", color: "#fca5a5" }}
        >
          <LogOut className="h-5 w-5" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
