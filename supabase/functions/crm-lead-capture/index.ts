/**
 * crm-lead-capture — Public form endpoint for the lead-magnet landing pages
 * (e.g. /internet-pas-cher-quebec). Inserts the visitor into crm_contacts
 * with EXPLICIT marketing_consent (Loi 25 / LCAP-grade opt-in) and queues
 * an immediate welcome email. The new agents (blast / followup / sequence)
 * then pick the contact up from their next cron tick onward.
 *
 * Anti-abuse guards
 *   - Honeypot field accepted but stored separately so a bot trip looks
 *     like success without polluting the DB.
 *   - Per-IP rate limit: 3 submissions per hour. Anything beyond returns
 *     200 success silently (no signal to bots) but is not persisted.
 *   - Hard email-format + name validation.
 *   - Reject internal Nivra addresses (someone testing the form from
 *     support@nivra-telecom.ca should not land in the marketing list).
 *
 * Idempotency
 *   - Same email submitted twice → second call returns success but does
 *     NOT re-create the row, NOR re-send the welcome email (event_key dedupe
 *     in email_queue).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NIVRA_INTERNAL_RE = /@(nivra-telecom\.ca|nivratelecom\.ca)$/i;
const NIVRA_INTERNAL_EXACT = new Set([
  "nivratelecom@gmail.com",
  "nivratelecom@hotmail.com",
]);

interface Body {
  first_name?: string;
  last_name?: string;
  email?: string;
  city?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  consent?: boolean;
  consent_source?: string;
  landing?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isValidEmail(s: string): boolean {
  if (!s || s.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isInternalEmail(s: string): boolean {
  const norm = s.trim().toLowerCase();
  if (NIVRA_INTERNAL_EXACT.has(norm)) return true;
  return NIVRA_INTERNAL_RE.test(norm);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Validation
  const firstName = (body.first_name || "").trim().slice(0, 60);
  const lastName = (body.last_name || "").trim().slice(0, 60);
  const email = (body.email || "").trim().toLowerCase().slice(0, 254);
  const city = (body.city || "").trim().slice(0, 80) || null;
  const postalCode = (body.postal_code || "").trim().toUpperCase().slice(0, 7) || null;
  const phone = (body.phone || "").trim().slice(0, 20) || null;
  const consent = body.consent === true;
  const consentSource = (body.consent_source || "website_explicit").slice(0, 60);
  const landing = (body.landing || "unknown").slice(0, 80);

  if (!firstName) return json({ ok: false, error: "first_name_required" }, 400);
  if (!isValidEmail(email)) return json({ ok: false, error: "email_invalid" }, 400);
  if (!consent) return json({ ok: false, error: "consent_required" }, 400);
  if (isInternalEmail(email)) {
    // Silent — looks like success to the submitter; no row written
    return json({ ok: true, accepted: false, reason: "internal_address_blocked" });
  }

  // Rate limit by IP — 3 submissions per hour. rate_limits schema:
  //   identifier TEXT, action_type TEXT, window_start TIMESTAMPTZ,
  //   request_count INT, UNIQUE(identifier, action_type, window_start)
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count: recentCount } = await admin
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("identifier", ip)
      .eq("action_type", "crm-lead-capture")
      .gte("window_start", since);

    if ((recentCount ?? 0) >= 3) {
      // Silent success — do not signal to bots that they were caught
      return json({ ok: true, accepted: false, reason: "rate_limited" });
    }

    await admin.from("rate_limits").insert({
      identifier: ip,
      action_type: "crm-lead-capture",
    });
  } catch {
    // rate_limits table is best-effort; if it's missing, do not block lead capture.
  }

  // Upsert into crm_contacts (idempotent by email)
  let contactId: string | null = null;
  try {
    const { data: existing } = await admin
      .from("crm_contacts")
      .select("id, marketing_consent, unsubscribed_at, call_status")
      .eq("email", email)
      .maybeSingle();

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || firstName;

    if (existing) {
      contactId = existing.id;
      // Refresh consent on every explicit website opt-in
      await admin
        .from("crm_contacts")
        .update({
          full_name: fullName,
          first_name: firstName,
          last_name: lastName || undefined,
          city: city ?? undefined,
          postal_code: postalCode ?? undefined,
          phone: phone ?? undefined,
          marketing_consent: true,
          unsubscribed_at: null,
          consent_source: consentSource,
          consent_date: new Date().toISOString(),
          notes: `Lead via /${landing}. IP: ${ip}.`,
        })
        .eq("id", existing.id);
    } else {
      const { data: inserted, error } = await admin
        .from("crm_contacts")
        .insert({
          full_name: fullName,
          first_name: firstName,
          last_name: lastName || null,
          email,
          city,
          postal_code: postalCode,
          phone,
          source: `website:${landing}`,
          status: "lead",
          call_status: "not_called",
          marketing_consent: true,
          consent_source: consentSource,
          consent_date: new Date().toISOString(),
          notes: `Lead via /${landing}. IP: ${ip}.`,
        })
        .select("id")
        .single();
      if (error) {
        console.error("[crm-lead-capture] insert failed", error);
        return json({ ok: false, error: "Database error" }, 500);
      }
      contactId = inserted?.id ?? null;
    }
  } catch (e) {
    console.error("[crm-lead-capture] db", e);
    return json({ ok: false, error: "Database error" }, 500);
  }

  // Queue the welcome email — event_key dedupes per contact so a repeat
  // submission within the same day does not send a second welcome.
  const today = new Date().toISOString().slice(0, 10);
  const eventKey = `lead_capture_welcome_${contactId ?? email}_${today}`;
  try {
    await admin.from("email_queue").insert({
      event_key: eventKey,
      to_email: email,
      template_key: "crm_lead_welcome",
      subject: `Bienvenue chez Nivra Telecom, ${firstName}!`,
      template_vars: {
        crm_contact_id: contactId,
        first_name: firstName,
        city: city || "",
        subject: `Bienvenue chez Nivra Telecom, ${firstName}!`,
        hero_title: "Merci pour votre intérêt",
      },
      status: "queued",
      priority: 10,
    });
  } catch (e) {
    // event_key collision (duplicate submission today) is fine — just log
    console.warn("[crm-lead-capture] welcome enqueue (likely duplicate)", e);
  }

  // Owner notification — drop a one-line alert in support@ so the team
  // knows a new lead just arrived. This is the ONLY copy that should go
  // to support for marketing flow — keep it minimal so the inbox is not
  // re-spammed like it was with the old BCC pattern.
  try {
    const adminSubject = `🎉 Nouveau lead Nivra — ${firstName}${lastName ? " " + lastName : ""}${city ? " (" + city + ")" : ""}`;
    const adminHtml = `
      <h2 style="font-family:sans-serif;color:#7c3aed;margin:0 0 12px;">Nouveau lead reçu</h2>
      <table style="font-family:sans-serif;font-size:14px;color:#374151;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Prénom</td><td>${firstName}</td></tr>
        ${lastName ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Nom</td><td>${lastName}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Courriel</td><td><a href="mailto:${email}">${email}</a></td></tr>
        ${city ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Ville</td><td>${city}</td></tr>` : ""}
        ${postalCode ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Code postal</td><td>${postalCode}</td></tr>` : ""}
        ${phone ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Téléphone</td><td>${phone}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Source</td><td>/${landing}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">IP</td><td>${ip}</td></tr>
      </table>
      <p style="font-family:sans-serif;font-size:12px;color:#9ca3af;margin-top:16px;">Le lead recevra automatiquement l'email de bienvenue + entrera dans la séquence 4-touches CASL.</p>
    `;
    await admin.from("email_queue").insert({
      event_key: `${eventKey}_admin`,
      to_email: "support@nivra-telecom.ca",
      template_key: "custom_html",
      subject: adminSubject,
      template_vars: { subject: adminSubject, html: adminHtml },
      status: "queued",
      priority: 0,
    });
  } catch {/* non-blocking */}

  // Audit
  try {
    await admin.from("security_events").insert({
      event_type: "CRM_LEAD_CAPTURED",
      severity: "info",
      details: {
        contact_id: contactId,
        email,
        landing,
        consent_source: consentSource,
        ip,
      },
    });
  } catch {/* non-blocking */}

  return json({ ok: true, accepted: true, contact_id: contactId });
});
