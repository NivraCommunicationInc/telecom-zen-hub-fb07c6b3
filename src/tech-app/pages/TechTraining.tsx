/**
 * TechTraining — Modules de formation et procédures techniques.
 */
import { useEffect, useState } from "react";
import { Play, CheckCircle2, Award, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TechHeader from "../components/TechHeader";

export default function TechTraining() {
  const [modules, setModules] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: mods } = await supabase
        .from("training_modules")
        .select("id, title, description, duration_minutes, category, is_required, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(30);
      setModules(mods ?? []);
      if (user) {
        const { data: prog } = await supabase
          .from("training_progress")
          .select("module_id, status, completed_at")
          .eq("user_id", user.id);
        const map: Record<string, any> = {};
        (prog ?? []).forEach((p: any) => { map[p.module_id] = p; });
        setProgress(map);
      }
      setLoading(false);
    })();
  }, []);

  const completed = Object.values(progress).filter((p: any) => p.status === "completed").length;

  return (
    <>
      <TechHeader title="Formation" subtitle="Guides & certifications" back />

      <section className="px-4 mt-4">
        <div className="rounded-2xl bg-zinc-900 text-white p-4 flex items-center gap-3">
          <Award className="h-8 w-8 text-amber-400" />
          <div className="flex-1">
            <p className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Progression</p>
            <p className="text-lg font-black italic">{completed} / {modules.length} modules</p>
          </div>
        </div>
      </section>

      <section className="px-4 mt-5 mb-8">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Modules disponibles</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-zinc-400" /></div>
        ) : modules.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-6">Aucun module disponible.</p>
        ) : (
          <div className="space-y-2">
            {modules.map((m) => {
              const done = progress[m.id]?.status === "completed";
              return (
                <div key={m.id} className="p-3 rounded-xl bg-white border border-zinc-200 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                    {done ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <BookOpen className="h-5 w-5 text-amber-400" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-black italic uppercase text-zinc-900 truncate">{m.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{m.category ?? "—"} · {m.duration_minutes ?? 0} min {m.is_required && "· obligatoire"}</p>
                  </div>
                  <button className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: done ? "#e4e4e7" : "#fbbf24", color: "#18181b" }} aria-label="Ouvrir">
                    <Play className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
