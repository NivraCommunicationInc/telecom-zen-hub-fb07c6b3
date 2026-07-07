/**
 * resendGateway — Shared helper that routes ALL Resend HTTP calls through the
 * Lovable connector gateway. `RESEND_API_KEY` is the connector-gateway
 * connection key (not a raw Resend API key). Direct calls to api.resend.com
 * return 401 "API key is invalid" since the Resend connector was migrated to
 * the Lovable gateway.
 *
 * Any Edge Function that previously did
 *     fetch("https://api.resend.com/emails", { Authorization: Bearer RESEND_API_KEY })
 * MUST use this helper (or `resendGatewayFetch`) instead.
 */

export const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export interface ResendGatewayResult {
  ok: boolean;
  status: number;
  data?: { id?: string } & Record<string, unknown>;
  error?: string;
}

function readKeys(): { lovableApiKey: string | null; resendApiKey: string | null } {
  return {
    lovableApiKey: Deno.env.get("LOVABLE_API_KEY") || null,
    resendApiKey: Deno.env.get("RESEND_API_KEY") || null,
  };
}

/**
 * Low-level: performs a raw fetch against the Resend connector gateway.
 * `path` MUST start with `/` (e.g. `/emails`, `/emails/{id}/cancel`).
 */
export async function resendGatewayFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { lovableApiKey, resendApiKey } = readKeys();
  if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured (required for connector gateway)");
  if (!resendApiKey) throw new Error("RESEND_API_KEY not configured (connector gateway connection key)");

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${lovableApiKey}`);
  headers.set("X-Connection-Api-Key", resendApiKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return await fetch(`${RESEND_GATEWAY_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
}

/**
 * High-level: send a transactional email via the gateway. Accepts any Resend
 * `/emails` payload shape (from, to, subject, html/text, attachments, headers…).
 */
export async function sendResendEmail(
  payload: Record<string, unknown>,
): Promise<ResendGatewayResult> {
  try {
    const r = await resendGatewayFetch("/emails", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data: Record<string, unknown> | undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch { /* not JSON */ }
    if (r.ok) return { ok: true, status: r.status, data: data as ResendGatewayResult["data"] };
    return { ok: false, status: r.status, error: `Resend gateway ${r.status}: ${text.slice(0, 400)}` };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
