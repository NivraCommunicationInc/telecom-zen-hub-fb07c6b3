import type { LucideIcon } from "lucide-react";

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  phase: string;
  capabilities: string[];
};

export function PagePlaceholder({ eyebrow, title, subtitle, icon: Icon, phase, capabilities }: Props) {
  return (
    <div>
      <header className="field-page__header">
        <div>
          <div className="field-page__eyebrow">{eyebrow}</div>
          <h1 className="field-page__title">{title}</h1>
          <p className="field-page__subtitle">{subtitle}</p>
        </div>
        <span className="field-tag field-tag--warn">Construction — {phase}</span>
      </header>

      <div className="field-card" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "hsl(var(--f-signal) / 0.14)", color: "hsl(var(--f-signal))",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Capacités prévues</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "hsl(var(--f-fg-muted))", fontSize: 14, lineHeight: 1.6 }}>
            {capabilities.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="field-card field-card--elev">
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "hsl(var(--f-fg-dim))" }}>Backend</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "hsl(var(--f-fg-muted))" }}>Réutilise la logique métier existante (RPC, tables, edge functions). Zéro réécriture.</div>
        </div>
        <div className="field-card field-card--elev">
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "hsl(var(--f-fg-dim))" }}>Offline</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "hsl(var(--f-fg-muted))" }}>File d'attente locale + sync visible dès P5.</div>
        </div>
        <div className="field-card field-card--elev">
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "hsl(var(--f-fg-dim))" }}>Assistant IA</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "hsl(var(--f-fg-muted))" }}>Copilote contextuel branché sur ce domaine en P5.</div>
        </div>
      </div>
    </div>
  );
}
