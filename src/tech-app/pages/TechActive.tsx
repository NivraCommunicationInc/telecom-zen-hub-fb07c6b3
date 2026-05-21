/**
 * TechActive — Redirects to the technician's current active installation if one exists,
 * else shows guidance.
 */
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Wrench } from "lucide-react";
import { useTechAssignments } from "../lib/useTechAssignments";
import TechHeader from "../components/TechHeader";

export default function TechActive() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useTechAssignments();

  useEffect(() => {
    if (isLoading) return;
    const today = new Date().toISOString().slice(0, 10);
    const active = data.find((a) => ["in_progress", "arrived", "en_route"].includes(a.status))
      ?? data.find((a) => a.scheduled_date === today && a.status === "scheduled")
      ?? data.find((a) => !["completed", "cancelled", "missed", "no_show"].includes(a.status));
    if (active) {
      navigate(`/tech/installation/${active.id}`, { replace: true });
    }
  }, [data, isLoading, navigate]);

  return (
    <div>
      <TechHeader title="En cours" />
      <div className="px-4 py-16 text-center">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
        ) : (
          <>
            <Wrench className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <p className="text-base font-semibold text-white">Aucune installation en cours</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Sélectionnez une mission pour commencer.</p>
            <Link
              to="/tech/assignments"
              className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-full bg-violet-600 text-white font-bold"
            >
              Voir mes missions
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
