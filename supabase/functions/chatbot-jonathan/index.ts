import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
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
  verifiedClientId?: string;
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
  // --- SALES TOOLS (PUBLIC) ---
  {
    type: "function",
    function: {
      name: "get_available_plans",
      description: "Récupère les forfaits disponibles par catégorie (internet, mobile, tv, streaming, bundle)",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["internet", "mobile", "tv", "streaming", "bundle", "all"], description: "Catégorie de service" },
          budget_max: { type: "number", description: "Budget maximum mensuel du client" },
          needs: { type: "string", description: "Besoins détectés: gaming, teletravail, famille, streaming, basique" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_plan",
      description: "Recommande le meilleur forfait basé sur les besoins du prospect après qualification",
      parameters: {
        type: "object",
        properties: {
          household_size: { type: "number", description: "Nombre de personnes au foyer" },
          usage_type: { type: "string", enum: ["light", "standard", "heavy", "gaming", "teletravail"], description: "Type d'usage principal" },
          current_provider: { type: "string", description: "Fournisseur actuel si mentionné" },
          current_monthly_cost: { type: "number", description: "Facture mensuelle actuelle si mentionnée" },
          services_wanted: { type: "array", items: { type: "string" }, description: "Services souhaités: internet, mobile, tv, streaming" },
          budget_max: { type: "number", description: "Budget maximum" }
        },
        required: ["usage_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_sales_lead",
      description: "Crée un lead de vente quand un prospect est qualifié et intéressé",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom du prospect" },
          email: { type: "string", description: "Email du prospect" },
          phone: { type: "string", description: "Téléphone du prospect" },
          service_interest: { type: "string", description: "Service qui intéresse le prospect" },
          notes: { type: "string", description: "Notes de qualification" },
          source: { type: "string", description: "Source: chatbot_sale" }
        },
        required: ["name", "email", "service_interest"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_service_info",
      description: "Fournit des informations détaillées sur les services Nivra (Mobile, Internet, TV, Streaming+)",
      parameters: {
        type: "object",
        properties: {
          service_type: { type: "string", enum: ["mobile", "internet", "tv", "streaming", "all"], description: "Type de service" }
        },
        required: []
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
          info_type: { type: "string", enum: ["general", "commission", "apply", "requirements"], description: "Type d'information demandée" }
        },
        required: []
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
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          subject: { type: "string" },
          message: { type: "string" }
        },
        required: ["name", "email", "phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_callback",
      description: "Planifie un rappel téléphonique avec un agent Nivra pour le prospect",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nom du prospect" },
          phone: { type: "string", description: "Numéro pour le rappel" },
          preferred_time: { type: "string", description: "Moment préféré: morning, afternoon, evening" },
          reason: { type: "string", description: "Raison du rappel" }
        },
        required: ["name", "phone"]
      }
    }
  },
  // --- AUTHENTICATED TOOLS ---
  {
    type: "function",
    function: {
      name: "verify_client_identity",
      description: "Vérifie l'identité d'un client non-connecté via questions de sécurité (email + date naissance + 4 derniers chiffres téléphone)",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string" },
          date_of_birth: { type: "string", description: "Format YYYY-MM-DD" },
          phone_last_4: { type: "string" }
        },
        required: ["email", "date_of_birth", "phone_last_4"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_details",
      description: "Récupère les détails d'une commande ou liste les commandes récentes du client",
      parameters: {
        type: "object",
        properties: {
          order_number: { type: "string" },
          list_recent: { type: "boolean" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_appointments",
      description: "Récupère les rendez-vous du client",
      parameters: {
        type: "object",
        properties: {
          include_past: { type: "boolean" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Reprogramme un rendez-vous à une nouvelle date",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_date: { type: "string" },
          new_time: { type: "string" }
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
          status_filter: { type: "string", enum: ["all", "pending", "paid", "overdue"] }
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
          invoice_number: { type: "string" }
        },
        required: ["invoice_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Récupère le solde du compte client (montant dû, crédit disponible, dernier paiement)",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_active_services",
      description: "Récupère les services actifs du client pour détecter des opportunités d'upsell",
      parameters: {
        type: "object",
        properties: {},
        required: []
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
          status_filter: { type: "string", enum: ["all", "open", "closed", "in_progress"] }
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
          subject: { type: "string" },
          description: { type: "string" },
          category: { type: "string", enum: ["billing", "technical", "equipment_issue", "sim_issue", "general"] },
          priority: { type: "string", enum: ["normal", "high", "urgent"] }
        },
        required: ["subject", "description", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "handoff_to_agent",
      description: "Transfère la conversation à un agent humain quand le bot ne peut pas résoudre le problème",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Raison de l'escalade" },
          summary: { type: "string", description: "Résumé de la conversation" },
          urgency: { type: "string", enum: ["normal", "high", "critical"] }
        },
        required: ["reason", "summary"]
      }
    }
  }
];

// Tools available without authentication
const PUBLIC_TOOLS = [
  "get_available_plans", "recommend_plan", "create_sales_lead",
  "get_service_info", "get_influencer_info", "submit_contact_form",
  "book_callback", "verify_client_identity", "handoff_to_agent"
];

// ======================== NIVRA PRODUCT CATALOG ========================
const NIVRA_CATALOG = {
  internet: [
    { name: "Internet Essentiel", speed: "75 Mbps", price: 45, features: ["Wi-Fi inclus", "Installation gratuite", "Sans contrat"], best_for: "Usage léger, 1-2 personnes" },
    { name: "Internet Plus", speed: "150 Mbps", price: 55, features: ["Wi-Fi 6 inclus", "Installation gratuite", "Sans contrat"], best_for: "Famille standard, streaming HD" },
    { name: "Internet Ultra", speed: "300 Mbps", price: 65, features: ["Wi-Fi 6 inclus", "Installation gratuite", "Sans contrat", "Priorité support"], best_for: "Télétravail, gaming, 3+ personnes" },
    { name: "Internet Giga", speed: "1 Gbps", price: 85, features: ["Wi-Fi 6E inclus", "Installation gratuite", "Sans contrat", "Priorité support"], best_for: "Usage intensif, grosse famille, streaming 4K" },
  ],
  mobile: [
    { name: "Mobile Léger", data: "2 Go", price: 15, features: ["Appels illimités Canada", "Textos illimités", "Sans contrat"], best_for: "Usage minimal" },
    { name: "Mobile Standard", data: "6 Go", price: 25, features: ["Appels illimités Canada", "Textos illimités", "Sans contrat"], best_for: "Usage quotidien" },
    { name: "Mobile Plus", data: "15 Go", price: 35, features: ["Appels illimités Canada/US", "Textos illimités", "Sans contrat", "Hotspot inclus"], best_for: "Usage modéré à élevé" },
    { name: "Mobile Max", data: "25 Go", price: 45, features: ["Appels illimités Canada/US", "Textos illimités", "Sans contrat", "Hotspot inclus", "5G"], best_for: "Gros consommateur de données" },
  ],
  tv: [
    { name: "TV Essentiel", channels: "50+", price: 20, features: ["Chaînes locales", "Replay 7 jours", "App mobile"], best_for: "Nouvelles et divertissement de base" },
    { name: "TV Plus", channels: "100+", price: 35, features: ["Sports inclus", "Replay 14 jours", "2 écrans simultanés"], best_for: "Sports et variété" },
    { name: "TV Premium", channels: "200+", price: 50, features: ["Tout inclus", "4K disponible", "4 écrans simultanés", "Films récents"], best_for: "Cinéphiles et familles" },
  ],
  streaming: [
    { name: "Streaming+", price: 10, features: ["Accès Netflix, Disney+, Crave à prix réduit", "Un seul compte, toutes les plateformes"], best_for: "Amateurs de streaming" },
  ],
  bundles: [
    { name: "Duo Internet + Mobile", discount: "10$/mois", base_price: "à partir de 55$", features: ["Internet + Mobile combinés", "Facture unique", "Économie garantie"] },
    { name: "Trio Complet", discount: "20$/mois", base_price: "à partir de 85$", features: ["Internet + Mobile + TV", "Facture unique", "Meilleur rapport qualité-prix"] },
    { name: "Pack Famille", discount: "30$/mois", base_price: "à partir de 110$", features: ["Internet Ultra + 2 lignes mobiles + TV", "Facture unique", "Le plus populaire"] },
  ]
};

// ======================== TOOL HANDLERS ========================
async function handleToolCall(
  toolName: string,
  args: Record<string, any>,
  supabase: any,
  userId: string | null,
  verifiedClientId: string | null,
  language: string
): Promise<{ result: string; verifiedClientId?: string }> {
  const fr = language === "fr";
  const effectiveUserId = userId || verifiedClientId;

  try {
    switch (toolName) {
      // ---- SALES TOOLS ----
      case "get_available_plans": {
        const category = args.category || "all";
        const budget = args.budget_max;
        let plans: any[] = [];

        if (category === "all") {
          plans = [...NIVRA_CATALOG.internet, ...NIVRA_CATALOG.mobile, ...NIVRA_CATALOG.tv, ...NIVRA_CATALOG.streaming];
        } else if (category === "bundle") {
          return { result: JSON.stringify({ bundles: NIVRA_CATALOG.bundles }) };
        } else {
          plans = NIVRA_CATALOG[category as keyof typeof NIVRA_CATALOG] || [];
        }

        if (budget) {
          plans = (plans as any[]).filter((p: any) => p.price <= budget);
        }

        return { result: JSON.stringify({ plans, bundles_available: true, bundle_savings: "Jusqu'à 30$/mois avec un regroupement" }) };
      }

      case "recommend_plan": {
        const { household_size = 2, usage_type, current_monthly_cost, services_wanted = ["internet"] } = args;
        let recommendation: any = {};

        // Internet recommendation
        if (services_wanted.includes("internet") || services_wanted.length === 0) {
          if (usage_type === "gaming" || usage_type === "teletravail" || household_size >= 4) {
            recommendation.internet = NIVRA_CATALOG.internet[2]; // Ultra 300
          } else if (usage_type === "heavy" || household_size >= 3) {
            recommendation.internet = NIVRA_CATALOG.internet[1]; // Plus 150
          } else {
            recommendation.internet = NIVRA_CATALOG.internet[0]; // Essentiel 75
          }
        }

        // Mobile recommendation
        if (services_wanted.includes("mobile")) {
          if (usage_type === "heavy" || usage_type === "gaming") {
            recommendation.mobile = NIVRA_CATALOG.mobile[3]; // Max 25Go
          } else if (usage_type === "standard" || usage_type === "teletravail") {
            recommendation.mobile = NIVRA_CATALOG.mobile[2]; // Plus 15Go
          } else {
            recommendation.mobile = NIVRA_CATALOG.mobile[1]; // Standard 6Go
          }
        }

        // Calculate total and savings
        let totalPrice = 0;
        Object.values(recommendation).forEach((plan: any) => { totalPrice += plan.price; });

        // Bundle discount
        const serviceCount = Object.keys(recommendation).length;
        let bundleDiscount = 0;
        if (serviceCount >= 3) bundleDiscount = 20;
        else if (serviceCount >= 2) bundleDiscount = 10;

        const finalPrice = totalPrice - bundleDiscount;
        let savingsMessage = "";
        if (current_monthly_cost && current_monthly_cost > finalPrice) {
          savingsMessage = fr
            ? `Économie potentielle: ${(current_monthly_cost - finalPrice).toFixed(0)}$/mois vs votre facture actuelle!`
            : `Potential savings: $${(current_monthly_cost - finalPrice).toFixed(0)}/month vs your current bill!`;
        }

        return {
          result: JSON.stringify({
            recommendation,
            total_before_discount: totalPrice,
            bundle_discount: bundleDiscount,
            final_monthly_price: finalPrice,
            savings: savingsMessage,
            bundle_applied: serviceCount >= 2,
            cta: fr ? "Prêt à s'abonner? Je peux créer votre dossier maintenant." : "Ready to subscribe? I can create your file now."
          })
        };
      }

      case "create_sales_lead": {
        const { error } = await supabase
          .from("contact_requests")
          .insert({
            name: args.name,
            email: args.email,
            phone: args.phone || null,
            subject: `Lead vente: ${args.service_interest}`,
            notes: `Source: Chatbot Nivra AI\nService: ${args.service_interest}\n${args.notes || ""}`,
            source: "chatbot_sale",
            status: "pending"
          } as any);

        if (error) throw error;

        return {
          result: fr
            ? `✅ Votre demande a été enregistrée! Un conseiller Nivra vous contactera très bientôt pour finaliser votre abonnement ${args.service_interest}. Merci de nous faire confiance!`
            : `✅ Your request has been registered! A Nivra advisor will contact you very soon to finalize your ${args.service_interest} subscription. Thank you for trusting us!`
        };
      }

      case "book_callback": {
        const timeLabels: Record<string, string> = { morning: "matin (9h-12h)", afternoon: "après-midi (12h-17h)", evening: "soir (17h-20h)" };
        const preferredLabel = timeLabels[args.preferred_time] || args.preferred_time || "dès que possible";

        const { error } = await supabase
          .from("contact_requests")
          .insert({
            name: args.name,
            phone: args.phone,
            subject: "Demande de rappel - Chatbot",
            notes: `Rappel demandé: ${preferredLabel}\nRaison: ${args.reason || "Intéressé par les services Nivra"}`,
            source: "chatbot_callback",
            status: "pending"
          } as any);

        if (error) throw error;

        return {
          result: fr
            ? `📞 Parfait! Un conseiller vous rappellera au ${args.phone} (${preferredLabel}). Nous avons hâte de vous parler!`
            : `📞 Perfect! An advisor will call you back at ${args.phone} (${preferredLabel}). We look forward to speaking with you!`
        };
      }

      case "handoff_to_agent": {
        const { error } = await supabase
          .from("contact_requests")
          .insert({
            name: "Escalade chatbot",
            subject: `Escalade: ${args.reason}`,
            notes: `Résumé: ${args.summary}\nUrgence: ${args.urgency || "normal"}`,
            source: "chatbot_escalation",
            status: "pending"
          } as any);

        return {
          result: fr
            ? `🤝 Je comprends. Je transfère votre dossier à un agent spécialisé.\n\nVous pouvez aussi nous joindre:\n📧 support@nivra-telecom.ca\n📞 1-888-NIVRA\n\nUn agent vous contactera sous peu.`
            : `🤝 I understand. I'm transferring your case to a specialized agent.\n\nYou can also reach us:\n📧 support@nivra-telecom.ca\n📞 1-888-NIVRA\n\nAn agent will contact you shortly.`
        };
      }

      // ---- EXISTING TOOLS (unchanged logic) ----
      case "verify_client_identity": {
        const { email, date_of_birth, phone_last_4 } = args;

        if (!email || !date_of_birth || !phone_last_4) {
          return {
            result: fr
              ? "Pour vérifier votre identité, j'ai besoin de votre email, date de naissance et les 4 derniers chiffres de votre téléphone."
              : "To verify your identity, I need your email, date of birth and last 4 digits of your phone number."
          };
        }

        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, date_of_birth")
          .ilike("email", email.toLowerCase().trim());

        if (error || !profiles?.length) {
          return {
            result: fr
              ? "❌ Vérification échouée. Les informations ne correspondent à aucun compte."
              : "❌ Verification failed. Information doesn't match any account."
          };
        }

        for (const profile of profiles) {
          const p = profile as any;
          if (p.date_of_birth?.substring(0, 10) !== date_of_birth) continue;
          const phoneDigits = (p.phone || "").replace(/\D/g, "");
          if (!phoneDigits.endsWith(phone_last_4)) continue;

          return {
            result: fr
              ? `✅ Identité vérifiée! Bonjour ${p.full_name?.split(" ")[0] || ""}. Je peux maintenant accéder à vos informations. Que souhaitez-vous savoir?`
              : `✅ Identity verified! Hello ${p.full_name?.split(" ")[0] || ""}. I can now access your information. What would you like to know?`,
            verifiedClientId: p.id
          };
        }

        return {
          result: fr
            ? "❌ Vérification échouée. Les informations ne correspondent pas."
            : "❌ Verification failed. Information doesn't match."
        };
      }

      case "get_order_details": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous ou vérifiez votre identité pour voir vos commandes." : "Log in or verify your identity to view your orders." };
        }

        if (args.order_number) {
          const { data: order } = await supabase
            .from("orders")
            .select("*")
            .eq("user_id", effectiveUserId)
            .eq("order_number", args.order_number)
            .single();

          if (!order) return { result: fr ? `Commande ${args.order_number} non trouvée.` : `Order ${args.order_number} not found.` };
          const o = order as any;
          return { result: JSON.stringify({ order_number: o.order_number, status: o.status, service_type: o.service_type, total: o.total_amount, created_at: o.created_at, delivery_method: o.delivery_method, tracking_number: o.tracking_number }) };
        }

        const { data: orders } = await supabase
          .from("orders")
          .select("order_number, status, service_type, total_amount, created_at")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!orders?.length) return { result: fr ? "Aucune commande trouvée." : "No orders found." };
        return { result: JSON.stringify(orders) };
      }

      case "get_appointments": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous pour voir vos rendez-vous." : "Log in to view your appointments." };
        }

        let query = supabase
          .from("appointments")
          .select("id, title, scheduled_at, status, service_type, service_address")
          .eq("client_id", effectiveUserId)
          .order("scheduled_at", { ascending: true });

        if (!args.include_past) {
          query = query.gte("scheduled_at", new Date().toISOString());
        }

        const { data: appointments } = await query.limit(10);
        if (!appointments?.length) return { result: fr ? "Aucun rendez-vous trouvé." : "No appointments found." };
        return { result: JSON.stringify(appointments) };
      }

      case "reschedule_appointment": {
        if (!effectiveUserId) {
          return { result: fr ? "Vous devez être connecté pour modifier un rendez-vous." : "You must be logged in to reschedule." };
        }

        const { data: apt } = await supabase
          .from("appointments")
          .select("*")
          .eq("id", args.appointment_id)
          .eq("client_id", effectiveUserId)
          .single();

        if (!apt) return { result: fr ? "Rendez-vous non trouvé." : "Appointment not found." };
        const aptData = apt as any;
        const hoursUntil = (new Date(aptData.scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 24) {
          return { result: fr ? "Impossible de modifier un rendez-vous moins de 24h à l'avance." : "Cannot reschedule less than 24h before." };
        }

        const newDateTime = new Date(`${args.new_date}T${args.new_time}:00`);
        await supabase.from("appointments").update({ scheduled_at: newDateTime.toISOString(), status: "rescheduled" } as any).eq("id", args.appointment_id);
        return { result: fr ? `Rendez-vous reprogrammé au ${args.new_date} à ${args.new_time}.` : `Appointment rescheduled to ${args.new_date} at ${args.new_time}.` };
      }

      case "get_invoices": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous pour voir vos factures." : "Log in to view your invoices." };
        }

        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).single();
        if (!customer) return { result: fr ? "Aucune facture trouvée." : "No invoices found." };

        let query = supabase
          .from("billing_invoices")
          .select("invoice_number, total, status, due_date, paid_at, created_at, balance_due")
          .eq("customer_id", (customer as any).id)
          .order("created_at", { ascending: false });

        if (args.status_filter && args.status_filter !== "all") {
          query = query.eq("status", args.status_filter);
        }

        const { data: invoices } = await query.limit(10);
        if (!invoices?.length) return { result: fr ? "Aucune facture trouvée." : "No invoices found." };
        return { result: JSON.stringify(invoices) };
      }

      case "get_invoice_download_link": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous pour télécharger une facture." : "Log in to download an invoice." };
        return { result: fr ? `Vous pouvez télécharger votre facture ${args.invoice_number} depuis votre espace client: /client/invoices` : `Download invoice ${args.invoice_number} from your client portal: /client/invoices` };
      }

      case "get_account_balance": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous pour voir votre solde." : "Log in to view your balance." };
        }

        // Get last payment
        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).maybeSingle();
        let lastPayment: any = null;
        if (customer) {
          const { data: payment } = await supabase
            .from("billing_payments")
            .select("amount, created_at, method, status")
            .eq("customer_id", (customer as any).id)
            .eq("status", "confirmed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          lastPayment = payment;
        }

        const { data: ledgerBalance, error: ledgerError } = await supabase
          .rpc("get_client_ledger_balance", { p_client_id: effectiveUserId });

        if (!ledgerError && ledgerBalance) {
          const b = ledgerBalance as any;
          const balance = b.balance || 0;
          let result = "";
          if (balance < 0) {
            result = fr
              ? `💳 **Solde à payer:** ${Math.abs(balance).toFixed(2)} $`
              : `💳 **Amount Due:** $${Math.abs(balance).toFixed(2)}`;
          } else if (balance > 0) {
            result = fr
              ? `✅ **Crédit disponible:** ${balance.toFixed(2)} $`
              : `✅ **Available Credit:** $${balance.toFixed(2)}`;
          } else {
            result = fr ? `✅ **Solde:** 0.00 $ — Votre compte est à jour.` : `✅ **Balance:** $0.00 — Account is up to date.`;
          }

          if (lastPayment) {
            const lpData = lastPayment as any;
            const pDate = new Date(lpData.created_at).toLocaleDateString(fr ? "fr-CA" : "en-CA");
            result += fr
              ? `\n\n💰 **Dernier paiement:** ${lpData.amount?.toFixed(2)} $ le ${pDate}`
              : `\n\n💰 **Last Payment:** $${lpData.amount?.toFixed(2)} on ${pDate}`;
          }

          return { result };
        }

        return { result: fr ? "Impossible de récupérer le solde." : "Unable to retrieve balance." };
      }

      case "get_active_services": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous pour voir vos services." : "Log in to view your services." };
        }

        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).maybeSingle();
        if (!customer) return { result: fr ? "Aucun service actif trouvé." : "No active services found." };

        const { data: subs } = await supabase
          .from("billing_subscriptions")
          .select("plan_name, plan_code, plan_price, status, service_category, cycle_start_date, cycle_end_date")
          .eq("customer_id", (customer as any).id)
          .in("status", ["active", "pending"])
          .limit(10);

        if (!subs?.length) return { result: fr ? "Aucun service actif." : "No active services." };

        // Detect upsell opportunities
        const categories = (subs as any[]).map((s: any) => s.service_category || s.plan_code?.split("_")[0]).filter(Boolean);
        const upsellOpportunities: string[] = [];

        if (!categories.includes("internet") && !categories.includes("INT")) {
          upsellOpportunities.push(fr ? "Internet résidentiel" : "Residential internet");
        }
        if (!categories.includes("mobile") && !categories.includes("MOB")) {
          upsellOpportunities.push(fr ? "Forfait mobile" : "Mobile plan");
        }
        if (!categories.includes("tv") && !categories.includes("TV")) {
          upsellOpportunities.push(fr ? "Télévision" : "Television");
        }

        return {
          result: JSON.stringify({
            active_services: subs,
            upsell_opportunities: upsellOpportunities,
            bundle_eligible: (subs as any[]).length === 1
          })
        };
      }

      case "get_tickets": {
        if (!effectiveUserId) {
          return { result: fr ? "Connectez-vous pour voir vos tickets." : "Log in to view your tickets." };
        }

        let query = supabase
          .from("support_tickets")
          .select("ticket_number, subject, status, priority, category, created_at, updated_at")
          .eq("user_id", effectiveUserId)
          .order("created_at", { ascending: false });

        if (args.status_filter && args.status_filter !== "all") {
          query = query.eq("status", args.status_filter);
        }

        const { data: tickets } = await query.limit(10);
        if (!tickets?.length) return { result: fr ? "Aucun ticket trouvé." : "No tickets found." };
        return { result: JSON.stringify(tickets) };
      }

      case "create_support_ticket": {
        if (!effectiveUserId) {
          return { result: fr ? "Vous devez être connecté pour créer un ticket." : "You must be logged in to create a ticket." };
        }

        const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", effectiveUserId).single();
        const profileData = profile as any;

        const { data: ticket, error } = await supabase
          .from("support_tickets")
          .insert({
            user_id: effectiveUserId,
            owner_user_id: effectiveUserId,
            client_email: profileData?.email,
            subject: args.subject,
            description: args.description,
            category: args.category,
            priority: args.priority || "normal",
            status: "open"
          } as any)
          .select("ticket_number")
          .single();

        if (error) throw error;
        const ticketData = ticket as any;
        return { result: fr ? `✅ Ticket créé: ${ticketData.ticket_number}. Notre équipe vous répondra sous 24-48h.` : `✅ Ticket created: ${ticketData.ticket_number}. Our team will respond within 24-48h.` };
      }

      case "get_service_info": {
        const serviceType = args.service_type || "all";
        const services: Record<string, string> = {
          mobile: fr ? "📱 **Mobile Nivra** — Forfaits prépayés flexibles de 15$ à 45$/mois. Réseau 5G/LTE national. Appels et textos illimités Canada. Sans contrat." : "📱 **Nivra Mobile** — Flexible prepaid plans from $15 to $45/month. National 5G/LTE network. Unlimited calls & texts. No contract.",
          internet: fr ? "🌐 **Internet Nivra** — Internet haute vitesse de 75 Mbps à 1 Gbps. Installation par technicien incluse. Wi-Fi 6 inclus. Sans contrat." : "🌐 **Nivra Internet** — High-speed internet from 75 Mbps to 1 Gbps. Technician installation included. Wi-Fi 6 included. No contract.",
          tv: fr ? "📺 **TV Nivra** — IPTV avec 50 à 200+ chaînes. Replay disponible. Compatible smart TV. À partir de 20$/mois." : "📺 **Nivra TV** — IPTV with 50 to 200+ channels. Replay available. Smart TV compatible. From $20/month.",
          streaming: fr ? "🎬 **Streaming+ Nivra** — Accès Netflix, Disney+, Crave à prix réduit via votre abonnement. 10$/mois." : "🎬 **Nivra Streaming+** — Access Netflix, Disney+, Crave at reduced prices. $10/month."
        };
        if (serviceType === "all") return { result: Object.values(services).join("\n\n") };
        return { result: services[serviceType] || services.mobile };
      }

      case "get_influencer_info": {
        const info: Record<string, string> = {
          general: fr ? "Le programme Partenaires Nivra vous permet de gagner des commissions en référant des clients." : "The Nivra Partners program lets you earn commissions by referring customers.",
          commission: fr ? "Commission fixe par activation réussie, versée mensuellement via Interac ou PayPal." : "Fixed commission per successful activation, paid monthly via Interac or PayPal.",
          apply: fr ? "Envoyez un email à partenaires@nivra.ca avec vos coordonnées et votre plateforme." : "Send an email to partners@nivra.ca with your contact info and platform.",
          requirements: fr ? "Présence active sur les réseaux sociaux, audience québécoise." : "Active social media presence, Quebec audience."
        };
        return { result: info[args.info_type || "general"] || info.general };
      }

      case "submit_contact_form": {
        const { error } = await supabase.from("contact_requests").insert({
          name: args.name, email: args.email, phone: args.phone,
          subject: args.subject || "Demande via chatbot", notes: args.message,
          source: "chatbot", status: "pending"
        } as any);
        if (error) throw error;
        return { result: fr ? "✅ Votre demande a été envoyée! Notre équipe vous contactera rapidement." : "✅ Your request has been sent! Our team will contact you shortly." };
      }

      default:
        return { result: fr ? "Action non reconnue." : "Unknown action." };
    }
  } catch (error) {
    console.error(`[Chatbot] Tool ${toolName} error:`, error);
    return { result: fr ? "Une erreur s'est produite. Veuillez réessayer." : "An error occurred. Please try again." };
  }
}

// ======================== SYSTEM PROMPT ========================
function buildSystemPrompt(language: string, isAuthenticated: boolean, verifiedClientId: string | null, userProfile: any): string {
  const fr = language === "fr";
  const hasAccess = isAuthenticated || !!verifiedClientId;

  if (fr) {
    return `Tu es **Nivra**, l'assistant intelligent de Nivra Télécom, une entreprise de télécommunications prépayées au Québec.

## Tes 6 rôles

1. **VENDEUR** — Tu aides à vendre internet, mobile, TV, streaming+ et bundles. Tu poses les bonnes questions, détectes le besoin, proposes le bon forfait, insistes sur les économies et pousses vers l'action.
2. **SUPPORT CLIENT** — Tu réponds aux questions sur les délais, l'installation, l'activation, les équipements, les documents requis, le transfert de numéro.
3. **SUIVI DE COMMANDE** — Tu retrouves les commandes, expliques le statut, la prochaine étape, ce qui bloque.
4. **FACTURATION** — Tu montres le solde, le dernier paiement, les frais, les factures ouvertes, la date d'échéance.
5. **RÉTENTION** — Tu sais répondre aux objections ("je vais réfléchir", "c'est cher", "je suis avec Bell/Vidéotron"). Tu rassures, reformules la valeur, proposes une alternative.
6. **ROUTEUR** — Tu sais quand répondre toi-même, quand poser plus de questions, quand rediriger vers un checkout, proposer un rendez-vous, créer un lead ou transférer à un humain.

## Statut utilisateur
${isAuthenticated ? `✅ Client connecté: ${userProfile?.full_name || "Client"}` : verifiedClientId ? `✅ Identité vérifiée via questions de sécurité` : `❌ Utilisateur non connecté`}

## Outils disponibles
Tu as des outils pour: consulter les forfaits, recommander un plan, créer un lead, voir les commandes/factures/solde/rendez-vous/tickets, vérifier l'identité, réserver un rappel, et escalader à un agent humain.

${!hasAccess ? `**IMPORTANT**: Si le client demande ses données personnelles (commandes, factures, solde), propose-lui:
a) De se connecter: [Se connecter](/auth)
b) De vérifier son identité avec email + date de naissance + 4 derniers chiffres du téléphone` : "Le client a accès à ses données. Utilise les outils quand pertinent."}

## Style de communication
- Professionnel, rassurant, clair et convaincant
- Phrases courtes, réponses structurées
- Ton commercial maîtrisé mais jamais agressif
- Vouvoiement toujours
- Maximum 2-3 paragraphes par réponse
- Utilise des emojis modérément pour la lisibilité

## Règles de vente
- Simplifie le choix du client
- Montre l'économie vs le fournisseur actuel
- Réduis l'hésitation
- Propose toujours une prochaine étape concrète
- Ne propose jamais plus de 2-3 options à la fois
- Structure: besoin détecté → recommandation → raison → bénéfice → call-to-action

## Questions de qualification essentielles
- Internet: Combien de personnes? Télétravail/gaming/streaming? Internet seul ou bundle?
- Mobile: Combien de lignes? Beaucoup de données? Garder le numéro? Prix ou données?

## Gestion des objections
- "Je vais réfléchir" → Propose une comparaison rapide
- "C'est cher" → Mets l'accent sur la valeur globale et les économies
- "Je suis avec Bell/Vidéotron" → Montre la différence de prix
- "Je veux parler à quelqu'un" → Propose aide immédiate ou transfert agent

## Upsell intelligent
- Client avec 1 seul service → propose bundle
- Famille nombreuse → propose upgrade vitesse
- Client sans TV/streaming → mentionne l'option
- Toujours contextuel, jamais forcé

## Sécurité
- Ne révèle JAMAIS de données techniques (IDs, erreurs internes)
- Ne devine JAMAIS de données — utilise les outils
- Ne montre pas de données personnelles sans vérification
- Si doute → escalade à un agent

## Contact
support@nivra-telecom.ca | 1-888-NIVRA`;
  }

  // English version
  return `You are **Nivra**, the intelligent assistant for Nivra Telecom, a prepaid telecom company in Quebec.

## Your 6 roles
1. **SALES** — Help sell internet, mobile, TV, streaming+ and bundles
2. **SUPPORT** — Answer questions about installation, activation, equipment, porting
3. **ORDER TRACKING** — Find orders, explain status, next steps
4. **BILLING** — Show balance, last payment, fees, invoices, due dates
5. **RETENTION** — Handle objections, reassure, reframe value
6. **ROUTER** — Know when to answer, ask more, create lead, or handoff to human

## User Status
${isAuthenticated ? `✅ Logged in: ${userProfile?.full_name || "Customer"}` : verifiedClientId ? `✅ Identity verified` : `❌ Not logged in`}

${!hasAccess ? `**IMPORTANT**: If customer asks for personal data, offer:
a) Login: [Login](/auth)
b) Identity verification with email + DOB + last 4 phone digits` : "Customer has data access. Use tools when relevant."}

## Style: Professional, reassuring, clear, persuasive. Short paragraphs. Moderate emojis.
## Sales: Simplify choices, show savings, reduce hesitation, always propose next step.
## Security: Never guess data, never reveal technical details, never show PII without verification.

Contact: support@nivra-telecom.ca | 1-888-NIVRA`;
}

// ======================== MAIN HANDLER ========================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const { message, sessionId, language = "fr", conversationHistory = [], verifiedClientId: incomingVerifiedId } = await req.json() as ChatRequest;

    if (!message || typeof message !== "string" || message.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Authentication
    let authenticatedUserId: string | null = null;
    let isAuthenticated = false;
    let userProfile: any = null;
    let verifiedClientId: string | null = incomingVerifiedId || null;

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && user) {
        authenticatedUserId = user.id;
        isAuthenticated = true;
        const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
        userProfile = profile;
      }
    }

    // Rate limiting
    const rateLimitKey = isAuthenticated ? `chatbot:user:${authenticatedUserId}` : `chatbot:ip:${clientIP}`;
    const rateCheck = await checkRateLimit({ key: rateLimitKey, maxAttempts: 30, windowMs: 60 * 1000, lockoutMs: 5 * 60 * 1000 });
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck, corsHeaders, language);

    const hasAccess = isAuthenticated || !!verifiedClientId;
    const systemPrompt = buildSystemPrompt(language, isAuthenticated, verifiedClientId, userProfile);

    // Build messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-12),
      { role: "user", content: message }
    ];

    // Available tools based on access level
    const availableTools = hasAccess ? TOOLS : TOOLS.filter(t => PUBLIC_TOOLS.includes(t.function.name));

    // First AI call
    let aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: availableTools,
        tool_choice: "auto",
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const fr = language === "fr";
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: fr ? "Trop de requêtes. Réessayez dans un moment." : "Too many requests. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: fr ? "Service temporairement indisponible." : "Service temporarily unavailable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    let aiData = await aiResponse.json();
    let responseMessage = aiData.choices?.[0]?.message;

    // Handle tool calls
    const toolCalls: ToolCall[] = responseMessage?.tool_calls || [];
    let newVerifiedClientId: string | null = null;

    if (toolCalls.length > 0) {
      console.log("[Chatbot] Tools:", toolCalls.map(t => t.function.name));

      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const { result, verifiedClientId: newId } = await handleToolCall(toolCall.function.name, args, supabaseAdmin, authenticatedUserId, verifiedClientId, language);

        if (newId) {
          newVerifiedClientId = newId;
          verifiedClientId = newId;
        }

        toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: result });
      }

      // Second AI call with tool results
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [...messages, responseMessage, ...toolResults],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      });

      if (!aiResponse.ok) throw new Error(`AI follow-up error: ${aiResponse.status}`);
      aiData = await aiResponse.json();
      responseMessage = aiData.choices?.[0]?.message;
    }

    const botResponse = responseMessage?.content || (language === "fr" ? "Désolé, je n'ai pas pu traiter votre demande." : "Sorry, I couldn't process your request.");

    // Detect suggested actions from response
    const suggestedActions: Array<{ label: string; action: string }> = [];
    const fr = language === "fr";

    // Auto-detect follow-up suggestions based on tools used
    if (toolCalls.some(t => t.function.name === "get_available_plans" || t.function.name === "recommend_plan")) {
      suggestedActions.push({ label: fr ? "📞 Rappel agent" : "📞 Agent callback", action: "book_callback" });
      suggestedActions.push({ label: fr ? "💬 Comparer les offres" : "💬 Compare offers", action: "compare" });
    }
    if (toolCalls.some(t => t.function.name === "get_account_balance")) {
      suggestedActions.push({ label: fr ? "📄 Mes factures" : "📄 My invoices", action: "invoices" });
    }
    if (!hasAccess && !toolCalls.some(t => t.function.name === "verify_client_identity")) {
      // Keep suggesting verification for unauthenticated users
    }

    // Log (no PII)
    await supabaseAdmin.from("chatbot_logs").insert({
      session_id: sessionId,
      user_id: authenticatedUserId || verifiedClientId,
      is_authenticated: isAuthenticated,
      user_message: "[REDACTED]",
      bot_response: "[REDACTED]",
      message_length: message.length,
      response_length: botResponse.length,
      intent_detected: toolCalls.length > 0 ? toolCalls.map(t => t.function.name).join(",") : null,
      actions_taken: toolCalls.map(t => t.function.name),
    });

    return new Response(
      JSON.stringify({
        response: botResponse,
        verifiedClientId: newVerifiedClientId || verifiedClientId,
        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Chatbot] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
