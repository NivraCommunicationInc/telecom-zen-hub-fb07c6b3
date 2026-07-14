import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FIELD_DOMAINS } from "./navigation";

type Props = { open: boolean; onClose: () => void };

export function CommandPalette({ open, onClose }: Props) {
  const nav = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const nav_items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return FIELD_DOMAINS.filter((d) =>
      !query || d.label.toLowerCase().includes(query) || d.description.toLowerCase().includes(query),
    );
  }, [q]);

  if (!open) return null;

  return (
    <div className="field-cmdk-scrim" onClick={onClose}>
      <div className="field-cmdk" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Recherche universelle">
        <input
          autoFocus
          className="field-cmdk__input"
          placeholder="Rechercher clients, RDV, équipement, procédures, actions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="field-cmdk__group-label">Aller à</div>
        {nav_items.map((d) => (
          <div key={d.id} className="field-cmdk__item" onClick={() => { nav(d.path); onClose(); }}>
            <d.icon size={16} />
            <div>
              <div style={{ fontWeight: 600 }}>{d.label}</div>
              <div style={{ fontSize: 12, color: "hsl(var(--f-fg-muted))" }}>{d.description}</div>
            </div>
          </div>
        ))}
        <div className="field-cmdk__group-label">Résultats métier</div>
        <div className="field-cmdk__item" style={{ color: "hsl(var(--f-fg-dim))" }}>
          Recherche clients / RDV / S/N — branchement RPC en P2
        </div>
      </div>
    </div>
  );
}
