/**
 * Step 4 — Récapitulatif
 * Full summary: services + equipment + discount + activation fee + TPS/TVQ + total + commission preview.
 *
 * NEW: « Sauvegarder comme soumission » — persists the draft to `field_quotes`
 * and emails the client a link to complete the order. NO order/invoice is
 * created at this stage.
 */
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Receipt,
  TrendingUp,
  User,
  MapPin,
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import type { FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";
import { saveQuoteAndEmail } from "@/field-app/lib/fieldQuoteService";

interface Props {
  draft: FieldSaleDraft;
  activationFee: number;
  monthlyBeforeDiscount: number;
  monthlyDiscountAmount: number;
  monthlyAfterDiscount: number;
  installationDiscountAmount: number;
  firstMonthCredit: number;
  equipmentTotal: number;
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
}

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function StepRecap({
  draft,
  activationFee,
  monthlyBeforeDiscount,
  monthlyDiscountAmount,
  monthlyAfterDiscount,
  installationDiscountAmount,
  firstMonthCredit,
  equipmentTotal,
  subtotal,
  tps,
  tvq,
  total,
  onNext,
  onBack,
}: Props) {
  const { user } = useStaffUser();
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null);

  const estimatedCommission = useMemo(
    () => Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)),
    [monthlyBeforeDiscount, equipmentTotal],
  );

  const handleSaveQuote = async () => {
    if (savingQuote) return;
    if (!draft.customer.email) {
      toast.error("Le courriel du client est requis pour envoyer la soumission.");
      return;
    }
    setSavingQuote(true);
    try {
      const agentName =
        (user?.user_metadata as Record<string, string> | undefined)?.full_name ||
        user?.email ||
        "Agent Nivra";
      const saved = await saveQuoteAndEmail({
        draft,
        agentName,
        activationFee,
        subtotal,
        tps,
        tvq,
        total,
      });
      setQuoteSavedId(saved.id);
      toast.success("Soumission enregistrée et envoyée au client.");
    } catch (err: any) {
      console.warn("[field_quote] save failed", err);
      toast.error(err?.message || "Impossible d'enregistrer la soumission.");
    } finally {
      setSavingQuote(false);
    }
  };

  return (
    <div className="space-y-5 field-page-enter">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white">Récapitulatif</h2>
        <p className="text-sm md:text-base text-[hsl(var(--field-text-muted))] mt-1">
          Vérifiez les détails avant de générer le paiement ou d'envoyer une soumission.
        </p>
      </div>

      {/* Client card */}
      <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 md:p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))] mb-2">
          <User className="h-3.5 w-3.5" /> Client
        </div>
        <p className="text-white font-semibold text-base">
          {draft.customer.first_name} {draft.customer.last_name}
        </p>
        <p className="text-sm text-[hsl(var(--field-text-muted))]">{draft.customer.email}</p>
        <p className="text-sm text-[hsl(var(--field-text-muted))]">{draft.customer.phone}</p>
        {draft.customer.address && (
          <div className="flex items-start gap-1.5 text-xs text-[hsl(var(--field-text-dim))] mt-2 pt-2 border-t border-[hsl(var(--field-border-subtle))]">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              {draft.customer.address}, {draft.customer.city}, {draft.customer.province}{" "}
              {draft.customer.postal_code}
            </span>
          </div>
        )}
      </div>

      {/* Order breakdown */}
      <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
          <Receipt className="h-3.5 w-3.5" /> Détails de la commande
        </div>

        {draft.services.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
              Forfaits récurrents
            </p>
            {draft.services.map((s) => (
              <div key={s.id} className="flex justify-between text-sm">
                <span className="text-white truncate pr-2">{s.name}</span>
                <span className="text-white flex-shrink-0">
                  {formatCAD(s.monthlyPrice)}/mois
                </span>
              </div>
            ))}
          </div>
        )}

        {draft.equipment.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[hsl(var(--field-border-subtle))]">
            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
              Équipement
            </p>
            {draft.equipment.map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-white truncate pr-2">
                  {e.name} {e.quantity > 1 && `×${e.quantity}`}
                </span>
                <span className="text-white flex-shrink-0">
                  {formatCAD(e.price * e.quantity)}
                </span>
              </div>
            ))}
          </div>
        )}

        {draft.discount && (monthlyDiscountAmount > 0 || installationDiscountAmount > 0 || firstMonthCredit > 0) && (
          <div className="pt-2 border-t border-[hsl(var(--field-border-subtle))] space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--field-success))]">
              <Sparkles className="h-3 w-3" /> Rabais — {draft.discount.name}
            </div>
            {monthlyDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(var(--field-success))]">
                  Rabais mensuel
                  {draft.discount.duration_months
                    ? ` (${draft.discount.duration_months} mois)`
                    : ""}
                </span>
                <span className="text-[hsl(var(--field-success))] font-semibold">
                  −{formatCAD(monthlyDiscountAmount)}
                </span>
              </div>
            )}
            {installationDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(var(--field-success))] inline-flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Installation gratuite
                </span>
                <span className="text-[hsl(var(--field-success))] font-semibold">
                  −{formatCAD(installationDiscountAmount)}
                </span>
              </div>
            )}
            {firstMonthCredit > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(var(--field-success))]">
                  Premier mois gratuit (forfait)
                </span>
                <span className="text-[hsl(var(--field-success))] font-semibold">
                  −{formatCAD(firstMonthCredit)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-[hsl(var(--field-border-subtle))] space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-[hsl(var(--field-text-muted))]">
              Frais d'activation ({draft.services.length}{" "}
              {draft.services.length > 1 ? "services" : "service"})
            </span>
            <span className="text-white">{formatCAD(activationFee)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span className="text-white">Sous-total</span>
            <span className="text-white">{formatCAD(subtotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[hsl(var(--field-text-muted))]">
              TPS ({(TPS_RATE * 100).toFixed(0)} %)
            </span>
            <span className="text-[hsl(var(--field-text-muted))]">{formatCAD(tps)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[hsl(var(--field-text-muted))]">
              TVQ ({(TVQ_RATE * 100).toFixed(3)} %)
            </span>
            <span className="text-[hsl(var(--field-text-muted))]">{formatCAD(tvq)}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-[hsl(var(--field-accent)/0.3)] flex items-center justify-between">
          <span className="text-sm uppercase tracking-wider text-[hsl(var(--field-text-muted))]">
            Total
          </span>
          <span className="text-2xl md:text-3xl font-bold text-[hsl(var(--field-accent-glow))]">
            {formatCAD(total)}
          </span>
        </div>
      </div>

      {/* Commission preview */}
      <div className="rounded-2xl border border-[hsl(var(--field-accent)/0.3)] field-gradient-purple p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-accent-glow))] mb-1">
          <TrendingUp className="h-3.5 w-3.5" /> Commission estimée
        </div>
        <p className="text-xl font-bold text-white">
          {formatCAD(estimatedCommission)}
          <span className="text-xs font-normal text-[hsl(var(--field-text-muted))] ml-2">
            (30% récurrent + 5% équipement)
          </span>
        </p>
      </div>

      {/* Save as quote — never creates an order */}
      <button
        type="button"
        onClick={handleSaveQuote}
        disabled={savingQuote || !!quoteSavedId || (draft.services.length === 0 && draft.equipment.length === 0)}
        className="w-full min-h-[56px] rounded-xl border border-[hsl(var(--field-accent)/0.4)] bg-[hsl(var(--field-accent)/0.08)] text-[hsl(var(--field-accent-glow))] font-semibold hover:bg-[hsl(var(--field-accent)/0.15)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {savingQuote ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
          </>
        ) : quoteSavedId ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Soumission envoyée au client
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Sauvegarder comme soumission (valide 30 jours)
          </>
        )}
      </button>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 h-14 rounded-xl border border-[hsl(var(--field-border-subtle))] text-white font-medium hover:bg-[hsl(var(--field-card-hover))] transition-colors flex items-center justify-center gap-2 text-base"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={draft.services.length === 0 && draft.equipment.length === 0}
          className="flex-1 h-14 rounded-xl field-gradient-accent text-white font-semibold field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base"
        >
          Continuer <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
