/**
 * FieldNewSale — Guided 8-step sales workflow.
 * All submission goes through the backend order engine.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { submitNewSale } from "@/field-app/lib/fieldServices";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  EMPTY_DRAFT, STEP_ORDER,
  type FieldSaleDraft, type FieldSaleStep,
} from "@/field-app/lib/fieldSaleTypes";
import { getActivationFee, useFieldConfig } from "@/field-app/lib/useFieldConfig";
import SaleStepIndicator from "@/field-app/components/sale/SaleStepIndicator";
import StepCustomer from "@/field-app/components/sale/StepCustomer";
import StepServices from "@/field-app/components/sale/StepServices";
import StepPromo from "@/field-app/components/sale/StepPromo";
import StepEquipment from "@/field-app/components/sale/StepEquipment";
import StepInstallation from "@/field-app/components/sale/StepInstallation";
import StepBilling from "@/field-app/components/sale/StepBilling";
import StepPayment from "@/field-app/components/sale/StepPayment";
import StepReview from "@/field-app/components/sale/StepReview";

type SubmitPhase = "idle" | "creating" | "syncing" | "finalizing" | "error";

export default function FieldNewSale() {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const [draft, setDraft] = useState<FieldSaleDraft>({
    ...EMPTY_DRAFT,
    agentId: user?.id ?? "",
    createdAt: new Date().toISOString(),
  });

  const [completedSteps, setCompletedSteps] = useState<FieldSaleStep[]>([]);

  const goTo = useCallback((step: FieldSaleStep) => {
    setDraft((d) => ({ ...d, step }));
  }, []);

  const advance = useCallback((from: FieldSaleStep) => {
    const idx = STEP_ORDER.indexOf(from);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) {
      setCompletedSteps((prev) => [...new Set([...prev, from])]);
      setDraft((d) => ({ ...d, step: STEP_ORDER[idx + 1] }));
    }
  }, []);

  const goBack = useCallback((from: FieldSaleStep) => {
    const idx = STEP_ORDER.indexOf(from);
    if (idx > 0) setDraft((d) => ({ ...d, step: STEP_ORDER[idx - 1] }));
  }, []);

  const { data: fieldConfig } = useFieldConfig();
  const activationFee = fieldConfig
    ? getActivationFee(fieldConfig, draft.services.length)
    : draft.services.length === 0 ? 0 : draft.services.length === 1 ? 25 : 45;

  const monthlySubtotal = draft.services.reduce((sum, s) => sum + s.monthlyPrice, 0);
  const equipmentTotal = draft.equipment.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const promoMonthlyDiscount = draft.promos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount") return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage) / 100;
    return sum;
  }, 0);

  const promoOnetimeDiscount = draft.promos.reduce((sum, p) => {
    if (p.promo_type === "activation_credit") return sum + Math.min(p.discount_onetime, activationFee);
    if (p.promo_type === "free_installation") return sum + p.discount_onetime;
    return sum;
  }, 0);

  const effectiveMonthly = Math.max(0, monthlySubtotal - promoMonthlyDiscount);
  const effectiveActivation = Math.max(0, activationFee - promoOnetimeDiscount);
  const totalDueToday = effectiveMonthly + equipmentTotal + effectiveActivation;

  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitPhase("creating");
    setSubmitMessage("Envoi de la commande au moteur central…");

    try {
      const paymentMethodMap: Record<string, string> = {
        paypal: "paypal", interac: "interac", send_link: "deferred", card_present: "card",
      };

      const result = await submitNewSale({
        customer: draft.customer,
        services: draft.services.map((s) => ({
          name: s.name, category: s.category, price_monthly: s.monthlyPrice, quantity: 1,
        })),
        equipment: draft.equipment.map((e) => ({ name: e.name, quantity: e.quantity, price: e.price })),
        promos: draft.promos.map((p) => ({ name: p.name, promo_type: p.promo_type })),
        installation: draft.installation,
        billing: draft.billing,
        payment: {
          method: paymentMethodMap[draft.payment.method] || "deferred",
          status: draft.payment.status,
        },
        total_amount: totalDueToday,
      });

      logger.log("Field sale submitted via engine", result);

      setSubmitPhase("finalizing");
      const syncState = result?.sync_status || "pending";

      if (syncState === "synced") {
        toast.success("Commande soumise et synchronisée avec succès");
      } else {
        toast.warning("Commande créée — synchronisation en cours");
      }

      const nextUrl = new URLSearchParams({
        leadId: result?.order_id || "",
        total: totalDueToday.toFixed(2),
        payment: draft.payment.method,
        status: draft.payment.status,
        sync: syncState,
      });

      navigate(fieldPath(`/sale/success?${nextUrl.toString()}`));
    } catch (err: any) {
      logger.warn("Field sale submission failed", err);
      setSubmitPhase("error");
      setSubmitMessage(err?.message || "La commande n'a pas pu être soumise.");
      toast.error(err?.message || "Erreur lors de la soumission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SaleStepIndicator
        currentStep={draft.step}
        completedSteps={completedSteps}
        onStepClick={(step) => {
          if (completedSteps.includes(step) || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(draft.step)) goTo(step);
        }}
      />

      {draft.step === "customer" && <StepCustomer customer={draft.customer} onChange={(customer) => setDraft((d) => ({ ...d, customer }))} onNext={() => advance("customer")} onCancel={() => navigate(fieldPath("/dashboard"))} />}
      {draft.step === "services" && <StepServices selected={draft.services} onChange={(services) => setDraft((d) => ({ ...d, services }))} onNext={() => advance("services")} onBack={() => goBack("services")} />}
      {draft.step === "promo" && <StepPromo selectedPromos={draft.promos} monthlySubtotal={monthlySubtotal} activationFee={activationFee} onChange={(promos) => setDraft((d) => ({ ...d, promos }))} onNext={() => advance("promo")} onBack={() => goBack("promo")} />}
      {draft.step === "equipment" && <StepEquipment services={draft.services} equipment={draft.equipment} onChange={(equipment) => setDraft((d) => ({ ...d, equipment }))} onNext={() => advance("equipment")} onBack={() => goBack("equipment")} />}
      {draft.step === "installation" && <StepInstallation services={draft.services} installation={draft.installation} onChange={(installation) => setDraft((d) => ({ ...d, installation }))} onNext={() => advance("installation")} onBack={() => goBack("installation")} />}
      {draft.step === "billing" && <StepBilling services={draft.services} equipment={draft.equipment} billing={draft.billing} promos={draft.promos} onChange={(billing) => setDraft((d) => ({ ...d, billing }))} onNext={() => advance("billing")} onBack={() => goBack("billing")} />}
      {draft.step === "payment" && <StepPayment payment={draft.payment} customer={draft.customer} totalAmount={totalDueToday} onChange={(payment) => setDraft((d) => ({ ...d, payment }))} onNext={() => advance("payment")} onBack={() => goBack("payment")} />}
      {draft.step === "review" && <StepReview draft={draft} agentName="Agent" activationFee={activationFee} submitPhase={submitPhase} submitMessage={submitMessage} onSubmit={handleSubmit} onBack={() => goBack("review")} isSubmitting={isSubmitting} />}
    </div>
  );
}
