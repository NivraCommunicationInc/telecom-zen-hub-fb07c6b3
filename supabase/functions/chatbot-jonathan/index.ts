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
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ======================== TOOL DEFINITIONS ========================
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_order_details",
      description: "Récupère les détails d'une commande spécifique par numéro ou liste les commandes récentes du client",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string", description: "Numéro de commande (ex: ORD-XXXX). Optionnel." },
          list_recent: { type: "boolean", description: "Si true, liste les 5 dernières commandes" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_appointments",
      description: "Récupère les rendez-vous du client (à venir ou passés)",
      parameters: {
        type: "object",
        properties: {
          include_past: { type: "boolean", description: "Inclure les rendez-vous passés" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Reprogramme un rendez-vous à une nouvelle date. Le client doit confirmer.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string", description: "ID du rendez-vous" },
          new_date: { type: "string", description: "Nouvelle date au format YYYY-MM-DD" },
          new_time: { type: "string", description: "Nouvelle heure au format HH:MM" }
        },
        required: ["appointment_id", "new_date", "new_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_invoices",
      description: "Récupère les factures du client avec statut de paiement",
      parameters: {
        type: "object",
        properties: {
          status_filter: { type: "string", enum: ["all", "pending", "paid", "overdue"], description: "Filtrer par statut" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_invoice_download_link",
      description: "Génère un lien pour télécharger une facture PDF",
      parameters: {
        type: "object",
        properties: {
          invoice_number: { type: "string", description: "Numéro de facture (ex: INV-XXXX)" }
        },
        required: ["invoice_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_tickets",
      description: "Récupère les tickets de support du client",
      parameters: {
        type: "object",
        properties: {
          status_filter: { type: "string", enum: ["all", "open", "closed", "in_progress"], description: "Filtrer par statut" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Crée un nouveau ticket de support pour le client",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Sujet du ticket" },
          description: { type: "string", description: "Description détaillée du problème" },
          category: { 
            type: "string", 
            enum: ["billing", "technical", "equipment_issue", "sim_issue", "general"],
            description: "Catégorie du problème"
          },
          priority: { type: "string", enum: ["normal", "high", "urgent"], description: "Priorité" }
        },
        required: ["subject", "description", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_contact_form",
      description: "Soumet un formulaire de contact pour les visiteurs non-connectés",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom complet" },
          email: { type: "string", description: "Adresse email" },
          phone: { type: "string", description: "Numéro de téléphone" },
          subject: { type: "string", description: "Sujet de la demande" },
          message: { type: "string", description: "Message détaillé" }
        },
        required: ["name", "email", "phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_influencer_info",
      description: "Fournit des informations sur le programme d'influenceurs/partenaires Nivra",
      parameters: {
        type: "object",
        properties: {
          info_type: { 
            type: "string", 
            enum: ["general", "commission", "apply", "requirements"],
            description: "Type d'information demandée"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_service_info",
      description: "Fournit des informations sur les services Nivra (Mobile, Internet, TV, Streaming)",
      parameters: {
        type: "object",
        properties: {
          service_type: { 
            type: "string", 
            enum: ["mobile", "internet", "tv", "streaming", "all"],
            description: "Type de service"
          }
        },
        required: []
      }
    }
  }
];

// ======================== TOOL HANDLERS ========================
async function handleToolCall(
  toolName: string, 
  args: Record<string, any>, 
  supabase: any,
  userId: string | null,
  language: string
): Promise<string> {
  const fr = language === "fr";
  
  try {
    switch (toolName) {
      case "get_order_details": {
        if (!userId) return fr ? "Vous devez être connecté pour voir vos commandes." : "You must be logged in to view your orders.";
        
        if (args.order_number) {
          const { data: order, error } = await supabase
            .from("orders")
            .select("*")
            .eq("user_id", userId)
            .eq("order_number", args.order_number as string)
            .single();
          
          if (error || !order) return fr ? `Commande ${args.order_number} non trouvée.` : `Order ${args.order_number} not found.`;
          
          const o = order as any;
          return JSON.stringify({
            order_number: o.order_number,
            status: o.status,
            service_type: o.service_type,
            total: o.total_amount,
            created_at: o.created_at,
            delivery_method: o.delivery_method,
            tracking_number: o.tracking_number
          });
        }
        
        const { data: orders } = await supabase
          .from("orders")
          .select("order_number, status, service_type, total_amount, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);
        
        if (!orders?.length) return fr ? "Aucune commande trouvée." : "No orders found.";
        return JSON.stringify(orders);
      }
      
      case "get_appointments": {
        if (!userId) return fr ? "Vous devez être connecté pour voir vos rendez-vous." : "You must be logged in to view your appointments.";
        
        let query = supabase
          .from("appointments")
          .select("id, title, scheduled_at, status, service_type, service_address")
          .eq("client_id", userId)
          .order("scheduled_at", { ascending: true });
        
        if (!args.include_past) {
          query = query.gte("scheduled_at", new Date().toISOString());
        }
        
        const { data: appointments } = await query.limit(10);
        
        if (!appointments?.length) return fr ? "Aucun rendez-vous trouvé." : "No appointments found.";
        return JSON.stringify(appointments);
      }
      
      case "reschedule_appointment": {
        if (!userId) return fr ? "Vous devez être connecté pour modifier vos rendez-vous." : "You must be logged in to reschedule.";
        
        const { data: apt } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", args.appointment_id as string)
          .eq("client_id", userId)
          .single();
        
        if (!apt) return fr ? "Rendez-vous non trouvé." : "Appointment not found.";
        
        // Check if more than 24h away
        const aptData = apt as any;
        const scheduledDate = new Date(aptData.scheduled_at);
        const hoursUntil = (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60);
        
        if (hoursUntil < 24) {
          return fr 
            ? "Impossible de modifier un rendez-vous moins de 24h à l'avance. Veuillez nous appeler au 1-888-NIVRA." 
            : "Cannot reschedule less than 24h before. Please call 1-888-NIVRA.";
        }
        
        const newDateTime = new Date(`${args.new_date}T${args.new_time}:00`);
        
        const { error } = await supabase
          .from("appointments")
          .update({ 
            scheduled_at: newDateTime.toISOString(),
            status: "rescheduled"
          } as any)
          .eq("id", args.appointment_id as string);
        
        if (error) throw error;
        
        return fr 
          ? `Rendez-vous reprogrammé au ${args.new_date} à ${args.new_time}. Vous recevrez une confirmation par email.`
          : `Appointment rescheduled to ${args.new_date} at ${args.new_time}. You will receive a confirmation email.`;
      }
      
      case "get_invoices": {
        if (!userId) return fr ? "Vous devez être connecté pour voir vos factures." : "You must be logged in to view invoices.";
        
        let query = supabase
          .from("billing")
          .select("invoice_number, amount, status, due_date, paid_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.status_filter && args.status_filter !== "all") {
          query = query.eq("status", args.status_filter);
        }
        
        const { data: invoices } = await query.limit(10);
        
        if (!invoices?.length) return fr ? "Aucune facture trouvée." : "No invoices found.";
        return JSON.stringify(invoices);
      }
      
      case "get_invoice_download_link": {
        if (!userId) return fr ? "Vous devez être connecté." : "You must be logged in.";
        
        const { data: invoice } = await supabase
          .from("billing")
          .select("id, invoice_number")
          .eq("user_id", userId)
          .eq("invoice_number", args.invoice_number as string)
          .single();
        
        if (!invoice) return fr ? "Facture non trouvée." : "Invoice not found.";
        
        // Return link to download page
        return fr
          ? `Vous pouvez télécharger votre facture ${args.invoice_number} depuis votre espace client: /client/invoices`
          : `You can download invoice ${args.invoice_number} from your client portal: /client/invoices`;
      }
      
      case "get_tickets": {
        if (!userId) return fr ? "Vous devez être connecté pour voir vos tickets." : "You must be logged in to view tickets.";
        
        let query = supabase
          .from("support_tickets")
          .select("ticket_number, subject, status, priority, category, created_at, updated_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        
        if (args.status_filter && args.status_filter !== "all") {
          query = query.eq("status", args.status_filter);
        }
        
        const { data: tickets } = await query.limit(10);
        
        if (!tickets?.length) return fr ? "Aucun ticket trouvé." : "No tickets found.";
        return JSON.stringify(tickets);
      }
      
      case "create_support_ticket": {
        if (!userId) {
          return fr 
            ? "Vous devez être connecté pour créer un ticket. Utilisez plutôt le formulaire de contact."
            : "You must be logged in to create a ticket. Use the contact form instead.";
        }
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", userId)
          .single();
        
        const profileData = profile as any;
        
        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .insert({
            user_id: userId,
            owner_user_id: userId,
            client_email: profileData?.email,
            subject: args.subject as string,
            description: args.description as string,
            category: args.category as string,
            priority: (args.priority as string) || "normal",
            status: "open"
          } as any)
          .select("ticket_number")
          .single();
        
        if (error) throw error;
        
        const ticketData = ticket as any;
        return fr 
          ? `Ticket créé avec succès! Numéro: ${ticketData.ticket_number}. Notre équipe vous répondra sous 24-48h.`
          : `Ticket created successfully! Number: ${ticketData.ticket_number}. Our team will respond within 24-48h.`;
      }
      
      case "submit_contact_form": {
        const { error } = await supabase
          .from("contact_requests")
          .insert({
            name: args.name as string,
            email: args.email as string,
            phone: args.phone as string,
            subject: (args.subject as string) || "Demande via chatbot",
            notes: args.message as string,
            source: "chatbot",
            status: "pending"
          } as any);
        
        if (error) throw error;
        
        return fr 
          ? "Votre demande a été envoyée! Notre équipe vous contactera dans les plus brefs délais."
          : "Your request has been sent! Our team will contact you shortly.";
      }
      
      case "get_influencer_info": {
        const infoType = args.info_type || "general";
        
        const info = {
          general: fr 
            ? "Le programme Partenaires Nivra vous permet de gagner des commissions en référant de nouveaux clients. Vous recevez une rémunération pour chaque client activé avec votre code promo."
            : "The Nivra Partners program lets you earn commissions by referring new customers. You receive payment for each activated customer with your promo code.",
          commission: fr
            ? "Structure de commission: montant fixe par activation réussie. Les commissions sont versées mensuellement via virement Interac ou PayPal."
            : "Commission structure: fixed amount per successful activation. Commissions are paid monthly via Interac or PayPal.",
          apply: fr
            ? "Pour devenir partenaire Nivra, envoyez un email à partenaires@nivra.ca avec vos coordonnées et votre plateforme (Instagram, YouTube, TikTok, etc.)."
            : "To become a Nivra partner, send an email to partners@nivra.ca with your contact info and platform (Instagram, YouTube, TikTok, etc.).",
          requirements: fr
            ? "Critères: présence active sur les réseaux sociaux, audience québécoise, contenu en lien avec la tech/télécom ou lifestyle."
            : "Requirements: active social media presence, Quebec audience, content related to tech/telecom or lifestyle."
        };
        
        return info[infoType as keyof typeof info] || info.general;
      }
      
      case "get_service_info": {
        const serviceType = args.service_type || "all";
        
        const services = {
          mobile: fr
            ? "📱 Mobile Nivra: Forfaits prépayés flexibles. Pas de contrat, pas de surprise. Réseau national 5G/LTE. Plans à partir de 15$/mois."
            : "📱 Nivra Mobile: Flexible prepaid plans. No contract, no surprises. National 5G/LTE network. Plans from $15/month.",
          internet: fr
            ? "🌐 Internet Nivra: Internet haute vitesse résidentiel. Installation rapide par technicien. Vitesses jusqu'à 1 Gbps selon disponibilité."
            : "🌐 Nivra Internet: High-speed residential internet. Quick technician installation. Speeds up to 1 Gbps where available.",
          tv: fr
            ? "📺 TV Nivra: IPTV avec 100+ chaînes. Chaînes locales et internationales. Compatible avec votre téléviseur intelligent."
            : "📺 Nivra TV: IPTV with 100+ channels. Local and international channels. Compatible with your smart TV.",
          streaming: fr
            ? "🎬 Streaming+ Nivra: Accès aux plateformes de streaming populaires à prix réduit via votre abonnement Nivra."
            : "🎬 Nivra Streaming+: Access to popular streaming platforms at reduced prices through your Nivra subscription."
        };
        
        if (serviceType === "all") {
          return Object.values(services).join("\n\n");
        }
        
        return services[serviceType as keyof typeof services] || services.mobile;
      }
      
      default:
        return fr ? "Action non reconnue." : "Unknown action.";
    }
  } catch (error) {
    console.error(`[Chatbot] Tool ${toolName} error:`, error);
    return fr ? "Une erreur s'est produite. Veuillez réessayer." : "An error occurred. Please try again.";
  }
}

// ======================== MAIN HANDLER ========================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const { message, sessionId, language = "fr", conversationHistory = [] } = await req.json() as ChatRequest;

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

    // Server-side authentication
    let authenticatedUserId: string | null = null;
    let isAuthenticated = false;
    let userProfile: { full_name?: string; email?: string } | null = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (!authError && user) {
        authenticatedUserId = user.id;
        isAuthenticated = true;
        
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .single();
        
        userProfile = profile;
      }
    }

    // Rate limiting
    const rateLimitKey = isAuthenticated 
      ? `chatbot:user:${authenticatedUserId}` 
      : `chatbot:ip:${clientIP}`;
    
    const rateCheck = await checkRateLimit({
      key: rateLimitKey,
      maxAttempts: 30,
      windowMs: 60 * 1000,
      lockoutMs: 5 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, language);
    }

    // Build system prompt
    const fr = language === "fr";
    const systemPrompt = fr
      ? `Tu es Nivra, l'assistant virtuel intelligent de Nivra Télécom, une entreprise de télécommunications prépayées au Québec.

${isAuthenticated ? `L'utilisateur est connecté: ${userProfile?.full_name || "Client"}.` : "L'utilisateur n'est PAS connecté."}

TU DISPOSES D'OUTILS POUR AIDER LES CLIENTS:
- get_order_details: Voir les commandes
- get_appointments: Voir les rendez-vous
- reschedule_appointment: Reprogrammer un RDV (24h minimum avant)
- get_invoices: Voir les factures
- get_invoice_download_link: Télécharger une facture
- get_tickets: Voir les tickets support
- create_support_ticket: Créer un ticket
- submit_contact_form: Formulaire contact (non-connectés)
- get_influencer_info: Programme partenaires
- get_service_info: Info sur nos services

RÈGLES:
1. Utilise les outils quand pertinent - ne devine JAMAIS les données
2. Sois professionnel, concis et empathique
3. Pour les non-connectés, suggère de se connecter ou utilise le formulaire contact
4. Ne révèle jamais de données techniques (IDs, erreurs internes)
5. Si tu ne peux pas aider, dirige vers support@nivra.ca ou 1-888-NIVRA`
      : `You are Nivra, the intelligent virtual assistant for Nivra Telecom, a prepaid telecom company in Quebec.

${isAuthenticated ? `User is logged in: ${userProfile?.full_name || "Customer"}.` : "User is NOT logged in."}

YOU HAVE TOOLS TO HELP CUSTOMERS:
- get_order_details: View orders
- get_appointments: View appointments
- reschedule_appointment: Reschedule appointment (24h minimum notice)
- get_invoices: View invoices
- get_invoice_download_link: Download invoice
- get_tickets: View support tickets
- create_support_ticket: Create ticket
- submit_contact_form: Contact form (non-logged users)
- get_influencer_info: Partner program info
- get_service_info: Service info

RULES:
1. Use tools when relevant - NEVER guess data
2. Be professional, concise and empathetic
3. For non-logged users, suggest login or use contact form
4. Never reveal technical data (IDs, internal errors)
5. If you can't help, direct to support@nivra.ca or 1-888-NIVRA`;

    // Build messages with conversation history
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message }
    ];

    // First AI call with tools
    let aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: isAuthenticated ? TOOLS : TOOLS.filter(t => 
          ["submit_contact_form", "get_influencer_info", "get_service_info"].includes(t.function.name)
        ),
        tool_choice: "auto",
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: fr ? "Trop de requêtes. Réessayez dans un moment." : "Too many requests. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    let aiData = await aiResponse.json();
    let responseMessage = aiData.choices?.[0]?.message;
    
    // Handle tool calls
    const toolCalls: ToolCall[] = responseMessage?.tool_calls || [];
    
    if (toolCalls.length > 0) {
      console.log("[Chatbot] Tool calls detected:", toolCalls.map(t => t.function.name));
      
      // Execute each tool
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const result = await handleToolCall(
          toolCall.function.name,
          args,
          supabaseAdmin,
          authenticatedUserId,
          language
        );
        
        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result
        });
        
        console.log(`[Chatbot] Tool ${toolCall.function.name} result:`, result.substring(0, 100));
      }
      
      // Second AI call with tool results
      const followUpMessages = [
        ...messages,
        responseMessage,
        ...toolResults
      ];
      
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: followUpMessages,
          max_tokens: 1000,
          temperature: 0.7,
        }),
      });
      
      if (!aiResponse.ok) {
        throw new Error(`AI follow-up error: ${aiResponse.status}`);
      }
      
      aiData = await aiResponse.json();
      responseMessage = aiData.choices?.[0]?.message;
    }

    const botResponse = responseMessage?.content || 
      (fr ? "Désolé, je n'ai pas pu traiter votre demande." : "Sorry, I couldn't process your request.");

    // Log without PII
    await supabaseAdmin.from("chatbot_logs").insert({
      session_id: sessionId,
      user_id: authenticatedUserId,
      is_authenticated: isAuthenticated,
      user_message: "[REDACTED]",
      bot_response: "[REDACTED]",
      message_length: message.length,
      response_length: botResponse.length,
      intent_detected: toolCalls.length > 0 ? toolCalls.map(t => t.function.name).join(",") : null,
      actions_taken: toolCalls.map(t => t.function.name),
    });

    console.log("[Chatbot] Response sent", { 
      sessionId, 
      isAuthenticated, 
      toolsUsed: toolCalls.map(t => t.function.name),
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
