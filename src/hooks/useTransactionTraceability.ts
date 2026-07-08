/**
 * Transaction Traceability Hook
 * 
 * Provides functions to log checkout/payment/order events for full audit trail.
 * 
 * Non-critical events (checkout_started, pricing_generated) → direct client insert
 * Critical events (payment_confirmed, order_created, payment_failed) → edge function
 */
import { useCallback, useRef } from "react";
import { portalClient as supabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";

// Event types for the checkout lifecycle
export type TransactionEventType =
  | "checkout_started"
  | "checkout_step_changed"
  | "pricing_generated"
  | "payment_method_selected"
  | "payment_started"
  | "payment_redirected"
  | "payment_confirmed"
  | "payment_failed"
  | "payment_cancelled"
  | "order_submitted"
  | "order_created"
  | "order_failed"
  | "subscription_created"
  | "checkout_abandoned"
  | "checkout_completed"
  | "checkout_error";

export type TransactionEventCategory = "checkout" | "payment" | "order" | "subscription";

export interface TransactionEventPayload {
  event_type: TransactionEventType;
  event_category?: TransactionEventCategory;
  status?: "info" | "success" | "error" | "warning" | "pending";
  order_number?: string;
  order_id?: string;
  invoice_number?: string;
  payment_number?: string;
  payment_reference?: string;
  provider_order_id?: string;
  provider_capture_id?: string;
  amount?: number;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, any>;
}

// Critical events that MUST go through the edge function for guaranteed persistence
const CRITICAL_EVENTS: TransactionEventType[] = [
  "payment_confirmed",
  "payment_failed",
  "order_created",
  "order_failed",
  "order_submitted",
  "subscription_created",
];

/**
 * Generate a unique session ID for this checkout session.
 * Persists in sessionStorage so it survives step navigation but not tab close.
 */
function getOrCreateCheckoutSessionId(): string {
  const KEY = "nivra_checkout_session_id";
  let sessionId = sessionStorage.getItem(KEY);
  if (!sessionId) {
    sessionId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, sessionId);
  }
  return sessionId;
}

export function resetCheckoutSessionId(): void {
  sessionStorage.removeItem("nivra_checkout_session_id");
}

export function useTransactionTraceability() {
  const { user } = useClientAuth();
  const sessionIdRef = useRef<string | null>(null);

  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = getOrCreateCheckoutSessionId();
    }
    return sessionIdRef.current;
  }, []);

  /**
   * Log a transaction event. 
   * Critical events go through edge function; others insert directly.
   * All calls are fire-and-forget (never block checkout flow).
   */
  const logEvent = useCallback(
    async (payload: TransactionEventPayload) => {
      if (!user?.id) {
        console.warn("[Traceability] No user, skipping event:", payload.event_type);
        return;
      }

      const sessionId = getSessionId();
      const isCritical = CRITICAL_EVENTS.includes(payload.event_type);

      try {
        if (isCritical) {
          // Edge function for guaranteed server-side persistence
          await supabase.functions.invoke("log-transaction-event", {
            body: {
              session_id: sessionId,
              ...payload,
            },
          });
        } else {
          // Direct client insert (faster, acceptable if lost on browser crash)
          await supabase.from("transaction_events" as any).insert({
            user_id: user.id,
            session_id: sessionId,
            event_type: payload.event_type,
            event_category: payload.event_category || "checkout",
            status: payload.status || "info",
            order_number: payload.order_number || null,
            order_id: payload.order_id || null,
            invoice_number: payload.invoice_number || null,
            payment_number: payload.payment_number || null,
            payment_reference: payload.payment_reference || null,
            paypal_order_id: null,
            paypal_capture_id: null,
            metadata: {
              ...(payload.metadata || {}),
              provider_order_id: payload.provider_order_id || null,
              provider_capture_id: payload.provider_capture_id || null,
            },
            amount: payload.amount || null,
            currency: "CAD",
            error_message: payload.error_message || null,
            error_code: payload.error_code || null,
            source: "client",
          });
        }

        console.log(`[Traceability] ${isCritical ? "⚡" : "📝"} ${payload.event_type}`, {
          session: sessionId,
          order: payload.order_number,
          status: payload.status,
        });
      } catch (err) {
        // Never block the checkout — log and continue
        console.error("[Traceability] Failed to log event (non-blocking):", payload.event_type, err);
      }
    },
    [user?.id, getSessionId]
  );

  /**
   * Convenience: log checkout start with selected services
   */
  const logCheckoutStarted = useCallback(
    (services: string[], totalAmount?: number) => {
      // Reset session for new checkout
      sessionIdRef.current = null;
      sessionStorage.removeItem("nivra_checkout_session_id");
      sessionIdRef.current = getOrCreateCheckoutSessionId();

      return logEvent({
        event_type: "checkout_started",
        event_category: "checkout",
        status: "info",
        amount: totalAmount,
        metadata: { services },
      });
    },
    [logEvent]
  );

  /**
   * Convenience: log payment confirmation
   */
  const logPaymentConfirmed = useCallback(
    (params: {
      order_number?: string;
      payment_reference?: string;
      provider_capture_id?: string;
      provider_order_id?: string;
      amount?: number;
      method?: string;
    }) => {
      return logEvent({
        event_type: "payment_confirmed",
        event_category: "payment",
        status: "success",
        ...params,
        metadata: { method: params.method },
      });
    },
    [logEvent]
  );

  /**
   * Convenience: log payment failure
   */
  const logPaymentFailed = useCallback(
    (params: {
      error_message?: string;
      error_code?: string;
      amount?: number;
      method?: string;
      provider_order_id?: string;
    }) => {
      return logEvent({
        event_type: "payment_failed",
        event_category: "payment",
        status: "error",
        ...params,
        metadata: { method: params.method },
      });
    },
    [logEvent]
  );

  /**
   * Convenience: log order creation result
   */
  const logOrderCreated = useCallback(
    (params: {
      order_number: string;
      order_id: string;
      invoice_number?: string;
      payment_number?: string;
      amount?: number;
    }) => {
      return logEvent({
        event_type: "order_created",
        event_category: "order",
        status: "success",
        ...params,
      });
    },
    [logEvent]
  );

  /**
   * Convenience: log order failure
   */
  const logOrderFailed = useCallback(
    (params: {
      error_message: string;
      error_code?: string;
      amount?: number;
      metadata?: Record<string, any>;
    }) => {
      return logEvent({
        event_type: "order_failed",
        event_category: "order",
        status: "error",
        ...params,
      });
    },
    [logEvent]
  );

  return {
    logEvent,
    logCheckoutStarted,
    logPaymentConfirmed,
    logPaymentFailed,
    logOrderCreated,
    logOrderFailed,
    getSessionId,
  };
}
