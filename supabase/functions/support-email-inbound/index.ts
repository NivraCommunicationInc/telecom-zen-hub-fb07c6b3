/**
 * support-email-inbound — Receive forwarded emails from Cloudflare Email Routing.
 *
 * Creates a support_tickets row, inserts the original message into ticket_replies,
 * and schedules the AI responder for 10 minutes later.
 *
 * Accepts a flexible payload (Cloudflare, Mailgun, Resend Inbound, generic JSON):
 *   { from, from_name?, subject, text?, html?, message_id? }
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cf-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INBOUND_SECRET = Deno.env.get("SUPPORT_INBOUND_SECRET") || "";

function parseFrom(rawFrom: string): { email: string; name: string } {
  if (!rawFrom) return { email: "", name: "" };
  // "Display Name <user@host>" or "user@host"
  const m = rawFrom.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { email: rawFrom.trim().toLowerCase(), name: "" };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MARKETING_SENDER_PATTERNS = ["noreply@", "no-reply@", "newsletter@", "changelog@", "notifications@"];
const MARKETING_SUBJECT_KEYWORDS = ["unsubscribe", "newsletter", "changelog", "what's new", "nouveautés"];

function isMarketingEmail(
  from_email: string,
  subject: string,
  body: string,
  emailHeaders: Record<string, string>,
): boolean {
  const lcHeaders = Object.fromEntries(Object.entries(emailHeaders).map(([k, v]) => [k.toLowerCase(), v]));
  if (lcHeaders["list-unsubscribe"]) return true;
  const lcFrom = from_email.toLowerCase();
  if (MARKETING_SENDER_PATTERNS.some((p) => lcFrom.includes(p))) return true;
  const lcSubject = subject.toLowerCase();
  if (MARKETING_SUBJECT_KEYWORDS.some((k) => lcSubject.includes(k))) return true;
  const lcBody = body.toLowerCase();
  if (lcBody.includes("unsubscribe") && lcBody.includes("newsletter")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Optional shared-secret header (Cloudflare Worker → here)
  if (INBOUND_SECRET) {
    const provided = req.headers.get("x-cf-signature") || req.headers.get("x-inbound-secret") || "";
    if (provided !== INBOUND_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Normalize fields from various inbound providers
  const rawFrom = String(payload.from ?? payload.sender ?? payload.From ?? "");
  const { email: from_email, name: parsedName } = parseFrom(rawFrom);
  const from_name = String(payload.from_name ?? payload.name ?? parsedName ?? "").trim();
  const subject = String(payload.subject ?? payload.Subject ?? "(sans objet)").slice(0, 500);
  const textBody = String(payload.text ?? payload["body-plain"] ?? "");
  const htmlBody = String(payload.html ?? payload["body-html"] ?? "");
  const body = (textBody || (htmlBody ? stripHtml(htmlBody) : "")).slice(0, 50000);
  const message_id = String(payload.message_id ?? payload["Message-Id"] ?? payload.messageId ?? "");

  if (!from_email || !body) {
    return new Response(JSON.stringify({ error: "Missing from or body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract email headers from payload (various providers may include them)
  const emailHeaders: Record<string, string> = {};
  if (payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers)) {
    Object.assign(emailHeaders, payload.headers);
  }
  // Also check top-level list-unsubscribe field some providers include
  if (payload["list-unsubscribe"] || payload["List-Unsubscribe"]) {
    emailHeaders["list-unsubscribe"] = String(payload["list-unsubscribe"] ?? payload["List-Unsubscribe"]);
  }
  if (isMarketingEmail(from_email, subject, body, emailHeaders)) {
    console.log("[support-email-inbound] Ignoring marketing email from", from_email, "subject:", subject);
    return new Response(JSON.stringify({ ok: true, skipped: true, reason: "marketing" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1) Find client account by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, full_name, email")
    .ilike("email", from_email)
    .maybeSingle();

  let account_id: string | null = null;
  let resolved_client_name = from_name;
  if (profile?.user_id) {
    resolved_client_name = resolved_client_name || (profile.full_name ?? "");
    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("client_id", profile.user_id)
      .maybeSingle();
    account_id = account?.id ?? null;
  }

  // 2) Dedup: existing open / ai_replied ticket from same client in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("support_tickets")
    .select("id, ticket_number")
    .ilike("client_email", from_email)
    .in("status", ["open", "ai_replied"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ticket_id: string;
  let ticket_number: string;

  if (existing?.id) {
    ticket_id = existing.id;
    ticket_number = existing.ticket_number;
    // Append message to existing ticket, reset AI scheduled time so it considers the new message
    await supabase
      .from("support_tickets")
      .update({
        status: "open",
        ai_scheduled_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket_id);
  } else {
    const { data: created, error: insertErr } = await supabase
      .from("support_tickets")
      .insert({
        client_email: from_email,
        client_name: resolved_client_name || null,
        account_id,
        subject,
        description: body, // legacy NOT NULL column
        body,
        status: "open",
        source: "email",
        category: "general",
        priority: "normal",
        ai_scheduled_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        owner_user_id: profile?.user_id ?? null,
        user_id: profile?.user_id ?? null,
      })
      .select("id, ticket_number")
      .single();

    if (insertErr || !created) {
      console.error("[support-email-inbound] insert ticket failed", insertErr);
      return new Response(JSON.stringify({ error: "Could not create ticket", details: insertErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    ticket_id = created.id;
    ticket_number = created.ticket_number;
  }

  // 3) Insert the client message into ticket_replies
  await supabase.from("ticket_replies").insert({
    ticket_id,
    user_id: profile?.user_id ?? null,
    content: body,
    sender_type: "client",
    sender_role: "client",
    sender_email: from_email,
    sender_name: resolved_client_name || from_email,
    subject,
    email_message_id: message_id || null,
    is_admin: false,
  });

  // 4) AI responder is triggered by pg_cron every 2 min — no invocation needed here

  return new Response(
    JSON.stringify({ ok: true, ticket_id, ticket_number }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
