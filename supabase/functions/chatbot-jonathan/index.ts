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
  function: { name: string; arguments: string };
}

// ======================== TOOL DEFINITIONS ========================
const TOOLS = [
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
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recommend_plan",
      description: "Recommande le meilleur forfait basé sur le profil complet du prospect. TOUJOURS utiliser cet outil avant de faire une recommandation.",
      parameters: {
        type: "object",
        properties: {
          household_size: { type: "number", description: "Nombre de personnes au foyer" },
          device_count: { type: "number", description: "Nombre d'appareils connectés simultanément" },
          has_telework: { type: "boolean", description: "Le client fait du télétravail" },
          has_gaming: { type: "boolean", description: "Le client fait du gaming en ligne" },
          has_streaming: { type: "boolean", description: "Le client fait du streaming vidéo (Netflix, YouTube 4K, etc.)" },
          wants_tv: { type: "boolean", description: "Le client veut de la télévision" },
          wants_sports: { type: "boolean", description: "Le client veut des chaînes sport" },
          wants_mobile: { type: "boolean", description: "Le client veut un forfait mobile" },
          current_provider: { type: "string", description: "Fournisseur actuel si mentionné" },
          current_monthly_cost: { type: "number", description: "Facture mensuelle actuelle si mentionnée" },
          budget_max: { type: "number", description: "Budget maximum mensuel" },
          priority: { type: "string", enum: ["price", "performance", "balanced"], description: "Priorité: prix bas, performance max, ou équilibré" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_fees_info",
      description: "Récupère les frais réels Nivra (activation, livraison, équipement, installation)",
      parameters: { type: "object", properties: {}, required: [] }
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
          name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
          service_interest: { type: "string" }, notes: { type: "string" }, source: { type: "string" }
        },
        required: ["name", "email", "service_interest"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_service_info",
      description: "Fournit des informations détaillées sur les services Nivra",
      parameters: {
        type: "object",
        properties: { service_type: { type: "string", enum: ["mobile", "internet", "tv", "streaming", "all"] } },
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
        properties: { info_type: { type: "string", enum: ["general", "commission", "apply", "requirements"] } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_contact_form",
      description: "Soumet un formulaire de contact",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, subject: { type: "string" }, message: { type: "string" } },
        required: ["name", "email", "phone", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_callback",
      description: "Planifie un rappel téléphonique avec un agent Nivra",
      parameters: {
        type: "object",
        properties: { name: { type: "string" }, phone: { type: "string" }, preferred_time: { type: "string" }, reason: { type: "string" } },
        required: ["name", "phone"]
      }
    }
  },
  // --- AUTHENTICATED TOOLS ---
  {
    type: "function",
    function: {
      name: "verify_client_identity",
      description: "Vérifie l'identité d'un client via email + date naissance + 4 derniers chiffres téléphone",
      parameters: {
        type: "object",
        properties: { email: { type: "string" }, date_of_birth: { type: "string" }, phone_last_4: { type: "string" } },
        required: ["email", "date_of_birth", "phone_last_4"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_order_details",
      description: "Récupère les détails d'une commande ou liste les commandes récentes",
      parameters: {
        type: "object",
        properties: { order_number: { type: "string" }, list_recent: { type: "boolean" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_appointments",
      description: "Récupère les rendez-vous du client",
      parameters: { type: "object", properties: { include_past: { type: "boolean" } }, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "reschedule_appointment",
      description: "Reprogramme un rendez-vous",
      parameters: {
        type: "object",
        properties: { appointment_id: { type: "string" }, new_date: { type: "string" }, new_time: { type: "string" } },
        required: ["appointment_id", "new_date", "new_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_invoices",
      description: "Récupère les factures du client",
      parameters: {
        type: "object",
        properties: { status_filter: { type: "string", enum: ["all", "pending", "paid", "overdue"] } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_invoice_download_link",
      description: "Lien de téléchargement facture",
      parameters: { type: "object", properties: { invoice_number: { type: "string" } }, required: ["invoice_number"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Récupère le solde du compte client",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_active_services",
      description: "Récupère les services actifs du client pour upsell",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_tickets",
      description: "Récupère les tickets de support",
      parameters: {
        type: "object",
        properties: { status_filter: { type: "string", enum: ["all", "open", "closed", "in_progress"] } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Crée un ticket de support",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string" }, description: { type: "string" },
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
      description: "Transfère à un agent humain",
      parameters: {
        type: "object",
        properties: { reason: { type: "string" }, summary: { type: "string" }, urgency: { type: "string", enum: ["normal", "high", "critical"] } },
        required: ["reason", "summary"]
      }
    }
  }
];

const PUBLIC_TOOLS = [
  "get_available_plans", "recommend_plan", "get_fees_info", "create_sales_lead",
  "get_service_info", "get_influencer_info", "submit_contact_form",
  "book_callback", "verify_client_identity", "handoff_to_agent"
];

// ======================== DYNAMIC DATA LOADER ========================
interface CatalogOffer {
  id: string;
  offer_type: string;
  category: string;
  name_fr: string;
  name_en: string | null;
  description_fr: string | null;
  price_monthly: number | null;
  price_setup: number | null;
  features_json: any;
  is_featured: boolean;
}

interface FeeRecord {
  fee_key: string;
  label_fr: string;
  amount: number;
  fee_type: string;
  category: string;
}

let _cachedCatalog: { offers: CatalogOffer[]; fees: FeeRecord[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

async function loadCatalog(supabase: any): Promise<{ offers: CatalogOffer[]; fees: FeeRecord[] }> {
  if (_cachedCatalog && Date.now() - _cachedCatalog.loadedAt < CACHE_TTL_MS) {
    return _cachedCatalog;
  }

  const [offersRes, feesRes] = await Promise.all([
    supabase.from("site_offers").select("id, offer_type, category, name_fr, name_en, description_fr, price_monthly, price_setup, features_json, is_featured").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase.from("operational_fees").select("fee_key, label_fr, amount, fee_type, category").eq("is_active", true).order("display_order", { ascending: true }),
  ]);

  const offers = (offersRes.data || []) as CatalogOffer[];
  const fees = (feesRes.data || []) as FeeRecord[];

  _cachedCatalog = { offers, fees, loadedAt: Date.now() };
  return _cachedCatalog;
}

// ======================== RECOMMENDATION ENGINE ========================

interface ClientProfile {
  household_size: number;
  device_count: number;
  has_telework: boolean;
  has_gaming: boolean;
  has_streaming: boolean;
  wants_tv: boolean;
  wants_sports: boolean;
  wants_mobile: boolean;
  budget_max: number | null;
  priority: "price" | "performance" | "balanced";
}

/**
 * Compute a "demand tier" from the client profile.
 * Returns: 'entry' | 'mid' | 'high' | 'ultra'
 */
function computeDemandTier(profile: ClientProfile): "entry" | "mid" | "high" | "ultra" {
  let score = 0;

  // Device count scoring
  if (profile.device_count >= 10) score += 4;
  else if (profile.device_count >= 6) score += 3;
  else if (profile.device_count >= 3) score += 2;
  else score += 1;

  // Usage scoring
  if (profile.has_telework) score += 2;
  if (profile.has_gaming) score += 2;
  if (profile.has_streaming) score += 1;

  // Household scoring
  if (profile.household_size >= 5) score += 2;
  else if (profile.household_size >= 3) score += 1;

  // Priority adjustment
  if (profile.priority === "performance") score += 1;

  if (score >= 8) return "ultra";
  if (score >= 5) return "high";
  if (score >= 3) return "mid";
  return "entry";
}

function buildRecommendation(profile: ClientProfile, offers: CatalogOffer[], fees: FeeRecord[], fr: boolean) {
  const tier = computeDemandTier(profile);

  // Separate offers by category
  const internetOffers = offers.filter(o => o.category === "internet").sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));
  const mobileOffers = offers.filter(o => o.category === "mobile").sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));
  const tvOffers = offers.filter(o => o.category === "tv").sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));
  const bundleOffers = offers.filter(o => o.offer_type === "bundle").sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));

  const rec: any = { internet: null, mobile: null, tv: null, bundle: null };
  const reasons: string[] = [];

  // ---- BUNDLE CHECK FIRST ----
  // If client wants TV + internet, always check bundle first (better value)
  if (profile.wants_tv && bundleOffers.length > 0) {
    // Pick the best bundle based on tier
    const bestBundle = bundleOffers[bundleOffers.length - 1] || bundleOffers[0]; // highest tier
    rec.bundle = bestBundle;
    reasons.push(fr
      ? `Avec vos besoins TV + Internet, un forfait groupé est la meilleure valeur. Le ${bestBundle.name_fr} inclut Internet et TV dans un seul forfait.`
      : `With your TV + Internet needs, a bundle is the best value. The ${bestBundle.name_fr} includes Internet and TV in one plan.`);
  } else {
    // ---- INTERNET SELECTION ----
    if (internetOffers.length > 0) {
      let selected: CatalogOffer;
      if (tier === "ultra" || tier === "high") {
        // Pick highest tier available
        selected = internetOffers[internetOffers.length - 1];
      } else if (tier === "mid") {
        selected = internetOffers[Math.floor(internetOffers.length / 2)] || internetOffers[0];
      } else {
        selected = internetOffers[0];
      }

      // Budget filter: if budget is tight, find the best that fits
      if (profile.budget_max && (selected.price_monthly || 0) > profile.budget_max * 0.8) {
        const affordable = internetOffers.filter(o => (o.price_monthly || 0) <= profile.budget_max! * 0.8);
        if (affordable.length > 0) {
          selected = affordable[affordable.length - 1]; // best within budget
          reasons.push(fr
            ? `Selon votre budget de ${profile.budget_max}$/mois, je vous oriente vers le ${selected.name_fr} qui offre le meilleur équilibre performance/prix.`
            : `Based on your ${profile.budget_max}$/month budget, I recommend the ${selected.name_fr} for the best performance/price balance.`);
        }
      }

      rec.internet = selected;

      // Build reason
      const features = selected.features_json;
      const speed = features?.speed || "";
      if (tier === "ultra" || tier === "high") {
        reasons.push(fr
          ? `Avec ${profile.device_count || "plusieurs"} appareils${profile.has_telework ? ", du télétravail" : ""}${profile.has_gaming ? ", du gaming" : ""}${profile.has_streaming ? " et du streaming" : ""}, vous avez besoin d'une connexion robuste. Le ${selected.name_fr}${speed ? ` (${speed})` : ""} est dimensionné pour supporter cette charge sans ralentissement.`
          : `With ${profile.device_count || "multiple"} devices${profile.has_telework ? ", remote work" : ""}${profile.has_gaming ? ", gaming" : ""}${profile.has_streaming ? " and streaming" : ""}, you need a robust connection. The ${selected.name_fr}${speed ? ` (${speed})` : ""} handles this load without slowdowns.`);
      } else {
        reasons.push(fr
          ? `Le ${selected.name_fr}${speed ? ` (${speed})` : ""} convient bien à votre profil d'utilisation.`
          : `The ${selected.name_fr}${speed ? ` (${speed})` : ""} fits your usage profile well.`);
      }
    }

    // ---- TV SELECTION ----
    if (profile.wants_tv && tvOffers.length > 0) {
      const selected = profile.wants_sports
        ? tvOffers[tvOffers.length - 1] || tvOffers[0] // premium for sports
        : tvOffers[0];
      rec.tv = selected;
      reasons.push(fr
        ? `${profile.wants_sports ? "Pour les chaînes sport, " : ""}le ${selected.name_fr} est l'option TV recommandée.`
        : `${profile.wants_sports ? "For sports channels, " : ""}the ${selected.name_fr} is the recommended TV option.`);
    }
  }

  // ---- MOBILE ----
  if (profile.wants_mobile && mobileOffers.length > 0) {
    const selected = mobileOffers[mobileOffers.length - 1] || mobileOffers[0];
    rec.mobile = selected;
    reasons.push(fr
      ? `Pour le mobile, le ${selected.name_fr} vous donne les données nécessaires.`
      : `For mobile, the ${selected.name_fr} gives you the data you need.`);
  }

  // ---- COMPUTE TOTAL ----
  let totalMonthly = 0;
  const lineItems: Array<{ name: string; price: number }> = [];

  if (rec.bundle) {
    totalMonthly += rec.bundle.price_monthly || 0;
    lineItems.push({ name: rec.bundle.name_fr, price: rec.bundle.price_monthly || 0 });
  } else {
    if (rec.internet) {
      totalMonthly += rec.internet.price_monthly || 0;
      lineItems.push({ name: rec.internet.name_fr, price: rec.internet.price_monthly || 0 });
    }
    if (rec.tv) {
      totalMonthly += rec.tv.price_monthly || 0;
      lineItems.push({ name: rec.tv.name_fr, price: rec.tv.price_monthly || 0 });
    }
  }
  if (rec.mobile) {
    totalMonthly += rec.mobile.price_monthly || 0;
    lineItems.push({ name: rec.mobile.name_fr, price: rec.mobile.price_monthly || 0 });
  }

  // One-time fees
  const activationFee = fees.find(f => f.fee_key === (lineItems.length >= 2 ? "activation_bundle" : "activation_single"));
  const equipmentFees = fees.filter(f => f.category === "equipment");

  // Tier warning
  let tierWarning: string | null = null;
  if (tier === "ultra" || tier === "high") {
    tierWarning = fr
      ? "⚠️ Votre profil d'utilisation est exigeant. Je ne vous recommande pas un forfait d'entrée de gamme — vous risqueriez des ralentissements et une mauvaise expérience."
      : "⚠️ Your usage profile is demanding. I don't recommend an entry-level plan — you'd risk slowdowns and a poor experience.";
  }

  return {
    demand_tier: tier,
    tier_warning: tierWarning,
    recommendation: {
      bundle: rec.bundle ? { name: rec.bundle.name_fr, price: rec.bundle.price_monthly, description: rec.bundle.description_fr, features: rec.bundle.features_json } : null,
      internet: rec.internet ? { name: rec.internet.name_fr, price: rec.internet.price_monthly, description: rec.internet.description_fr, features: rec.internet.features_json } : null,
      tv: rec.tv ? { name: rec.tv.name_fr, price: rec.tv.price_monthly, description: rec.tv.description_fr, features: rec.tv.features_json } : null,
      mobile: rec.mobile ? { name: rec.mobile.name_fr, price: rec.mobile.price_monthly, description: rec.mobile.description_fr, features: rec.mobile.features_json } : null,
    },
    monthly_total: totalMonthly,
    line_items: lineItems,
    reasons,
    one_time_fees: {
      activation: activationFee ? { label: activationFee.label_fr, amount: activationFee.amount } : null,
      equipment_note: fr ? "Équipement requis selon le service choisi (routeur, terminal TV, SIM)" : "Equipment required per chosen service (router, TV terminal, SIM)",
    },
    cta: fr ? "Prêt à s'abonner? Je peux créer votre dossier ou réserver un rappel avec un conseiller." : "Ready to subscribe? I can create your file or book an advisor callback."
  };
}

// ======================== TOOL HANDLERS ========================
async function handleToolCall(
  toolName: string, args: Record<string, any>,
  supabase: any, userId: string | null, verifiedClientId: string | null, language: string
): Promise<{ result: string; verifiedClientId?: string }> {
  const fr = language === "fr";
  const effectiveUserId = userId || verifiedClientId;

  try {
    switch (toolName) {
      case "get_available_plans": {
        const { offers } = await loadCatalog(supabase);
        const category = args.category || "all";
        let filtered = offers;

        if (category !== "all") {
          filtered = offers.filter(o => o.category === category || (category === "bundle" && o.offer_type === "bundle"));
        }

        if (args.budget_max) {
          filtered = filtered.filter(o => (o.price_monthly || 0) <= args.budget_max);
        }

        const plans = filtered.map(o => ({
          name: o.name_fr,
          category: o.category,
          type: o.offer_type,
          price: o.price_monthly,
          setup_fee: o.price_setup,
          description: o.description_fr,
          features: o.features_json,
          is_featured: o.is_featured,
        }));

        return { result: JSON.stringify({ plans, total_available: plans.length, source: "live_database" }) };
      }

      case "recommend_plan": {
        const { offers, fees } = await loadCatalog(supabase);
        const profile: ClientProfile = {
          household_size: args.household_size || 2,
          device_count: args.device_count || 3,
          has_telework: args.has_telework || false,
          has_gaming: args.has_gaming || false,
          has_streaming: args.has_streaming || false,
          wants_tv: args.wants_tv || false,
          wants_sports: args.wants_sports || false,
          wants_mobile: args.wants_mobile || false,
          budget_max: args.budget_max || null,
          priority: args.priority || "balanced",
        };

        const recommendation = buildRecommendation(profile, offers, fees, fr);
        return { result: JSON.stringify(recommendation) };
      }

      case "get_fees_info": {
        const { fees } = await loadCatalog(supabase);
        const grouped: Record<string, Array<{ label: string; amount: number }>> = {};
        for (const f of fees) {
          if (!grouped[f.category]) grouped[f.category] = [];
          grouped[f.category].push({ label: f.label_fr, amount: f.amount });
        }
        return { result: JSON.stringify({ fees: grouped, source: "live_database", note: fr ? "Tous les frais sont sujets aux taxes (TPS 5% + TVQ 9.975%)" : "All fees subject to taxes (GST 5% + QST 9.975%)" }) };
      }

      case "create_sales_lead": {
        const { error } = await supabase.from("contact_requests").insert({
          name: args.name, email: args.email, phone: args.phone || null,
          subject: `Lead vente: ${args.service_interest}`,
          notes: `Source: Chatbot Nivra AI\nService: ${args.service_interest}\n${args.notes || ""}`,
          source: "chatbot_sale", status: "pending"
        } as any);
        if (error) throw error;
        return { result: fr ? `✅ Votre demande a été enregistrée! Un conseiller Nivra vous contactera très bientôt.` : `✅ Your request has been registered! A Nivra advisor will contact you soon.` };
      }

      case "book_callback": {
        const timeLabels: Record<string, string> = { morning: "matin (9h-12h)", afternoon: "après-midi (12h-17h)", evening: "soir (17h-20h)" };
        const preferredLabel = timeLabels[args.preferred_time] || args.preferred_time || "dès que possible";
        const { error } = await supabase.from("contact_requests").insert({
          name: args.name, phone: args.phone,
          subject: "Demande de rappel - Chatbot",
          notes: `Rappel demandé: ${preferredLabel}\nRaison: ${args.reason || "Intéressé par les services Nivra"}`,
          source: "chatbot_callback", status: "pending"
        } as any);
        if (error) throw error;
        return { result: fr ? `📞 Parfait! Un conseiller vous rappellera au ${args.phone} (${preferredLabel}).` : `📞 Perfect! An advisor will call you back at ${args.phone} (${preferredLabel}).` };
      }

      case "handoff_to_agent": {
        await supabase.from("contact_requests").insert({
          name: "Escalade chatbot", subject: `Escalade: ${args.reason}`,
          notes: `Résumé: ${args.summary}\nUrgence: ${args.urgency || "normal"}`,
          source: "chatbot_escalation", status: "pending"
        } as any);
        return { result: fr
          ? `🤝 Je transfère votre dossier à un agent spécialisé.\n📧 support@nivra-telecom.ca\n📞 1-888-NIVRA`
          : `🤝 Transferring to a specialized agent.\n📧 support@nivra-telecom.ca\n📞 1-888-NIVRA` };
      }

      case "verify_client_identity": {
        const { email, date_of_birth, phone_last_4 } = args;
        if (!email || !date_of_birth || !phone_last_4) {
          return { result: fr ? "J'ai besoin de votre email, date de naissance et les 4 derniers chiffres de votre téléphone." : "I need your email, date of birth and last 4 digits of your phone." };
        }
        const { data: profiles, error } = await supabase.from("profiles").select("id, full_name, email, phone, date_of_birth").ilike("email", email.toLowerCase().trim());
        if (error || !profiles?.length) return { result: fr ? "❌ Vérification échouée. Informations incorrectes." : "❌ Verification failed." };
        for (const p of profiles as any[]) {
          if (p.date_of_birth?.substring(0, 10) !== date_of_birth) continue;
          const phoneDigits = (p.phone || "").replace(/\D/g, "");
          if (!phoneDigits.endsWith(phone_last_4)) continue;
          return { result: fr ? `✅ Identité vérifiée! Bonjour ${p.full_name?.split(" ")[0] || ""}. Que souhaitez-vous savoir?` : `✅ Verified! Hello ${p.full_name?.split(" ")[0] || ""}.`, verifiedClientId: p.id };
        }
        return { result: fr ? "❌ Vérification échouée." : "❌ Verification failed." };
      }

      case "get_order_details": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous ou vérifiez votre identité." : "Log in or verify your identity." };
        if (args.order_number) {
          const { data: order } = await supabase.from("orders").select("*").eq("user_id", effectiveUserId).eq("order_number", args.order_number).single();
          if (!order) return { result: fr ? `Commande ${args.order_number} non trouvée.` : `Order ${args.order_number} not found.` };
          const o = order as any;
          return { result: JSON.stringify({ order_number: o.order_number, status: o.status, service_type: o.service_type, total: o.total_amount, created_at: o.created_at, delivery_method: o.delivery_method }) };
        }
        const { data: orders } = await supabase.from("orders").select("order_number, status, service_type, total_amount, created_at").eq("user_id", effectiveUserId).order("created_at", { ascending: false }).limit(5);
        if (!orders?.length) return { result: fr ? "Aucune commande trouvée." : "No orders found." };
        return { result: JSON.stringify(orders) };
      }

      case "get_appointments": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous pour voir vos rendez-vous." : "Log in to view appointments." };
        let query = supabase.from("appointments").select("id, title, scheduled_at, status, service_type, service_address").eq("client_id", effectiveUserId).order("scheduled_at", { ascending: true });
        if (!args.include_past) query = query.gte("scheduled_at", new Date().toISOString());
        const { data: appointments } = await query.limit(10);
        if (!appointments?.length) return { result: fr ? "Aucun rendez-vous." : "No appointments." };
        return { result: JSON.stringify(appointments) };
      }

      case "reschedule_appointment": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous d'abord." : "Log in first." };
        const { data: apt } = await supabase.from("appointments").select("*").eq("id", args.appointment_id).eq("client_id", effectiveUserId).single();
        if (!apt) return { result: fr ? "Rendez-vous non trouvé." : "Appointment not found." };
        const hoursUntil = (new Date((apt as any).scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 24) return { result: fr ? "Impossible de modifier moins de 24h à l'avance." : "Cannot reschedule less than 24h before." };
        const newDateTime = new Date(`${args.new_date}T${args.new_time}:00`);
        await supabase.from("appointments").update({ scheduled_at: newDateTime.toISOString(), status: "rescheduled" } as any).eq("id", args.appointment_id);
        return { result: fr ? `Rendez-vous reprogrammé au ${args.new_date} à ${args.new_time}.` : `Rescheduled to ${args.new_date} at ${args.new_time}.` };
      }

      case "get_invoices": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous pour voir vos factures." : "Log in to view invoices." };
        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).single();
        if (!customer) return { result: fr ? "Aucune facture." : "No invoices." };
        let query = supabase.from("billing_invoices").select("invoice_number, total, status, due_date, paid_at, created_at, balance_due").eq("customer_id", (customer as any).id).order("created_at", { ascending: false });
        if (args.status_filter && args.status_filter !== "all") query = query.eq("status", args.status_filter);
        const { data: invoices } = await query.limit(10);
        if (!invoices?.length) return { result: fr ? "Aucune facture." : "No invoices." };
        return { result: JSON.stringify(invoices) };
      }

      case "get_invoice_download_link": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous." : "Log in." };
        return { result: fr ? `Téléchargez votre facture ${args.invoice_number} depuis votre espace client: /client/invoices` : `Download invoice ${args.invoice_number} from: /client/invoices` };
      }

      case "get_account_balance": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous pour voir votre solde." : "Log in to view balance." };
        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).maybeSingle();
        let lastPayment: any = null;
        if (customer) {
          const { data: payment } = await supabase.from("billing_payments").select("amount, created_at, method, status").eq("customer_id", (customer as any).id).eq("status", "confirmed").order("created_at", { ascending: false }).limit(1).maybeSingle();
          lastPayment = payment;
        }
        const { data: ledgerBalance, error: ledgerError } = await supabase.rpc("get_client_ledger_balance", { p_client_id: effectiveUserId });
        if (!ledgerError && ledgerBalance) {
          const b = ledgerBalance as any;
          const balance = b.balance || 0;
          let result = "";
          if (balance < 0) result = fr ? `💳 **Solde à payer:** ${Math.abs(balance).toFixed(2)} $` : `💳 **Amount Due:** $${Math.abs(balance).toFixed(2)}`;
          else if (balance > 0) result = fr ? `✅ **Crédit disponible:** ${balance.toFixed(2)} $` : `✅ **Available Credit:** $${balance.toFixed(2)}`;
          else result = fr ? `✅ **Solde:** 0.00 $ — Compte à jour.` : `✅ **Balance:** $0.00 — Up to date.`;
          if (lastPayment) {
            const lp = lastPayment as any;
            const pDate = new Date(lp.created_at).toLocaleDateString(fr ? "fr-CA" : "en-CA");
            result += fr ? `\n\n💰 **Dernier paiement:** ${lp.amount?.toFixed(2)} $ le ${pDate}` : `\n\n💰 **Last Payment:** $${lp.amount?.toFixed(2)} on ${pDate}`;
          }
          return { result };
        }
        return { result: fr ? "Impossible de récupérer le solde." : "Unable to retrieve balance." };
      }

      case "get_active_services": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous." : "Log in." };
        const { data: customer } = await supabase.from("billing_customers").select("id").eq("user_id", effectiveUserId).maybeSingle();
        if (!customer) return { result: fr ? "Aucun service actif." : "No active services." };
        const { data: subs } = await supabase.from("billing_subscriptions").select("plan_name, plan_code, plan_price, status, service_category, cycle_start_date, cycle_end_date").eq("customer_id", (customer as any).id).in("status", ["active", "pending"]).limit(10);
        if (!subs?.length) return { result: fr ? "Aucun service actif." : "No active services." };
        const categories = (subs as any[]).map((s: any) => s.service_category || "").filter(Boolean);
        const upsell: string[] = [];
        if (!categories.some(c => c.includes("internet"))) upsell.push(fr ? "Internet résidentiel" : "Residential internet");
        if (!categories.some(c => c.includes("mobile"))) upsell.push(fr ? "Forfait mobile" : "Mobile plan");
        if (!categories.some(c => c.includes("tv"))) upsell.push(fr ? "Télévision" : "Television");
        return { result: JSON.stringify({ active_services: subs, upsell_opportunities: upsell, bundle_eligible: (subs as any[]).length === 1 }) };
      }

      case "get_tickets": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous." : "Log in." };
        let query = supabase.from("support_tickets").select("ticket_number, subject, status, priority, category, created_at").eq("user_id", effectiveUserId).order("created_at", { ascending: false });
        if (args.status_filter && args.status_filter !== "all") query = query.eq("status", args.status_filter);
        const { data: tickets } = await query.limit(10);
        if (!tickets?.length) return { result: fr ? "Aucun ticket." : "No tickets." };
        return { result: JSON.stringify(tickets) };
      }

      case "create_support_ticket": {
        if (!effectiveUserId) return { result: fr ? "Connectez-vous pour créer un ticket." : "Log in to create a ticket." };
        const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", effectiveUserId).single();
        const pd = profile as any;
        const { data: ticket, error } = await supabase.from("support_tickets").insert({
          user_id: effectiveUserId, owner_user_id: effectiveUserId, client_email: pd?.email,
          subject: args.subject, description: args.description, category: args.category,
          priority: args.priority || "normal", status: "open"
        } as any).select("ticket_number").single();
        if (error) throw error;
        return { result: fr ? `✅ Ticket créé: ${(ticket as any).ticket_number}. Réponse sous 24-48h.` : `✅ Ticket created: ${(ticket as any).ticket_number}. Response within 24-48h.` };
      }

      case "get_service_info": {
        const { offers } = await loadCatalog(supabase);
        const serviceType = args.service_type || "all";
        const relevant = serviceType === "all" ? offers : offers.filter(o => o.category === serviceType);
        if (relevant.length === 0) {
          return { result: fr ? "Aucune offre trouvée pour cette catégorie." : "No offers found for this category." };
        }
        const formatted = relevant.map(o => {
          const features = o.features_json?.features || [];
          return `**${o.name_fr}** — ${o.price_monthly}$/mois\n${o.description_fr || ""}\n${features.map((f: string) => `• ${f}`).join("\n")}`;
        }).join("\n\n");
        return { result: formatted };
      }

      case "get_influencer_info": {
        const info: Record<string, string> = {
          general: fr ? "Le programme Partenaires Nivra vous permet de gagner des commissions en référant des clients." : "The Nivra Partners program lets you earn commissions by referring customers.",
          commission: fr ? "Commission fixe par activation réussie, versée mensuellement." : "Fixed commission per successful activation, paid monthly.",
          apply: fr ? "Envoyez un email à partenaires@nivra.ca." : "Email partners@nivra.ca.",
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
        return { result: fr ? "✅ Demande envoyée! Notre équipe vous contactera rapidement." : "✅ Request sent!" };
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
async function buildSystemPrompt(language: string, isAuthenticated: boolean, verifiedClientId: string | null, userProfile: any, supabase: any): Promise<string> {
  const fr = language === "fr";
  const hasAccess = isAuthenticated || !!verifiedClientId;

  // Load live catalog for context
  const { offers, fees } = await loadCatalog(supabase);

  // Build catalog summary for the AI
  const catalogSummary = offers.map(o => {
    const features = o.features_json;
    const speed = features?.speed || "";
    const badge = features?.badge || "";
    const featureList = (features?.features || []).slice(0, 4).join(", ");
    return `- ${o.name_fr} (${o.category}) — ${o.price_monthly}$/mois${speed ? ` — ${speed}` : ""}${badge ? ` [${badge}]` : ""} — ${featureList}`;
  }).join("\n");

  const feesSummary = fees.map(f => `- ${f.label_fr}: ${f.amount}$`).join("\n");

  if (fr) {
    return `Tu es **Nivra**, l'assistant intelligent de Nivra Télécom, une entreprise de télécommunications prépayées au Québec.

## INFOS ENTREPRISE
- Nivra Télécom est un fournisseur Internet et TV au Québec
- Sans contrat, sans vérification de crédit, résiliez à tout moment
- Service offert à Montréal, Laval, Longueuil, Brossard, Rive-Sud et environs
- Support: support@nivra-telecom.ca (7 jours/7, 8h-20h)
- AUCUN support téléphonique — courriel uniquement
- Page de support complète: /support

## CATALOGUE ACTUEL NIVRA (source de vérité — ne jamais inventer d'autres forfaits)
${catalogSummary}

## FRAIS ACTUELS NIVRA
${feesSummary}
Note: Tous les montants sont sujets aux taxes (TPS 5% + TVQ 9.975%).

## ÉQUIPEMENT (prix fixes)
- Borne Nivra WiFi: 60$ (achat unique)
- Terminal TV: 50$ par terminal
- SIM: 30$
- Frais d'activation: 10$
- Frais de livraison: 20$
- Premier mois GRATUIT pour nouveaux clients (automatique)

## PROCESSUS D'ACTIVATION
1. Le client reçoit son équipement par la poste
2. Il branche la Borne Nivra WiFi (câble coaxial + adaptateur secteur)
3. Il attend le voyant BLANC FIXE (jusqu'à 20 minutes)
4. Il se connecte au portail nivra-telecom.ca/portail
5. Il clique sur « Activation WiFi » et remplit le formulaire
6. L'équipe Nivra active le service en 10-30 minutes
7. Le client reçoit une confirmation par courriel

## VOYANTS LED DE LA BORNE
- Orange / clignotant = en démarrage, attendre
- Blanc fixe = prêt pour activation
- Rouge fixe = erreur, vérifier le câble coaxial

## PROCÉDURE DE RESET (équipement reconditionné)
**Étape 1 — Reset télécommande (OBLIGATOIRE EN PREMIER):**
1. Appuyer sur EXIT
2. Maintenir A + D pendant 5 secondes jusqu'au voyant vert
3. Appuyer 9, 8, 1 — voyant clignote 3 fois = succès

**Étape 2 — Reset terminal (APRÈS la télécommande):**
1. Maintenir PWR 5 secondes
2. Appuyer sur le bouton central
3. Appuyer flèche droite
4. Appuyer flèche bas
5. Appuyer PWR pour redémarrer

## DÉPANNAGE RAPIDE
- Pas d'Internet: débrancher 30 sec, rebrancher, attendre 3 min
- WiFi lent: rapprocher l'appareil de la borne, éviter obstacles
- Écran TV noir: vérifier la bonne entrée HDMI
- Terminal TV ne se connecte pas au WiFi: vérifier maj/min du mot de passe, essayer WPS

## PORTAIL CLIENT
- URL: nivra-telecom.ca/portail
- Le client peut: payer ses factures, demander l'activation, télécharger les guides, voir ses factures, gérer son compte

## RÈGLE ABSOLUE DE RECOMMANDATION
Tu ne dois JAMAIS recommander un forfait qui n'existe pas dans le catalogue ci-dessus.
Tu ne dois JAMAIS inventer des prix, des vitesses, ou des noms de forfaits.
Utilise TOUJOURS l'outil recommend_plan avant de faire une suggestion.

## LOGIQUE DE DIMENSIONNEMENT
- 1-3 appareils, usage léger → forfait de base acceptable
- Télétravail OU gaming OU 4+ appareils → ne PAS proposer un forfait d'entrée de gamme
- 6+ appareils OU télétravail + streaming → forfait milieu ou haut de gamme obligatoire
- 8-10+ appareils OU télétravail + gaming + streaming → TOUJOURS le forfait le plus performant
- Si client veut TV + Internet → vérifier d'abord les bundles
- Un seul service par adresse: Internet OU TV (les forfaits TV incluent Internet)

## Statut utilisateur
${isAuthenticated ? `✅ Client connecté: ${userProfile?.full_name || "Client"}` : verifiedClientId ? `✅ Identité vérifiée` : `❌ Non connecté`}

${!hasAccess ? `**IMPORTANT**: Pour données personnelles, propose:
a) Connexion: [Se connecter](/portal/auth)
b) Vérification: email + date de naissance + 4 derniers chiffres téléphone` : "Client a accès à ses données. Utilise les outils."}

## Style et règles
- Toujours répondre dans la langue du client (français OU anglais)
- Professionnel, rassurant, clair, convaincant
- Vouvoiement toujours
- Max 2-3 paragraphes
- Si tu ne peux pas répondre → diriger vers support@nivra-telecom.ca
- Ne JAMAIS inventer de prix, disponibilité, ou information non listée
- Ne JAMAIS révéler de données techniques internes
- Si doute → escalade agent

Contact: support@nivra-telecom.ca (courriel uniquement)`;
  }

  return `You are **Nivra**, the intelligent assistant for Nivra Telecom, a prepaid telecom company in Quebec.

## COMPANY INFO
- Nivra Telecom is a Quebec-based Internet and TV provider
- No contract, no credit check, cancel anytime
- Service available in Montreal, Laval, Longueuil, Brossard, South Shore and surrounding areas
- Support email: support@nivra-telecom.ca (7 days/week, 8AM-8PM)
- NO phone support — email only
- Full support page: /support

## CURRENT NIVRA CATALOG (source of truth — never invent other plans)
${catalogSummary}

## CURRENT FEES
${feesSummary}
Note: All amounts subject to taxes (GST 5% + QST 9.975%).

## EQUIPMENT (fixed prices)
- Nivra WiFi Modem: $60 (one-time purchase)
- TV Terminal: $50 per terminal
- SIM: $30
- Activation fee: $10
- Delivery fee: $20
- First month FREE for new clients (automatic)

## ACTIVATION PROCESS
1. Client receives equipment by mail
2. Plugs in the Nivra WiFi Modem (coaxial cable + power adapter)
3. Waits for SOLID WHITE light (up to 20 minutes)
4. Logs into portal at nivra-telecom.ca/portail
5. Clicks "WiFi Activation" and fills out the form
6. Nivra team activates service in 10-30 minutes
7. Client receives email confirmation

## LED LIGHT COLORS
- Orange / blinking = starting up, wait
- Solid white = ready for activation
- Solid red = error, check coaxial cable

## RESET PROCEDURE (refurbished equipment)
**Step 1 — Remote reset (MUST DO FIRST):**
1. Press EXIT
2. Hold A + D for 5 seconds until green light
3. Press 9, 8, 1 — light blinks 3 times = success

**Step 2 — Terminal reset (AFTER remote):**
1. Hold PWR 5 seconds
2. Press center button
3. Press right arrow
4. Press down arrow
5. Press PWR to restart

## TROUBLESHOOTING
- No internet: unplug 30 sec, replug, wait 3 min
- Slow WiFi: move closer to modem, avoid obstacles
- Black TV screen: check HDMI input selection
- Terminal won't connect to WiFi: check password case, try WPS

## CLIENT PORTAL
- URL: nivra-telecom.ca/portail
- Clients can: pay bills, request activation, download guides, view invoices, manage account

## ABSOLUTE RECOMMENDATION RULE
NEVER recommend a plan not in the catalog above. NEVER invent prices or speeds.
ALWAYS use the recommend_plan tool before suggesting.

## SIZING LOGIC
- 1-3 devices, light use → entry plan OK
- Telework OR gaming OR 4+ devices → never entry-level
- 8-10+ devices OR telework + streaming → always highest tier available

## User Status
${isAuthenticated ? `✅ Logged in: ${userProfile?.full_name || "Customer"}` : verifiedClientId ? `✅ Identity verified` : `❌ Not logged in`}

${!hasAccess ? `For personal data, offer: a) Login: [Login](/portal/auth) b) Verify identity` : "Customer has access."}

## Style and rules
- Always respond in the same language the client writes in (French or English)
- Professional, clear, persuasive. Max 2-3 paragraphs.
- If you cannot answer → direct to support@nivra-telecom.ca
- NEVER invent prices, availability, or info not listed above
- NEVER reveal internal technical data
- When in doubt → escalate to agent

Contact: support@nivra-telecom.ca (email only)`;
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
    const systemPrompt = await buildSystemPrompt(language, isAuthenticated, verifiedClientId, userProfile, supabaseAdmin);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-12),
      { role: "user", content: message }
    ];

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
        max_tokens: 1500,
        temperature: 0.6,
      }),
    });

    if (!aiResponse.ok) {
      const fr = language === "fr";
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: fr ? "Trop de requêtes." : "Too many requests." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: fr ? "Service temporairement indisponible." : "Service temporarily unavailable." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        if (newId) { newVerifiedClientId = newId; verifiedClientId = newId; }
        toolResults.push({ role: "tool", tool_call_id: toolCall.id, content: result });
      }

      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [...messages, responseMessage, ...toolResults],
          max_tokens: 1500,
          temperature: 0.6,
        }),
      });

      if (!aiResponse.ok) throw new Error(`AI follow-up error: ${aiResponse.status}`);
      aiData = await aiResponse.json();
      responseMessage = aiData.choices?.[0]?.message;
    }

    const botResponse = responseMessage?.content || (language === "fr" ? "Désolé, je n'ai pas pu traiter votre demande." : "Sorry, I couldn't process your request.");

    // Suggested actions
    const suggestedActions: Array<{ label: string; action: string }> = [];
    const fr = language === "fr";
    if (toolCalls.some(t => t.function.name === "get_available_plans" || t.function.name === "recommend_plan")) {
      suggestedActions.push({ label: fr ? "📞 Rappel agent" : "📞 Agent callback", action: "book_callback" });
    }
    if (toolCalls.some(t => t.function.name === "get_account_balance")) {
      suggestedActions.push({ label: fr ? "📄 Mes factures" : "📄 My invoices", action: "invoices" });
    }

    // Log
    await supabaseAdmin.from("chatbot_logs").insert({
      session_id: sessionId,
      user_id: authenticatedUserId || verifiedClientId,
      is_authenticated: isAuthenticated,
      user_message: message.slice(0, 2000),
      bot_response: botResponse.slice(0, 4000),
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
