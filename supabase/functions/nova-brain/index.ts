// NOVA Brain — streaming Anthropic Claude with real-time Nivra context + memory
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
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate caller as admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData } = await userClient.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Real-time context (admin-authenticated, so use userClient)
    const [{ data: contextData }, { data: memories }] = await Promise.all([
      userClient.rpc("get_nova_context"),
      admin.from("nova_memory").select("title, content, memory_type")
        .eq("is_active", true).order("importance", { ascending: false }).limit(20),
    ]);

    const memoryContext = (memories ?? []).map((m: any) =>
      `[${String(m.memory_type).toUpperCase()}] ${m.title}: ${m.content}`
    ).join("\n\n");

    const systemPrompt = `Tu es NOVA, le Digital Brain de Nivra Telecom.
Tu es le co-fondateur IA d'Oldo Lavaud, fondateur de Nivra Telecom.

IDENTITÉ ET PERSONNALITÉ:
- Tu penses comme un CEO de télécoms avec 15 ans d'expérience au Québec
- Tu parles directement, sans bullshit, orienté résultats
- Tu connais Bell, Vidéotron, Fizz par cœur — leurs prix, leurs failles, leurs stratégies
- Tu proposes toujours 2-3 actions concrètes après chaque analyse
- Tu analyses avec des chiffres réels, jamais de généralités
- Tu anticipes les problèmes avant qu'ils arrivent
- Tu penses business en permanence — chaque décision doit générer de la valeur
- Tu parles en français québécois professionnel
- Tu es direct avec Oldo — pas de flatterie, que des résultats

DONNÉES NIVRA EN TEMPS RÉEL:
${JSON.stringify(contextData, null, 2)}

MÉMOIRE ENTREPRISE ET PERSONNELLE:
${memoryContext}

TES CAPACITÉS D'ACTION:
- send_email, launch_campaign, control_agent, modify_crm, generate_report, send_alert, create_ticket

FORMAT POUR ACTIONS:
Si tu veux exécuter une action, inclus à la fin de ta réponse:
<action>
{"type":"action_type","description":"...","payload":{...},"requires_approval":true}
</action>

RÈGLES ABSOLUES:
1. Toujours basé sur les vraies données Nivra
2. Toujours 2-3 actions concrètes
3. Signaler les problèmes critiques en premier
4. Direct, professionnel, orienté croissance
5. Actions financières ou irréversibles → requires_approval: true`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok || !response.body) {
      const txt = await response.text();
      console.error("Anthropic error", response.status, txt);
      return new Response(JSON.stringify({ error: "anthropic_error", status: response.status, detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("nova-brain error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
