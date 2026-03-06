import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const { code, client_email, client_id, cart_items, subtotal_before_discount } = await req.json();

    console.log(`[validate-promo] Validating code: ${code} for client: ${client_email}`);

    if (!code || !code.trim()) {
      return new Response(
        JSON.stringify({ valid: false, error: "Code promo requis" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize: trim, uppercase, remove trailing punctuation (accepts "Bienvenue." etc.)
    const normalizedCode = code.trim().toUpperCase().replace(/[.,;:!?]+$/, '');

    // First check referral_codes table (influencer codes)
    const { data: referralCode, error: referralError } = await supabase
      .from('referral_codes')
      .select('*, influencers(*)')
      .ilike('code', normalizedCode)
      .eq('status', 'active')
      .single();

    if (referralCode && !referralError) {
      console.log(`[validate-promo] Found referral code: ${normalizedCode} for influencer: ${referralCode.influencer_id}`);
      
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

    // Check if "new customers only" promo
    if (promo.new_customers_only === true && client_id) {
      // Check if client has any completed orders
      const { count: orderCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client_id)
        .in('status', ['completed', 'active', 'processing', 'paid']);

      if (orderCount !== null && orderCount > 0) {
        return new Response(
          JSON.stringify({ valid: false, error: "Ce code est réservé aux nouveaux clients" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
