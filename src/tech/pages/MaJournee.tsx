import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useMyDay, type DayAssignment } from "@/tech/hooks/useMyDay";
import { useTechnicianLocation } from "@/tech/hooks/useTechnicianLocation";
import { SortableAppointment } from "@/tech/components/planning/SortableAppointment";
import { RouteMiniMap } from "@/tech/components/planning/RouteMiniMap";
import { Wand2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function MaJournee() {
  const nav = useNavigate();
  const { items, loading, reload } = useMyDay();
  const me = useTechnicianLocation(true);
  const [local, setLocal] = useState<DayAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ total_km: number; count: number } | null>(null);

  useEffect(() => { setLocal(items); }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistOrder = useCallback(async (arr: DayAssignment[]) => {
    const { data: user } = await supabase.auth.getUser();
    const uid = user.user?.id;
    if (!uid) return;
    const { error } = await supabase.rpc("fn_reorder_assignments", {
      _tech_id: uid, _ordered_ids: arr.map((a) => a.assignment_id),
    });
    if (error) toast.error(error.message);
    else toast.success("Ordre enregistré");
  }, []);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = local.findIndex((x) => x.assignment_id === active.id);
    const newIdx = local.findIndex((x) => x.assignment_id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(local, oldIdx, newIdx);
    setLocal(next);
    void persistOrder(next);
  };

  const optimize = async () => {
    setBusy(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) return;
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("fn_optimize_route", { _tech_id: uid, _date: today });
      if (error) throw error;
      const res = data as { ordered_ids: string[]; total_km: number; count: number };
      setSummary({ total_km: res.total_km, count: res.count });
      toast.success(`Tournée optimisée — ${res.count} arrêts, ${res.total_km} km`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'optimisation");
    } finally { setBusy(false); }
  };

  const startIntervention = async (a: DayAssignment) => {
    if (a.intervention_session_id) { nav(`/tech/intervention/${a.intervention_session_id}`); return; }
    try {
      const { data, error } = await supabase.rpc("fn_start_intervention", {
        p_assignment_id: a.assignment_id,
        p_service_kind: a.service_type ?? "internet",
        p_gps_lat: me.lat, p_gps_lng: me.lng, p_gps_accuracy: me.accuracy,
      });
      if (error) throw error;
      const s = data as { id: string };
      nav(`/tech/intervention/${s.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur au démarrage");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div className="tk-tag tk-tag--accent">Portail v3</div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>Ma journée</h1>
          <p style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 14, margin: 0 }}>
            Glisser pour réordonner · Optimiser calcule la tournée par proximité
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="tk-btn tk-btn--ghost" onClick={() => reload()}><RefreshCw size={14} /> Actualiser</button>
          <button className="tk-btn" onClick={optimize} disabled={busy || local.length < 2}>
            {busy ? <><Loader2 size={14} className="tk-spin" /> Optimisation…</> : <><Wand2 size={14} /> Optimiser la tournée</>}
          </button>
        </div>
      </div>

      <div className="tk-mc-hero">
        <div className="tk-card">
          {loading ? (
            <div style={{ color: "hsl(var(--tk-fg-mut))" }}><Loader2 className="tk-spin" size={14} /> Chargement…</div>
          ) : local.length === 0 ? (
            <div className="tk-alert tk-alert--info">Aucun rendez-vous aujourd'hui.</div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={local.map((x) => x.assignment_id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: "grid", gap: 8 }}>
                  {local.map((a, idx) => (
                    <SortableAppointment key={a.assignment_id} a={a} idx={idx}
                      onStart={startIntervention}
                      onOpen={(x) => nav(x.intervention_session_id ? `/tech/intervention/${x.intervention_session_id}` : `/tech`)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="tk-card">
          <div className="tk-widget__head">Carte</div>
          <RouteMiniMap items={local} me={me} />
          <div className="tk-route-summary">
            <div><strong>{local.length}</strong><span>Arrêts</span></div>
            <div><strong>{summary?.total_km ?? "—"}</strong><span>Km (optimisé)</span></div>
            <div><strong>{local.filter((x) => x.intervention_status === "completed").length}</strong><span>Terminés</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
