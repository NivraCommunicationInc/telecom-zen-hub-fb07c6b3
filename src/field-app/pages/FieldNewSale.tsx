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
import { checkServiceability } from "@/field-app/lib/fieldServices";
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

const createDraftId = () => `sale_${crypto.randomUUID()}`;

interface FieldNewSaleProps {
  /** Path used when the agent cancels/holds/converts. Defaults to fieldPath("/dashboard"). */
  exitRedirect?: string;
  /** Core-only: allow manual custom fees, credits and promotions on the order. */
  allowCoreAdjustments?: boolean;
}

export default function FieldNewSale({ exitRedirect, allowCoreAdjustments = false }: FieldNewSaleProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prefillAccountId = searchParams.get("client") || searchParams.get("account") || null;
  const prefillAddressId = searchParams.get("adresse") || searchParams.get("address") || searchParams.get("service_address_id") || null;
  const _exitPath = exitRedirect ?? fieldPath("/dashboard");
  const resumeIntentId = (location.state as any)?.resumeIntentId as string | undefined;
  const resumeQuoteId = (location.state as any)?.resumeQuoteId as string | undefined;
  const { user } = useStaffUser();
  const DRAFT_KEY = useMemo(() => {
    if (!allowCoreAdjustments) return user?.id ? `${DRAFT_KEY_BASE}_${user.id}` : DRAFT_KEY_BASE;
    const accountScope = prefillAccountId || "manual";
    const addressScope = prefillAddressId || "any-address";
    return `${DRAFT_KEY_BASE}_core_${accountScope}_${addressScope}`;
  }, [allowCoreAdjustments, prefillAccountId, prefillAddressId, user?.id]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [prefillContext, setPrefillContext] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const [prefillLoading, setPrefillLoading] = useState<boolean>(Boolean(prefillAccountId));
  const [agentGps, setAgentGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const [draft, setDraft] = useState<FieldSaleDraft>({
    ...EMPTY_DRAFT,
    id: createDraftId(),
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
    setDraft({ ...EMPTY_DRAFT, id: createDraftId(), agentId: user?.id ?? "", createdAt: new Date().toISOString() });
    setCompletedSteps([]);
    setCardSuccess(null);
  }, [DRAFT_KEY, user?.id]);
  const { data: fieldConfig } = useFieldConfig();

  // ── Draft persistence (FIX: survive page refresh) ──
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<{ draft: FieldSaleDraft; completed: FieldSaleStep[] } | null>(null);
  const checkedRestoreKeyRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);

  // Restore draft on mount (run once)
  useEffect(() => {
    if (checkedRestoreKeyRef.current === DRAFT_KEY) return;
    checkedRestoreKeyRef.current = DRAFT_KEY;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const savedDraft = parsed?.draft as FieldSaleDraft | undefined;
      const savedCompleted = (parsed?.completedSteps as FieldSaleStep[] | undefined) || [];
      const savedHasMeaningfulContent = Boolean(
        savedDraft && (
          savedDraft.step !== "customer" ||
          savedDraft.customer?.first_name ||
          savedDraft.customer?.last_name ||
          savedDraft.customer?.email ||
          savedDraft.customer?.phone ||
          savedDraft.customer?.address ||
          savedDraft.services?.length ||
          savedDraft.equipment?.length ||
          savedDraft.discount ||
          savedDraft.payment?.fieldOrderId ||
          savedDraft.custom_adjustments?.length ||
          savedCompleted.length > 0
        ),
      );
      if (!savedDraft || !savedHasMeaningfulContent) {
        // Empty draft — nothing meaningful to restore
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (allowCoreAdjustments) {
        setDraft({ ...savedDraft, id: savedDraft.id || createDraftId(), agentId: user?.id ?? savedDraft.agentId });
        setCompletedSteps(savedCompleted);
        setPendingRestore(null);
        setRestoreDialogOpen(false);
        return;
      }
      setPendingRestore({ draft: savedDraft, completed: savedCompleted });
      setRestoreDialogOpen(true);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [DRAFT_KEY, allowCoreAdjustments, user?.id]);

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
        draft.equipment.length > 0 ||
        Boolean(draft.discount) ||
        Boolean(draft.payment.fieldOrderId) ||
        Boolean(draft.custom_adjustments?.length) ||
        completedSteps.length > 0;
      if (meaningful) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, completedSteps }));
      }
    } catch {
      /* quota exceeded — ignore */
    }
  }, [draft, completedSteps, restoreDialogOpen, DRAFT_KEY]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }, [DRAFT_KEY]);

  const handleRestoreAccept = () => {
    if (pendingRestore) {
      setDraft({ ...pendingRestore.draft, id: pendingRestore.draft.id || createDraftId(), agentId: user?.id ?? pendingRestore.draft.agentId });
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
          id: createDraftId(),
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
        checkedRestoreKeyRef.current = DRAFT_KEY;
        setRestoreDialogOpen(false);
        setPendingRestore(null);
        toast.success("Soumission rechargée — étape paiement.");
      } catch (e: any) {
        console.error("[resume]", e);
        toast.error("Erreur de rechargement: " + (e?.message || "inconnue"));
      }
    })();
  }, [resumeIntentId, resumeQuoteId, user?.id, DRAFT_KEY]);

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
        setPrefillError(null);
        const { data: acct, error: acctErr } = await supabase
          .from("accounts")
          .select("id, account_number, account_name, client_id, primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province, billing_address, billing_city, billing_postal_code, billing_province")
          .eq("id", prefillAccountId)
          .maybeSingle();
        if (acctErr || !acct) {
          const msg = "Compte introuvable — vérifiez le lien.";
          setPrefillError(msg);
          toast.error(msg);
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
          const { data: a, error: addrErr } = await supabase
            .from("service_addresses")
            .select("id, address_line, city, province, postal_code, label")
            .eq("id", prefillAddressId)
            .eq("account_id", (acct as any).id)
            .is("deleted_at", null)
            .maybeSingle();
          if (addrErr || !a) {
            const msg = "Adresse de service introuvable pour ce compte — impossible de pré-remplir la commande.";
            setPrefillError(msg);
            toast.error(msg);
            setPrefillLoading(false);
            return;
          }
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
        const accountLabel = `Compte #${(acct as any).account_number || "—"}`;
        const clientLabel = (acct as any).account_name || prof?.full_name || [first_name, last_name].filter(Boolean).join(" ") || "Client";
        const addressLabel = [address_line, city, postal_code].filter(Boolean).join(", ");
        const ctxLabel = `${accountLabel} — ${clientLabel} — Adresse : ${addressLabel || "—"}`;
        setPrefillContext(ctxLabel);

        let serviceabilityStatus: "available" | "unavailable" = "unavailable";
        try {
          const coverage = await checkServiceability(postal_code, address_line, city);
          serviceabilityStatus = coverage.status === "available" || coverage.status === "limited" ? "available" : "unavailable";
        } catch (coverageErr) {
          logger.warn("[FieldNewSale] prefill serviceability check failed", coverageErr);
        }

        setDraft((d) => {
          const restoredInProgress =
            allowCoreAdjustments &&
            d.existing_account_id === (acct as any).id &&
            (
              d.step !== "customer" ||
              d.services.length > 0 ||
              d.equipment.length > 0 ||
              Boolean(d.discount) ||
              Boolean(d.payment?.fieldOrderId) ||
              Boolean(d.custom_adjustments?.length)
            );

          return {
            ...d,
            // Core refresh must keep the exact in-progress step. Fresh
            // prefill stays on customer so install slot/survey can render.
            step: restoredInProgress ? d.step : "customer",
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
              serviceability_status: d.customer.serviceability_status === "unknown" ? serviceabilityStatus : d.customer.serviceability_status,
            },
          };
        });
        // Skip any restored draft — prefill takes priority
        checkedRestoreKeyRef.current = DRAFT_KEY;
        setRestoreDialogOpen(false);
        setPendingRestore(null);
        if (serviceabilityStatus === "available") {
          toast.success("Compte et adresse chargés — choisissez un créneau d'installation puis continuez.");
        } else {
          toast.warning("Compte chargé — disponibilité à vérifier avant de continuer.");
        }
      } catch (e: any) {
        console.error("[FieldNewSale] prefill error", e);
        const msg = "Erreur de pré-remplissage : " + (e?.message || "inconnue");
        setPrefillError(msg);
        toast.error(msg);
      } finally {
        setPrefillLoading(false);
      }
    })();
  }, [prefillAccountId, prefillAddressId, allowCoreAdjustments]);


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

  const fulfillmentFee = useMemo(() => {
    if (allowCoreAdjustments) {
      if (draft.customer.install_mode === "technician") {
        return Number(draft.customer.installation_fee ?? 50) || 0;
      }
      return Number(draft.customer.delivery_fee ?? 20) || 0;
    }
    if (draft.customer.install_mode !== "self") return 0;
    const cfg = (fieldConfig as any)?.shipping_fee_cents ?? (fieldConfig as any)?.shippingFeeCents;
    const cents = typeof cfg === "number" ? cfg : 2000;
    return cents / 100;
  }, [allowCoreAdjustments, draft.customer.delivery_fee, draft.customer.install_mode, draft.customer.installation_fee, fieldConfig]);
  const customAdjustmentsTotal = useMemo(() => {
    if (!allowCoreAdjustments) return 0;
    return (draft.custom_adjustments || []).reduce((sum, adjustment) => {
      const amount = Math.max(0, Number(adjustment.amount || 0));
      return sum + (adjustment.kind === "fee" ? amount : -amount);
    }, 0);
  }, [allowCoreAdjustments, draft.custom_adjustments]);
  const orderExtraLineItems = useMemo(() => {
    if (!allowCoreAdjustments) return [];
    const deliveryMode = draft.customer.delivery_mode || (draft.customer.install_mode === "self" ? "standard" : "technician");
    const fulfillmentLabel = deliveryMode === "express"
      ? "Livraison Express — Uber Direct"
      : deliveryMode === "standard"
        ? "Auto-installation — livraison standard"
        : "Installation technicien";
    const fulfillmentType = deliveryMode === "technician" ? "installation" : "delivery";
    const fulfillment = fulfillmentFee > 0 ? [{
      id: `fulfillment-${deliveryMode}`,
      kind: "fulfillment_fee",
      category: "fee",
      type: fulfillmentType,
      name: fulfillmentLabel,
      quantity: 1,
      price: fulfillmentFee,
      price_setup: fulfillmentFee,
      price_monthly: 0,
      monthly_price: 0,
    }] : [];
    const custom = (draft.custom_adjustments || [])
      .filter((adjustment) => Number(adjustment.amount || 0) > 0)
      .map((adjustment) => {
        const amount = Math.max(0, Number(adjustment.amount || 0));
        const signedAmount = adjustment.kind === "fee" ? amount : -amount;
        return {
          id: adjustment.id,
          kind: "custom_adjustment",
          category: adjustment.kind === "fee" ? "fee" : "discount",
          type: adjustment.kind,
          name: adjustment.label || (adjustment.kind === "fee" ? "Frais personnalisé" : "Crédit personnalisé"),
          quantity: 1,
          price: signedAmount,
          price_setup: signedAmount,
          price_monthly: 0,
          monthly_price: 0,
        };
      });
    return [...fulfillment, ...custom];
  }, [allowCoreAdjustments, draft.customer.delivery_mode, draft.customer.install_mode, draft.custom_adjustments, fulfillmentFee]);

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
  // Custom Core adjustments (crédit/promotion/frais personnalisés) sont inclus
  // dans le subtotal AVANT taxes (comportement original — taxes matchent le moteur serveur).
  const subtotal = Math.max(
    0,
    monthlyAfterDiscount + equipmentTotal + effectiveActivation + fulfillmentFee - firstMonthCredit + customAdjustmentsTotal,
  );
  const tps = Math.round(subtotal * TPS_RATE * 100) / 100;
  const tvq = Math.round(subtotal * TVQ_RATE * 100) / 100;
  const total = Math.max(0, Math.round((subtotal + tps + tvq) * 100) / 100);

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
      // F31-1/F31-4 — routed through canonical EF (ownership validated server-side)
      await supabase.functions.invoke("new-order-actions", {
        body: {
          action: "link_service_address",
          sale_id: saleId,
          service_address_id: draft.existing_service_address_id,
          account_id: draft.existing_account_id ?? null,
        },
      });
    } catch (e) {
      logger.warn("linkOrderToServiceAddress failed", e);
    }
  }, [draft.existing_service_address_id, draft.existing_account_id]);


  // ── Submit inline (square_inline): create quote + intent, then Square widget charges ──
  const handleSquareInlineInit = async () => {
    if (!user?.id || isSubmitting) return;
    if (draft.payment.fieldOrderId && draft.payment.paypalApprovalUrl) {
      setDraft((d) => ({ ...d, payment: { ...d.payment, method: "square_inline", status: "pending" } }));
      toast.info("Même transaction réutilisée — aucun doublon créé.");
      return;
    }
    setIsSubmitting(true);
    setSubmitMessage("Préparation du paiement…");
    try {
      const { saveQuoteAndEmail, sendPaymentLinkFromQuote } = await import("@/field-app/lib/fieldQuoteService");
      const quote = draft.payment.quoteId
        ? { id: draft.payment.quoteId, valid_until: "" }
        : await saveQuoteAndEmail({
            draft, agentName, activationFee, subtotal, tps, tvq, total, agentGps,
            skipClientEmail: true,
            idempotencyKey: `quote_${draft.id || createDraftId()}_${user.id}`,
          });
      const link = await sendPaymentLinkFromQuote(quote.id, "link_only");
      setDraft((d) => ({
        ...d,
        id: d.id || draft.id || createDraftId(),
        payment: { ...d.payment, quoteId: quote.id, status: "pending", fieldOrderId: link.intent_id, paypalApprovalUrl: link.payment_url },
      }));
      toast.success("Prêt — entrez les informations de carte ci-dessous.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la préparation du paiement");
    } finally {
      setIsSubmitting(false);
      setSubmitMessage("");
    }
  };

  // ── Square inline success: payment intent was already materialized into a Core order before charging ──
  const handleSquareInlineSuccess = async (paymentId: string) => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setSubmitMessage("Validation de la commande Core…");
    try {
      const intentId = draft.payment.fieldOrderId || paymentId;
      const commissionAmount = Math.max(0, Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)));
      const { data: intent } = await supabase
        .from("field_payment_intents" as any)
        .select("converted_order_id, converted_field_order_id")
        .eq("id", intentId)
        .maybeSingle();
      const coreOrderId = (intent as any)?.converted_order_id as string | undefined;
      if (!coreOrderId) throw new Error("Commande Core introuvable pour ce paiement.");

      const { data: coreOrder } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", coreOrderId)
        .maybeSingle();
      const coreOrderNumber = (coreOrder as any)?.order_number || `CMD-${coreOrderId.slice(0, 8).toUpperCase()}`;

      if (draft.customer.coaxial_survey) {
        try {
          // F31-1 — routed through canonical EF (patch coaxial_survey on Core order)
          await supabase.functions.invoke("new-order-actions", {
            body: {
              action: "link_service_address",
              order_id: coreOrderId,
              account_id: draft.existing_account_id ?? null,
              customer: { coaxial_survey: draft.customer.coaxial_survey },
            },
          });
        } catch (mirrorErr) { logger.warn("coaxial_survey mirror failed", mirrorErr); }
      }
      if ((intent as any)?.converted_field_order_id) await linkOrderToServiceAddress((intent as any).converted_field_order_id);

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
      if (draft.payment.fieldOrderId && draft.payment.paypalApprovalUrl) {
        if (draft.payment.method === "square_email") {
          const { data, error } = await supabase.functions.invoke("new-order-actions", {
            body: {
              action: "resend_payment_link",
              intent_id: draft.payment.fieldOrderId,
              payment_url: draft.payment.paypalApprovalUrl,
              customer: draft.customer,
              agent_name: agentName,
              client_totals: { subtotal, tps, tvq, total },
            },
          });
          if (error || !data?.ok) throw new Error(data?.error || error?.message || "Échec d'envoi du courriel.");
          setDraft((d) => ({ ...d, payment: { ...d.payment, status: "sent", linkSentTo: draft.customer.email } }));
          toast.success("Lien renvoyé au client — même commande conservée.");
        } else {
          toast.info("Lien déjà généré — même commande conservée.");
        }
        return;
      }

      // 1) Save the quote (no order/invoice yet)
      const { saveQuoteAndEmail, sendPaymentLinkFromQuote } = await import("@/field-app/lib/fieldQuoteService");
      const quote = draft.payment.quoteId
        ? { id: draft.payment.quoteId, valid_until: "" }
        : await saveQuoteAndEmail({
            draft, agentName, activationFee,
            subtotal, tps, tvq, total, agentGps,
            skipClientEmail: true,
            idempotencyKey: `quote_${draft.id || createDraftId()}_${user.id}`,
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
            quoteId: quote.id,
            paypalApprovalUrl: approvalUrl, paypalOrderId: null,
            fieldOrderId: data.intent_id ?? null, invoiceId: null, coreOrderId: null,
          },
        }));
        toast.success("Lien Revoir ma commande envoyé au client.");
        if (!allowCoreAdjustments) clearDraft();
      } else {
        setDraft((d) => ({
          ...d,
          payment: {
            ...d.payment, status: "pending",
            quoteId: quote.id,
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

  // F31-1/F31-2/F31-3/F31-6 — Card manual submit routed through canonical
  // `new-order-actions` edge. All catalogue resolution, TPS/TVQ, ownership,
  // audit and email queueing happen server-side. Commission is NOT written
  // here (F31-6 — created by square-webhook after capture).
  const handleCardSubmit = async (cardData: { number: string; name: string; expiry: string; cvv: string }) => {
    if (!user?.id || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitMessage("Chiffrement et enregistrement…");
    try {
      const { data, error } = await supabase.functions.invoke("new-order-actions", {
        body: {
          action: "submit_card_order",
          idempotency_key: `card_${Date.now()}_${user.id}`,
          client_user_id: null,
          account_id: draft.existing_account_id ?? null,
          service_address_id: draft.existing_service_address_id ?? null,
          customer: draft.customer,
          services: draft.services,
          equipment: draft.equipment,
          custom_adjustments: draft.custom_adjustments || [],
          discount: draft.discount,
          activation_fee: activationFee,
          agent_name: agentName,
          agent_gps: agentGps,
          client_totals: { subtotal, tps, tvq, total,
                           monthly_before_discount: monthlyBeforeDiscount,
                           equipment_total: equipmentTotal,
                           first_month_credit: firstMonthCredit },
          card: {
            number: cardData.number, name: cardData.name,
            expiry: cardData.expiry, cvv: cardData.cvv,
          },
        },
      });
      if (error || !data?.ok) {
        throw new Error(data?.error || error?.message || "Erreur lors du traitement de la carte.");
      }

      const intentId: string = data.intent_id;
      const last4: string = data.card_last4 || cardData.number.slice(-4);
      const coreOrderNumber: string = data.order_number || `SUB-${String(intentId).slice(0, 8).toUpperCase()}`;
      // F31-6 — commission preview shown only; the row will be inserted by
      // square-webhook after real capture. This is a display estimate.
      const commissionAmount = Math.max(
        0,
        Number((monthlyBeforeDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2)),
      );

      setCardSuccess({ intentId, orderNumber: coreOrderNumber, last4, amount: total, commission: commissionAmount });
      setCompletedSteps((prev) => [...new Set([...prev, "recap" as FieldSaleStep, "payment" as FieldSaleStep])]);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success(`Commande créée ${coreOrderNumber} • Carte ••${last4}`);
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

  if (prefillLoading && prefillAccountId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-violet-500/30 bg-gray-800 p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <h1 className="text-lg font-bold text-gray-50">Chargement du compte client…</h1>
          <p className="mt-1 text-sm text-gray-400">Préparation de l'adresse et vérification de couverture.</p>
        </div>
      </div>
    );
  }

  if (prefillError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-2xl border border-red-500/30 bg-gray-800 p-6 shadow-xl">
          <h1 className="text-lg font-bold text-gray-50">Pré-remplissage impossible</h1>
          <p className="mt-2 text-sm text-red-200">{prefillError}</p>
          <button
            type="button"
            onClick={() => navigate(_exitPath)}
            className="mt-5 h-11 rounded-lg border border-border px-4 text-sm font-semibold text-gray-50 hover:bg-secondary"
          >
            Retour
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
          {draft.existing_account_id && prefillContext && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-sm text-violet-100">
              <p className="font-semibold">{prefillContext}</p>
              <p className="mt-1 text-xs text-violet-200/80">Tunnel staff pré-rempli — aucun nouveau compte ne sera créé.</p>
            </div>
          )}

          {draft.step === "customer" && (
            <StepCustomer
              customer={draft.customer}
              onChange={(customer) => setDraft((d) => ({ ...d, customer }))}
              onNext={() => advance("customer")}
              onCancel={() => { clearDraft(); navigate(_exitPath); }}
              locked={Boolean(draft.existing_account_id)}
              lockedContext={prefillContext || undefined}
              // BUG-CORE-002A: gate InstallSlotPicker on ≥1 installable service.
              // Same rule as Core POS UnifiedPOSPage `requiresInstall`.
              hasInstallableService={draft.services.some(
                (s) => s.category === "internet" || s.category === "tv"
              )}
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
              allowCustomDiscount={allowCoreAdjustments}
              onChange={(discount) => setDraft((d) => ({ ...d, discount }))}
              onNext={() => advance("discounts")}
              onBack={() => goBack("discounts")}
            />
          )}

          {draft.step === "recap" && (
            <StepRecap
              draft={draft}
              allowCoreAdjustments={allowCoreAdjustments}
              activationFee={activationFee}
              fulfillmentFee={fulfillmentFee}
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
              onCustomAdjustmentsChange={(custom_adjustments) => setDraft((d) => ({ ...d, custom_adjustments }))}
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
                // F31-1/F31-13 — routed through canonical EF
                const { data, error } = await supabase.functions.invoke("new-order-actions", {
                  body: {
                    action: "resend_payment_link",
                    intent_id: draft.payment.fieldOrderId,
                    payment_url: draft.payment.paypalApprovalUrl,
                    customer: draft.customer,
                    agent_name: agentName,
                    client_totals: { subtotal, tps, tvq, total },
                  },
                });
                if (error || !data?.ok) toast.error(data?.error || "Échec d'envoi du courriel.");
                else toast.success("Courriel renvoyé.");
              }}
              onChangeMethod={() => {
                setDraft((d) => ({
                  ...d,
                  payment: { ...d.payment, method: "square_onsite" as any, status: "pending", linkSentTo: null },
                }));
              }}
              onCancelTransaction={async (reason: string) => {
                if (!reason || reason.trim().length < 10) {
                  toast.error("Motif de ≥ 10 caractères requis."); return;
                }
                // F31-1/F31-11/F31-14 — cancel routed through canonical EF
                const { data, error } = await supabase.functions.invoke("new-order-actions", {
                  body: {
                    action: "cancel_transaction",
                    intent_id: draft.payment.fieldOrderId,
                    order_id: draft.payment.coreOrderId,
                    reason: reason.trim(),
                    customer: draft.customer,
                    account_id: draft.existing_account_id ?? null,
                    client_totals: { subtotal, tps, tvq, total },
                  },
                });
                if (error || !data?.ok) {
                  toast.error(data?.error || error?.message || "Échec de l'annulation");
                  return;
                }
                toast.success("Transaction annulée. Client informé.");
                clearDraft();
                navigate(_exitPath);
              }}
              onHoldTransaction={async () => {
                if (!draft.payment.coreOrderId) {
                  toast.error("Aucune commande à mettre en attente."); return;
                }
                const reason = window.prompt("Motif de mise en attente (≥ 10 caractères) :", "") || "";
                if (reason.trim().length < 10) { toast.error("Motif ≥ 10 caractères requis."); return; }
                const { data, error } = await supabase.functions.invoke("new-order-actions", {
                  body: {
                    action: "hold_transaction",
                    order_id: draft.payment.coreOrderId,
                    reason: reason.trim(),
                    account_id: draft.existing_account_id ?? null,
                  },
                });
                if (error || !data?.ok) {
                  toast.error(data?.error || error?.message || "Échec de la mise en attente");
                  return;
                }
                toast.success("Commande mise en attente.");
                navigate(_exitPath);
              }}
              onConvertToQuote={async () => {
                if (!draft.customer.email) { toast.error("Email client requis pour soumission."); return; }
                const intentId = draft.payment.fieldOrderId;
                if (!intentId) { toast.error("Lien de paiement requis avant soumission."); return; }
                const payerUrl = `https://nivra-telecom.ca/payer/${intentId}`;
                // F31-1/F31-13 — routed through canonical EF
                const { data, error } = await supabase.functions.invoke("new-order-actions", {
                  body: {
                    action: "convert_to_quote_sub",
                    intent_id: intentId,
                    payment_url: payerUrl,
                    customer: draft.customer,
                    services: draft.services,
                    equipment: draft.equipment,
                    custom_adjustments: draft.custom_adjustments || [],
                    discount: draft.discount,
                    activation_fee: activationFee,
                    agent_name: agentName,
                    client_totals: { subtotal, tps, tvq, total,
                                     monthly_before_discount: monthlyBeforeDiscount,
                                     equipment_total: equipmentTotal,
                                     first_month_credit: firstMonthCredit },
                  },
                });
                if (error || !data?.ok) {
                  toast.error(data?.error || error?.message || "Échec de la conversion en soumission");
                  return;
                }
                toast.success("Soumission envoyée au client (valide 7 jours).");
                clearDraft();
                navigate(_exitPath);
              }}
            />
          )}
        </div>

        <LiveSummary
          draft={draft}
          activationFee={activationFee}
              fulfillmentFee={fulfillmentFee}
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
