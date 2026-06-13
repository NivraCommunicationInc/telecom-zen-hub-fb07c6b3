/**
 * checkout-abandonment-track
 *
 * Tracks checkout abandonment and sends a recovery email via Resend scheduled send.
 *
 * Actions:
 *   "start"    — called when user reaches step 3 (has email + services).
 *               Schedules a recovery email 60 minutes from now.
 *               Returns { email_id } to store client-side for cancellation.
 *
 *   "cancel"   — called when order is successfully completed.
 *               Cancels the scheduled Resend email so the client doesn't
 *               receive an abandonment email after having already ordered.
 *
 * CASL / Loi 25 note:
 *   This email is TRANSACTIONAL (not marketing) — the person demonstrated
 *   clear purchase intent by filling out the checkout form. One follow-up
 *   email falls under implied consent (existing business relationship).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Service { name: string; price: number; }

interface Body {
  action: "start" | "cancel";
  email?: string;
  first_name?: string;
  last_name?: string;
  services?: Service[];
  session_id?: string;
  email_id?: string; // Resend email ID — required for cancel
}

function buildEmail(firstName: string, services: Service[], lang: "fr" | "en"): { subject: string; html: string } {
  const isFr = lang === "fr";
  const serviceList = services
    .map(s => `<li style="margin:4px 0;">${s.name} — <strong>${s.price.toFixed(2)} $/mois</strong></li>`)
    .join("");

  const subject = isFr
    ? "Vous avez oublié quelque chose chez Nivra Telecom"
    : "You left something behind at Nivra Telecom";

  const html = `
<!DOCTYPE html>
<html lang="${isFr ? "fr" : "en"}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Nivra Telecom</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
              ${isFr ? "Internet · Mobile · Télévision" : "Internet · Mobile · Television"}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;font-size:22px;color:#111827;">
              ${isFr ? `Bonjour ${firstName} 👋` : `Hi ${firstName} 👋`}
            </h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:16px;line-height:1.6;">
              ${isFr
                ? "Vous avez commencé à configurer votre forfait Nivra mais n'avez pas complété votre commande. Votre panier vous attend !"
                : "You started setting up your Nivra plan but didn't complete your order. Your cart is waiting for you!"}
            </p>

            <!-- Cart -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7ff;border:1px solid #e9d5ff;border-radius:12px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#7c3aed;">
                  ${isFr ? "Votre panier" : "Your cart"}
                </p>
                <ul style="margin:0;padding:0 0 0 16px;color:#374151;font-size:15px;">
                  ${serviceList}
                </ul>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="https://nivra-telecom.ca/commander"
                   style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:16px 40px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:-0.3px;">
                  ${isFr ? "Compléter ma commande →" : "Complete my order →"}
                </a>
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;text-align:center;">
              ${isFr
                ? "Des questions ? Écrivez-nous à <a href='mailto:support@nivra-telecom.ca' style='color:#7c3aed;'>support@nivra-telecom.ca</a>"
                : "Questions? Email us at <a href='mailto:support@nivra-telecom.ca' style='color:#7c3aed;'>support@nivra-telecom.ca</a>"}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#d1d5db;font-size:12px;">
              © ${new Date().getFullYear()} Nivra Telecom Inc. · Québec, Canada
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_KEY) return json({ ok: false, error: "RESEND_API_KEY not configured" }, 500);

  let body: Body;
  try { body = await req.json(); } catch (_e) { return json({ ok: false, error: "invalid_json" }, 400); }

  // ── CANCEL ───────────────────────────────────────────────────────────────
  if (body.action === "cancel") {
    if (!body.email_id) return json({ ok: true, cancelled: false, reason: "no_email_id" });

    try {
      const res = await fetch(`https://api.resend.com/emails/${body.email_id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}` },
      });
      const data = await res.json();
      return json({ ok: true, cancelled: res.ok, data });
    } catch (e) {
      console.error("[abandonment-track] cancel failed:", e);
      return json({ ok: true, cancelled: false }); // non-fatal
    }
  }

  // ── START ─────────────────────────────────────────────────────────────────
  const { email, first_name, last_name, services = [], session_id } = body;

  if (!email || !first_name || services.length === 0) {
    return json({ ok: false, error: "email, first_name, and services are required" }, 400);
  }

  // Ne pas envoyer aux adresses internes Nivra
  if (/@(nivra-telecom\.ca|nivratelecom\.ca)$/i.test(email) ||
      ["nivratelecom@gmail.com", "support@nivra-telecom.ca"].includes(email.toLowerCase())) {
    return json({ ok: true, skipped: true, reason: "internal_email" });
  }

  // Idempotency : une seule tentative par session
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check if this session already has a pending abandonment email
  if (session_id) {
    const { data: existing } = await supabase
      .from("checkout_abandonment_log")
      .select("id, resend_email_id")
      .eq("session_id", session_id)
      .maybeSingle();

    if (existing?.resend_email_id) {
      return json({ ok: true, email_id: existing.resend_email_id, reused: true });
    }
  }

  // Build and schedule email (60 minutes from now)
  const lang: "fr" | "en" = "fr";
  const { subject, html } = buildEmail(first_name, services, lang);
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  let emailId: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nivra Telecom <support@nivra-telecom.ca>",
        to: [email],
        subject,
        html,
        scheduled_at: scheduledAt,
        tags: [
          { name: "type", value: "cart_abandonment" },
          { name: "session_id", value: session_id || "unknown" },
        ],
      }),
    });
    const data = await res.json();
    emailId = data?.id || null;
    if (!res.ok) {
      console.error("[abandonment-track] Resend schedule failed:", data);
      return json({ ok: false, error: "resend_failed", detail: data }, 500);
    }
  } catch (e) {
    console.error("[abandonment-track] Resend error:", e);
    return json({ ok: false, error: "resend_exception" }, 500);
  }

  // Log to DB (best-effort, non-fatal)
  try {
    await supabase.from("checkout_abandonment_log").upsert({
      session_id: session_id || crypto.randomUUID(),
      email: email.toLowerCase(),
      first_name,
      last_name: last_name || "",
      services_json: services,
      resend_email_id: emailId,
      scheduled_at: scheduledAt,
      cancelled: false,
    }, { onConflict: "session_id" });
  } catch (e) {
    // Table might not exist yet — non-fatal, email is already scheduled
    console.warn("[abandonment-track] DB log failed (non-fatal):", e);
  }

  return json({ ok: true, email_id: emailId, scheduled_at: scheduledAt });
});
