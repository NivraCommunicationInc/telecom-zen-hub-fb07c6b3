import { Bell, Search, Sparkles, ScanLine } from "lucide-react";

type Props = {
  onOpenCommand: () => void;
  onOpenNotifications: () => void;
  onOpenAssistant: () => void;
  onOpenScanner: () => void;
  status: "available" | "en_route" | "on_site" | "pause" | "off";
  onCycleStatus: () => void;
};

const STATUS_LABEL: Record<Props["status"], string> = {
  available: "Disponible",
  en_route: "En route",
  on_site: "Sur site",
  pause: "Pause",
  off: "Hors service",
};

const STATUS_COLOR: Record<Props["status"], string> = {
  available: "hsl(var(--f-ok))",
  en_route: "hsl(var(--f-info))",
  on_site: "hsl(var(--f-signal))",
  pause: "hsl(var(--f-warn))",
  off: "hsl(var(--f-fg-dim))",
};

export function FieldTopbar({
  onOpenCommand, onOpenNotifications, onOpenAssistant, onOpenScanner,
  status, onCycleStatus,
}: Props) {
  return (
    <header className="field-topbar" role="banner">
      <div className="field-topbar__brand">
        <div className="field-topbar__brand-mark" aria-hidden />
        <span>Nivra Field</span>
      </div>

      <button className="field-topbar__search" onClick={onOpenCommand} aria-label="Recherche universelle">
        <Search size={16} />
        <span>Rechercher clients, RDV, équipement, procédures…</span>
        <span className="field-topbar__kbd">⌘K</span>
      </button>

      <div className="field-topbar__actions">
        <button className="field-status-pill" onClick={onCycleStatus} aria-label="Changer le statut">
          <span className="field-status-pill__dot" style={{ background: STATUS_COLOR[status], boxShadow: `0 0 0 3px ${STATUS_COLOR[status]}30` }} />
          {STATUS_LABEL[status]}
        </button>
        <button className="field-icon-btn" onClick={onOpenScanner} aria-label="Scanner"><ScanLine size={18} /></button>
        <button className="field-icon-btn" onClick={onOpenNotifications} aria-label="Notifications"><Bell size={18} /></button>
        <button className="field-icon-btn" onClick={onOpenAssistant} aria-label="Assistant IA"><Sparkles size={18} /></button>
      </div>
    </header>
  );
}
