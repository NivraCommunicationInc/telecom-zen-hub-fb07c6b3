/**
 * TechProfile — Technician profile page.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TechTopBar from "../components/TechTopBar";
import { useTechAssignments } from "../lib/useTechAssignments";

export default function TechProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ email?: string; full_name?: string } | null>(null);
  const { data: assignments = [] } = useTechAssignments();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? { email: user.email ?? "" });
    })();
  }, []);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthKey = monthStart.toISOString().slice(0, 10);
  const completedThisMonth = assignments.filter(
    (a) => a.status === "completed" && a.scheduled_date >= monthKey,
  ).length;

  return (
    <div>
      <TechTopBar title="Mon profil" />
      <div className="px-4 py-5 space-y-4">
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-violet-600/20 border border-violet-600/40 flex items-center justify-center">
            <User className="h-7 w-7 text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-white truncate">
              {profile?.full_name || "Technicien"}
            </p>
            <p className="text-xs text-slate-400 truncate">{profile?.email || ""}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-2xl font-bold text-white">{completedThisMonth}</p>
            <p className="text-xs text-slate-400 mt-1">Installations ce mois</p>
          </div>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
            <p className="text-2xl font-bold text-white">{assignments.length}</p>
            <p className="text-xs text-slate-400 mt-1">Assignations totales</p>
          </div>
        </section>

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/", { replace: true });
          }}
          className="w-full min-h-[56px] rounded-full bg-red-600/20 border border-red-600/50 text-red-300 text-base font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="h-5 w-5" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
