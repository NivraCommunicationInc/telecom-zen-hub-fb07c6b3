import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * AI IMPROVE MESSAGE - Assistant IA pour améliorer les messages tickets
 * Utilise Lovable AI (Gemini) pour reformuler en style télécom professionnel
 * 
 * SECURITY: Uses dedicated LOVABLE_AI_KEY only. Never falls back to service role key.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImproveMessageRequest {
  original_message: string;
  context?: string; // e.g., "ticket_reply", "email", "sms"
  tone?: string; // e.g., "professional", "empathetic", "urgent"
}

const SYSTEM_PROMPT = `Tu es un assistant de rédaction pour Nivra Télécom, une entreprise de télécommunications au Québec.

RÈGLES STRICTES:
1. Corrige l'orthographe et la grammaire
2. Reformule de façon professionnelle, claire et empathique
3. Garde le style "support télécom" : orienté solution, rassurant
4. CONSERVE TOUS les détails techniques (numéros, dates, montants, ID)
5. NE JAMAIS inventer de faits ou d'engagements non présents dans le message original
6. Garde la même intention et le même sens
7. Utilise le vouvoiement (formel)
8. Maximum 2-3 paragraphes courts

FORMAT DE RÉPONSE:
Retourne uniquement le texte amélioré, sans explication ni commentaire.`;

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] ai-improve-message invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Only use dedicated AI key, never service role key
    const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_AI_KEY");
    
    if (!LOVABLE_AI_KEY) {
      console.error(`[${requestId}] LOVABLE_AI_KEY not configured`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Service IA non configuré. Contactez l'administrateur.",
          ai_disabled: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { original_message, context, tone }: ImproveMessageRequest = await req.json();

    if (!original_message || original_message.trim().length < 10) {
      throw new Error("Le message doit contenir au moins 10 caractères");
    }

    // Build the user prompt
    let userPrompt = `Message original à améliorer:\n\n"${original_message}"`;
    
    if (context === "ticket_reply") {
      userPrompt += "\n\nContexte: Réponse à un ticket de support client.";
    } else if (context === "email") {
      userPrompt += "\n\nContexte: Email professionnel.";
    }
    
    if (tone === "empathetic") {
      userPrompt += "\nTon: Particulièrement empathique (client frustré).";
    } else if (tone === "urgent") {
      userPrompt += "\nTon: Urgence contrôlée (problème critique).";
    }

    // Call Lovable AI (Gemini)
    const LOVABLE_AI_URL = Deno.env.get("LOVABLE_AI_URL") || "https://lovable-ai.lovable.dev/v1/chat/completions";

    console.log(`[${requestId}] Calling Lovable AI...`);
    
    const response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_AI_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] AI API error:`, errorText);
      throw new Error("Erreur lors de l'appel à l'IA");
    }

    const aiResponse = await response.json();
    const improvedMessage = aiResponse.choices?.[0]?.message?.content?.trim();

    if (!improvedMessage) {
      throw new Error("L'IA n'a pas retourné de réponse valide");
    }

    console.log(`[${requestId}] Successfully improved message`);

    return new Response(
      JSON.stringify({
        success: true,
        original: original_message,
        improved: improvedMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erreur inconnue" 
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
