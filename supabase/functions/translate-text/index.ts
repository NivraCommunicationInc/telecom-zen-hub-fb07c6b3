/**
 * translate-text — Auto-translation via Lovable AI Gateway.
 *
 * Body: { texts: string[], targetLang: 'fr' | 'en' | 'ht' | 'es' | 'ar' | 'pt', sourceLang?: string }
 * Returns: { translations: string[] }
 *
 * Strict 1:1 array mapping. Falls back to original text on failure.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LANG_NAMES: Record<string, string> = {
  fr: "French",
  en: "English",
  ht: "Haitian Creole",
  es: "Spanish",
  ar: "Arabic",
  pt: "Portuguese",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, targetLang, sourceLang = "fr" } = await req.json();
    if (!Array.isArray(texts) || !targetLang || !LANG_NAMES[targetLang]) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetLang === sourceLang || texts.length === 0) {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a translator for a Quebec telecom company (Nivra). Translate the user's JSON array of strings from ${LANG_NAMES[sourceLang]} to ${LANG_NAMES[targetLang]}. Keep brand names (Nivra, Borne WiFi, Smart Terminal), units (Mbps, Gbps, GB, $), and numbers unchanged. Preserve formatting, punctuation and emoji. Return ONLY the translated array via the tool.`,
          },
          { role: "user", content: JSON.stringify(texts) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_translations",
            description: "Return translated strings in the same order",
            parameters: {
              type: "object",
              properties: {
                translations: { type: "array", items: { type: "string" } },
              },
              required: ["translations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_translations" } },
      }),
    });

    if (!resp.ok) {
      const code = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      return new Response(
        JSON.stringify({ error: "ai_error", translations: texts }),
        { status: code, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const argsStr = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let translations: string[] = texts;
    try {
      const parsed = JSON.parse(argsStr || "{}");
      if (Array.isArray(parsed?.translations) && parsed.translations.length === texts.length) {
        translations = parsed.translations.map((t: unknown) => String(t ?? ""));
      }
    } catch { /* fall back to source */ }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-text error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
