import { HardHat } from "lucide-react";

type Props = { title: string; tour: string; lede: string; deliverables: string[] };

export function DomainInConstruction({ title, tour, lede, deliverables }: Props) {
  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <div className="tk-tag tk-tag--warn" style={{ marginBottom: 10 }}>Livraison {tour}</div>
      <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 15, marginTop: 0 }}>{lede}</p>

      <div className="tk-card" style={{ marginTop: 20, display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "hsl(var(--tk-warn) / 0.15)", color: "hsl(var(--tk-warn))",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <HardHat size={22} />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Ce domaine est en construction — pas un placeholder</div>
          <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
            Le domaine <b>Intervention</b> est livré et 100% fonctionnel dans ce tour. Les autres domaines suivent, un par tour,
            avec livraison complète (base de données, actions réelles, preuves). Aucun faux tableau de bord, aucun composant décoratif.
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Contenu livré à ce tour :</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "hsl(var(--tk-fg-mut))", fontSize: 13, lineHeight: 1.7 }}>
            {deliverables.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
