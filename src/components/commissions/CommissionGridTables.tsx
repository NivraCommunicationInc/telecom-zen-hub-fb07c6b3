/**
 * CommissionGridTables — Read-only canonical commission & bonus grids
 * shared across Core (agent profile + standalone page), Field portal,
 * and RH portal. Values match the system's commission_rules (30%/5%)
 * and field_bonus_rules tables.
 *
 * Theme variants:
 *  - "light"    → Core / RH (semantic tokens)
 *  - "field"    → Field portal (dark navy/purple via field-* tokens)
 */
import { cn } from "@/lib/utils";

type Variant = "light" | "field";

const FORFAITS: Array<{ label: string; price: number }> = [
  { label: "Internet 100 Mbps", price: 45 },
  { label: "Internet 500 Mbps", price: 50 },
  { label: "Internet Giga", price: 60 },
  { label: "Internet 100 + TV Basic", price: 75 },
  { label: "Internet 500 + TV 5 choix", price: 80 },
  { label: "GIGA + TV 5 choix", price: 80 },
  { label: "Internet 500 + TV 25 choix", price: 80 },
  { label: "GIGA + TV Basic", price: 85 },
  { label: "Internet 500 + TV 10 choix", price: 90 },
  { label: "GIGA + TV 10 choix", price: 90 },
  { label: "GIGA + TV 15 choix", price: 90 },
  { label: "Internet 500 + TV 15 choix", price: 95 },
  { label: "GIGA + TV 25 choix", price: 100 },
];

const EQUIPMENT: Array<{ label: string; price: number }> = [
  { label: "Borne Nivra WiFi", price: 60 },
  { label: "Terminal Nivra 4K Smart", price: 50 },
];

const BONUS_TIERS: Array<{ label: string; bonus: number; min: number }> = [
  { label: "10 ventes", bonus: 100, min: 10 },
  { label: "20 ventes", bonus: 250, min: 20 },
  { label: "30 ventes", bonus: 450, min: 30 },
  { label: "50+ ventes", bonus: 750, min: 50 },
];

const fmt = (n: number) =>
  `${n.toFixed(2).replace(".", ",")} $`;

function styles(variant: Variant) {
  if (variant === "field") {
    return {
      card: "bg-[hsl(var(--field-card))] border border-[hsl(var(--field-border-subtle))] rounded-2xl p-4 md:p-5",
      title: "text-sm md:text-base font-bold text-white mb-3 flex items-center gap-2",
      sub: "text-[11px] text-[hsl(var(--field-text-muted))]",
      tableWrap: "overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0",
      table: "w-full text-xs",
      th: "text-left font-semibold text-[hsl(var(--field-text-muted))] uppercase tracking-wider py-2 px-2 border-b border-[hsl(var(--field-border-subtle))]",
      td: "py-2 px-2 text-white border-b border-[hsl(var(--field-border-subtle))]/40",
      tdRight: "py-2 px-2 text-right text-[hsl(var(--field-accent-glow))] font-semibold border-b border-[hsl(var(--field-border-subtle))]/40 tabular-nums",
      tdNum: "py-2 px-2 text-right text-white border-b border-[hsl(var(--field-border-subtle))]/40 tabular-nums",
      note: "text-[10px] text-[hsl(var(--field-text-dim))] mt-2 italic",
      bonusBadge: "inline-block px-3 py-1 rounded-full text-xs font-bold bg-[hsl(var(--field-accent)/0.18)] text-[hsl(var(--field-accent-glow))] border border-[hsl(var(--field-accent)/0.45)]",
      sectionTag: "text-[hsl(var(--field-accent-glow))]",
    };
  }
  return {
    card: "bg-card border border-border rounded-xl p-4",
    title: "text-sm font-bold text-foreground mb-3 flex items-center gap-2",
    sub: "text-xs text-muted-foreground",
    tableWrap: "overflow-x-auto",
    table: "w-full text-xs",
    th: "text-left font-semibold text-muted-foreground uppercase tracking-wider py-2 px-2 border-b border-border",
    td: "py-2 px-2 text-foreground border-b border-border/40",
    tdRight: "py-2 px-2 text-right text-primary font-semibold border-b border-border/40 tabular-nums",
    tdNum: "py-2 px-2 text-right text-foreground border-b border-border/40 tabular-nums",
    note: "text-[11px] text-muted-foreground mt-2 italic",
    bonusBadge: "inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30",
    sectionTag: "text-primary",
  };
}

export function CommissionRateTable({ variant = "light" }: { variant?: Variant }) {
  const s = styles(variant);
  return (
    <div className={s.card}>
      <h3 className={s.title}>
        <span className={s.sectionTag}>📊</span> Grille de commission officielle
      </h3>
      <p className={cn(s.sub, "mb-3")}>
        Commission de <strong>30%</strong> sur Internet, TV et bundles —{" "}
        <strong>5%</strong> sur l'équipement.
      </p>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Forfait</th>
              <th className={cn(s.th, "text-right")}>Prix/mois</th>
              <th className={cn(s.th, "text-right")}>Commission 30%</th>
            </tr>
          </thead>
          <tbody>
            {FORFAITS.map((f) => (
              <tr key={f.label}>
                <td className={s.td}>{f.label}</td>
                <td className={s.tdNum}>{fmt(f.price)}</td>
                <td className={s.tdRight}>{fmt(f.price * 0.3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className={cn(s.title, "mt-5 text-xs")}>
        <span className={s.sectionTag}>📦</span> Équipement (commission 5%)
      </h4>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Équipement</th>
              <th className={cn(s.th, "text-right")}>Prix unitaire</th>
              <th className={cn(s.th, "text-right")}>Commission 5%</th>
            </tr>
          </thead>
          <tbody>
            {EQUIPMENT.map((e) => (
              <tr key={e.label}>
                <td className={s.td}>{e.label}</td>
                <td className={s.tdNum}>{fmt(e.price)}</td>
                <td className={s.tdRight}>{fmt(e.price * 0.05)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={s.note}>⚠️ Aucune commission sur les forfaits Mobile.</p>
    </div>
  );
}

export function BonusGridTable({
  variant = "light",
  currentSales,
}: {
  variant?: Variant;
  currentSales?: number;
}) {
  const s = styles(variant);

  // Find next tier progress
  let progress: { current: number; next: { min: number; bonus: number } | null; achieved: { min: number; bonus: number } | null } | null = null;
  if (typeof currentSales === "number") {
    const sorted = [...BONUS_TIERS].sort((a, b) => a.min - b.min);
    const achieved = [...sorted].reverse().find((t) => currentSales >= t.min) ?? null;
    const next = sorted.find((t) => currentSales < t.min) ?? null;
    progress = { current: currentSales, next, achieved };
  }

  return (
    <div className={s.card}>
      <h3 className={s.title}>
        <span className={s.sectionTag}>🏆</span> Grille de bonus mensuel
      </h3>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.th}>Ventes/mois</th>
              <th className={cn(s.th, "text-right")}>Bonus</th>
            </tr>
          </thead>
          <tbody>
            {BONUS_TIERS.map((t) => {
              const isAchieved = progress?.achieved?.min === t.min;
              return (
                <tr key={t.label}>
                  <td className={s.td}>
                    {t.label}{" "}
                    {isAchieved && (
                      <span className={cn("ml-1", s.bonusBadge)}>✓ Atteint</span>
                    )}
                  </td>
                  <td className={s.tdRight}>{fmt(t.bonus)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {progress && (
        <div className="mt-3 space-y-1">
          <p className={s.sub}>
            Ce mois-ci : <strong>{progress.current} vente{progress.current > 1 ? "s" : ""}</strong>
            {progress.next ? (
              <>
                {" "}— Prochain palier :{" "}
                <strong>{progress.next.min - progress.current} vente{progress.next.min - progress.current > 1 ? "s" : ""}</strong>{" "}
                pour obtenir le bonus de <strong>{fmt(progress.next.bonus)}</strong>
              </>
            ) : (
              <> — 🎉 Palier maximum atteint !</>
            )}
          </p>
        </div>
      )}

      <p className={s.note}>
        ℹ️ Calculé automatiquement le dernier jeudi de chaque mois.<br />
        ℹ️ Bonus calculé sur les forfaits uniquement (équipement exclu).<br />
        ℹ️ 1 commande = 1 vente pour le calcul du bonus.
      </p>
    </div>
  );
}

export default function CommissionGridTables({ variant = "light", currentSales }: { variant?: Variant; currentSales?: number }) {
  return (
    <div className="space-y-4">
      <CommissionRateTable variant={variant} />
      <BonusGridTable variant={variant} currentSales={currentSales} />
    </div>
  );
}
