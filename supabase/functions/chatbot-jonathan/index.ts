import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  message: string;
  sessionId: string;
  language: "fr" | "en";
  isAuthenticated: boolean;
  userId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId, language, isAuthenticated, userId } = await req.json() as ChatRequest;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let contextData: Record<string, unknown> = {};
    let systemPrompt = "";

    // Build context based on authentication
    if (isAuthenticated && userId) {
      // Fetch user's orders
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, status, service_type, created_at, total_amount")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user's appointments
      const { data: appointments } = await supabaseAdmin
        .from("appointments")
        .select("id, title, scheduled_at, status, service_type")
        .eq("client_id", userId)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3);

      // Fetch user's profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      contextData = { orders, appointments, profile };

      systemPrompt = language === "fr"
        ? `Tu es Jonathan, l'assistant virtuel de Nivra Télécom. Tu es professionnel, amical et efficace.
          L'utilisateur est connecté. Voici ses données:
          - Nom: ${profile?.full_name || "Non spécifié"}
          - Commandes récentes: ${orders?.length || 0}
          - Prochains rendez-vous: ${appointments?.length || 0}
          
          Tu peux l'aider avec:
          - Suivi de commande (statut, détails)
          - Informations sur ses rendez-vous
          - Questions sur les plans et services
          - Création de ticket support si nécessaire
          
          Réponds de façon concise et utile.`
        : `You are Jonathan, Nivra Telecom's virtual assistant. You are professional, friendly, and efficient.
          The user is logged in. Here's their data:
          - Name: ${profile?.full_name || "Not specified"}
          - Recent orders: ${orders?.length || 0}
          - Upcoming appointments: ${appointments?.length || 0}
          
          You can help them with:
          - Order tracking (status, details)
          - Appointment information
          - Questions about plans and services
          - Creating a support ticket if needed
          
          Respond concisely and helpfully.`;
    } else {
      systemPrompt = language === "fr"
        ? `Tu es Jonathan, l'assistant virtuel de Nivra Télécom. Tu es professionnel, amical et efficace.
          L'utilisateur n'est pas connecté. Tu peux UNIQUEMENT:
          - Répondre aux questions générales sur Nivra et ses services
          - Expliquer les plans (Mobile, Internet, TV, Streaming+)
          - Donner les coordonnées de contact
          - Suggérer de se connecter au portail pour accéder à ses données personnelles
          
          NE JAMAIS inventer de données personnelles. Réponds de façon concise.`
        : `You are Jonathan, Nivra Telecom's virtual assistant. You are professional, friendly, and efficient.
          The user is not logged in. You can ONLY:
          - Answer general questions about Nivra and its services
          - Explain plans (Mobile, Internet, TV, Streaming+)
          - Provide contact information
          - Suggest logging into the portal to access personal data
          
          NEVER invent personal data. Respond concisely.`;
    }

    // Call AI gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const botResponse = aiData.choices?.[0]?.message?.content || 
      (language === "fr" ? "Désolé, je n'ai pas pu traiter votre demande." : "Sorry, I couldn't process your request.");

    // Log the conversation
    await supabaseAdmin.from("chatbot_logs").insert({
      session_id: sessionId,
      user_id: userId || null,
      is_authenticated: isAuthenticated,
      user_message: message,
      bot_response: botResponse,
      intent_detected: null,
      entities_extracted: contextData,
      actions_taken: [],
    });

    return new Response(
      JSON.stringify({ response: botResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
