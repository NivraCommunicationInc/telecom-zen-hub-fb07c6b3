import { X, Sparkles } from "lucide-react";

type Props = { open: boolean; onClose: () => void };

export function AIAssistantPanel({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="field-scrim" onClick={onClose} />
      <aside className="field-drawer" role="dialog" aria-label="Assistant IA">
        <div className="field-drawer__header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={16} style={{ color: "hsl(var(--f-signal))" }} />
            <div style={{ fontWeight: 700 }}>Copilote terrain</div>
          </div>
          <button className="field-icon-btn" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="field-drawer__body">
          <div className="field-card">
            <div style={{ fontSize: 14, color: "hsl(var(--f-fg-muted))" }}>
              L'assistant sera branché en P5 sur Lovable AI Gateway avec des outils contextuels :
              diagnostic, résumé client, rédaction de notes, réponse email, guidance procédure.
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
