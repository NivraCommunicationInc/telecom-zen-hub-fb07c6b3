import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Rate limit: 30 promo validations per minute per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `promo:${clientIp}`, ...RATE_LIMITS.SEARCH });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code, client_email, client_id, cart_items, subtotal_before_discount, client_dob, client_phone, auto_apply } = await req.json();

    console.log(`[validate-promo] Validating code: ${code} for client: ${client_email}`);

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code promo requis" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize: trim, uppercase, remove trailing punctuation (accepts "Bienvenue." etc.)
    const normalizedCode = code.trim().toUpperCase().replace(/[.,;:!?]+$/, '');

    // ========== CHECK CLIENT REFERRAL CODES (profiles.referral_code) ==========
    const { data: referrerProfile, error: refProfileError } = await supabase
      .from('profiles')
      .select('user_id, email, phone, first_name, last_name, referral_code')
      .ilike('referral_code', normalizedCode)
      .maybeSingle();

    if (referrerProfile && !refProfileError) {
      console.log(`[validate-promo] Found client referral code: ${normalizedCode} from user: ${referrerProfile.user_id}`);

      // Anti-fraud: self-referral
      if (client_id && referrerProfile.user_id === client_id) {
        return new Response(
          JSON.stringify({ valid: false, error: "Auto-parrainage interdit" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Anti-fraud: same email
      if (client_email && referrerProfile.email && client_email.toLowerCase() === referrerProfile.email.toLowerCase()) {
        return new Response(
          JSON.stringify({ valid: false, error: "Même adresse courriel détectée" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Anti-fraud: same phone
      if (client_id && referrerProfile.phone) {
        const { data: referredProfile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', client_id)
          .maybeSingle();
        if (referredProfile?.phone && referredProfile.phone === referrerProfile.phone) {
          return new Response(
            JSON.stringify({ valid: false, error: "Même numéro de téléphone détecté" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Already used a referral
      if (client_id) {
        const { count } = await supabase
          .from('client_referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referred_user_id', client_id);
        if (count && count > 0) {
          return new Response(
            JSON.stringify({ valid: false, error: "Vous avez déjà utilisé un code de parrainage" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Client referral code is valid — no discount, just tracking
      const result = {
        valid: true,
        is_client_referral: true,
        referrer_user_id: referrerProfile.user_id,
        referrer_name: `${referrerProfile.first_name || ''} ${referrerProfile.last_name || ''}`.trim(),
        referral_code: normalizedCode,
        promo: {
          id: `client_referral_${referrerProfile.user_id}`,
          code: normalizedCode,
          name: 'Code de parrainage Nivra',
          discount_type: 'fixed_amount',
          discount_value: 0,
          applies_to: { services: false, one_time_fees: false, equipment: false, delivery: false, installation: false },
          stackable: false,
          new_customers_only: true,
          duration: 'none',
          discount_label: 'Parrainage Nivra — carte-cadeau 25$ pour votre parrain après 3 mois',
        },
        discount_amount: 0,
        eligible_subtotal: 0,
        breakdown: { services: 0, one_time_fees: 0, equipment: 0, delivery: 0, installation: 0 },
      };

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CHECK INFLUENCER REFERRAL CODES (referral_codes table) ==========
    // First check referral_codes table (influencer codes)
    const { data: referralCode, error: referralError } = await supabase
      .from('referral_codes')
      .select('*, influencers(*)')
      .ilike('code', normalizedCode)
      .eq('status', 'active')
      .single();

    if (referralCode && !referralError) {
      console.log(`[validate-promo] Found influencer referral code: ${normalizedCode} for influencer: ${referralCode.influencer_id}`);
      
      // Check if customer has already used ANY referral code (lifetime limit)
      if (client_email) {
        const { count: usedCount } = await supabase
          .from('referral_attributions')
          .select('id', { count: 'exact', head: true })
          .eq('customer_email', client_email.toLowerCase());

        if (usedCount !== null && usedCount > 0) {
          return new Response(
            JSON.stringify({ valid: false, error: "Vous avez déjà utilisé un code de référence" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Fetch referral program settings from DB (generic — no hardcoded percentages)
      const { data: refSettings } = await supabase
        .from('referral_program_settings')
        .select('discount_percent_first_invoice_monthly')
        .limit(1)
        .single();

      const referralDiscountPercent = refSettings?.discount_percent_first_invoice_monthly ?? 50;

      // Calculate eligible subtotal - SERVICES ONLY for referral codes
      let servicesSubtotal = 0;
      for (const item of cart_items || []) {
        if (item.type === 'service') {
          servicesSubtotal += item.amount;
        }
      }

      if (servicesSubtotal <= 0) {
        return new Response(
          JSON.stringify({ valid: false, error: "Aucun service éligible pour ce code de référence" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Discount from DB config, capped at eligible subtotal
      const discountAmount = Math.round(Math.min(servicesSubtotal, servicesSubtotal * (referralDiscountPercent / 100)) * 100) / 100;

      console.log(`[validate-promo] Valid referral code ${normalizedCode}: ${referralDiscountPercent}% off services = ${discountAmount} CAD`);

      const result = {
        valid: true,
        is_referral_code: true,
        referral_code_id: referralCode.id,
        influencer_id: referralCode.influencer_id,
        promo: {
          id: `referral_${referralCode.id}`,
          code: referralCode.code.toUpperCase(),
          name: `Rabais parrainage ${referralDiscountPercent}%`,
          discount_type: 'percent',
          discount_value: referralDiscountPercent,
          applies_to: { services: true, one_time_fees: false, equipment: false, delivery: false, installation: false },
          stackable: false,
          new_customers_only: true,
          duration: 'first_cycle_only',
          discount_label: `Rabais parrainage ${referralDiscountPercent}% (1er mois seulement)`,
        },
        discount_amount: discountAmount,
        eligible_subtotal: servicesSubtotal,
        breakdown: {
          services: servicesSubtotal,
          one_time_fees: 0,
          equipment: 0,
          delivery: 0,
          installation: 0,
        },
      };

      return new Response(
        JSON.stringify(result),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not a referral code, check promotions table
    const { data: promo, error: promoError } = await supabase
      .from('promotions')
      .select('*')
      .ilike('code', normalizedCode)
      .single();

    if (promoError || !promo) {
      console.log(`[validate-promo] Code not found: ${normalizedCode}`);
      return new Response(
        JSON.stringify({ valid: false, error: "Code promo invalide" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if active
    if (promo.status !== 'active') {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code promo n'est plus actif" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check date range
    const now = new Date();
    if (promo.start_at && new Date(promo.start_at) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code promo n'est pas encore actif" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (promo.end_at && new Date(promo.end_at) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Ce code promo a expiré" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if "new customers only" promo — enhanced 2-of-3 identity check (email, DOB, phone)
    if (promo.new_customers_only === true) {
      // First check by client_id (existing logged-in client)
      if (client_id) {
        const { count: orderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client_id)
          .in('status', ['completed', 'active', 'processing', 'paid']);

        if (orderCount !== null && orderCount > 0) {
          return new Response(
            JSON.stringify({ valid: false, error: "Ce code est réservé aux nouveaux clients", is_new_client: false }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // 2-of-3 identity match: email, DOB, phone — count matches against existing profiles with orders
      let identityMatches = 0;
      const matchedUserIds = new Set<string>();

      if (client_email) {
        const { data: emailMatch } = await supabase
          .from('profiles')
          .select('user_id')
          .ilike('email', client_email)
          .maybeSingle();
        if (emailMatch?.user_id && (!client_id || emailMatch.user_id !== client_id)) {
          identityMatches++;
          matchedUserIds.add(emailMatch.user_id);
        }
      }

      if (client_dob) {
        const { data: dobMatches } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('date_of_birth', client_dob);
        if (dobMatches && dobMatches.length > 0) {
          for (const m of dobMatches) {
            if (m.user_id && (!client_id || m.user_id !== client_id)) {
              identityMatches++;
              matchedUserIds.add(m.user_id);
              break;
            }
          }
        }
      }

      if (client_phone) {
        const normalizedPhone = String(client_phone).replace(/\D/g, '');
        if (normalizedPhone.length >= 10) {
          const last10 = normalizedPhone.slice(-10);
          const { data: phoneMatches } = await supabase
            .from('profiles')
            .select('user_id, phone')
            .ilike('phone', `%${last10}%`)
            .limit(5);
          if (phoneMatches && phoneMatches.length > 0) {
            for (const m of phoneMatches) {
              if (m.user_id && (!client_id || m.user_id !== client_id)) {
                identityMatches++;
                matchedUserIds.add(m.user_id);
                break;
              }
            }
          }
        }
      }

      // If 2+ identifiers match an existing user with paid orders — reject
      if (identityMatches >= 2) {
        let hasOrders = false;
        for (const uid of matchedUserIds) {
          const { count } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', uid)
            .in('status', ['completed', 'active', 'processing', 'paid']);
          if (count && count > 0) { hasOrders = true; break; }
        }
        if (hasOrders) {
          return new Response(
            JSON.stringify({
              valid: false,
              is_new_client: false,
              error: auto_apply
                ? "Client existant détecté"
                : "Ce compte existe déjà dans notre système. Le code premier mois gratuit est réservé aux nouveaux clients.",
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Check scope restrictions
    if (promo.scope === 'restricted') {
      let allowed = false;

      if (promo.restricted_client_ids && promo.restricted_client_ids.length > 0 && client_id) {
        allowed = promo.restricted_client_ids.includes(client_id);
      }

      if (!allowed && promo.restricted_email_domains && promo.restricted_email_domains.length > 0 && client_email) {
        const emailDomain = client_email.split('@')[1]?.toLowerCase();
        allowed = promo.restricted_email_domains.some((d: string) => d.toLowerCase() === emailDomain);
      }

      if (!allowed) {
        return new Response(
          JSON.stringify({ valid: false, error: "Ce code promo n'est pas disponible pour votre compte" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check total usage limit
    if (promo.usage_limit_total !== null) {
      const { count } = await supabase
        .from('promotion_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('promotion_id', promo.id);

      if (count !== null && count >= promo.usage_limit_total) {
        return new Response(
          JSON.stringify({ valid: false, error: "Ce code promo a atteint sa limite d'utilisation" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check per-client usage limit
    if (promo.usage_limit_per_client !== null && client_email) {
      const { count } = await supabase
        .from('promotion_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('promotion_id', promo.id)
        .eq('client_email', client_email.toLowerCase());

      if (count !== null && count >= promo.usage_limit_per_client) {
        return new Response(
          JSON.stringify({ valid: false, error: "Vous avez déjà utilisé ce code promo" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate eligible subtotal based on applies_to flags
    const appliesTo = promo.applies_to as Record<string, boolean>;
    const breakdown = {
      services: 0,
      one_time_fees: 0,
      equipment: 0,
      delivery: 0,
      installation: 0,
    };

    let eligibleSubtotal = 0;

    for (const item of cart_items || []) {
      let eligible = false;
      
      switch (item.type) {
        case 'service':
          eligible = appliesTo.services === true;
          if (eligible) breakdown.services += item.amount;
          break;
        case 'one_time_fee':
          eligible = appliesTo.one_time_fees === true;
          if (eligible) breakdown.one_time_fees += item.amount;
          break;
        case 'equipment':
          eligible = appliesTo.equipment === true;
          if (eligible) breakdown.equipment += item.amount;
          break;
        case 'delivery':
          eligible = appliesTo.delivery === true;
          if (eligible) breakdown.delivery += item.amount;
          break;
        case 'installation':
          eligible = appliesTo.installation === true;
          if (eligible) breakdown.installation += item.amount;
          break;
      }

      if (eligible) {
        eligibleSubtotal += item.amount;
      }
    }

    if (eligibleSubtotal <= 0) {
      return new Response(
        JSON.stringify({ valid: false, error: "Aucun article éligible pour ce code promo" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum subtotal
    if (promo.min_subtotal !== null && subtotal_before_discount < promo.min_subtotal) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Ce code promo nécessite un minimum de ${promo.min_subtotal.toFixed(2)} $ avant taxes` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate discount
    let discountAmount = 0;

    if (promo.discount_type === 'percent') {
      discountAmount = eligibleSubtotal * (promo.discount_value / 100);
    } else if (promo.discount_type === 'fixed_amount') {
      discountAmount = Math.min(promo.discount_value, eligibleSubtotal);
    }

    // Apply cap if set
    if (promo.max_discount_amount !== null && discountAmount > promo.max_discount_amount) {
      discountAmount = promo.max_discount_amount;
    }

    // Enforce min_payable_cents: discount cannot reduce total below minimum payable
    if (promo.min_payable_cents != null && promo.min_payable_cents > 0) {
      const minPayable = promo.min_payable_cents / 100; // convert cents to dollars
      const maxAllowedDiscount = Math.max(0, subtotal_before_discount - minPayable);
      if (discountAmount > maxAllowedDiscount) {
        discountAmount = maxAllowedDiscount;
      }
    }

    // Round to 2 decimals
    discountAmount = Math.round(discountAmount * 100) / 100;

    console.log(`[validate-promo] Valid promo ${normalizedCode}: discount ${discountAmount} CAD`);

    // Build label for first-cycle-only promos
    let discountLabel = promo.name;
    if (promo.duration === 'first_cycle_only') {
      discountLabel = `${promo.name} (1er mois seulement)`;
    }

    const result = {
      valid: true,
      is_new_client: promo.new_customers_only === true ? true : undefined,
      auto_applied: auto_apply === true ? true : undefined,
      promo: {
        id: promo.id,
        code: promo.code.toUpperCase(),
        name: promo.name,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        applies_to: appliesTo,
        stackable: promo.stackable,
        new_customers_only: promo.new_customers_only,
        duration: promo.duration,
        discount_label: discountLabel,
      },
      discount_amount: discountAmount,
      eligible_subtotal: eligibleSubtotal,
      breakdown,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("[validate-promo] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inattendue";
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ valid: false, error: message }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
