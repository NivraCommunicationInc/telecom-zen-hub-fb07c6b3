import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  message: string;
  sessionId: string;
  language: "fr" | "en";
  // SECURITY: isAuthenticated and userId from client are IGNORED
  // Authentication is determined server-side from the Authorization header
}

function getClientIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         req.headers.get("cf-connecting-ip") || 
         "unknown";
}

// Simple SHA-256 hash for message deduplication (no PII stored)
async function hashMessage(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);

  try {
    const { message, sessionId, language = "fr" } = await req.json() as ChatRequest;

    // Validate inputs
    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(
        JSON.stringify({ error: "Invalid message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid sessionId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // SECURITY: Determine authentication from Authorization header, NOT from client body
    let authenticatedUserId: string | null = null;
    let isAuthenticated = false;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      
      // Verify the JWT token server-side
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (!authError && user) {
        authenticatedUserId = user.id;
        isAuthenticated = true;
        console.log("[Chatbot] Authenticated user verified");
      } else {
        console.log("[Chatbot] Invalid or expired token");
      }
    }

    // PRODUCTION RATE LIMITING using database-backed module
    const rateLimitKey = isAuthenticated 
      ? `chatbot:user:${authenticatedUserId}` 
      : `chatbot:ip:${clientIP}`;
    
    // 20 requests per minute, with 5 minute lockout on abuse
    const rateCheck = await checkRateLimit({
      key: rateLimitKey,
      maxAttempts: 20,
      windowMs: 60 * 1000, // 1 minute
      lockoutMs: 5 * 60 * 1000, // 5 minute lockout on abuse
    });

    // Log rate limit check (no PII)
    console.log("[Chatbot] Rate limit check:", {
      rateLimitKey: rateLimitKey.includes("user:") ? "chatbot:user:***" : rateLimitKey,
      allowed: rateCheck.allowed,
      remaining: rateCheck.remaining,
      retryAfter: rateCheck.retryAfter || null,
      isLocked: rateCheck.isLocked || false,
    });

    if (!rateCheck.allowed) {
      console.log("[Chatbot] Rate limit exceeded for key (masked)");
      return rateLimitResponse(rateCheck, corsHeaders, language);
    }

    let contextData: Record<string, unknown> = {};
    let systemPrompt = "";

    // Build context based on VERIFIED server-side authentication
    if (isAuthenticated && authenticatedUserId) {
      // Fetch user's orders
      const { data: orders } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, status, service_type, created_at, total_amount")
        .eq("user_id", authenticatedUserId)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user's appointments
      const { data: appointments } = await supabaseAdmin
        .from("appointments")
        .select("id, title, scheduled_at, status, service_type")
        .eq("client_id", authenticatedUserId)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3);

      // Fetch user's profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", authenticatedUserId)
        .single();

      // Store context without PII in logs
      contextData = { 
        ordersCount: orders?.length || 0, 
        appointmentsCount: appointments?.length || 0,
        hasProfile: !!profile
      };

      // System prompt with "Nivra" as the assistant name
      systemPrompt = language === "fr"
        ? `Tu es Nivra, l'assistant virtuel de Nivra Télécom. Tu es professionnel, amical et efficace.
          L'utilisateur est connecté et vérifié. Voici ses données:
          - Nom: ${profile?.full_name || "Non spécifié"}
          - Commandes récentes: ${orders?.length || 0}
          - Prochains rendez-vous: ${appointments?.length || 0}
          
          Tu peux l'aider avec:
          - Suivi de commande (statut, détails)
          - Informations sur ses rendez-vous
          - Questions sur les plans et services
          - Création de ticket support si nécessaire
          
          Réponds de façon concise et professionnelle.
          Ne jamais inventer de données personnelles.`
        : `You are Nivra, Nivra Telecom's virtual assistant. You are professional, friendly, and efficient.
          The user is logged in and verified. Here's their data:
          - Name: ${profile?.full_name || "Not specified"}
          - Recent orders: ${orders?.length || 0}
          - Upcoming appointments: ${appointments?.length || 0}
          
          You can help them with:
          - Order tracking (status, details)
          - Appointment information
          - Questions about plans and services
          - Creating a support ticket if needed
          
          Respond concisely and professionally.
          Never invent personal data.`;
    } else {
      // Public mode - no user data
      systemPrompt = language === "fr"
        ? `Tu es Nivra, l'assistant virtuel de Nivra Télécom. Tu es professionnel, amical et efficace.
          L'utilisateur n'est pas connecté. Tu peux UNIQUEMENT:
          - Répondre aux questions générales sur Nivra et ses services
          - Expliquer les plans (Mobile, Internet, TV, Streaming+)
          - Donner les coordonnées de contact
          - Suggérer de se connecter au portail pour accéder à ses données personnelles
          
          Réponds de façon concise et professionnelle.
          Ne jamais inventer de données personnelles.`
        : `You are Nivra, Nivra Telecom's virtual assistant. You are professional, friendly, and efficient.
          The user is not logged in. You can ONLY:
          - Answer general questions about Nivra and its services
          - Explain plans (Mobile, Internet, TV, Streaming+)
          - Provide contact information
          - Suggest logging into the portal to access personal data
          
          Respond concisely and professionally.
          Never invent personal data.`;
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
      const errorText = await aiResponse.text();
      console.error("[Chatbot] AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const botResponse = aiData.choices?.[0]?.message?.content || 
      (language === "fr" ? "Désolé, je n'ai pas pu traiter votre demande." : "Sorry, I couldn't process your request.");

    // SECURITY: Log WITHOUT any PII in clear text
    // Only store: session_id, user_id (if auth), lengths, hash, and metadata
    const messageHash = await hashMessage(message);
    
    await supabaseAdmin.from("chatbot_logs").insert({
      session_id: sessionId,
      user_id: authenticatedUserId, // Server-verified user ID only
      is_authenticated: isAuthenticated,
      user_message: "[REDACTED]", // Never store message content
      bot_response: "[REDACTED]", // Never store response content
      message_length: message.length,
      response_length: botResponse.length,
      message_hash: messageHash, // For deduplication only
      intent_detected: null,
      entities_extracted: contextData, // Only counts, no PII
      actions_taken: [],
    });

    console.log("[Chatbot] Response sent", { 
      sessionId, 
      isAuthenticated, 
      messageLength: message.length,
      responseLength: botResponse.length
    });

    return new Response(
      JSON.stringify({ response: botResponse }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Chatbot] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
