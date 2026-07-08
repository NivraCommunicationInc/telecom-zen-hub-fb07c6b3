/**
 * core-client-notify
 * Generic branded notification email dispatched from Core 360 actions.
 * Uses the official Nivra template (violetShell / #0066CC).
 * Every action from Account360NewActionDialogs invokes this function.
 */
import { corsHeaders } from "../_shared/cors.ts";
import { sendOfficialEmail } from "../_shared/officialEmail.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface Payload {
  clientEmail: string;
  clientName?: string;
  subject: string;
  heroTitle: string;
  heroSub?: string;
  greeting?: string;
  bodyHtml?: string;
  cardTitle?: string;
  cardRows?: Array<{ label: string; value: string }>;
  actionKey: string;   // audit action key
  accountId?: string;
  clientUserId?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (!body.clientEmail || !body.subject || !body.heroTitle || !body.actionKey) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Send email via official template
    const result = await sendOfficialEmail({
      to: body.clientEmail,
      subject: body.subject,
      heroTitle: body.heroTitle,
      heroSub: body.heroSub,
      greeting: body.greeting || (body.clientName ? `Bonjour ${body.clientName},` : "Bonjour,"),
      bodyHtml: body.bodyHtml,
      cardTitle: body.cardTitle,
      cardRows: body.cardRows,
      helpVariant: "support",
    });

    // Audit: activity_logs
    try {
      await supabase.from("activity_logs").insert({
        user_id: body.clientUserId ?? null,
        action: `core_action.${body.actionKey}`,
        entity_type: "account",
        entity_id: body.accountId ?? null,
        actor_role: "core_staff",
        reason: body.reason ?? null,
        details: {
          subject: body.subject,
          email_result: result.success ? "sent" : "failed",
          email_id: result.id,
          hero_title: body.heroTitle,
        },
      });
    } catch (e) {
      console.error("[core-client-notify] audit insert failed", e);
    }

    return new Response(JSON.stringify({
      success: result.success, email_id: result.id, error: result.error,
    }), {
      status: result.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[core-client-notify] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
