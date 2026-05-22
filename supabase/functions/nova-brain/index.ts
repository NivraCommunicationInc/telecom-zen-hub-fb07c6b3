import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error("[nova-brain] ANTHROPIC_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "configuration_error", detail: "NOVA n'est pas configuré. Contactez l'administrateur." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const messages = body.messages || [];

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({
          content: "Bonjour! Je suis NOVA, le Digital Brain de Nivra Telecom. Comment puis-je vous aider?"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contextData } = await supabase.rpc("get_nova_context");

    const { data: memories } = await supabase
      .from("nova_memory")
      .select("title, content, memory_type")
      .eq("is_active", true)
      .order("importance", { ascending: false })
      .limit(10);

    const memoryText = (memories || [])
      .map((m: any) => `[${m.memory_type}] ${m.title}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = `Tu es NOVA, le Digital Brain de Nivra Telecom.
Tu es le co-fondateur IA d'Oldo Lavaud.

PERSONNALITÉ:
- Tu penses comme un CEO de télécoms
- Tu parles directement, sans bullshit
- Tu proposes toujours des actions concrètes
- Tu analyses avec des chiffres réels
- Tu réponds en français québécois professionnel
- Jamais de réponses génériques

DONNÉES NIVRA EN TEMPS RÉEL:
${JSON.stringify(contextData || {}, null, 2)}

MÉMOIRE:
${memoryText}

RÈGLES:
- Toujours basé sur les vraies données
- Proposer 2-3 actions après chaque analyse
- Penser business en permanence
- Réponses structurées et précises`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const firstBlock: any = response.content?.[0];
    const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

    return new Response(
      JSON.stringify({ content: text, usage: response.usage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[nova-brain] error:", error);
    return new Response(
      JSON.stringify({
        error: "nova_error",
        detail: error?.message ?? "Une erreur est survenue.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
