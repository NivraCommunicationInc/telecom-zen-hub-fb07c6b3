import { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin, Phone, Play, ChevronRight, CheckCircle2 } from "lucide-react";
import type { DayAssignment } from "@/tech/hooks/useMyDay";

export function SortableAppointment({
  a, idx, onStart, onOpen,
}: { a: DayAssignment; idx: number; onStart: (a: DayAssignment) => void; onOpen: (a: DayAssignment) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.assignment_id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const done = a.intervention_status === "completed" || a.status === "completed";
  const cur = a.intervention_status === "active";

  return (
    <div ref={setNodeRef} style={style} className={`tk-appt${isDragging ? " dragging" : ""}`} data-cur={cur ? 1 : 0} data-done={done ? 1 : 0}>
      <div className="tk-appt__time">
        <div style={{ fontSize: 10, opacity: 0.7 }}>#{idx + 1}</div>
        <div>{a.time_start?.slice(0, 5)}</div>
      </div>
      <div className="tk-appt__body">
        <div className="tk-appt__title">{a.client_full_name || "Client"} <span style={{ color: "hsl(var(--tk-fg-dim))", fontWeight: 500, marginLeft: 6 }}>· {a.service_type ?? "installation"}</span></div>
        <div className="tk-appt__meta">
          <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {a.address_line ?? "—"}{a.city ? `, ${a.city}` : ""}</span>
          {a.client_phone && <span><Phone size={11} style={{ verticalAlign: -1 }} /> {a.client_phone}</span>}
          {done && <span className="tk-tag tk-tag--ok"><CheckCircle2 size={10}/> Terminé</span>}
          {cur && <span className="tk-tag tk-tag--accent">En cours · {a.intervention_progress ?? 0}/12</span>}
        </div>
      </div>
      <div className="tk-appt__actions">
        {!done && (
          <button className="tk-btn tk-btn--sm" onClick={() => onStart(a)} title="Démarrer intervention">
            <Play size={12} /> {cur ? "Reprendre" : "Démarrer"}
          </button>
        )}
        <button className="tk-btn tk-btn--sm tk-btn--ghost" onClick={() => onOpen(a)} title="Détails">
          <ChevronRight size={14} />
        </button>
        <span className="tk-appt__handle" {...attributes} {...listeners} aria-label="Réordonner">
          <GripVertical size={14} />
        </span>
      </div>
    </div>
  );
}
