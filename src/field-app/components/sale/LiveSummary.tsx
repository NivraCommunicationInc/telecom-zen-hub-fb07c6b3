/**
 * LiveSummary — sticky right column shown on tablet/desktop.
 * Mirrors the totals in StepRecap so the agent sees the running price
 * while filling earlier steps.
 */
import { Receipt } from "lucide-react";
import type { FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  draft: FieldSaleDraft;
  activationFee: number;
  monthlyBeforeDiscount: number;
  monthlyDiscountAmount: number;
  installationDiscountAmount: number;
  firstMonthCredit: number;
  equipmentTotal: number;
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
}

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function LiveSummary({
  draft,
  activationFee,
  monthlyBeforeDiscount,
  monthlyDiscountAmount,
  installationDiscountAmount,
  firstMonthCredit,
  equipmentTotal,
  subtotal,
  tps,
  tvq,
  total,
}: Props) {
  const empty =
    draft.services.length === 0 && draft.equipment.length === 0 && activationFee === 0;

  return (
    <aside className="hidden md:block sticky top-6 self-start">
      <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))] mb-3">
          <Receipt className="h-3.5 w-3.5" /> Sommaire en direct
        </div>

        {empty ? (
          <p className="text-sm text-[hsl(var(--field-text-muted))]">
            Sélectionnez un client, des forfaits et de l'équipement pour voir le total.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {draft.services.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
                  Forfaits ({draft.services.length})
                </p>
                {draft.services.map((s) => (
                  <div key={s.id} className="flex justify-between">
                    <span className="text-white truncate pr-2">{s.name}</span>
                    <span className="text-white">{formatCAD(s.monthlyPrice)}/mois</span>
                  </div>
                ))}
              </div>
            )}

            {draft.equipment.length > 0 && (
              <div className="space-y-1 pt-2 border-t border-[hsl(var(--field-border-subtle))]">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
                  Équipement
                </p>
                {draft.equipment.map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <span className="text-white truncate pr-2">
                      {e.name}
                      {e.quantity > 1 ? ` ×${e.quantity}` : ""}
                    </span>
                    <span className="text-white">{formatCAD(e.price * e.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            {(monthlyDiscountAmount > 0 || installationDiscountAmount > 0 || firstMonthCredit > 0) && draft.discount && (
              <div className="space-y-1 pt-2 border-t border-[hsl(var(--field-border-subtle))]">
                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--field-success))]">
                  Rabais — {draft.discount.name}
                </p>
                {monthlyDiscountAmount > 0 && (
                  <div className="flex justify-between text-[hsl(var(--field-success))]">
                    <span>Rabais mensuel</span>
                    <span>−{formatCAD(monthlyDiscountAmount)}</span>
                  </div>
                )}
                {installationDiscountAmount > 0 && (
                  <div className="flex justify-between text-[hsl(var(--field-success))]">
                    <span>Installation gratuite</span>
                    <span>−{formatCAD(installationDiscountAmount)}</span>
                  </div>
                )}
                {firstMonthCredit > 0 && (
                  <div className="flex justify-between text-[hsl(var(--field-success))]">
                    <span>1er mois gratuit</span>
                    <span>−{formatCAD(firstMonthCredit)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-[hsl(var(--field-border-subtle))] space-y-1">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--field-text-muted))]">Activation</span>
                <span className="text-white">{formatCAD(activationFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--field-text-muted))]">Sous-total</span>
                <span className="text-white">{formatCAD(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[hsl(var(--field-text-dim))]">TPS</span>
                <span className="text-[hsl(var(--field-text-dim))]">{formatCAD(tps)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[hsl(var(--field-text-dim))]">TVQ</span>
                <span className="text-[hsl(var(--field-text-dim))]">{formatCAD(tvq)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[hsl(var(--field-accent)/0.3)] flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-[hsl(var(--field-text-muted))]">
                Total
              </span>
              <span className="text-xl font-bold text-[hsl(var(--field-accent-glow))]">
                {formatCAD(total)}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
