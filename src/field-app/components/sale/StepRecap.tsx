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
  Send,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import type { FieldSaleCustomer, FieldSaleCustomAdjustment, FieldSaleDraft } from "@/field-app/lib/fieldSaleTypes";
import { saveQuoteAndEmail, sendPaymentLinkFromQuote } from "@/field-app/lib/fieldQuoteService";
import { formatDiscountLabel } from "@/field-app/lib/fieldUtils";
import InstallSlotPicker from "@/components/shared/InstallSlotPicker";

interface Props {
  draft: FieldSaleDraft;
  allowCoreAdjustments?: boolean;
  activationFee: number;
  fulfillmentFee?: number;
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
  onCustomerChange?: (customer: FieldSaleCustomer) => void;
  onCustomAdjustmentsChange?: (adjustments: FieldSaleCustomAdjustment[]) => void;
}

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

const formatCAD = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export default function StepRecap({
  draft,
  allowCoreAdjustments = false,
  activationFee,
  fulfillmentFee = 0,
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
  onCustomerChange,
  onCustomAdjustmentsChange,
}: Props) {
  const { user } = useStaffUser();
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteSavedId, setQuoteSavedId] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);

  const estimatedCommission = useMemo(
    () => Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)),
    [monthlyBeforeDiscount, equipmentTotal],
  );

  const agentDisplayName = () =>
    (user?.user_metadata as Record<string, string> | undefined)?.full_name ||
    user?.email ||
    "Agent Nivra";

  const customAdjustments = draft.custom_adjustments || [];
  const updateFulfillment = (mode: "standard" | "express" | "technician") => {
    const next =
      mode === "standard"
        ? { install_mode: "self" as const, delivery_mode: mode, delivery_fee: 20, installation_fee: 0, install_slot: null, install_date: null }
        : mode === "express"
          ? { install_mode: "self" as const, delivery_mode: mode, delivery_fee: 40, installation_fee: 0, install_slot: null, install_date: null }
          : { install_mode: "technician" as const, delivery_mode: mode, delivery_fee: 0, installation_fee: 50 };
    onCustomerChange?.({ ...draft.customer, ...next });
  };
  const addAdjustment = () => {
    onCustomAdjustmentsChange?.([
      ...customAdjustments,
      { id: crypto.randomUUID(), kind: "credit", label: "Crédit personnalisé", amount: 0 },
    ]);
  };
  const updateAdjustment = (id: string, patch: Partial<FieldSaleCustomAdjustment>) => {
    onCustomAdjustmentsChange?.(customAdjustments.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const removeAdjustment = (id: string) => {
    onCustomAdjustmentsChange?.(customAdjustments.filter((item) => item.id !== id));
  };

  const handleSendPaymentLink = async () => {
    if (sendingLink) return;
    if (!draft.customer.email) {
      toast.error("Le courriel du client est requis pour envoyer le lien de paiement.");
      return;
    }
    if (draft.services.length === 0 && draft.equipment.length === 0) {
      toast.error("Ajoutez au moins un service ou équipement.");
      return;
    }
    setSendingLink(true);
    try {
      // 1) Persist the quote (no client email — the Review Order email is sent below)
      let quoteId = quoteSavedId;
      if (!quoteId) {
        const saved = await saveQuoteAndEmail({
          draft,
          agentName: agentDisplayName(),
          activationFee,
          subtotal,
          tps,
          tvq,
          total,
          skipClientEmail: true,
        });
        quoteId = saved.id;
        setQuoteSavedId(saved.id);
      }
      // 2) Generate the secure Review Order/Square link + email
      const link = await sendPaymentLinkFromQuote(quoteId);
      setPaymentLinkUrl(link.payment_url);
      toast.success(
        link.email_sent
          ? `Lien Revoir ma commande envoyé à ${draft.customer.email}. Commission préservée.`
          : "Lien de paiement créé — le courriel n'a pas pu être envoyé.",
        { duration: 6000 },
      );
    } catch (err: any) {
      console.warn("[payment_link] send failed", err);
      toast.error(err?.message || "Impossible de créer le lien de paiement.");
    } finally {
      setSendingLink(false);
    }
  };


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
        skipClientEmail: true,
      });
      setQuoteSavedId(saved.id);
      const link = await sendPaymentLinkFromQuote(saved.id);
      setPaymentLinkUrl(link.payment_url);
      toast.success(
        link.email_sent
          ? "Soumission enregistrée — lien Revoir ma commande envoyé au client."
          : "Soumission enregistrée — lien créé, mais le courriel n'a pas pu être envoyé.",
      );
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
              {draft.customer.address}{draft.customer.apartment ? `, App. ${draft.customer.apartment}` : ""}, {draft.customer.city}, {draft.customer.province}{" "}
              {draft.customer.postal_code}
            </span>
          </div>
        )}
      </div>

      {/* Installation preferences — visible to client on the payment link page */}
      <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
          <Wrench className="h-3.5 w-3.5" /> Installation
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {allowCoreAdjustments ? (
            <div className="md:col-span-2 grid gap-2 md:grid-cols-3">
              {[
                { key: "standard", label: "Auto-installation — livraison standard", fee: 20 },
                { key: "express", label: "Express avec Uber", fee: 40 },
                { key: "technician", label: "Installation technicien", fee: 50 },
              ].map((option) => {
                const active = (draft.customer.delivery_mode || "technician") === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateFulfillment(option.key as "standard" | "express" | "technician")}
                    className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-[hsl(var(--field-accent))] bg-[hsl(var(--field-accent)/0.12)]" : "border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] hover:bg-white/[0.03]"}`}
                  >
                    <span className="block text-sm font-semibold text-white">{option.label}</span>
                    <span className="text-xs text-[hsl(var(--field-text-muted))]">{formatCAD(option.fee)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--field-text-muted))]">Mode d'installation</span>
              <select
                value={draft.customer.install_mode || "technician"}
                onChange={(e) =>
                  onCustomerChange?.({ ...draft.customer, install_mode: e.target.value as "technician" | "self" })
                }
                className="h-11 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] px-3 text-sm text-white"
              >
                <option value="technician">Installation par technicien</option>
                <option value="self">Auto-installation</option>
              </select>
            </label>
          )}
          {allowCoreAdjustments && (draft.customer.delivery_mode || "technician") === "technician" ? (
            <div className="md:col-span-2 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-white">Calendrier de disponibilité technicien</p>
                <p className="text-xs text-[hsl(var(--field-text-muted))] mt-0.5">Sélectionnez un vrai créneau ouvert du calendrier canonique.</p>
              </div>
              <InstallSlotPicker
                variant="compact"
                value={draft.customer.install_slot ?? null}
                onChange={(slot) =>
                  onCustomerChange?.({
                    ...draft.customer,
                    install_slot: slot,
                    install_date: slot?.date ?? null,
                    install_mode: slot ? "technician" : "technician",
                    delivery_mode: "technician",
                  })
                }
              />
            </div>
          ) : !allowCoreAdjustments ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-[hsl(var(--field-text-muted))]">Date prévue</span>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={draft.customer.install_date || ""}
                onChange={(e) =>
                  onCustomerChange?.({ ...draft.customer, install_date: e.target.value || null })
                }
                className="h-11 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] px-3 text-sm text-white"
              />
            </label>
          ) : null}
        </div>
        <p className="text-[11px] text-[hsl(var(--field-text-dim))]">
          {allowCoreAdjustments
            ? "Le mode technicien exige un créneau disponible; l’auto-installation ne réserve aucun rendez-vous."
            : "Le client verra cette date sur sa page de commande et pourra demander une modification si nécessaire."}
        </p>
      </div>

      {allowCoreAdjustments && (
        <div className="rounded-2xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-card))] p-5 md:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[hsl(var(--field-text-dim))]">
              <Receipt className="h-3.5 w-3.5" /> Frais / promotions personnalisés
            </div>
            <button
              type="button"
              onClick={addAdjustment}
              className="h-9 rounded-lg border border-[hsl(var(--field-accent)/0.45)] px-3 text-xs font-semibold text-[hsl(var(--field-accent-glow))] hover:bg-[hsl(var(--field-accent)/0.08)] inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          </div>
          {customAdjustments.length === 0 ? (
            <p className="text-sm text-[hsl(var(--field-text-muted))]">Aucun frais ou crédit personnalisé.</p>
          ) : (
            <div className="space-y-2">
              {customAdjustments.map((adjustment) => (
                <div key={adjustment.id} className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_120px_40px]">
                  <select
                    value={adjustment.kind}
                    onChange={(e) => updateAdjustment(adjustment.id, { kind: e.target.value as FieldSaleCustomAdjustment["kind"] })}
                    className="h-10 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] px-3 text-sm text-white"
                  >
                    <option value="credit">Crédit</option>
                    <option value="promotion">Promotion</option>
                    <option value="fee">Frais</option>
                  </select>
                  <input
                    value={adjustment.label}
                    onChange={(e) => updateAdjustment(adjustment.id, { label: e.target.value })}
                    placeholder="Raison"
                    className="h-10 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] px-3 text-sm text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={adjustment.amount || ""}
                    onChange={(e) => updateAdjustment(adjustment.id, { amount: Math.max(0, Number(e.target.value || 0)) })}
                    placeholder="0.00"
                    className="h-10 rounded-xl border border-[hsl(var(--field-border-subtle))] bg-[hsl(var(--field-input))] px-3 text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeAdjustment(adjustment.id)}
                    className="h-10 rounded-xl border border-[hsl(var(--field-border-subtle))] text-[hsl(var(--field-text-muted))] hover:text-white"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

        {/* RULE 1 — Automatic, mandatory, locked first-month-free credit. */}
        {firstMonthCredit > 0 && (
          <div className="pt-2 border-t border-[hsl(var(--field-border-subtle))] space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--field-success))]">
              <Sparkles className="h-3 w-3" /> 1er mois offert ✓ (automatique)
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[hsl(var(--field-success)/0.15)] text-[8px] tracking-wider">
                VERROUILLÉ
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[hsl(var(--field-success))]">
                Premier mois gratuit (forfait)
              </span>
              <span className="text-[hsl(var(--field-success))] font-semibold">
                −{formatCAD(firstMonthCredit)}
              </span>
            </div>
          </div>
        )}

        {draft.discount && (monthlyDiscountAmount > 0 || installationDiscountAmount > 0) && (
          <div className="pt-2 border-t border-[hsl(var(--field-border-subtle))] space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--field-success))]">
              <Sparkles className="h-3 w-3" /> {formatDiscountLabel(draft.discount)}
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
          {fulfillmentFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[hsl(var(--field-text-muted))]">Livraison / installation</span>
              <span className="text-white">{formatCAD(fulfillmentFee)}</span>
            </div>
          )}
          {customAdjustments.map((adjustment) => (
            <div key={adjustment.id} className="flex justify-between text-sm">
              <span className={adjustment.kind === "fee" ? "text-[hsl(var(--field-text-muted))]" : "text-[hsl(var(--field-success))]"}>
                {adjustment.label || (adjustment.kind === "fee" ? "Frais personnalisé" : "Crédit personnalisé")}
              </span>
              <span className={adjustment.kind === "fee" ? "text-white" : "text-[hsl(var(--field-success))] font-semibold"}>
                {adjustment.kind === "fee" ? "" : "−"}{formatCAD(Math.max(0, Number(adjustment.amount || 0)))}
              </span>
            </div>
          ))}
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

      {/* PRIMARY — Send secure payment link to client (agent commission preserved) */}
      <button
        type="button"
        onClick={handleSendPaymentLink}
        disabled={sendingLink || (draft.services.length === 0 && draft.equipment.length === 0)}
        className="w-full min-h-[64px] rounded-xl field-gradient-accent text-white font-bold text-base field-glow hover:field-glow-strong transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {sendingLink ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> Envoi du lien en cours…</>
        ) : paymentLinkUrl ? (
          <><CheckCircle2 className="h-5 w-5" /> Lien envoyé — Renvoyer au client</>
        ) : (
          <><Send className="h-5 w-5" /> Envoyer le lien de paiement au client</>
        )}
      </button>

      {paymentLinkUrl && (
        <div className="rounded-xl border border-[hsl(var(--field-accent)/0.35)] bg-[hsl(var(--field-accent)/0.06)] p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--field-accent-glow))] font-semibold">
            Lien sécurisé — expire dans 7 jours
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/40 px-3 py-2 text-xs text-white/85 font-mono">
              {paymentLinkUrl}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(paymentLinkUrl);
                toast.success("Lien copié.");
              }}
              className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copier
            </button>
          </div>
          <p className="text-[11px] text-[hsl(var(--field-text-muted))]">
            Un courriel a été envoyé à {draft.customer.email}. La commission vous est créditée automatiquement à la réception du paiement.
          </p>
        </div>
      )}

      {/* Secondary — Save as quote (no payment link, just an offer) */}
      <button
        type="button"
        onClick={handleSaveQuote}
        disabled={savingQuote || !!quoteSavedId || (draft.services.length === 0 && draft.equipment.length === 0)}
        className="w-full min-h-[52px] rounded-xl border border-[hsl(var(--field-border-subtle))] bg-transparent text-white/75 font-medium hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {savingQuote ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…</>
        ) : quoteSavedId && !paymentLinkUrl ? (
          <><CheckCircle2 className="h-4 w-4" /> Soumission envoyée</>
        ) : (
          <><Save className="h-4 w-4" /> Envoyer plutôt une soumission (sans paiement)</>
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
