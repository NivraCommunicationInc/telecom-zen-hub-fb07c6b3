// Redeployed: 2026-05-22-NOVA-FIX
// NOVA Memory Update — extract insights from conversations and persist them.
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { conversation_id, messages } = await req.json();
    if (!Array.isArray(messages) || messages.length < 2) {
      return new Response(JSON.stringify({ ok: true, skipped: "too_short" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const transcript = messages
      .map((m: any) => `[${m.role.toUpperCase()}] ${m.content}`)
      .join("\n\n");

    const extractionPrompt = `Analyse cette conversation entre Oldo (fondateur Nivra Telecom) et NOVA (son IA).
Extrait les NOUVEAUX apprentissages utiles à mémoriser pour rendre NOVA plus intelligent à l'avenir.

Conversation:
${transcript}

Retourne UNIQUEMENT un JSON valide:
{
  "insights": [
    {
      "memory_type": "company" | "personal_oldo" | "learned" | "decision" | "market" | "oldo_clone",
      "category": "string courte (ex: pricing, agent_management, ui_preference)",
      "title": "titre court de l'apprentissage",
      "content": "contenu détaillé (1-3 phrases max)",
      "importance": 1-10
    }
  ]
}

Règles:
- Ne crée PAS de doublons triviaux
- Maximum 5 insights par conversation
- 'oldo_clone' pour: style de communication, préférences, sujets favoris, décisions répétées
- 'learned' pour: nouveaux faits opérationnels Nivra
- 'decision' pour: décisions stratégiques prises
- Si rien d'intéressant, retourne {"insights":[]}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 2048,
        messages: [{ role: "user", content: extractionPrompt }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "anthropic_error", detail: t }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const text = data?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ ok: true, insights: 0, raw: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let parsed: any;
    try { parsed = JSON.parse(jsonMatch[0]); } catch {
      return new Response(JSON.stringify({ ok: true, insights: 0, parse_error: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
    let saved = 0;
    for (const ins of insights.slice(0, 5)) {
      if (!ins?.title || !ins?.content || !ins?.memory_type) continue;
      // Check for existing similar memory (by title)
      const { data: existing } = await admin
        .from("nova_memory")
        .select("id, content")
        .eq("title", ins.title)
        .eq("memory_type", ins.memory_type)
        .maybeSingle();
      if (existing) {
        await admin.from("nova_memory").update({
          content: ins.content,
          importance: Math.max(1, Math.min(10, Number(ins.importance) || 5)),
          last_accessed: new Date().toISOString(),
        }).eq("id", (existing as any).id);
      } else {
        await admin.from("nova_memory").insert({
          memory_type: ins.memory_type,
          category: ins.category || "general",
          title: ins.title,
          content: ins.content,
          importance: Math.max(1, Math.min(10, Number(ins.importance) || 5)),
          source: `conversation:${conversation_id ?? "unknown"}`,
        });
      }
      saved++;
    }
    return new Response(JSON.stringify({ ok: true, insights: saved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
