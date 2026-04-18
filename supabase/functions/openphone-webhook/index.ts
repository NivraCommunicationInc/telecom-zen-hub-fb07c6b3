/**
 * openphone-webhook — Receives OpenPhone events.
 *
 * Responsibilities:
 *  1) Persist SMS + call events into telephony_logs (existing behaviour).
 *  2) For inbound SMS, upsert a marketing_conversations row, detect language,
 *     and (if AI is globally + per-conversation enabled) ask Lovable AI Gateway
 *     for a sales reply, send it via OpenPhone, log it.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-openphone-signature",
};

type OpenPhoneEvent = {
  type: string;
  data: {
    object: {
      id: string;
      createdAt: string;
      direction: "incoming" | "outgoing";
      from: string;
      to: string[];
      body?: string;
      content?: string;
      status?: string;
      phoneNumberId?: string;
      userId?: string;
      duration?: number;
      answeredAt?: string;
      completedAt?: string;
    };
  };
};

// --- Light-weight language detection (no external dep) ----------------------
function detectLanguage(text: string): "fr" | "en" | "ht" | "es" | "it" | "pt" {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return "fr";
  // Haitian Creole markers
  if (/\b(mwen|ou|nou|kijan|kounye|mèsi|sak pase|bonjou|kreyòl|èske)\b/.test(t)) return "ht";
  // Spanish markers
  if (/\b(hola|gracias|por favor|cuánto|cuanto|tienen|quiero|necesito|cómo|como estás)\b/.test(t)) return "es";
  // Italian markers
  if (/\b(ciao|grazie|buongiorno|quanto costa|vorrei|prezzo|servizio)\b/.test(t)) return "it";
  // Portuguese markers
  if (/\b(olá|obrigado|obrigada|quanto custa|preciso|serviço|bom dia)\b/.test(t)) return "pt";
  // French markers
  if (/[àâçéèêëîïôûùüÿœæ]|(\bbonjour\b|\bmerci\b|\bcombien\b|\bje veux\b|\bcoute\b|\bcoûte\b|\bforfait\b|\bs'il vous plaît\b)/.test(t)) return "fr";
  // English markers
  if (/\b(hello|hi|how much|price|i want|need|thanks|thank you|english)\b/.test(t)) return "en";
  return "fr";
}

async function generateAIReply(opts: {
  supabase: any;
  conversation: any;
  inbound: string;
  language: string;
}): Promise<{ text: string; model: string; promptTokens?: number; completionTokens?: number } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY missing");
    return null;
  }

  // Load AI config
  const { data: cfg } = await opts.supabase
    .from("marketing_ai_config")
    .select("is_enabled, model, system_prompt")
    .limit(1)
    .maybeSingle();

  if (!cfg || cfg.is_enabled === false) return null;

  const model = cfg.model || "google/gemini-2.5-pro";

  // Fetch recent history (last 10 messages)
  const { data: recent } = await opts.supabase
    .from("telephony_logs")
    .select("direction, message_preview, created_at")
    .eq("marketing_conversation_id", opts.conversation.id)
    .eq("action", "sms")
    .order("created_at", { ascending: true })
    .limit(20);

  const history = (recent || []).map((m: any) => ({
    role: m.direction === "inbound" ? "user" : "assistant",
    content: m.message_preview || "",
  }));

  const systemPrompt = `${cfg.system_prompt}

CURRENT CONVERSATION CONTEXT:
- Detected language: ${opts.language}
- Discount already offered: ${opts.conversation.discount_offered || "none"}
- Always reply in language: ${opts.language}.
- Keep replies under 320 characters (2 SMS).`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: opts.inbound },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error", resp.status, errText);
      return null;
    }
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return {
      text,
      model,
      promptTokens: json?.usage?.prompt_tokens,
      completionTokens: json?.usage?.completion_tokens,
    };
  } catch (e) {
    console.error("AI generation failed", e);
    return null;
  }
}

async function sendOpenPhoneSMS(toNumber: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
  if (!OPENPHONE_API_KEY) return { ok: false, error: "OPENPHONE_API_KEY missing" };

  // Discover a phone number to send from
  try {
    const pnRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: { Authorization: OPENPHONE_API_KEY, "Content-Type": "application/json" },
    });
    if (!pnRes.ok) return { ok: false, error: `phone-numbers ${pnRes.status}` };
    const pnJson = await pnRes.json();
    const fromId = pnJson?.data?.[0]?.id;
    const fromNumber = pnJson?.data?.[0]?.phoneNumber;
    if (!fromId || !fromNumber) return { ok: false, error: "no openphone number" };

    const sendRes = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: { Authorization: OPENPHONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: text,
        from: fromNumber,
        to: [toNumber],
      }),
    });
    const sendJson = await sendRes.json().catch(() => null);
    if (!sendRes.ok) {
      return { ok: false, error: `send ${sendRes.status} ${JSON.stringify(sendJson)}` };
    }
    return { ok: true, id: sendJson?.data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rawBody = await req.text();
    let payload: any;
    try { payload = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Test connection (called from Marketing Settings page) ──
    if (payload?.__test_connection) {
      const apiKey = Deno.env.get("OPENPHONE_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ ok: false, error: "OPENPHONE_API_KEY non configurée dans les secrets" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      try {
        const resp = await fetch("https://api.openphone.com/v1/phone-numbers", {
          method: "GET",
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
        });
        if (!resp.ok) {
          const err = await resp.text();
          return new Response(
            JSON.stringify({ ok: false, error: `OpenPhone ${resp.status}: ${err.slice(0, 200)}` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const json = await resp.json();
        const count = Array.isArray(json?.data) ? json.data.length : 0;
        return new Response(
          JSON.stringify({ ok: true, message: `Connexion OK — ${count} numéro(s) accessible(s)` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ ok: false, error: e?.message || "Erreur réseau" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log("OpenPhone webhook:", payload.type);
    const data = payload.data?.object;
    if (!data) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventType = payload.type;

    // ---------- SMS ----------
    if (eventType === "message.received" || eventType === "message.created") {
      const isIncoming = data.direction === "incoming";
      const phoneNumber = isIncoming ? data.from : (data.to?.[0] || data.from);
      const messageContent = data.body || data.content || "";

      // Dedupe
      const { data: existing } = await supabase
        .from("telephony_logs")
        .select("id")
        .eq("openphone_message_id", data.id)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, deduped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find client by phone
      const { data: profile } = await supabase
        .from("profiles").select("id, full_name").eq("phone", phoneNumber).maybeSingle();

      // Upsert marketing_conversations (only for inbound or outbound to a known prospect)
      const detectedLang = detectLanguage(messageContent);
      let conversation: any = null;
      const { data: existingConv } = await supabase
        .from("marketing_conversations")
        .select("*").eq("phone_number", phoneNumber).maybeSingle();

      if (existingConv) {
        conversation = existingConv;
      } else {
        const { data: newConv } = await supabase
          .from("marketing_conversations")
          .insert({
            phone_number: phoneNumber,
            client_id: profile?.id || null,
            client_name: profile?.full_name || null,
            detected_language: detectedLang,
          })
          .select().single();
        conversation = newConv;
      }

      // Update conversation summary
      if (conversation) {
        await supabase
          .from("marketing_conversations")
          .update({
            last_message_preview: messageContent.substring(0, 280),
            last_message_at: data.createdAt || new Date().toISOString(),
            message_count: (conversation.message_count || 0) + 1,
            detected_language: isIncoming ? detectedLang : conversation.detected_language,
            status: isIncoming && conversation.status === "ai_active" ? "ai_active" : conversation.status,
          })
          .eq("id", conversation.id);
      }

      // Insert telephony log
      await supabase.from("telephony_logs").insert({
        client_id: profile?.id || null,
        phone_number: phoneNumber,
        action: "sms",
        direction: isIncoming ? "inbound" : "outbound",
        openphone_message_id: data.id,
        message_preview: messageContent.substring(0, 500),
        status: data.status || (isIncoming ? "received" : "sent"),
        raw_payload: payload,
        marketing_conversation_id: conversation?.id || null,
        created_at: data.createdAt || new Date().toISOString(),
      });

      // ---- AI auto-reply (only for inbound) ----
      if (isIncoming && conversation && conversation.ai_enabled !== false && conversation.status !== "human_takeover") {
        const ai = await generateAIReply({
          supabase, conversation, inbound: messageContent, language: detectedLang,
        });
        if (ai) {
          const sent = await sendOpenPhoneSMS(phoneNumber, ai.text);
          await supabase.from("marketing_ai_replies").insert({
            conversation_id: conversation.id,
            inbound_message: messageContent,
            ai_response: ai.text,
            model: ai.model,
            detected_language: detectedLang,
            prompt_tokens: ai.promptTokens || null,
            completion_tokens: ai.completionTokens || null,
            sent_via_openphone: sent.ok,
            openphone_message_id: sent.id || null,
            error: sent.ok ? null : sent.error || null,
          });
          if (sent.ok) {
            // Log outbound in telephony
            await supabase.from("telephony_logs").insert({
              client_id: profile?.id || null,
              phone_number: phoneNumber,
              action: "sms",
              direction: "outbound",
              openphone_message_id: sent.id || null,
              message_preview: ai.text.substring(0, 500),
              status: "sent",
              agent_name: "AI Sales Agent",
              marketing_conversation_id: conversation.id,
              raw_payload: { ai_generated: true, model: ai.model },
            });
          }
        } else {
          // AI couldn't reply — flag for human
          await supabase.from("marketing_conversations")
            .update({ status: "waiting" }).eq("id", conversation.id);
        }
      }

      return new Response(JSON.stringify({ success: true, conversation_id: conversation?.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Calls ----------
    if (eventType === "call.completed" || eventType === "call.ringing" || eventType === "call.recording.completed") {
      const isIncoming = data.direction === "incoming";
      const phoneNumber = isIncoming ? data.from : (data.to?.[0] || data.from);

      const { data: existing } = await supabase
        .from("telephony_logs").select("id").eq("openphone_call_id", data.id).maybeSingle();

      if (existing) {
        await supabase.from("telephony_logs")
          .update({
            status: data.status || "completed",
            duration_seconds: data.duration || null,
            raw_payload: payload,
          })
          .eq("openphone_call_id", data.id);
      } else {
        const { data: profile } = await supabase
          .from("profiles").select("id").eq("phone", phoneNumber).maybeSingle();
        await supabase.from("telephony_logs").insert({
          client_id: profile?.id || null,
          phone_number: phoneNumber,
          action: "call",
          direction: isIncoming ? "inbound" : "outbound",
          openphone_call_id: data.id,
          status: data.status || "ringing",
          duration_seconds: data.duration || null,
          raw_payload: payload,
          created_at: data.createdAt || new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
