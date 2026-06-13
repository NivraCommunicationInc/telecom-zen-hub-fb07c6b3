/**
 * training-ai-evaluate — Évalue une simulation d'appel Academy.
 * Retourne JSON structuré: score 0-100, forces, faiblesses, recommandations, verdict.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVAL_SYSTEM = `Tu es un coach de vente sénior pour Nivra Télécom (Québec, prépayé sans contrat).
Tu évalues une simulation d'appel/visite entre un AGENT en formation et un CLIENT (joué par IA).
Critères:
- Ouverture & accroche (professionnalisme, ton)
- Découverte des besoins (questions ouvertes)
- Présentation produit (Internet/TV/Mobile prépayé, transparence sur frais d'équipement requis)
- Traitement des objections (prix, engagement, équipement)
- Closing (proposition claire, prochaine étape)
- Respect (jamais de fausses promesses, jamais d'invention de prix/forfaits)

Réponds UNIQUEMENT en JSON valide (pas de markdown), shape exact:
{
  "score": 0-100,
  "verdict": "excellent" | "good" | "needs_work" | "fail",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": ["..."],
  "summary_fr": "..."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "IA non configurée" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const persona = String(body?.persona_label || "");
    const scenario = String(body?.scenario || "");

    if (messages.length < 2) {
      return new Response(JSON.stringify({ error: "Conversation trop courte" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transcript = messages.map((m: any) =>
      `${m.role === "assistant" ? "CLIENT" : "AGENT"}: ${String(m.content ?? "").slice(0, 2000)}`
    ).join("\n");

    const userMsg = `Persona client: ${persona}\nScénario: ${scenario}\n\nTranscription:\n${transcript}\n\nÉvalue l'agent.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EVAL_SYSTEM },
          { role: "user", content: userMsg },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Eval AI error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Erreur IA" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch (_e) { parsed = { score: 0, verdict: "fail", summary_fr: raw }; }
    return new Response(JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erreur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
