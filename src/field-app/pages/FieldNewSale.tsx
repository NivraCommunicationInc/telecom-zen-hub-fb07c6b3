/**
 * FieldNewSale — Guided 8-step sales workflow.
 * Customer → Services → Promo → Equipment → Installation → Billing → Payment → Review → Submit
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  EMPTY_DRAFT,
  STEP_ORDER,
  type FieldSaleDraft,
  type FieldSaleStep,
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

  const { data: fieldConfig } = useFieldConfig();
  const activationFee = fieldConfig
    ? getActivationFee(fieldConfig, draft.services.length)
    : draft.services.length === 0
      ? 0
      : draft.services.length === 1
        ? 25
        : 45;

  const monthlySubtotal = draft.services.reduce((sum, service) => sum + service.monthlyPrice, 0);
  const equipmentTotal = draft.equipment.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const promoMonthlyDiscount = draft.promos.reduce((sum, promo) => {
    if (promo.promo_type === "monthly_discount") return sum + promo.discount_monthly;
    if (promo.promo_type === "percentage_off") return sum + (monthlySubtotal * promo.discount_percentage) / 100;
    return sum;
  }, 0);

  const promoOnetimeDiscount = draft.promos.reduce((sum, promo) => {
    if (promo.promo_type === "activation_credit") return sum + Math.min(promo.discount_onetime, activationFee);
    if (promo.promo_type === "free_installation") return sum + promo.discount_onetime;
    return sum;
  }, 0);

  const effectiveMonthly = Math.max(0, monthlySubtotal - promoMonthlyDiscount);
  const effectiveActivation = Math.max(0, activationFee - promoOnetimeDiscount);
  const totalDueToday = effectiveMonthly + equipmentTotal + effectiveActivation;
  const taxes = { total: totalDueToday };

  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitPhase("creating");
    setSubmitMessage("Création de la commande terrain et validation des données client…");

    try {
      const promoNames = draft.promos.map((promo) => promo.name).join(", ");
      const servicesPayload = draft.services.map((service) => ({
        name: service.name,
        category: service.category,
        price_monthly: service.monthlyPrice,
        price_setup: 0,
        quantity: 1,
      }));

      const paymentMethodMap: Record<string, string> = {
        paypal: "paypal",
        interac: "interac",
        send_link: "deferred",
        card_present: "card",
      };

      const { data: fieldOrder, error: fieldOrderError } = await supabase
        .from("field_sales_orders")
        .insert({
          salesperson_id: user.id,
          customer_name: `${draft.customer.first_name} ${draft.customer.last_name}`.trim(),
          customer_email: draft.customer.email.trim().toLowerCase(),
          customer_phone: draft.customer.phone,
          customer_address: draft.customer.address,
          customer_city: draft.customer.city,
          customer_postal_code: draft.customer.postal_code,
          customer_date_of_birth: draft.customer.date_of_birth || null,
          services: servicesPayload,
          total_amount: totalDueToday,
          payment_method: paymentMethodMap[draft.payment.method] || "deferred",
          payment_status: draft.payment.status === "completed" ? "confirmed" : "pending",
          payment_reference: null,
          appointment_date: draft.installation.scheduledDate || null,
          appointment_notes: draft.installation.timeWindow
            ? `Plage: ${draft.installation.timeWindow}. Type: ${draft.installation.type}`
            : `Type: ${draft.installation.type}`,
          sync_status: "pending",
          internal_notes: [
            promoNames ? `Promos: ${promoNames}` : "",
            draft.equipment.length > 0 ? `Équipement: ${draft.equipment.map((item) => `${item.name} x${item.quantity}`).join(", ")}` : "",
            draft.billing.preauthorizedPayment ? "Pré-auth: Oui" : "",
            draft.customer.notes || "",
          ]
            .filter(Boolean)
            .join("\n"),
        })
        .select("id")
        .single();

      if (fieldOrderError) throw fieldOrderError;

      logger.log("Field sale created", fieldOrder.id);

      setSubmitPhase("syncing");
      setSubmitMessage("Synchronisation en cours avec le système central pour rendre la commande visible aux opérations…");

      let syncState: "success" | "pending" | "error" = "pending";
      let syncErrorMessage = "";

      try {
        const { data: syncResult, error: syncError } = await supabase.functions.invoke("field-sales-sync", {
          body: { action: "sync_single", sale_id: fieldOrder.id },
        });

        if (syncError) {
          syncState = "error";
          syncErrorMessage = syncError.message || "Erreur de synchronisation";
          logger.warn("Field sale sync error", syncError);
        } else if (syncResult?.success) {
          syncState = "success";
          logger.log("Field sale synced", syncResult.order_number || fieldOrder.id);
        } else {
          syncState = "error";
          syncErrorMessage = syncResult?.error || "La synchronisation a été refusée";
          logger.warn("Field sale sync returned failure", syncResult);
        }
      } catch (syncErr: any) {
        syncState = "error";
        syncErrorMessage = syncErr?.message || "La synchronisation a échoué";
        logger.warn("Field sale sync invocation failed", syncErr);
      }

      setSubmitPhase("finalizing");
      setSubmitMessage(
        syncState === "success"
          ? "Commande transmise avec succès. Finalisation de la trace CRM et du journal d'audit…"
          : "Commande créée. La vente est sauvegardée, mais la synchronisation devra être suivie dans le détail de commande."
      );

      try {
        await supabase.from("field_leads").insert({
          agent_id: user.id,
          agent_name: profile?.full_name || "Agent",
          first_name: draft.customer.first_name,
          last_name: draft.customer.last_name,
          email: draft.customer.email,
          phone: draft.customer.phone,
          address: draft.customer.address,
          city: draft.customer.city,
          postal_code: draft.customer.postal_code,
          service_need: draft.services.map((service) => service.name).join(", "),
          payment_method_intent:
            draft.payment.method === "paypal"
              ? "PayPal"
              : draft.payment.method === "interac"
                ? "Virement Interac"
                : draft.payment.method === "send_link"
                  ? "Lien de paiement"
                  : "Carte sur place",
          eligibility_notes: `Installation: ${draft.installation.type}${draft.installation.scheduledDate ? ` le ${draft.installation.scheduledDate}` : ""}`,
          notes: [
            `Services: ${draft.services.map((service) => service.name).join(", ")}`,
            `Équipement: ${draft.equipment.map((item) => `${item.name} x${item.quantity}`).join(", ") || "Aucun"}`,
            promoNames ? `Promos: ${promoNames}` : "",
            `Total: ${taxes.total.toFixed(2)} $`,
            `Pré-auth: ${draft.billing.preauthorizedPayment ? "Oui" : "Non"}`,
            draft.customer.notes,
          ]
            .filter(Boolean)
            .join(". ")
            .trim(),
          status: "submitted",
          submitted_at: new Date().toISOString(),
        });
      } catch (leadErr) {
        logger.warn("Field lead mirror creation failed", leadErr);
      }

      await logInternalAudit({
        action: "field_sale_submitted",
        category: "operations",
        portal: "field",
        targetType: "field_sales_order",
        targetId: fieldOrder.id,
        details: {
          customer: `${draft.customer.first_name} ${draft.customer.last_name}`,
          services: draft.services.map((service) => service.name),
          promos: draft.promos.map((promo) => promo.name),
          total: taxes.total,
          payment_method: draft.payment.method,
          sync_state: syncState,
        },
      });

      if (syncState === "success") {
        toast.success("Commande soumise et synchronisée avec succès");
      } else if (syncState === "error") {
        toast.warning("Commande créée, mais la synchronisation demande un suivi");
      } else {
        toast.success("Commande créée — synchronisation toujours en cours");
      }

      const nextUrl = new URLSearchParams({
        leadId: fieldOrder.id,
        total: taxes.total.toFixed(2),
        payment: draft.payment.method,
        status: draft.payment.status,
        sync: syncState,
      });

      if (syncErrorMessage) nextUrl.set("syncError", syncErrorMessage);
      navigate(fieldPath(`/sale/success?${nextUrl.toString()}`));
    } catch (err: any) {
      logger.warn("Field sale submission failed", err);
      setSubmitPhase("error");
      setSubmitMessage(err?.message || "La commande n'a pas pu être soumise. Vérifiez les données et réessayez.");
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
          activationFee={activationFee}
          submitPhase={submitPhase}
          submitMessage={submitMessage}
          onSubmit={handleSubmit}
          onBack={() => goBack("review")}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
