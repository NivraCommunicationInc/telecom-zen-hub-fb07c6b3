/**
 * FieldNewSale — Guided 8-step sales workflow.
 * Customer → Services → Promo → Equipment → Installation → Billing → Payment → Review → Submit
 * With real catalog, customer lookup, promo selection, and commission auto-creation.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";
import { estimateTaxes } from "@/lib/pricing/serverTaxEngine";
import {
  EMPTY_DRAFT, STEP_ORDER,
  type FieldSaleDraft, type FieldSaleStep,
} from "@/field-app/lib/fieldSaleTypes";

import SaleStepIndicator from "@/field-app/components/sale/SaleStepIndicator";
import StepCustomer from "@/field-app/components/sale/StepCustomer";
import StepServices from "@/field-app/components/sale/StepServices";
import StepPromo from "@/field-app/components/sale/StepPromo";
import StepEquipment from "@/field-app/components/sale/StepEquipment";
import StepInstallation from "@/field-app/components/sale/StepInstallation";
import StepBilling from "@/field-app/components/sale/StepBilling";
import StepPayment from "@/field-app/components/sale/StepPayment";
import StepReview from "@/field-app/components/sale/StepReview";

export default function FieldNewSale() {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["field-agent-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

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
    if (idx > 0) {
      setDraft((d) => ({ ...d, step: STEP_ORDER[idx - 1] }));
    }
  }, []);

  // Compute promo discounts
  const monthlySubtotal = draft.services.reduce((s, sv) => s + sv.monthlyPrice, 0);
  const equipmentTotal = draft.equipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const activationFee = draft.services.length === 0 ? 0 : draft.services.length === 1 ? 25 : 45;

  // Calculate promo impact
  const promoMonthlyDiscount = draft.promos.reduce((sum, p) => {
    if (p.promo_type === "monthly_discount") return sum + p.discount_monthly;
    if (p.promo_type === "percentage_off") return sum + (monthlySubtotal * p.discount_percentage / 100);
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
  const taxes = estimateTaxes(totalDueToday);

  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const promoNames = draft.promos.map(p => p.name).join(", ");
      
      const { data: lead, error } = await supabase.from("field_leads").insert({
        agent_id: user.id,
        agent_name: profile?.full_name || "Agent",
        first_name: draft.customer.first_name,
        last_name: draft.customer.last_name,
        email: draft.customer.email,
        phone: draft.customer.phone,
        address: draft.customer.address,
        city: draft.customer.city,
        postal_code: draft.customer.postal_code,
        service_need: draft.services.map((s) => s.name).join(", "),
        payment_method_intent: draft.payment.method === "send_link" ? "Lien de paiement" : "Carte sur place",
        eligibility_notes: `Installation: ${draft.installation.type}${draft.installation.scheduledDate ? ` le ${draft.installation.scheduledDate}` : ""}`,
        notes: [
          `Services: ${draft.services.map((s) => s.name).join(", ")}`,
          `Équipement: ${draft.equipment.map((e) => `${e.name} x${e.quantity}`).join(", ") || "Aucun"}`,
          promoNames ? `Promos: ${promoNames}` : "",
          `Total: ${taxes.total.toFixed(2)} $`,
          `Pré-auth: ${draft.billing.preauthorizedPayment ? "Oui" : "Non"}`,
          draft.customer.notes,
        ].filter(Boolean).join(". ").trim(),
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }).select("id").single();

      if (error) throw error;

      // Auto-create commission record
      try {
        const { data: rules } = await supabase
          .from("field_sales_commission_rules")
          .select("*")
          .eq("is_active", true)
          .limit(1);

        const rule = rules?.[0];
        let commissionAmount = 0;

        if (rule) {
          if (rule.rule_type === "percentage" && rule.bonus_percentage) {
            commissionAmount = Math.round((taxes.total * rule.bonus_percentage / 100) * 100) / 100;
          } else if (rule.bonus_amount) {
            commissionAmount = rule.bonus_amount;
          }
        }

        if (commissionAmount <= 0) commissionAmount = 10;

        await supabase.from("field_commissions").insert({
          agent_id: user.id,
          lead_id: lead.id,
          amount: commissionAmount,
          status: "pending",
          notes: `Auto-commission: ${draft.services.map((s) => s.name).join(", ")} — ${taxes.total.toFixed(2)} $`,
        });
      } catch (commErr) {
        console.error("[FieldNewSale] Commission creation failed (non-blocking):", commErr);
      }

      await logInternalAudit({
        action: "field_sale_submitted",
        category: "operations",
        portal: "field",
        targetType: "lead",
        targetId: lead.id,
        details: {
          customer: `${draft.customer.first_name} ${draft.customer.last_name}`,
          services: draft.services.map((s) => s.name),
          promos: draft.promos.map((p) => p.name),
          total: taxes.total,
          payment_method: draft.payment.method,
        },
      });

      toast.success("Commande soumise avec succès !");
      navigate(fieldPath(`/sale/success?leadId=${lead.id}&total=${taxes.total.toFixed(2)}&payment=${draft.payment.method}&status=${draft.payment.status}`));
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la soumission");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <SaleStepIndicator
        currentStep={draft.step}
        completedSteps={completedSteps}
        onStepClick={(step) => {
          if (completedSteps.includes(step) || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(draft.step)) {
            goTo(step);
          }
        }}
      />

      {draft.step === "customer" && (
        <StepCustomer
          customer={draft.customer}
          onChange={(customer) => setDraft((d) => ({ ...d, customer }))}
          onNext={() => advance("customer")}
          onCancel={() => navigate(fieldPath("/dashboard"))}
        />
      )}

      {draft.step === "services" && (
        <StepServices
          selected={draft.services}
          onChange={(services) => setDraft((d) => ({ ...d, services }))}
          onNext={() => advance("services")}
          onBack={() => goBack("services")}
        />
      )}

      {draft.step === "promo" && (
        <StepPromo
          selectedPromos={draft.promos}
          monthlySubtotal={monthlySubtotal}
          activationFee={activationFee}
          onChange={(promos) => setDraft((d) => ({ ...d, promos }))}
          onNext={() => advance("promo")}
          onBack={() => goBack("promo")}
        />
      )}

      {draft.step === "equipment" && (
        <StepEquipment
          services={draft.services}
          equipment={draft.equipment}
          onChange={(equipment) => setDraft((d) => ({ ...d, equipment }))}
          onNext={() => advance("equipment")}
          onBack={() => goBack("equipment")}
        />
      )}

      {draft.step === "installation" && (
        <StepInstallation
          services={draft.services}
          installation={draft.installation}
          onChange={(installation) => setDraft((d) => ({ ...d, installation }))}
          onNext={() => advance("installation")}
          onBack={() => goBack("installation")}
        />
      )}

      {draft.step === "billing" && (
        <StepBilling
          services={draft.services}
          equipment={draft.equipment}
          billing={draft.billing}
          promos={draft.promos}
          onChange={(billing) => setDraft((d) => ({ ...d, billing }))}
          onNext={() => advance("billing")}
          onBack={() => goBack("billing")}
        />
      )}

      {draft.step === "payment" && (
        <StepPayment
          payment={draft.payment}
          customer={draft.customer}
          totalAmount={taxes.total}
          onChange={(payment) => setDraft((d) => ({ ...d, payment }))}
          onNext={() => advance("payment")}
          onBack={() => goBack("payment")}
        />
      )}

      {draft.step === "review" && (
        <StepReview
          draft={draft}
          agentName={profile?.full_name || "Agent"}
          onSubmit={handleSubmit}
          onBack={() => goBack("review")}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
