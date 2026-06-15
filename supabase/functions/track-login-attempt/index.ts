// Track login attempts on the internal hub and send an email alert
// to ops when 3+ failures occur for the same email within 5 minutes.
// Public function (no JWT required) — accepts only minimal payload.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALERT_RECIPIENT = Deno.env.get("SECURITY_ALERT_EMAIL") ?? "support@nivra-telecom.ca";
const FAILURE_THRESHOLD = 3;
const WINDOW_MINUTES = 5;
const COOLDOWN_MINUTES = 15; // don't re-alert for same email within this window

interface Payload {
  email_attempted?: string;
  success?: boolean;
  failure_reason?: string;
  portal?: string;
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

function buildAlertHtml(opts: {
  email: string;
  ip: string | null;
  userAgent: string | null;
  failures: number;
  windowMin: number;
  portal: string | null;
}) {
  const when = new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" });
  return `<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f4f4f7;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#dc2626;color:#ffffff;padding:20px 24px;">
      <h1 style="margin:0;font-size:18px;">🚨 Tentatives de connexion suspectes — Nivra Hub</h1>
    </div>
    <div style="padding:24px;color:#111111;font-size:14px;line-height:1.6;">
      <p><strong>${opts.failures}</strong> échecs de connexion en moins de <strong>${opts.windowMin} minutes</strong> sur le portail interne.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
        <tr><td style="padding:8px 0;color:#6b7280;width:140px;">Email tenté</td><td style="padding:8px 0;"><strong>${opts.email}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Adresse IP</td><td style="padding:8px 0;">${opts.ip || "inconnue"}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Portail visé</td><td style="padding:8px 0;">${opts.portal || "hub"}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">User-Agent</td><td style="padding:8px 0;font-size:11px;word-break:break-all;">${opts.userAgent || "inconnu"}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Détecté</td><td style="padding:8px 0;">${when} (HAE)</td></tr>
      </table>
      <div style="margin-top:20px;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;">
        <strong>Action recommandée :</strong> Si ce n'est pas un employé, bloquez l'IP dans Cloudflare et avisez l'utilisateur ciblé.
      </div>
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">Alerte automatique du système de sécurité Nivra. Vous ne pouvez pas vous désinscrire de ces alertes critiques.</p>
    </div>
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const payload: Payload = await req.json().catch(() => ({}));
    const email = (payload.email_attempted || "").trim().toLowerCase();
    if (!email || email.length > 254) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip = getClientIp(req);
    const ua = req.headers.get("user-agent");

    // 1) Insert attempt
    await supabase.from("auth_login_attempts").insert({
      email_attempted: email,
      ip_address: ip,
      user_agent: ua,
      success: payload.success === true,
      failure_reason: payload.failure_reason ?? null,
      portal: payload.portal ?? null,
    });

    // Only check threshold on failures
    if (payload.success === true) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Count failures in the window
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count: failureCount } = await supabase
      .from("auth_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", windowStart)
      .ilike("email_attempted", email);

    if (!failureCount || failureCount < FAILURE_THRESHOLD) {
      return new Response(JSON.stringify({ ok: true, failures: failureCount ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Check cooldown — don't spam
    const cooldownStart = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
    const { data: recentAlert } = await supabase
      .from("auth_login_alerts_sent")
      .select("id")
      .ilike("email_attempted", email)
      .gte("sent_at", cooldownStart)
      .limit(1)
      .maybeSingle();

    if (recentAlert) {
      return new Response(JSON.stringify({ ok: true, alerted: false, reason: "cooldown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Send alert email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    await resend.emails.send({
      from: "Nivra Security <security@notify.nivra-telecom.ca>",
      to: [ALERT_RECIPIENT],
      subject: `🚨 ${failureCount} échecs de connexion — ${email}`,
      html: buildAlertHtml({
        email,
        ip,
        userAgent: ua,
        failures: failureCount,
        windowMin: WINDOW_MINUTES,
        portal: payload.portal ?? null,
      }),
    });

    await supabase.from("auth_login_alerts_sent").insert({
      email_attempted: email,
      ip_address: ip,
    });

    return new Response(JSON.stringify({ ok: true, alerted: true, failures: failureCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-login-attempt error", e);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
