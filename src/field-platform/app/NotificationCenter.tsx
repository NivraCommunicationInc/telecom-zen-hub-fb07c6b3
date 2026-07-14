import { X } from "lucide-react";

type Props = { open: boolean; onClose: () => void };

export function NotificationCenter({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="field-scrim" onClick={onClose} />
      <aside className="field-drawer" role="dialog" aria-label="Centre de notifications">
        <div className="field-drawer__header">
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "hsl(var(--f-fg-dim))" }}>Centre unifié</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Notifications</div>
          </div>
          <button className="field-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="field-drawer__body">
          <div className="field-card" style={{ marginBottom: 12 }}>
            <div className="field-tag field-tag--warn">Dispatch</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Aucune notification pour le moment</div>
            <div style={{ color: "hsl(var(--f-fg-muted))", fontSize: 13 }}>Les alertes NOC, dispatch, clients et système apparaîtront ici.</div>
          </div>
        </div>
      </aside>
    </>
  );
}
