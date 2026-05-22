// NOVA Email Handler — autonomously responds to support tickets. Cron every 5 min.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENSITIVE_KEYWORDS = ["facture", "annulation", "remboursement", "résiliation", "cancel", "refund", "billing", "litige", "dispute"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: tickets } = await admin.from("support_tickets_ai")
      .select("id, ticket_number, from_email, from_name, subject, body, category, priority, account_id")
      .eq("status", "new")
      .eq("ai_response_sent", false)
      .order("created_at", { ascending: true })
      .limit(10);

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0; let auto = 0; let escalated = 0;

    for (const t of tickets) {
      const lower = `${t.subject ?? ""} ${t.body ?? ""}`.toLowerCase();
      const isSensitive = SENSITIVE_KEYWORDS.some((k) => lower.includes(k));

      const prompt = `Tu es NOVA, l'assistant support de Nivra Telecom (Internet/TV prépayé Québec).
Réponds à cet email client de façon professionnelle, chaleureuse, et concise (max 200 mots).
Termine par "L'équipe Nivra Telecom".

Sujet: ${t.subject ?? ""}
Message: ${t.body ?? ""}

Retourne UNIQUEMENT un JSON:
{"confidence": 0.0-1.0, "subject": "Re: ...", "body": "...réponse...", "suggested_status": "ai_responded" | "escalated"}`;

      let aiResp: any = null;
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (r.ok) {
          const d = await r.json();
          const txt = d?.content?.[0]?.text ?? "";
          const m = txt.match(/\{[\s\S]*\}/);
          if (m) aiResp = JSON.parse(m[0]);
        }
      } catch { /* fall through */ }

      processed++;
      const confidence = Number(aiResp?.confidence ?? 0);

      if (aiResp && confidence >= 0.9 && !isSensitive) {
        // Auto-respond
        await admin.from("email_queue").insert({
          to_email: t.from_email,
          template_key: "nova_support_response",
          template_vars: {
            first_name: t.from_name ?? "Client",
            subject: aiResp.subject ?? `Re: ${t.subject ?? ""}`,
            body: aiResp.body ?? "",
            ticket_number: t.ticket_number,
          },
          status: "queued",
          language: "fr",
        });
        await admin.from("support_tickets_ai").update({
          ai_response: aiResp.body,
          ai_confidence: confidence,
          ai_response_sent: true,
          status: "ai_responded",
        }).eq("id", t.id);
        await admin.from("nova_actions").insert({
          action_type: "send_email",
          action_payload: { ticket_id: t.id, to: t.from_email, confidence, auto: true },
          status: "completed",
          result: { ticket_number: t.ticket_number, confidence },
        });
        auto++;
      } else {
        // Escalate to Oldo
        await admin.from("support_tickets_ai").update({
          ai_response: aiResp?.body ?? null,
          ai_confidence: confidence,
          ai_escalated: true,
          escalation_reason: isSensitive ? "sensitive_topic" : (aiResp ? "low_confidence" : "ai_failed"),
          status: "escalated",
        }).eq("id", t.id);
        await admin.from("nova_actions").insert({
          action_type: "send_email",
          action_payload: {
            ticket_id: t.id, to: t.from_email,
            subject: aiResp?.subject ?? t.subject,
            draft_body: aiResp?.body ?? null,
            confidence, sensitive: isSensitive,
          },
          status: "pending",
          requires_approval: true,
          result: { ticket_number: t.ticket_number, reason: isSensitive ? "sensitive" : "low_confidence" },
        });
        escalated++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, auto, escalated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
