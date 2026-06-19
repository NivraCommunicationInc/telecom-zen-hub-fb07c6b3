import { Tag, Sparkles, Repeat, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ClientPromo, ClientCredit } from "@/hooks/useClientPerks";

interface Props {
  promotions: ClientPromo[];
  credits: ClientCredit[];
}

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(124,58,237,0.25)",
  borderRadius: 20,
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  overflow: "hidden",
};

const fmtDate = (d: string | null) => {
  if (!d) return null;
  try { return format(new Date(d), "d MMM yyyy", { locale: fr }); } catch { return null; }
};

const fmtCAD = (n: number) =>
  Number(n).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

function PromoCard({ p }: { p: ClientPromo }) {
  return (
    <div style={CARD}>
      <div style={{ height: 3, background: "linear-gradient(135deg,#059669,#10b981)" }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399", flexShrink: 0 }}>
            <Tag size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{p.label}</p>
            {p.promo_code && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#34d399", fontFamily: "'JetBrains Mono', monospace", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, padding: "2px 7px" }}>
                {p.promo_code}
              </span>
            )}
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: "#34d399", whiteSpace: "nowrap" }}>
            -{fmtCAD(p.amount)}
          </span>
        </div>
        <div style={{ borderTop: "1px solid rgba(16,185,129,0.12)", paddingTop: 12, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          {(p.months_remaining ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Repeat size={12} style={{ color: "#34d399" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ fontWeight: 700, color: "#34d399" }}>{p.months_remaining}</span> mois restant{(p.months_remaining ?? 0) > 1 ? "s" : ""}
              </span>
            </div>
          )}
          {p.expires_at && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Fin le {fmtDate(p.expires_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreditCard({ c }: { c: ClientCredit }) {
  const typeLabel =
    c.type === "first_month_free" ? "Premier mois gratuit" :
    c.type === "one_time"         ? "Crédit unique" :
                                    "Crédit mensuel";
  return (
    <div style={CARD}>
      <div style={{ height: 3, background: "linear-gradient(135deg,#1d4ed8,#60a5fa)" }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa", flexShrink: 0 }}>
            <Sparkles size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{c.description}</p>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {typeLabel}
            </span>
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, color: "#60a5fa", whiteSpace: "nowrap" }}>
            -{fmtCAD(c.amount)}
          </span>
        </div>
        <div style={{ borderTop: "1px solid rgba(59,130,246,0.12)", paddingTop: 12 }}>
          {c.is_permanent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Repeat size={12} style={{ color: "#60a5fa" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Crédit <span style={{ fontWeight: 700, color: "#60a5fa" }}>permanent</span></span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Repeat size={12} style={{ color: "#60a5fa" }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ fontWeight: 700, color: "#60a5fa" }}>{c.months_remaining ?? 0}</span> mois restant{(c.months_remaining ?? 0) > 1 ? "s" : ""}
                {c.months_total ? ` / ${c.months_total}` : ""}
              </span>
            </div>
          )}
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, lineHeight: 1.5 }}>
            Ce crédit sera appliqué automatiquement à votre prochaine facture.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ClientPerksWidget({ promotions, credits }: Props) {
  if (promotions.length === 0 && credits.length === 0) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
          Avantages &amp; crédits
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {promotions.map(p => <PromoCard key={p.id} p={p} />)}
        {credits.map(c => <CreditCard key={c.id} c={c} />)}
      </div>
    </div>
  );
}
