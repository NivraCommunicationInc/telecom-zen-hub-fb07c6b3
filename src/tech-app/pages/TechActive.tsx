/**
 * TechActive — Redirects to the tech's current active installation.
 * Shows a professional empty state if nothing is in progress.
 */
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Wrench, ArrowRight } from "lucide-react";
import { useTechAssignments } from "../lib/useTechAssignments";
import TechHeader from "../components/TechHeader";

export default function TechActive() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useTechAssignments();

  useEffect(() => {
    if (isLoading) return;
    const today = new Date().toISOString().slice(0, 10);
    const active =
      data.find((a) => ["in_progress", "arrived", "en_route"].includes(a.status)) ??
      data.find((a) => a.scheduled_date === today && a.status === "scheduled") ??
      data.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status));
    if (active) navigate(`/tech/installation/${active.id}`, { replace: true });
  }, [data, isLoading, navigate]);

  return (
    <div>
      <TechHeader title="En cours" />
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        ) : (
          <>
            <div
              className="h-20 w-20 rounded-3xl flex items-center justify-center mb-5"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <Wrench className="h-9 w-9 text-slate-600" />
            </div>
            <p className="text-[18px] font-black text-white tracking-[-0.02em]">Aucune installation en cours</p>
            <p className="text-[13px] text-slate-500 mt-2 mb-8 max-w-[240px]">
              Sélectionnez une mission dans votre liste pour commencer.
            </p>
            <Link
              to="/tech/assignments"
              className="inline-flex items-center gap-2 h-[52px] px-7 rounded-full text-[14px] font-bold text-white transition-all active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#0066CC 0%,#004C99 100%)", boxShadow: "0 4px 16px rgba(0,102,204,0.28)" }}
            >
              Voir mes missions <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
