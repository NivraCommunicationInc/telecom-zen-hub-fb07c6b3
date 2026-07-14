import { X, ScanLine } from "lucide-react";

type Props = { open: boolean; onClose: () => void };

export function ScannerSheet({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="field-scrim" onClick={onClose} />
      <aside className="field-drawer" role="dialog" aria-label="Scanner universel">
        <div className="field-drawer__header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ScanLine size={16} style={{ color: "hsl(var(--f-signal))" }} />
            <div style={{ fontWeight: 700 }}>Scanner universel</div>
          </div>
          <button className="field-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="field-drawer__body">
          <div className="field-card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>S/N · MAC · QR · Code-barre</div>
            <div style={{ fontSize: 13, color: "hsl(var(--f-fg-muted))" }}>
              L'accès caméra et la reconnaissance seront implémentés en P3, disponibles depuis toutes les pages via le bouton central du dock.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
