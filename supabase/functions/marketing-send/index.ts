/**
 * marketing-send — Envoie une campagne marketing via Resend (gateway Lovable).
 *
 * Flow:
 *   1. Charge la campagne (status doit être draft/scheduled)
 *   2. Résout l'audience → liste unique de destinataires (email dédupliqué)
 *   3. Cross-check email_unsubscribes (CASL/Loi 25)
 *   4. Envoie via Resend gateway, batch de 50, avec token unsubscribe HMAC
 *   5. Log chaque envoi dans mkt_send_log
 *   6. Met à jour compteurs de la campagne
 *
 * Auth: JWT admin requis (has_role admin).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { generateUnsubscribeToken } from "../_shared/unsubscribeToken.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const UNSUB_BASE = `${SUPABASE_URL}/functions/v1/email-unsubscribe`;

type SendMode = "test" | "campaign";

interface Body {
  mode: SendMode;
  campaign_id?: string;
  test_email?: string;
  subject?: string;
  html?: string;
  preheader?: string;
  from_name?: string;
  from_email?: string;
}

interface Recipient {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  city?: string | null;
  crm_contact_id?: string | null;
  client_id?: string | null;
  custom_contact_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
      return json({ error: "resend_not_connected", hint: "Connecte Resend via le connecteur Lovable" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body: Body = await req.json();
    const mode = body.mode ?? "test";

    // ─── TEST MODE ───────────────────────────────────────────
    if (mode === "test") {
      if (!body.test_email || !body.subject || !body.html) {
        return json({ error: "missing_fields", required: ["test_email", "subject", "html"] }, 400);
      }
      const r = await sendOne({
        to: body.test_email,
        subject: `[TEST] ${body.subject}`,
        html: personalize(
          buildOfficialMarketingHtml(body.html, body.subject, body.preheader, "{{unsubscribe_url}}"),
          { email: body.test_email, first_name: "Client" },
          `${UNSUB_BASE}?token=${encodeURIComponent(await generateUnsubscribeToken(body.test_email))}`,
        ),
        fromName: body.from_name ?? "Nivra Telecom",
        fromEmail: body.from_email ?? "marketing@nivra-telecom.ca",
      });
      return json({ ok: r.ok, id: r.id, error: r.error });
    }

    // ─── CAMPAIGN MODE ───────────────────────────────────────
    if (!body.campaign_id) return json({ error: "campaign_id_required" }, 400);
    const { data: campaign, error: cErr } = await admin.from("mkt_campaigns")
      .select("*").eq("id", body.campaign_id).maybeSingle();
    if (cErr || !campaign) return json({ error: "campaign_not_found" }, 404);
    if (!["draft", "scheduled"].includes(campaign.status)) {
      return json({ error: "invalid_status", status: campaign.status }, 400);
    }
    if (!campaign.subject || !campaign.html_content) {
      return json({ error: "missing_content", hint: "Sujet et contenu HTML requis" }, 400);
    }

    // Mark sending
    await admin.from("mkt_campaigns").update({
      status: "sending", started_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    // Resolve audience → recipients
    const recipients = await resolveAudience(admin, campaign.audience_id);
    const uniqEmails = new Map<string, Recipient>();
    for (const r of recipients) {
      const k = r.email.toLowerCase();
      if (!uniqEmails.has(k)) uniqEmails.set(k, r);
    }
    const emails = Array.from(uniqEmails.keys());

    // Suppression list
    let suppressed = new Set<string>();
    if (emails.length > 0) {
      const { data: sup } = await admin.from("email_unsubscribes")
        .select("email").in("email", emails).eq("is_active", true);
      suppressed = new Set((sup ?? []).map((s: any) => String(s.email).toLowerCase()));
    }
    const targets = Array.from(uniqEmails.values()).filter(r => !suppressed.has(r.email.toLowerCase()));

    await admin.from("mkt_campaigns").update({ total_recipients: targets.length }).eq("id", campaign.id);

    // Batch send
    let sent = 0, failed = 0;
    for (const t of targets) {
      try {
        const unsubToken = await generateUnsubscribeToken(t.email);
        const unsubUrl = `${UNSUB_BASE}?token=${encodeURIComponent(unsubToken)}`;
        const htmlPersonalized = personalize(
          buildOfficialMarketingHtml(campaign.html_content, campaign.subject, campaign.preheader ?? "", "{{unsubscribe_url}}"),
          t,
          unsubUrl,
        );
        const subjectPersonalized = personalize(campaign.subject, t, unsubUrl);

        const r = await sendOne({
          to: t.email,
          subject: subjectPersonalized,
          html: htmlPersonalized,
          fromName: campaign.from_name,
          fromEmail: campaign.from_email,
          replyTo: campaign.reply_to ?? undefined,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          tags: [{ name: "campaign_id", value: campaign.id }],
        });

        await admin.from("mkt_send_log").insert({
          campaign_id: campaign.id,
          channel: "email",
          recipient_email: t.email,
          crm_contact_id: t.crm_contact_id ?? null,
          client_id: t.client_id ?? null,
          custom_contact_id: t.custom_contact_id ?? null,
          provider: "resend",
          provider_message_id: r.id ?? null,
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
          sent_at: r.ok ? new Date().toISOString() : null,
        });

        if (r.ok) sent++; else failed++;
      } catch (e) {
        failed++;
        await admin.from("mkt_send_log").insert({
          campaign_id: campaign.id, channel: "email", recipient_email: t.email,
          provider: "resend", status: "failed", error: String(e).slice(0, 500),
        });
      }
    }

    await admin.from("mkt_campaigns").update({
      status: "sent",
      completed_at: new Date().toISOString(),
      sent_count: sent,
    }).eq("id", campaign.id);

    return json({ ok: true, sent, failed, total: targets.length });
  } catch (e) {
    return json({ error: "internal", message: String(e) }, 500);
  }
});

async function sendOne(opts: {
  to: string; subject: string; html: string;
  fromName: string; fromEmail: string; replyTo?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: `${opts.fromName} <${opts.fromEmail}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.replyTo,
        headers: opts.headers,
        tags: opts.tags,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: JSON.stringify(data).slice(0, 500) };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 500) };
  }
}

async function resolveAudience(admin: any, audienceId: string | null): Promise<Recipient[]> {
  if (!audienceId) return [];
  const { data: aud } = await admin.from("mkt_audiences").select("*").eq("id", audienceId).maybeSingle();
  if (!aud) return [];
  const rules = aud.rules ?? {};
  const out: Recipient[] = [];

  const source = rules.source ?? "crm_contacts";
  const filters = rules.filters ?? {};

  if (source === "crm_contacts" || source === "all") {
    let q = admin.from("crm_contacts")
      .select("id, first_name, last_name, email, city")
      .not("email", "is", null).neq("email", "");
    if (filters.marketing_consent !== false) q = q.eq("marketing_consent", true);
    if (filters.city) q = q.ilike("city", `%${filters.city}%`);
    const { data } = await q.limit(5000);
    for (const c of data ?? []) {
      out.push({ email: c.email, first_name: c.first_name, last_name: c.last_name, city: c.city, crm_contact_id: c.id });
    }
  }

  if (source === "clients" || source === "all") {
    const { data } = await admin.from("profiles")
      .select("id, first_name, last_name, email, city")
      .not("email", "is", null).neq("email", "").limit(5000);
    for (const c of data ?? []) {
      out.push({ email: c.email, first_name: c.first_name, last_name: c.last_name, city: c.city, client_id: c.id });
    }
  }

  if (source === "custom" || source === "all") {
    let q = admin.from("mkt_contacts_custom").select("id, first_name, last_name, email, city, tags")
      .not("email", "is", null).eq("is_active", true);
    if (filters.tags && Array.isArray(filters.tags) && filters.tags.length) {
      q = q.overlaps("tags", filters.tags);
    }
    const { data } = await q.limit(10000);
    for (const c of data ?? []) {
      out.push({ email: c.email, first_name: c.first_name, last_name: c.last_name, city: c.city, custom_contact_id: c.id });
    }
  }

  if (source === "selected_emails") {
    const emails = Array.isArray(filters.emails) ? filters.emails : [];
    for (const email of emails) {
      const normalized = String(email || "").trim().toLowerCase();
      if (normalized && normalized.includes("@")) out.push({ email: normalized });
    }
  }

  return out;
}

function personalize(text: string, r: Recipient, unsubUrl: string): string {
  const first = r.first_name || "Client";
  const full = [r.first_name, r.last_name].filter(Boolean).join(" ") || "Client";
  return String(text)
    .replace(/\{\{first_name\}\}/g, escapeHtml(first))
    .replace(/\{\{full_name\}\}/g, escapeHtml(full))
    .replace(/\{\{city\}\}/g, escapeHtml(r.city ?? ""))
    .replace(/\{\{unsubscribe_url\}\}/g, unsubUrl)
    .replace(/\{\{email\}\}/g, escapeHtml(r.email));
}

function buildOfficialMarketingHtml(bodyHtml: string, subject: string, preheader = "", unsubUrl = "{{unsubscribe_url}}") {
  const cleanBody = normalizeMarketingBody(bodyHtml);
  const unsubscribeBlock = `
    <div style="border-top:1px solid #E5E7EB;margin-top:24px;padding-top:16px;text-align:center;font-size:12px;line-height:1.6;color:#6B7280;font-family:Arial,Helvetica,sans-serif">
      Vous recevez ce message parce que vous êtes inscrit aux communications Nivra.<br>
      <a href="${unsubUrl}" style="color:#0066CC;text-decoration:underline">Se désabonner</a>
    </div>`;

  return violetShell({
    preheader: preheader || subject,
    badge: "NIVRA TELECOM",
    heroTitle: subject || "Nivra Telecom",
    heroSub: preheader || undefined,
    bodyHtml: `${cleanBody}${unsubscribeBlock}`,
  });
}

function normalizeMarketingBody(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<body[^>]*>/gi, "")
    .replace(/<\/body>/gi, "")
    .replace(/<div[^>]*background\s*:\s*#0066CC[^>]*>[\s\S]*?Nivra Telecom[\s\S]*?<\/div>/i, "")
    .replace(/<div[^>]*background\s*:\s*#f5f5f5[\s\S]*?Se désabonner[\s\S]*?<\/div>\s*<\/div>\s*$/i, "")
    .trim();
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
