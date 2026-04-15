/**
 * Cloudflare Turnstile server-side verification utility.
 * Used by public-facing Edge Functions to validate anti-bot tokens.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  if (!token) return false;

  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY not configured — skipping verification");
    return false;
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      console.warn("[turnstile] Verification failed:", data["error-codes"]);
    }

    return data.success === true;
  } catch (error) {
    console.error("[turnstile] Verification request error:", error);
    return false;
  }
}

/**
 * Extract client IP from common headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Standard 403 response for failed Turnstile verification.
 */
export function turnstileFailResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Vérification anti-bot échouée. Veuillez réessayer." }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
