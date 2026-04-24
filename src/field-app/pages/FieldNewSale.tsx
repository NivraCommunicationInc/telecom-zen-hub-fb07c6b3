/**
 * FieldNewSale — Rebuilt 5-step guided sale flow (PayPal-only).
 *
 *   1. Client    — StepCustomer (reused, backend serviceability + duplicates)
 *   2. Forfaits  — StepServices (reused, live catalog)
 *   3. Rabais    — StepDiscounts (new — agent_discount_assignments)
 *   4. Récap     — StepRecap (new — full breakdown + commission preview)
 *   5. Paiement  — StepPaymentPaypal (new — on-site link + email link)
 *
 * Submission still goes through the existing field-order-engine; we simply
 * map the new payment method enum to the engine's contract.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { submitNewSale } from "@/field-app/lib/fieldServices";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_DRAFT, STEP_ORDER,
  type FieldSaleDraft, type FieldSaleStep,
} from "@/field-app/lib/fieldSaleTypes";
import { getActivationFee, useFieldConfig } from "@/field-app/lib/useFieldConfig";
import SaleStepIndicator from "@/field-app/components/sale/SaleStepIndicator";
import StepCustomer from "@/field-app/components/sale/StepCustomer";
import StepServices from "@/field-app/components/sale/StepServices";
import StepEquipment from "@/field-app/components/sale/StepEquipment";
import StepDiscounts from "@/field-app/components/sale/StepDiscounts";
import StepRecap from "@/field-app/components/sale/StepRecap";
import StepPaymentPaypal from "@/field-app/components/sale/StepPaymentPaypal";
import LiveSummary from "@/field-app/components/sale/LiveSummary";
import { computeDiscountBreakdown } from "@/field-app/lib/fieldDiscountMath";

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

export default function FieldNewSale() {
  const navigate = useNavigate();
  const { user } = useStaffUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const [draft, setDraft] = useState<FieldSaleDraft>({
    ...EMPTY_DRAFT,
    agentId: user?.id ?? "",
    createdAt: new Date().toISOString(),
  });

  const [completedSteps, setCompletedSteps] = useState<FieldSaleStep[]>([]);
  const { data: fieldConfig } = useFieldConfig();

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

  // ── Pricing math ─────────────────────────────────────────
  const activationFee = fieldConfig
    ? getActivationFee(fieldConfig, draft.services.length)
    : draft.services.length === 0 ? 0 : draft.services.length === 1 ? 10 : 45;

  const monthlyBeforeDiscount = useMemo(
    () => draft.services.reduce((sum, s) => sum + s.monthlyPrice, 0),
    [draft.services]
  );

  const equipmentTotal = useMemo(
    () => draft.equipment.reduce((sum, e) => sum + e.price * e.quantity, 0),
    [draft.equipment]
  );

  const monthlyDiscountAmount = useMemo(() => {
    if (!draft.discount) return 0;
    if (draft.discount.type === "percentage") {
      return (monthlyBeforeDiscount * draft.discount.value) / 100;
    }
    return Math.min(draft.discount.value, monthlyBeforeDiscount);
  }, [draft.discount, monthlyBeforeDiscount]);

  const monthlyAfterDiscount = Math.max(0, monthlyBeforeDiscount - monthlyDiscountAmount);
  const subtotal = monthlyAfterDiscount + equipmentTotal + activationFee;
  const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
  const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
  const total = Math.round((subtotal + tps + tvq) * 100) / 100;

  // ── Submit (creates order, then triggers PayPal) ─────────
  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    if (draft.payment.method === "paypal_email" && !draft.customer.email) {
      toast.error("Le courriel du client est requis pour envoyer le lien.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("Création de la commande…");

    try {
      // 1) Create the order via the existing engine (reuses Order+Invoice+Commission pipeline)
      const result = await submitNewSale({
        customer: draft.customer,
        services: draft.services.map((s) => ({
          name: s.name, category: s.category, price_monthly: s.monthlyPrice, quantity: 1,
        })),
        equipment: draft.equipment.map((e) => ({ name: e.name, quantity: e.quantity, price: e.price })),
        promos: draft.discount
          ? [{ name: draft.discount.name, promo_type: draft.discount.type === "percentage" ? "percentage_off" : "monthly_discount" }]
          : [],
        installation: { type: "self_install", scheduledDate: null, timeWindow: null },
        billing: { preauthorizedPayment: false, billingCycleDay: new Date().getDate() },
        payment: { method: "paypal", status: "pending" },
        total_amount: total,
      });

      logger.log("Field sale created", result);
      const fieldOrderId = result?.field_order_id;
      const orderId = result?.order_id;
      const invoiceId = result?.invoice_id || result?.billing_invoice_id;

      if (!invoiceId) {
        throw new Error("Aucune facture générée pour cette commande.");
      }

      // 2) Generate PayPal order via existing edge function
      setSubmitMessage("Génération du lien PayPal…");
      const { data: ppData, error: ppErr } = await supabase.functions.invoke("paypal-create-order", {
        body: {
          invoice_id: invoiceId,
          amount: total,
          description: `Nivra Telecom — Commande ${orderId || ""}`.trim(),
        },
      });
      if (ppErr) throw ppErr;

      const approvalLink = ppData?.links?.find(
        (l: { rel: string; href: string }) => l.rel === "payer-action" || l.rel === "approve"
      );
      const approvalUrl = approvalLink?.href;
      if (!approvalUrl) throw new Error("PayPal n'a pas retourné de lien d'approbation.");

      // 3a) Email mode — enqueue Violet Bold "field_payment_link" template
      if (draft.payment.method === "paypal_email") {
        setSubmitMessage("Envoi du lien au client…");
        try {
          const summary = draft.services.map((s) => s.name).join(", ") || "Services Nivra";
          const { error: queueErr } = await supabase.from("email_queue").insert({
            event_key: `field_payment_link_${invoiceId}`,
            to_email: draft.customer.email,
            template_key: "field_payment_link",
            template_vars: {
              client_name: draft.customer.first_name || draft.customer.last_name || "Client",
              first_name: draft.customer.first_name,
              order_number: orderId || invoiceId,
              total: total.toFixed(2),
              approval_url: approvalUrl,
              summary,
              agent_name: user?.email || "votre conseiller Nivra",
            },
            status: "queued",
          } as any);
          if (queueErr) throw queueErr;
        } catch (mailErr) {
          // Non-fatal: link is still generated. Surface a warning.
          logger.warn("Field email send failed (link still valid)", mailErr);
          toast.warning("Lien généré mais l'envoi du courriel a échoué — copiez-le manuellement.");
        }

        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment,
            status: "sent",
            linkSentTo: draft.customer.email,
            paypalApprovalUrl: approvalUrl,
            paypalOrderId: ppData?.id ?? null,
            fieldOrderId: fieldOrderId ?? null,
            invoiceId: invoiceId ?? null,
            coreOrderId: orderId ?? null,
          },
        }));
        toast.success("Lien PayPal envoyé au client.");
      } else {
        // 3b) On-site mode — keep the link on screen for QR display
        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment,
            status: "pending",
            paypalApprovalUrl: approvalUrl,
            paypalOrderId: ppData?.id ?? null,
            fieldOrderId: fieldOrderId ?? null,
            invoiceId: invoiceId ?? null,
            coreOrderId: orderId ?? null,
          },
        }));
        toast.success("Lien PayPal prêt — montrez le QR au client.");
      }

      setCompletedSteps((prev) => [...new Set([...prev, "recap" as FieldSaleStep])]);
    } catch (err: any) {
      logger.warn("Field sale submission failed", err);
      toast.error(err?.message || "Erreur lors de la soumission");
    } finally {
      setIsSubmitting(false);
      setSubmitMessage("");
    }
  };

  // ── Realtime: invoice paid → mark payment completed ──────
  useEffect(() => {
    if (!draft.payment.invoiceId) return;

    const checkInvoiceStatus = async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("status, amount_paid, balance_due")
        .eq("id", draft.payment.invoiceId)
        .maybeSingle();

      if (error || !data) return;

      if (data.status === "paid" || Number(data.balance_due ?? 0) <= 0 || Number(data.amount_paid ?? 0) > 0) {
        setDraft((d) => ({ ...d, payment: { ...d.payment, status: "completed" } }));
        toast.success("Paiement PayPal confirmé !");
      }
    };

    checkInvoiceStatus();

    const channel = supabase
      .channel(`field-sale-invoice-${draft.payment.invoiceId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "billing_invoices", filter: `id=eq.${draft.payment.invoiceId}` },
        (payload: any) => {
          if (payload.new?.status === "paid") {
            setDraft((d) => ({ ...d, payment: { ...d.payment, status: "completed" } }));
            toast.success("Paiement PayPal confirmé !");
          }
        }
      )
      .subscribe();

    const poll = window.setInterval(checkInvoiceStatus, 5000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [draft.payment.invoiceId]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
      <SaleStepIndicator
        currentStep={draft.step}
        completedSteps={completedSteps}
        onStepClick={(step) => {
          if (completedSteps.includes(step) || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(draft.step)) goTo(step);
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

      {draft.step === "equipment" && (
        <StepEquipment
          selected={draft.equipment}
          onChange={(equipment) => setDraft((d) => ({ ...d, equipment }))}
          onNext={() => advance("equipment")}
          onBack={() => goBack("equipment")}
        />
      )}

      {draft.step === "discounts" && (
        <StepDiscounts
          selected={draft.discount}
          services={draft.services}
          onChange={(discount) => setDraft((d) => ({ ...d, discount }))}
          onNext={() => advance("discounts")}
          onBack={() => goBack("discounts")}
        />
      )}

      {draft.step === "recap" && (
        <StepRecap
          draft={draft}
          activationFee={activationFee}
          monthlyBeforeDiscount={monthlyBeforeDiscount}
          monthlyDiscountAmount={monthlyDiscountAmount}
          monthlyAfterDiscount={monthlyAfterDiscount}
          equipmentTotal={equipmentTotal}
          subtotal={subtotal}
          tps={tps}
          tvq={tvq}
          total={total}
          onNext={() => advance("recap")}
          onBack={() => goBack("recap")}
        />
      )}

      {draft.step === "payment" && (
        <StepPaymentPaypal
          payment={draft.payment}
          customer={draft.customer}
          totalAmount={total}
          onChange={(payment) => setDraft((d) => ({ ...d, payment }))}
          onSubmit={handleSubmit}
          onBack={() => goBack("payment")}
          isSubmitting={isSubmitting}
          submitMessage={submitMessage}
        />
      )}
    </div>
  );
}
