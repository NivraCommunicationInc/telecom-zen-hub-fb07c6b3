/**
 * Nivra Core backend integration.
 * Base URL configured via VITE_NIVRA_CORE_URL env variable.
 */

const getNivraCoreUrl = (): string => {
  return import.meta.env.VITE_NIVRA_CORE_URL || "http://localhost:4000";
};

interface MarkPaidPayload {
  paymentNumber: string;
  paypalOrderId: string;
  paypalCaptureId: string;
}

/**
 * Notify Nivra Core that a PayPal payment was successfully captured.
 * Fire-and-forget by default — errors are logged but don't block the UI.
 */
export const notifyNivraCorePaid = async (payload: MarkPaidPayload): Promise<boolean> => {
  const url = `${getNivraCoreUrl()}/payments/mark-paid`;
  try {
    console.log("[NivraCore] Sending mark-paid:", payload);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[NivraCore] mark-paid failed ${res.status}:`, text);
      return false;
    }

    console.log("[NivraCore] mark-paid success");
    return true;
  } catch (err) {
    console.error("[NivraCore] mark-paid network error:", err);
    return false;
  }
};
