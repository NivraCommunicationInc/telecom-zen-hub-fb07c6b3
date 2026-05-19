/**
 * training-ai-simulate — Nivra Academy AI client persona for sales simulation.
 * Uses Lovable AI Gateway (Gemini 2.5 Flash). Non-streaming for simplicity.
 *
 * POST body:
 *   { simulation_id?: string, system_prompt?: string, persona_label?: string,
 *     messages: { role: 'user'|'assistant'|'system', content: string }[] }
 *
 * Returns: { reply: string }
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_PROMPT = `Tu joues le rôle d'un client québécois potentiel de Nivra Télécom.
L'agent en formation vient te démarcher. Reste dans le personnage en tout temps,
réponds en français du Québec, naturel, ni trop facile ni trop hostile.
Ne rédige jamais de méta-commentaire ("voici comment je réponds"). Reste un humain.`;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Service IA non configuré." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0 || messages.length > 60) {
      return new Response(
        JSON.stringify({ error: "messages doit contenir 1-60 entrées" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = String(body?.system_prompt || FALLBACK_PROMPT).slice(0, 4000);
    const persona = body?.persona_label ? `\n\nPersonnage : ${String(body.persona_label).slice(0, 200)}.` : "";

    const aiMessages = [
      { role: "system", content: systemPrompt + persona },
      ...messages.slice(-30).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
        content: String(m.content ?? "").slice(0, 4000),
      })),
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        max_tokens: 400,
        temperature: 0.9,
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans un instant." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Crédits IA épuisés. Contactez un admin." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`[${requestId}] AI error`, resp.status, txt);
      return new Response(JSON.stringify({ error: "Erreur IA" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "...";
    return new Response(JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error(`[${requestId}]`, err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
