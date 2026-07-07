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
import { violetShell } from "../_shared/violetEmailShell.ts";
import { resendGatewayFetch, sendResendEmail } from "../_shared/resendGateway.ts";


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
  email_id?: string;
}

function buildEmail(firstName: string, services: Service[], lang: "fr" | "en"): { subject: string; html: string } {
  const isFr = lang === "fr";
  const subject = isFr
    ? "Vous avez oublié quelque chose chez Nivra Telecom"
    : "You left something behind at Nivra Telecom";
  const cardRows: [string, string][] = services.map(s => [s.name, `${s.price.toFixed(2)} $/mois`]);
  const html = violetShell({
    preheader: isFr
      ? "Votre panier vous attend — complétez votre commande Nivra."
      : "Your cart is waiting — complete your Nivra order.",
    badge: isFr ? "PANIER EN ATTENTE" : "CART WAITING",
    heroTitle: isFr ? "Vous avez oublié quelque chose" : "You left something behind",
    heroSub: isFr ? "Votre panier Nivra Telecom" : "Your Nivra Telecom cart",
    greeting: isFr ? `Bonjour ${firstName},` : `Hi ${firstName},`,
    bodyHtml: isFr
      ? "Vous avez commencé à configurer votre forfait Nivra mais n'avez pas complété votre commande. Votre panier vous attend."
      : "You started setting up your Nivra plan but didn't complete your order. Your cart is waiting.",
    cardTitle: isFr ? "Votre panier" : "Your cart",
    cardRows,
    ctaPrimaryUrl: "https://nivra-telecom.ca/commander",
    ctaPrimaryLabel: isFr ? "Compléter ma commande" : "Complete my order",
    helpHtml: isFr
      ? `Des questions ? Écrivez-nous à <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;">support@nivra-telecom.ca</a>`
      : `Questions? Email us at <a href="mailto:support@nivra-telecom.ca" style="color:#0066CC;">support@nivra-telecom.ca</a>`,
  });
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
      const res = await resendGatewayFetch(`/emails/${body.email_id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
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
    const r = await sendResendEmail({
      from: "Nivra Telecom <support@nivra-telecom.ca>",
      to: [email],
      subject,
      html,
      scheduled_at: scheduledAt,
      tags: [
        { name: "type", value: "cart_abandonment" },
        { name: "session_id", value: session_id || "unknown" },
      ],
    });
    emailId = (r.data?.id as string | undefined) || null;
    if (!r.ok) {
      console.error("[abandonment-track] Resend schedule failed:", r.error);
      return json({ ok: false, error: "resend_failed", detail: r.error }, 500);
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
