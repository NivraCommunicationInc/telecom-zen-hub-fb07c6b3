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
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
const DRAFT_KEY_BASE = "field_sale_draft";

interface FieldNewSaleProps {
  /** Path used when the agent cancels/holds/converts. Defaults to fieldPath("/dashboard"). */
  exitRedirect?: string;
}

export default function FieldNewSale({ exitRedirect }: FieldNewSaleProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prefillAccountId = searchParams.get("client") || searchParams.get("account") || null;
  const prefillAddressId = searchParams.get("adresse") || searchParams.get("address") || searchParams.get("service_address_id") || null;
  const _exitPath = exitRedirect ?? fieldPath("/dashboard");
  const resumeIntentId = (location.state as any)?.resumeIntentId as string | undefined;
  const resumeQuoteId = (location.state as any)?.resumeQuoteId as string | undefined;
  const { user } = useStaffUser();
  const DRAFT_KEY = user?.id ? `${DRAFT_KEY_BASE}_${user.id}` : DRAFT_KEY_BASE;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [prefillContext, setPrefillContext] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState<boolean>(Boolean(prefillAccountId));
  const [agentGps, setAgentGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const [draft, setDraft] = useState<FieldSaleDraft>({
    ...EMPTY_DRAFT,
    agentId: user?.id ?? "",
    createdAt: new Date().toISOString(),
  });

  const [completedSteps, setCompletedSteps] = useState<FieldSaleStep[]>([]);

  // Card-saved success state.
  const [cardSuccess, setCardSuccess] = useState<{
    intentId: string;
    orderNumber: string;
    last4: string;
    amount: number;
    commission: number;
  } | null>(null);

  const resetForNewSale = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setDraft({ ...EMPTY_DRAFT, agentId: user?.id ?? "", createdAt: new Date().toISOString() });
    setCompletedSteps([]);
    setCardSuccess(null);
  }, [user?.id]);
  const { data: fieldConfig } = useFieldConfig();

  // ── Draft persistence (FIX: survive page refresh) ──
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{ draft: FieldSaleDraft; completed: FieldSaleStep[] } | null>(null);
  const hasCheckedRestoreRef = useRef(false);
  const hasMountedRef = useRef(false);

  // Restore draft on mount (run once)
  useEffect(() => {
    if (hasCheckedRestoreRef.current) return;
    hasCheckedRestoreRef.current = true;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const savedDraft = parsed?.draft as FieldSaleDraft | undefined;
      const savedCompleted = (parsed?.completedSteps as FieldSaleStep[] | undefined) || [];
      if (!savedDraft || savedDraft.step === "customer" && savedCompleted.length === 0) {
        // Empty draft — nothing meaningful to restore
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      setPendingRestore({ draft: savedDraft, completed: savedCompleted });
      setRestoreDialogOpen(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  // Persist draft on every change (skip first render to avoid clobbering pending restore)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (restoreDialogOpen) return; // don't overwrite while user decides
    try {
      // Only persist if something meaningful has been entered
      const meaningful =
        draft.step !== "customer" ||
        draft.customer.first_name ||
        draft.customer.last_name ||
        draft.customer.email ||
        draft.services.length > 0 ||
        completedSteps.length > 0;
      if (meaningful) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, completedSteps }));
      }
    } catch {
      /* quota exceeded — ignore */
    }
  }, [draft, completedSteps, restoreDialogOpen]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, []);

  const handleRestoreAccept = () => {
    if (pendingRestore) {
      setDraft({ ...pendingRestore.draft, agentId: user?.id ?? pendingRestore.draft.agentId });
      setCompletedSteps(pendingRestore.completed);
    }
    setPendingRestore(null);
    setRestoreDialogOpen(false);
  };

  const handleRestoreReject = () => {
    clearDraft();
    setPendingRestore(null);
    setRestoreDialogOpen(false);
  };

  // ── Capture agent GPS on mount (fraud prevention / audit) ──
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setAgentGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => { /* GPS denied or unavailable — non-blocking */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // ── Fetch agent full name + agent number (for emails / documents) ──
  const [agentFullName, setAgentFullName] = useState<string>("");
  const [agentNumber, setAgentNumber] = useState<string>("");
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: agentProfile } = await supabase
        .from("profiles")
        .select("full_name, agent_number")
        .eq("user_id", user.id)
        .maybeSingle();
      setAgentFullName(((agentProfile as any)?.full_name as string) || "");
      setAgentNumber(((agentProfile as any)?.agent_number as string) || "");
    })();
  }, [user?.id]);
  const agentName = agentFullName || user?.email || "votre conseiller Nivra";

  // ── Resume from existing payment intent (Reprendre button) ──
  const hasResumedRef = useRef(false);
  useEffect(() => {
    if (!resumeIntentId || hasResumedRef.current) return;
    hasResumedRef.current = true;
    (async () => {
      try {
        const { data: intent } = await supabase
          .from("field_payment_intents" as any)
          .select("id, quote_id, customer_email, customer_name, paypal_approval_url, paypal_order_id, amount, status")
          .eq("id", resumeIntentId)
          .maybeSingle();
        const quoteId = (intent as any)?.quote_id || resumeQuoteId;
        if (!quoteId) {
          toast.error("Soumission introuvable.");
          return;
        }
        const { data: quote } = await supabase
          .from("field_quotes" as any)
          .select("id, client_info, services, equipment, discount")
          .eq("id", quoteId)
          .maybeSingle();
        if (!quote) {
          toast.error("Devis introuvable pour cette soumission.");
          return;
        }
        const ci: any = (quote as any).client_info || {};
        const restored: FieldSaleDraft = {
          ...EMPTY_DRAFT,
          agentId: user?.id ?? "",
          createdAt: new Date().toISOString(),
          customer: {
            first_name: ci.first_name || ci.firstName || "",
            last_name: ci.last_name || ci.lastName || "",
            email: ci.email || (intent as any)?.customer_email || "",
            phone: ci.phone || "",
            address: ci.address || "",
            city: ci.city || "",
            postal_code: ci.postal_code || ci.postalCode || "",
            date_of_birth: ci.date_of_birth || ci.dob || "",
          } as any,
          services: ((quote as any).services as any[]) || [],
          equipment: ((quote as any).equipment as any[]) || [],
          discount: ((quote as any).discount as any) || null,
          payment: {
            method: "square_email",
            status: (intent as any)?.status === "completed" ? "completed" : "sent",
            paypalApprovalUrl: `https://nivra-telecom.ca/payer/${(intent as any)?.id || resumeIntentId}`,
            paypalOrderId: null,
            fieldOrderId: (intent as any)?.id ?? null,
            invoiceId: null,
            coreOrderId: null,
            linkSentTo: ci.email || (intent as any)?.customer_email || null,
          } as any,
          step: "payment",
        };
        setDraft(restored);
        setCompletedSteps(["customer", "services", "equipment", "discounts", "recap"] as FieldSaleStep[]);
        // Skip the restore prompt — we just loaded fresh data
        hasCheckedRestoreRef.current = true;
        setRestoreDialogOpen(false);
        setPendingRestore(null);
        toast.success("Soumission rechargée — étape paiement.");
      } catch (e: any) {
        console.error("[resume]", e);
        toast.error("Erreur de rechargement: " + (e?.message || "inconnue"));
      }
    })();
  }, [resumeIntentId, resumeQuoteId, user?.id]);

  // ── Prefill mode: staff opens tunnel from a known account + address ──
  // Query params: ?client=<account_id>&adresse=<service_address_id>
  // When present: pre-fill customer + lock identity/address fields; final
  // submission attaches the resulting order to the existing account and
  // service_address_id (no new user/account is ever created).
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (!prefillAccountId || hasPrefilledRef.current) {
      if (!prefillAccountId) setPrefillLoading(false);
      return;
    }
    hasPrefilledRef.current = true;
    (async () => {
      try {
        const { data: acct, error: acctErr } = await supabase
          .from("accounts")
          .select("id, account_number, account_name, client_id, primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province, billing_address, billing_city, billing_postal_code, billing_province")
          .eq("id", prefillAccountId)
          .maybeSingle();
        if (acctErr || !acct) {
          toast.error("Compte introuvable — vérifiez le lien.");
          setPrefillLoading(false);
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name, email, phone, date_of_birth")
          .eq("user_id", (acct as any).client_id)
          .maybeSingle();

        let addr: any = null;
        if (prefillAddressId) {
          const { data: a } = await supabase
            .from("service_addresses")
            .select("id, address_line, city, province, postal_code, label")
            .eq("id", prefillAddressId)
            .maybeSingle();
          addr = a;
        }

        // Fallback to account primary address if no service address id
        const address_line = addr?.address_line || (acct as any).primary_service_address || (acct as any).billing_address || "";
        const city = addr?.city || (acct as any).primary_service_city || (acct as any).billing_city || "";
        const postal_code = addr?.postal_code || (acct as any).primary_service_postal_code || (acct as any).billing_postal_code || "";
        const province = addr?.province || (acct as any).primary_service_province || (acct as any).billing_province || "QC";

        const nameParts = (prof?.full_name || "").split(" ");
        const first_name = (prof as any)?.first_name || nameParts[0] || "";
        const last_name = (prof as any)?.last_name || nameParts.slice(1).join(" ") || "";

        setDraft((d) => ({
          ...d,
          existing_account_id: (acct as any).id,
          existing_service_address_id: addr?.id || null,
          customer: {
            ...d.customer,
            first_name,
            last_name,
            email: prof?.email || "",
            phone: prof?.phone || "",
            date_of_birth: (prof as any)?.date_of_birth || "",
            address: address_line,
            city,
            postal_code,
            province,
            serviceability_status: "unknown",
          },
        }));
        const ctxLabel = `Compte ${(acct as any).account_number || "—"} · ${(acct as any).account_name || prof?.full_name || "Client"}`
          + (addr ? ` · Adresse : ${addr.address_line}${addr.city ? ", " + addr.city : ""}` : "");
        setPrefillContext(ctxLabel);
        // Skip any restored draft — prefill takes priority
        hasCheckedRestoreRef.current = true;
        setRestoreDialogOpen(false);
        setPendingRestore(null);
      } catch (e: any) {
        console.error("[FieldNewSale] prefill error", e);
        toast.error("Erreur de pré-remplissage : " + (e?.message || "inconnue"));
      } finally {
        setPrefillLoading(false);
      }
    })();
  }, [prefillAccountId, prefillAddressId]);


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

  // Shipping fee when the client chose self-installation.
  // Reads `shipping_fee_cents` from field_sales_config (default $20).
  const shippingFee = useMemo(() => {
    if (draft.customer.install_mode !== "self") return 0;
    const cfg = (fieldConfig as any)?.shipping_fee_cents ?? (fieldConfig as any)?.shippingFeeCents;
    const cents = typeof cfg === "number" ? cfg : 2000;
    return cents / 100;
  }, [draft.customer.install_mode, fieldConfig]);

  // Centralized discount math (handles fixed_monthly, remove_fee, first_month_free, etc.).
  const discountBreakdown = useMemo(
    () => computeDiscountBreakdown(draft.discount, draft.services, activationFee),
    [draft.discount, draft.services, activationFee],
  );

  const monthlyDiscountAmount = discountBreakdown.monthlyDiscountAmount;
  const installationDiscountAmount = discountBreakdown.installationDiscountAmount;
  // RULE 1 — "Premier mois gratuit" is ALWAYS automatic when at least one
  // forfait récurrent is selected. The agent cannot remove it. If the agent
  // also picked a first_month_free discount, we keep a single credit (no double).
  const autoFirstMonthCredit = draft.services.length > 0 ? monthlyBeforeDiscount : 0;
  const firstMonthCredit = Math.max(autoFirstMonthCredit, discountBreakdown.firstMonthCredit);

  const monthlyAfterDiscount = Math.max(0, monthlyBeforeDiscount - monthlyDiscountAmount);
  const effectiveActivation = Math.max(0, activationFee - installationDiscountAmount);
  // First-month credit is a one-time credit on the first invoice only.
  const subtotal = Math.max(
    0,
    monthlyAfterDiscount + equipmentTotal + effectiveActivation + shippingFee - firstMonthCredit,
  );
  const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
  const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
  const total = Math.round((subtotal + tps + tvq) * 100) / 100;

  // ── Prefill mode: build internal-notes marker + post-sync order patch ──
  // Ensures Core admins see the origin and the resulting orders row is
  // linked to service_addresses.id (account_id is already handled by
  // field-sales-sync via email match).
  const prefillNoteTag = useCallback((): string => {
    if (!draft.existing_account_id) return "";
    const parts = [`[STAFF_TUNNEL account_id=${draft.existing_account_id}`];
    if (draft.existing_service_address_id) parts.push(`service_address_id=${draft.existing_service_address_id}`);
    parts.push("]");
    return parts.join(" ");
  }, [draft.existing_account_id, draft.existing_service_address_id]);

  const linkOrderToServiceAddress = useCallback(async (saleId: string | null | undefined) => {
    if (!saleId || !draft.existing_service_address_id) return;
    try {
      const { data: fsFinal } = await supabase
        .from("field_sales_orders")
        .select("converted_order_id")
        .eq("id", saleId)
        .maybeSingle();
      const coreOrderId = (fsFinal as any)?.converted_order_id;
      if (coreOrderId) {
        await supabase
          .from("orders")
          .update({ service_address_id: draft.existing_service_address_id } as any)
          .eq("id", coreOrderId);
      }
    } catch (e) {
      logger.warn("linkOrderToServiceAddress failed", e);
    }
  }, [draft.existing_service_address_id]);


  // ── Submit inline (square_inline): create quote + intent, then Square widget charges ──
  const handleSquareInlineInit = async () => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("Préparation du paiement…");
    try {
      const { saveQuoteAndEmail } = await import("@/field-app/lib/fieldQuoteService");
      const quote = await saveQuoteAndEmail({ draft, agentName, activationFee, subtotal, tps, tvq, total, agentGps, skipClientEmail: true });
      const customerName = `${draft.customer.first_name} ${draft.customer.last_name}`.trim();
      const { data: intentData, error: intentErr } = await supabase
        .from("field_payment_intents" as any)
        .insert({
          quote_id: quote.id,
          agent_id: user.id,
          amount: total,
          currency: "CAD",
          status: "pending",
          payment_method: "square_inline",
          customer_email: draft.customer.email || null,
          customer_name: customerName || null,
        })
        .select("id")
        .single();
      if (intentErr || !intentData) throw intentErr ?? new Error("Erreur création intent paiement");
      setDraft((d) => ({
        ...d,
        payment: { ...d.payment, status: "pending", fieldOrderId: (intentData as any).id, paypalApprovalUrl: null },
      }));
      toast.success("Prêt — entrez les informations de carte ci-dessous.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la préparation du paiement");
    } finally {
      setIsSubmitting(false);
      setSubmitMessage("");
    }
  };

  // ── Square inline success: create order + sync after immediate charge ──
  const handleSquareInlineSuccess = async (paymentId: string) => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setSubmitMessage("Création de la commande…");
    try {
      const customerName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
      const intentId = draft.payment.fieldOrderId || paymentId;
      const orderNumber = `SUB-${String(intentId).slice(0, 8).toUpperCase()}`;
      const commissionAmount = Math.max(0, Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)));

      try {
        await supabase.from("field_commissions").insert({
          agent_id: user.id, order_id: null, amount: commissionAmount,
          status: "pending", commission_type: "forfait",
          description: `Square direct — ${paymentId}`,
        } as any);
      } catch (commErr: any) { logger.warn("commission insert failed", commErr); }

      let coreOrderNumber = orderNumber;
      try {
        const { data: fsRow, error: fsErr } = await supabase
          .from("field_sales_orders")
          .insert({
            salesperson_id: user.id,
            customer_name: customerName,
            customer_email: draft.customer.email || null,
            customer_phone: draft.customer.phone || "",
            customer_address: (draft.customer.address || "") + (draft.customer.apartment ? `, App. ${draft.customer.apartment}` : ""),
            customer_city: draft.customer.city || null,
            customer_postal_code: draft.customer.postal_code || null,
            customer_date_of_birth: draft.customer.date_of_birth || null,
            install_date: draft.customer.install_slot?.date || draft.customer.install_date || null,
            install_mode: draft.customer.install_mode || null,
            appointment_date: draft.customer.install_slot?.date || null,
            appointment_notes: draft.customer.install_slot?.time_slot || null,
            services: [
              ...draft.services.map((s) => ({ ...s, quantity: 1, price_monthly: s.monthlyPrice, monthly_price: s.monthlyPrice, price_setup: 0 })),
              ...draft.equipment.map((e) => ({ ...e, quantity: e.quantity, price_monthly: 0, monthly_price: 0, price_setup: e.price })),
            ] as any,
            total_amount: total,
            payment_method: "square",
            payment_reference: paymentId,
            payment_status: "paid",
            sync_status: "pending",
            discount_data: draft.discount ? {
              name: (draft.discount as any).name || "Rabais",
              type: (draft.discount as any).type || null,
              amount: Number((draft.discount as any).value ?? monthlyDiscountAmount ?? 0),
              applies_to: (draft.discount as any).applies_to || null,
              duration_months: Number((draft.discount as any).duration_months ?? 0),
              monthly_amount: Number(monthlyDiscountAmount || 0),
              monthly_price: Number(monthlyBeforeDiscount || 0),
            } : null,
            internal_notes: `${prefillNoteTag()}Square paiement immédiat — ${paymentId}\nCommission: ${commissionAmount.toFixed(2)}$`.trim(),
          } as any)
          .select("id")
          .single();
        if (fsErr) throw fsErr;
        const saleId = (fsRow as any)?.id;
        if (saleId) {
          const { data: syncData } = await supabase.functions.invoke("field-sales-sync", { body: { action: "sync_single", sale_id: saleId } });
          if (syncData?.order_number) coreOrderNumber = syncData.order_number;
          // Mirror the coaxial survey onto the synced Core order for cross-portal parity.
          if (draft.customer.coaxial_survey) {
            try {
              const { data: fsFinal } = await supabase
                .from("field_sales_orders")
                .select("converted_order_id")
                .eq("id", saleId)
                .maybeSingle();
              const coreOrderId = (fsFinal as any)?.converted_order_id;
              if (coreOrderId) {
                await supabase
                  .from("orders")
                  .update({ coaxial_survey: draft.customer.coaxial_survey as any } as any)
                  .eq("id", coreOrderId);
              }
            } catch (mirrorErr) { logger.warn("coaxial_survey mirror failed", mirrorErr); }
          }
          // Attach the resulting Core order to the selected service_address_id (staff tunnel).
          await linkOrderToServiceAddress(saleId);
        }
      } catch (syncErr: any) {
        logger.warn("[square-inline] order creation failed (non-blocking)", syncErr);
      }

      setCardSuccess({ intentId, orderNumber: coreOrderNumber, last4: paymentId.slice(-4), amount: total, commission: commissionAmount });
      setCompletedSteps((prev) => [...new Set([...prev, "recap" as FieldSaleStep, "payment" as FieldSaleStep])]);
      clearDraft();
      toast.success(`Paiement Square confirmé — ${coreOrderNumber}`);
    } catch (err: any) {
      logger.warn("Square inline order creation failed", err);
      toast.error(err?.message || "Erreur lors de la création de la commande");
    } finally {
      setIsSubmitting(false);
      setSubmitMessage("");
    }
  };

  // ── Submit (FIX 1: payment-first — NO order created until webhook confirms) ──
  const handleSubmit = async () => {
    if (!user?.id || isSubmitting) return;
    if (draft.payment.method === "square_email" && !draft.customer.email) {
      toast.error("Le courriel du client est requis pour envoyer le lien.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("Sauvegarde de la soumission…");

    try {
      // 1) Save the quote (no order/invoice yet)
      const { saveQuoteAndEmail, sendPaymentLinkFromQuote } = await import("@/field-app/lib/fieldQuoteService");
      const quote = await saveQuoteAndEmail({
        draft, agentName, activationFee,
        subtotal, tps, tvq, total, agentGps,
        skipClientEmail: true,
      });

      // 2) Create/reuse the Review Order/Square payment intent.
      // The client must land on /payer/:intentId, never /commander/GuestCheckout.
      setSubmitMessage("Génération du lien de paiement…");
      const link = await sendPaymentLinkFromQuote(
        quote.id,
        draft.payment.method === "square_email" ? "email" : "link_only",
      );
      const data = { intent_id: link.intent_id };
      const approvalUrl: string = link.payment_url;

      // 3) Email mode — already sent by field-payment-link-create.
      if (draft.payment.method === "square_email") {
        if (!link.email_sent) {
          toast.warning(`Lien créé, mais l'email n'a pas pu être envoyé. Le client peut payer via: ${approvalUrl}`, { duration: 15000 });
        }

        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment, status: "sent", linkSentTo: draft.customer.email,
            paypalApprovalUrl: approvalUrl, paypalOrderId: null,
            fieldOrderId: data.intent_id ?? null, invoiceId: null, coreOrderId: null,
          },
        }));
        toast.success("Lien Revoir ma commande envoyé au client.");
        clearDraft();
      } else {
        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment, status: "pending",
            paypalApprovalUrl: approvalUrl, paypalOrderId: null,
            fieldOrderId: data.intent_id ?? null, invoiceId: null, coreOrderId: null,
          },
        }));
        toast.success("Lien Square prêt — montrez le QR au client.");
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

  // FIX 1 — Card manual submit: order_confirmation email + pending commission + success screen
  const handleCardSubmit = async (cardData: { number: string; name: string; expiry: string; cvv: string }) => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("Chiffrement et enregistrement…");
    try {
      const { saveQuoteAndEmail } = await import("@/field-app/lib/fieldQuoteService");
      const quote = await saveQuoteAndEmail({
        draft, agentName, activationFee,
        subtotal, tps, tvq, total, agentGps,
        skipClientEmail: true,
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
      if (data && (data.ok === false || (data.error && !data.intent_id))) {
        throw new Error(data.error || "Erreur lors du traitement de la carte.");
      }
      if (!data?.intent_id) throw new Error("Réponse invalide du backend (intent_id manquant).");

      const intentId: string = data.intent_id;
      const last4: string = data.card_last4 || cardData.number.slice(-4);
      const orderNumber = `SUB-${String(intentId).slice(0, 8).toUpperCase()}`;

      // Commission = 30% of FULL monthly recurring (before discount) + 5% of equipment
      const commissionAmount = Math.max(
        0,
        Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)),
      );
      try {
        await supabase.from("field_commissions").insert({
          agent_id: user.id,
          order_id: null,
          amount: commissionAmount,
          status: "pending",
          commission_type: "forfait",
          description: `Carte en attente de capture — intent ${intentId}`,
        } as any);
      } catch (commErr: any) {
        logger.warn("commission insert failed", commErr);
      }

      // Order confirmation email (reuses payment_link_employee template engine).
      if (draft.customer.email) {
        const servicesList = buildServicesList(draft);
        const equipmentList = buildEquipmentList(draft);
        const discountLabel = buildDiscountLabel(draft);
        const fullName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
        const discountAmount = Math.max(0, monthlyBeforeDiscount - monthlyAfterDiscount) + firstMonthCredit;
        const emailPayload = {
          event_key: `order_confirmation_${intentId}`,
          to_email: draft.customer.email,
          template_key: "order_confirmation",
          template_vars: {
            client_name: fullName,
            client_email: draft.customer.email,
            first_name: draft.customer.first_name || "Client",
            order_number: orderNumber,
            services: servicesList,
            summary: servicesList,
            equipment: equipmentList,
            discount: discountAmount.toFixed(2),
            discount_label: discountLabel,
            subtotal: subtotal.toFixed(2),
            tps: tps.toFixed(2),
            tvq: tvq.toFixed(2),
            total: total.toFixed(2),
            payment_status: "En attente de traitement (carte)",
            card_last4: last4,
            agent_name: agentName,
            agent_number: agentNumber || "N/A",
            payment_url: `https://nivra-telecom.ca/payer/${intentId}`,
            subject_override: "Confirmation de commande — Nivra Telecom",
            badge_override: "COMMANDE REÇUE",
            hero_override: "Votre commande a été enregistrée",
            body_override: "Le paiement par carte sera traité par notre équipe dans les 48 heures.",
          },
          status: "queued",
        };
        for (let i = 1; i <= 3; i++) {
          const { error: e } = await supabase.from("email_queue").insert(emailPayload as any);
          if (!e) break;
          if (i < 3) await new Promise((r) => setTimeout(r, 2000));
        }
      }

      // Create real order in Core via field_sales_orders + field-sales-sync.
      let coreOrderNumber = orderNumber;
      try {
        const customerName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
        const { data: fsRow, error: fsErr } = await supabase
          .from("field_sales_orders")
          .insert({
            salesperson_id: user.id,
            customer_name: customerName,
            customer_email: draft.customer.email || null,
            customer_phone: draft.customer.phone || "",
            customer_address: (draft.customer.address || "") + (draft.customer.apartment ? `, App. ${draft.customer.apartment}` : ""),
            customer_city: draft.customer.city || null,
            customer_postal_code: draft.customer.postal_code || null,
            customer_date_of_birth: draft.customer.date_of_birth || null,
            install_date: draft.customer.install_slot?.date || draft.customer.install_date || null,
            install_mode: draft.customer.install_mode || null,
            appointment_date: draft.customer.install_slot?.date || null,
            appointment_notes: draft.customer.install_slot?.time_slot || null,
            services: [
              ...draft.services.map((service) => ({
                ...service,
                quantity: 1,
                price_monthly: service.monthlyPrice,
                monthly_price: service.monthlyPrice,
                price_setup: 0,
              })),
              ...draft.equipment.map((equipment) => ({
                ...equipment,
                quantity: equipment.quantity,
                price_monthly: 0,
                monthly_price: 0,
                price_setup: equipment.price,
              })),
            ] as any,
            total_amount: total,
            payment_method: "card_manual",
            payment_reference: intentId,
            payment_status: "pending",
            sync_status: "pending",
            discount_data: draft.discount ? {
              name: (draft.discount as any).name || (draft.discount as any).label || "Rabais",
              type: (draft.discount as any).type || null,
              amount: Number((draft.discount as any).value ?? monthlyDiscountAmount ?? 0),
              applies_to: (draft.discount as any).applies_to || null,
              conditions: (draft.discount as any).applies_to || null,
              duration_months: Number((draft.discount as any).duration_months ?? (draft.discount as any).duration ?? 0),
              min_plan_price: (draft.discount as any).min_plan_price ?? null,
              source_discount_id: (draft.discount as any).id || null,
              monthly_amount: Number(monthlyDiscountAmount || 0),
              monthly_price: Number(monthlyBeforeDiscount || 0),
            } : null,
            internal_notes: `${prefillNoteTag()}Carte saisie en personne — intent ${intentId} • ••${last4}\nCommission: ${commissionAmount.toFixed(2)}$ = 30% récurrent (${monthlyBeforeDiscount.toFixed(2)}$) + 5% équipement (${equipmentTotal.toFixed(2)}$)`.trim(),
          } as any)
          .select("id")
          .single();
        if (fsErr) {
          console.error("[field_sales_orders] insert failed", fsErr);
          toast.error("Erreur création commande Core: " + (fsErr.message || "inconnue"));
          throw fsErr;
        }
        const saleId = (fsRow as any)?.id;
        if (saleId) {
          const { data: syncData, error: syncError } = await supabase.functions.invoke("field-sales-sync", {
            body: { action: "sync_single", sale_id: saleId },
          });
          if (syncError || syncData?.success === false) {
            const message = syncError?.message || syncData?.error || "Erreur sync inconnue";
            console.error("[sync] field-sales-sync failed", syncError || syncData);
            logger.warn("[card-sync] field-sales-sync failed", syncError || syncData);
            toast.error("Commande créée, mais sync Core échouée: " + message);
          } else if (syncData?.order_number) {
            coreOrderNumber = syncData.order_number;
          }
          if (draft.customer.coaxial_survey) {
            try {
              const { data: fsFinal } = await supabase
                .from("field_sales_orders")
                .select("converted_order_id")
                .eq("id", saleId)
                .maybeSingle();
              const coreOrderId = (fsFinal as any)?.converted_order_id;
              if (coreOrderId) {
                await supabase
                  .from("orders")
                  .update({ coaxial_survey: draft.customer.coaxial_survey as any } as any)
                  .eq("id", coreOrderId);
              }
            } catch (mirrorErr) { logger.warn("coaxial_survey mirror failed", mirrorErr); }
          }
          // Attach the resulting Core order to the selected service_address_id (staff tunnel).
          await linkOrderToServiceAddress(saleId);
        }
      } catch (syncCatch: any) {
        console.error("[field_sales_orders] catch", syncCatch);
        logger.warn("[card-sync] order creation failed (non-blocking)", syncCatch);
      }

      setCardSuccess({ intentId, orderNumber: coreOrderNumber, last4, amount: total, commission: commissionAmount });
      setCompletedSteps((prev) => [...new Set([...prev, "recap" as FieldSaleStep, "payment" as FieldSaleStep])]);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success(`Commande créée ${orderNumber} • Carte ••${last4}`);
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
        toast.success("Paiement Square confirmé !");
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
            toast.success("Paiement Square confirmé !");
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

  // Card success screen.
  if (cardSuccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <div className="rounded-2xl border border-violet-500/30 bg-gray-800 p-6 md:p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-violet-600/10 mb-3">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-50">Commande créée</h1>
            <p className="text-sm text-gray-400 mt-1">
              Numéro <span className="font-mono font-semibold text-gray-50">#{cardSuccess.orderNumber}</span> · Carte ••{cardSuccess.last4}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-6">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-gray-400">Total commande</div>
              <div className="font-semibold text-gray-50">{cardSuccess.amount.toFixed(2)} $</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-gray-400">Commission en attente</div>
              <div className="font-semibold text-violet-400">{cardSuccess.commission.toFixed(2)} $</div>
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200 mb-6">
            Le rendez-vous d'installation sera planifié par l'équipe Nivra depuis Core.
          </div>

          {/* Nouvelle vente — always available */}
          <button
            onClick={resetForNewSale}
            className="w-full h-12 rounded-lg border border-violet-500/40 bg-violet-600/10 text-violet-200 text-sm font-semibold hover:bg-violet-600/20"
          >
            Nouvelle vente
          </button>
        </div>
      </div>
    );
  }

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
              onCancel={() => { clearDraft(); navigate(_exitPath); }}
              locked={Boolean(draft.existing_account_id)}
              lockedContext={prefillContext || undefined}
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
              services={draft.services}
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
              onCustomerChange={(customer) => setDraft((d) => ({ ...d, customer }))}
            />
          )}

          {draft.step === "payment" && (
            <StepPaymentPaypal
              payment={draft.payment}
              customer={draft.customer}
              totalAmount={total}
              onChange={(payment) => setDraft((d) => ({ ...d, payment }))}
              onSubmit={handleSubmit}
              onSquareInlineInit={handleSquareInlineInit}
              onSquareInlineSuccess={handleSquareInlineSuccess}
              onBack={() => goBack("payment")}
              isSubmitting={isSubmitting}
              submitMessage={submitMessage}
              onResendEmail={async () => {
                if (!draft.payment.paypalApprovalUrl || !draft.customer.email || !draft.payment.fieldOrderId) {
                  toast.error("Aucun lien à renvoyer."); return;
                }
                const summary = buildServicesList(draft);
                const equipmentList = buildEquipmentList(draft);
                const discountLabel = buildDiscountLabel(draft);
                const fullName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
                const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
                const orderNumber = `SUB-${String(draft.payment.fieldOrderId).slice(0, 8).toUpperCase()}`;
                const payload = {
                  event_key: `field_payment_link_resend_${draft.payment.fieldOrderId}_${Date.now()}`,
                  to_email: draft.customer.email,
                  template_key: "field_payment_link",
                  template_vars: {
                    client_name: fullName, first_name: draft.customer.first_name || "Client",
                    order_number: orderNumber, total: total.toFixed(2),
                    approval_url: draft.payment.paypalApprovalUrl, payment_url: `https://nivra-telecom.ca/payer/${draft.payment.fieldOrderId}`,
                    summary, services: summary, equipment: equipmentList,
                    discount_label: discountLabel,
                    subtotal: subtotal.toFixed(2), tps: tps.toFixed(2), tvq: tvq.toFixed(2),
                    valid_until: validUntil,
                    agent_name: agentName,
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
                  clearDraft();
                  navigate(_exitPath);
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
                  navigate(_exitPath);
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
                const validUntilIso = validUntilDate.toISOString();
                const validUntilLabel = validUntilDate.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                const customerName = `${draft.customer.first_name || ""} ${draft.customer.last_name || ""}`.trim() || "Client";
                const servicesSummary = buildServicesList(draft);
                const equipmentSummary = buildEquipmentList(draft);
                const discountLabel = buildDiscountLabel(draft);
                try {
                  const insertPayload: any = {
                    agent_id: user?.id,
                    agent_name: agentName,
                    intent_id: intentId,
                    customer_name: customerName,
                    customer_email: draft.customer.email,
                    customer_phone: draft.customer.phone || null,
                    customer_address: draft.customer.address ? draft.customer.address + (draft.customer.apartment ? `, App. ${draft.customer.apartment}` : "") : null,
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
                  const quoteNumber = `SUB-${String(quoteId).slice(0, 8).toUpperCase()}`;
                  const templateVars = {
                    client_name: customerName,
                    first_name: draft.customer.first_name || "Client",
                    quote_number: quoteNumber, quote_id: quoteId,
                    order_number: quoteNumber,
                    complete_url: payerUrl,
                    payment_url: payerUrl,
                    agent_name: agentName,
                    services: servicesSummary,
                    services_summary: servicesSummary,
                    equipment: equipmentSummary,
                    equipment_summary: equipmentSummary,
                    subtotal: subtotal.toFixed(2),
                    discount: (monthlyDiscountAmount + installationDiscountAmount).toFixed(2),
                    discount_label: discountLabel,
                    tps: tps.toFixed(2), tvq: tvq.toFixed(2),
                    activation_fee: activationFee.toFixed(2), total: total.toFixed(2),
                    valid_until: validUntilLabel,
                    valid_until_iso: validUntilIso,
                  };
                  // Validate before queuing — log any anomalies, never block.
                  const issues: string[] = [];
                  if (!templateVars.agent_name || templateVars.agent_name.includes('@')) issues.push('agent_name missing/email');
                  if (!templateVars.services || templateVars.services === '—') issues.push('services missing');
                  if (!templateVars.order_number || templateVars.order_number.includes('—')) issues.push('order_number missing');
                  if (!templateVars.valid_until || templateVars.valid_until.includes('non disponible')) issues.push('valid_until missing');
                  if (issues.length > 0) console.error('[EMAIL VALIDATION FAILED quote_client]', issues, templateVars);
                  const payload = {
                    event_key: `quote_client_${quoteId}_${Date.now()}`,
                    to_email: draft.customer.email,
                    template_key: "quote_client",
                    template_vars: templateVars,
                    status: "queued",
                  };
                  for (let i = 1; i <= 3; i++) {
                    const { error: e } = await supabase.from("email_queue").insert(payload as any);
                    if (!e) break;
                    if (i < 3) await new Promise((r) => setTimeout(r, 2000));
                  }
                  toast.success("Soumission envoyée au client (valide 7 jours).");
                  clearDraft();
                  navigate(_exitPath);
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

      {/* Restore-draft dialog (FIX: survive page refresh mid-sale) */}
      {restoreDialogOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-50">Commande en cours détectée</h2>
              <p className="text-sm text-gray-400 mt-1">
                Vous avez une commande en cours. Voulez-vous la reprendre où vous l'avez laissée ?
              </p>
            </div>
            {pendingRestore?.draft?.customer?.first_name || pendingRestore?.draft?.customer?.last_name ? (
              <div className="text-xs bg-muted/50 rounded-lg p-3">
                <span className="text-gray-400">Client :</span>{" "}
                <span className="font-medium text-gray-50">
                  {[pendingRestore.draft.customer.first_name, pendingRestore.draft.customer.last_name].filter(Boolean).join(" ")}
                </span>
                {pendingRestore.draft.services.length > 0 && (
                  <div className="mt-1">
                    <span className="text-gray-400">Forfaits :</span>{" "}
                    <span className="text-gray-50">{pendingRestore.draft.services.length}</span>
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={handleRestoreReject}
                className="flex-1 h-10 px-4 rounded-lg border border-border bg-gray-900 text-sm font-medium text-gray-50 hover:bg-muted transition-colors"
              >
                Nouvelle commande
              </button>
              <button
                onClick={handleRestoreAccept}
                className="flex-1 h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
              >
                Reprendre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
