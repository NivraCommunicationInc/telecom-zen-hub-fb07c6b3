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

  // ── Fetch agent full name (for emails) ──
  const [agentFullName, setAgentFullName] = useState<string>("");
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: agentProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setAgentFullName(((agentProfile as any)?.full_name as string) || "");
    })();
  }, [user?.id]);
  const agentName = agentFullName || user?.email || "votre conseiller Nivra";

  // ── Email payload helpers (services / equipment / discount) ──
  const buildServicesList = useCallback((d: FieldSaleDraft) => {
    const list = (d.services || [])
      .filter((s: any) => s && s.name)
      .map((s: any) => `${s.name} — ${(s.monthlyPrice ?? s.price ?? 0)}$/mois`)
      .join(", ");
    return list || "Aucun forfait";
  }, []);
  const buildEquipmentList = useCallback((d: FieldSaleDraft) => {
    const list = (d.equipment || [])
      .filter((e: any) => e && e.name)
      .map((e: any) => `${e.name}${e.quantity > 1 ? ` x${e.quantity}` : ""} — ${(e.price ?? e.unit_price ?? 0)}$`)
      .join(", ");
    return list || "Aucun équipement";
  }, []);
  const buildDiscountLabel = useCallback((d: FieldSaleDraft): string | null => {
    const disc: any = d.discount;
    if (!disc) return null;
    const dur = disc.duration_months ? ` — ${disc.duration_months} mois` : "";
    const val = Number(disc.value || 0);
    const unit = disc.type === "percentage" ? "%" : "$/mois";
    return `${disc.name}${dur} — ${val}${unit}`;
  }, []);

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

  // Centralized discount math (handles fixed_monthly, remove_fee, first_month_free, etc.).
  const discountBreakdown = useMemo(
    () => computeDiscountBreakdown(draft.discount, draft.services, activationFee),
    [draft.discount, draft.services, activationFee],
  );

  const monthlyDiscountAmount = discountBreakdown.monthlyDiscountAmount;
  const installationDiscountAmount = discountBreakdown.installationDiscountAmount;
  const firstMonthCredit = discountBreakdown.firstMonthCredit;

  const monthlyAfterDiscount = Math.max(0, monthlyBeforeDiscount - monthlyDiscountAmount);
  const effectiveActivation = Math.max(0, activationFee - installationDiscountAmount);
  // First-month credit is a one-time credit on the first invoice only.
  const subtotal = Math.max(
    0,
    monthlyAfterDiscount + equipmentTotal + effectiveActivation - firstMonthCredit,
  );
  const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
  const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
  const total = Math.round((subtotal + tps + tvq) * 100) / 100;

  // ── Submit (FIX 1: payment-first — NO order created until webhook confirms) ──
  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    if (draft.payment.method === "paypal_email" && !draft.customer.email) {
      toast.error("Le courriel du client est requis pour envoyer le lien.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("Sauvegarde de la soumission…");

    try {
      // 1) Save the quote (no order/invoice yet)
      const { saveQuoteAndEmail } = await import("@/field-app/lib/fieldQuoteService");
      const quote = await saveQuoteAndEmail({
        draft, agentName: user?.email || "Agent terrain", activationFee,
        subtotal, tps, tvq, total,
      });

      // 2) Ask backend to generate a PayPal link tied to a payment intent
      setSubmitMessage("Génération du lien PayPal…");
      const { data, error } = await supabase.functions.invoke("field-payment-initiate", {
        body: {
          quote_id: quote.id,
          amount: total,
          customer_email: draft.customer.email,
          customer_name: `${draft.customer.first_name} ${draft.customer.last_name}`.trim(),
          description: `Nivra Telecom — Vente terrain (${draft.customer.first_name || ""})`.trim(),
        },
      });
      if (error) throw error;
      const approvalUrl: string | null = data?.approval_url || null;
      if (!approvalUrl) throw new Error("PayPal n'a pas retourné de lien d'approbation.");

      // 3) Email mode — enqueue Violet Bold "payment_link_employee" template (with retry)
      if (draft.payment.method === "paypal_email") {
        setSubmitMessage("Envoi du lien au client…");
        const servicesList = draft.services.map((s) => s.name).filter(Boolean).join(", ") || "Services Nivra";
        const equipmentList = (draft.equipment || []).map((e: any) => e?.name).filter(Boolean).join(", ") || "Aucun";
        const fullName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
        const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const discountAmount = Math.max(0, monthlyBeforeDiscount - monthlyAfterDiscount) + firstMonthCredit;
        const emailPayload = {
          event_key: `payment_link_employee_${data.intent_id}`,
          to_email: draft.customer.email,
          template_key: "payment_link_employee",
          template_vars: {
            client_name: fullName,
            client_email: draft.customer.email,
            first_name: draft.customer.first_name || "Client",
            order_number: data.intent_id,
            services: servicesList,
            summary: servicesList,
            equipment: equipmentList,
            discount: discountAmount.toFixed(2),
            subtotal: subtotal.toFixed(2),
            tps: tps.toFixed(2),
            tvq: tvq.toFixed(2),
            total: total.toFixed(2),
            approval_url: approvalUrl,
            payment_url: `https://nivra-telecom.ca/payer/${data.intent_id}`,
            valid_until: validUntil,
            agent_name: user?.email || "votre conseiller Nivra",
          },
          status: "queued",
        };
        // Retry insert up to 3 times with 2s backoff
        console.log('[EMAIL] Attempting to queue email for:', draft.customer.email);
        let emailErr: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error: e } = await supabase.from("email_queue").insert(emailPayload as any);
          if (!e) { emailErr = null; break; }
          emailErr = e;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
        }
        console.log('[EMAIL] Queue result:', emailErr ? emailErr.message : 'SUCCESS');
        if (emailErr) {
          const payerUrl = `https://nivra-telecom.ca/payer/${data.intent_id}`;
          logger.warn("field_payment_link enqueue failed after 3 attempts", emailErr);
          toast.warning(`Commande créée mais l'email n'a pas pu être envoyé. Le client peut payer via: ${payerUrl}`, { duration: 15000 });
        }

        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment, status: "sent", linkSentTo: draft.customer.email,
            paypalApprovalUrl: approvalUrl, paypalOrderId: data.paypal_order_id ?? null,
            fieldOrderId: data.intent_id ?? null, invoiceId: null, coreOrderId: null,
          },
        }));
        toast.success("Lien PayPal envoyé au client.");
      } else {
        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment, status: "pending",
            paypalApprovalUrl: approvalUrl, paypalOrderId: data.paypal_order_id ?? null,
            fieldOrderId: data.intent_id ?? null, invoiceId: null, coreOrderId: null,
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

  // FIX 2 — Card manual submit
  const handleCardSubmit = async (cardData: { number: string; name: string; expiry: string; cvv: string }) => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("Chiffrement et enregistrement…");
    try {
      const { saveQuoteAndEmail } = await import("@/field-app/lib/fieldQuoteService");
      const quote = await saveQuoteAndEmail({
        draft, agentName: user?.email || "Agent terrain", activationFee,
        subtotal, tps, tvq, total,
      });

      const { data, error } = await supabase.functions.invoke("field-card-intent", {
        body: {
          quote_id: quote.id,
          amount: total,
          card_number: cardData.number,
          card_name: cardData.name,
          card_expiry: cardData.expiry,
          cvv: cardData.cvv,
          customer_email: draft.customer.email,
          customer_name: `${draft.customer.first_name} ${draft.customer.last_name}`.trim(),
        },
      });
      if (error) throw error;

      setDraft((d) => ({
        ...d,
        payment: { ...d.payment, status: "sent", linkSentTo: null,
          paypalApprovalUrl: null, paypalOrderId: null,
          fieldOrderId: null, invoiceId: null, coreOrderId: null },
      }));
      toast.success(`Carte ••${data.card_last4} enregistrée. En attente de traitement par Core.`);
      setCompletedSteps((prev) => [...new Set([...prev, "recap" as FieldSaleStep])]);
    } catch (err: any) {
      logger.warn("Field card submission failed", err);
      toast.error(err?.message || "Erreur lors de l'enregistrement de la carte");
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
    <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
      <div className="mb-5">
        <SaleStepIndicator
          currentStep={draft.step}
          completedSteps={completedSteps}
          onStepClick={(step) => {
            if (completedSteps.includes(step) || STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(draft.step)) goTo(step);
          }}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5 min-w-0">
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
              installationFee={activationFee}
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
              installationDiscountAmount={installationDiscountAmount}
              firstMonthCredit={firstMonthCredit}
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
              onSubmitCard={handleCardSubmit}
              onBack={() => goBack("payment")}
              isSubmitting={isSubmitting}
              submitMessage={submitMessage}
              onResendEmail={async () => {
                if (!draft.payment.paypalApprovalUrl || !draft.customer.email || !draft.payment.fieldOrderId) {
                  toast.error("Aucun lien à renvoyer."); return;
                }
                const summary = draft.services.map((s) => s.name).join(", ") || "Services Nivra";
                const fullName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
                const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
                const payload = {
                  event_key: `field_payment_link_resend_${draft.payment.fieldOrderId}_${Date.now()}`,
                  to_email: draft.customer.email,
                  template_key: "field_payment_link",
                  template_vars: {
                    client_name: fullName, first_name: draft.customer.first_name || "Client",
                    order_number: draft.payment.fieldOrderId, total: total.toFixed(2),
                    approval_url: draft.payment.paypalApprovalUrl, payment_url: `https://nivra-telecom.ca/payer/${draft.payment.fieldOrderId}`,
                    summary, services: summary, valid_until: validUntil,
                    agent_name: user?.email || "votre conseiller Nivra",
                  },
                  status: "queued",
                };
                let err: any = null;
                for (let i = 1; i <= 3; i++) {
                  const { error: e } = await supabase.from("email_queue").insert(payload as any);
                  if (!e) { err = null; break; }
                  err = e;
                  if (i < 3) await new Promise((r) => setTimeout(r, 2000));
                }
                if (err) { toast.error("Échec d'envoi du courriel."); }
                else { toast.success("Courriel renvoyé."); }
              }}
              onChangeMethod={() => {
                setDraft((d) => ({
                  ...d,
                  payment: { ...d.payment, method: undefined as any, status: "pending", linkSentTo: null,
                    paypalApprovalUrl: null, paypalOrderId: null, fieldOrderId: null, invoiceId: null, coreOrderId: null },
                }));
              }}
              onCancelTransaction={async (reason: string) => {
                const intentId = draft.payment.fieldOrderId;
                const orderId = draft.payment.coreOrderId;
                try {
                  if (intentId) {
                    await supabase.from("field_payment_intents" as any)
                      .update({ status: "cancelled", cancelled_reason: reason } as any).eq("id", intentId);
                  }
                  if (orderId) {
                    await supabase.from("orders").update({ status: "cancelled" } as any).eq("id", orderId);
                  }
                  if (draft.customer.email) {
                    const payload = {
                      event_key: `tx_cancelled_${intentId || orderId || Date.now()}`,
                      to_email: draft.customer.email,
                      template_key: "transaction_cancelled",
                      template_vars: {
                        client_name: `${draft.customer.first_name} ${draft.customer.last_name}`.trim() || "Client",
                        first_name: draft.customer.first_name || "Client",
                        order_number: intentId || orderId || "—",
                        total: total.toFixed(2),
                        reason,
                      },
                      status: "queued",
                    };
                    for (let i = 1; i <= 3; i++) {
                      const { error } = await supabase.from("email_queue").insert(payload as any);
                      if (!error) break;
                      if (i < 3) await new Promise((r) => setTimeout(r, 2000));
                    }
                  }
                  toast.success("Transaction annulée. Client informé.");
                  navigate(fieldPath("/dashboard"));
                } catch (e: any) {
                  logger.warn("Cancel transaction failed", e);
                  toast.error(e?.message || "Échec de l'annulation");
                }
              }}
              onHoldTransaction={async () => {
                const orderId = draft.payment.coreOrderId;
                try {
                  if (orderId) {
                    await supabase.from("orders").update({ status: "on_hold" } as any).eq("id", orderId);
                  }
                  toast.success("Commande mise en attente. Vous pouvez la reprendre depuis Mes commandes.");
                  navigate(fieldPath("/dashboard"));
                } catch (e: any) {
                  logger.warn("Hold transaction failed", e);
                  toast.error(e?.message || "Échec de la mise en attente");
                }
              }}
              onConvertToQuote={async () => {
                if (!draft.customer.email) { toast.error("Email client requis pour soumission."); return; }
                const intentId = draft.payment.fieldOrderId;
                if (!intentId) { toast.error("Lien de paiement requis avant soumission."); return; }
                const payerUrl = `https://nivra-telecom.ca/payer/${intentId}`;
                const validUntilDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const validUntilLabel = validUntilDate.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
                const customerName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
                const servicesSummary = draft.services.map((s) => `${s.name} (${s.monthlyPrice.toFixed(2)}$/mois)`).join(", ") || "—";
                const equipmentSummary = draft.equipment.map((e) => `${e.name} x${e.quantity} (${(e.price * e.quantity).toFixed(2)}$)`).join(", ") || "—";
                try {
                  const insertPayload: any = {
                    agent_id: user?.id,
                    agent_name: user?.email || null,
                    intent_id: intentId,
                    customer_name: customerName,
                    customer_email: draft.customer.email,
                    customer_phone: draft.customer.phone || null,
                    customer_address: draft.customer.address || null,
                    services: draft.services as any,
                    equipment: draft.equipment as any,
                    discount: { monthly: monthlyDiscountAmount, installation: installationDiscountAmount } as any,
                    subtotal, tps, tvq, total,
                    payment_url: payerUrl,
                    status: "pending_client",
                  };
                  const { data: row, error } = await supabase.from("field_submissions" as any).insert(insertPayload).select("id").maybeSingle();
                  if (error) throw error;
                  const quoteId = (row as any)?.id || intentId;
                  const payload = {
                    event_key: `quote_client_${quoteId}_${Date.now()}`,
                    to_email: draft.customer.email,
                    template_key: "quote_client",
                    template_vars: {
                      client_name: customerName,
                      first_name: draft.customer.first_name || "Client",
                      quote_number: quoteId, quote_id: quoteId,
                      complete_url: payerUrl,
                      payment_url: payerUrl,
                      agent_name: user?.email || "votre conseiller Nivra",
                      services_summary: servicesSummary, equipment_summary: equipmentSummary,
                      subtotal: subtotal.toFixed(2), discount: (monthlyDiscountAmount + installationDiscountAmount).toFixed(2),
                      activation_fee: activationFee.toFixed(2), total: total.toFixed(2),
                      valid_until: validUntilLabel,
                    },
                    status: "queued",
                  };
                  for (let i = 1; i <= 3; i++) {
                    const { error: e } = await supabase.from("email_queue").insert(payload as any);
                    if (!e) break;
                    if (i < 3) await new Promise((r) => setTimeout(r, 2000));
                  }
                  toast.success("Soumission envoyée au client (valide 7 jours).");
                  navigate(fieldPath("/dashboard"));
                } catch (e: any) {
                  logger.warn("Convert to quote failed", e);
                  toast.error(e?.message || "Échec de la conversion en soumission");
                }
              }}
            />
          )}
        </div>

        <LiveSummary
          draft={draft}
          activationFee={activationFee}
          monthlyBeforeDiscount={monthlyBeforeDiscount}
          monthlyDiscountAmount={monthlyDiscountAmount}
          installationDiscountAmount={installationDiscountAmount}
          firstMonthCredit={firstMonthCredit}
          equipmentTotal={equipmentTotal}
          subtotal={subtotal}
          tps={tps}
          tvq={tvq}
          total={total}
        />
      </div>
    </div>
  );
}
