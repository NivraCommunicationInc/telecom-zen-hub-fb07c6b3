import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Field Sales Sync Edge Function
 * Handles server-side synchronization of field sales orders
 * 
 * CRITICAL: This function converts field_sales_orders into the main "orders" table
 * so they can be processed by Admin/Staff like any other order.
 * 
 * Actions:
 * - sync_single: Sync a single sale immediately after creation
 * - force_sync_all: Admin action to sync all pending sales
 * - get_stats: Get synchronization statistics
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Content-Type': 'application/json',
};

// Generate order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `FS${year}${month}${day}-${random}`;
}

function splitName(fullName?: string | null): { firstName?: string; lastName?: string } {
  const cleaned = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return {};
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizeServiceTypeLabel(services: any[]): string {
  const names = (Array.isArray(services) ? services : [])
    .map((s) => String(s?.name || s?.plan_name || s?.label || s?.category || "").trim())
    .filter(Boolean);

  const label = names.length > 0 ? names.join(" + ") : "Vente terrain";
  // Keep it reasonably short for lists/tables
  return label.slice(0, 120);
}

function mapLineItemType(raw?: any): string {
  const v = String(raw || "").toLowerCase();
  if (v.includes("internet") || v.includes("fibre")) return "internet";
  if (v.includes("tv") || v.includes("tele") || v.includes("télé")) return "tv";
  if (v.includes("mobile") || v.includes("cell")) return "mobile";
  if (v.includes("stream")) return "streaming";
  if (v.includes("secur")) return "security";
  return "other";
}

function wrapLineItemsForOrder(lineItems: any[]): Record<string, any> {
  return {
    line_items: lineItems,
    generated_at: new Date().toISOString(),
    version: 2,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non autorisé' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getUser(token);
    
    if (claimsError || !claims.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session invalide' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json();
    const { action, sale_id } = body;

    // Helper function to sync a single field sale to the orders table
    async function syncSaleToOrders(
      sale: any
    ): Promise<{ success: boolean; orderId?: string; order_number?: string; error?: string }> {
      console.log(`[field-sales-sync] Syncing sale ${sale.id} to orders table`);

      try {
        // Check if this sale was already synced to orders
        if (sale.converted_order_id) {
          console.log(`[field-sales-sync] Sale ${sale.id} already has converted_order_id: ${sale.converted_order_id}`);
          return { success: true, orderId: sale.converted_order_id };
        }

        // Get salesperson profile for rep info
        const { data: repProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email, phone')
          .eq('user_id', sale.salesperson_id)
          .maybeSingle();

        // Resolve / create a real client user_id (orders.user_id is NOT NULL)
        const customerEmail = String(sale.customer_email || "").trim().toLowerCase();
        if (!customerEmail) {
          throw new Error("Email client manquant sur la vente terrain");
        }

        let clientUserId: string | null = null;

        const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
          .from("profiles")
          .select("user_id, email")
          .ilike("email", customerEmail)
          .maybeSingle();

        if (existingProfileError) {
          console.warn("[field-sales-sync] profile lookup error:", existingProfileError);
        }

        if (existingProfile?.user_id) {
          clientUserId = existingProfile.user_id;
        }

        if (!clientUserId) {
          console.log("[field-sales-sync] No profile found for email, creating auth user:", customerEmail);
          const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: {
              full_name: sale.customer_name || null,
              phone: sale.customer_phone || null,
              source: "field_sales",
            },
          });

          if (createUserError || !createdUser?.user) {
            console.error("[field-sales-sync] createUser error:", createUserError);
            throw new Error(createUserError?.message || "Impossible de créer le compte client");
          }

          clientUserId = createdUser.user.id;

          // Ensure a profile row exists (some projects rely on profile trigger; we enforce it here)
          const { error: upsertProfileError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                user_id: clientUserId,
                email: customerEmail,
                full_name: sale.customer_name || null,
                phone: sale.customer_phone || null,
              } as any,
              { onConflict: "user_id" }
            );
          if (upsertProfileError) {
            console.warn("[field-sales-sync] profile upsert warning:", upsertProfileError);
          }
        }

        // Calculate totals from services
        const services = Array.isArray(sale.services) ? sale.services : [];
        let monthlyTotal = 0;
        let oneTimeFeesTotal = 0;

        const lineItems: any[] = [];
        for (const svc of services) {
          const qty = Number(svc?.quantity ?? 1) || 1;
          const monthly = Number(svc?.price_monthly ?? svc?.monthly_price ?? 0) || 0;
          const setup = Number(svc?.price_setup ?? svc?.setup_fee ?? 0) || 0;

          const itemName = String(svc?.name || svc?.plan_name || svc?.label || svc?.category || "Service");
          const itemType = mapLineItemType(svc?.type || svc?.category);

          if (monthly > 0) {
            monthlyTotal += monthly * qty;
            lineItems.push({
              category: "service",
              type: itemType,
              name: itemName,
              qty,
              unit_price: monthly,
              period: "monthly",
              taxable: true,
            });
          }

          if (setup > 0) {
            oneTimeFeesTotal += setup * qty;
            lineItems.push({
              category: "fee",
              type: "activation",
              name: `Frais de mise en service - ${itemName}`,
              qty,
              unit_price: setup,
              period: "one_time",
              taxable: true,
            });
          }
        }

        // Base fees model aligned to orders schema
        const subtotal = monthlyTotal;
        const activationFee = oneTimeFeesTotal;
        const deliveryFee = 0;
        const installationFee = 0;

        // Taxes (Quebec)
        const baseAmount = subtotal + activationFee + deliveryFee + installationFee;
        const tpsAmount = baseAmount * 0.05;
        const tvqAmount = baseAmount * 0.09975;
        const totalAmount = baseAmount + tpsAmount + tvqAmount;

        // Generate order number
        const orderNumber = generateOrderNumber();

        const serviceTypeLabel = normalizeServiceTypeLabel(services);
        const { firstName, lastName } = splitName(sale.customer_name);

        // Create order in main orders table (match actual schema)
        const { data: newOrder, error: orderError } = await supabaseAdmin
          .from('orders')
          .insert({
            user_id: clientUserId,
            order_number: orderNumber,
            created_by: 'field_sales',

            client_email: customerEmail,
            client_phone: sale.customer_phone || null,
            client_first_name: firstName || null,
            client_last_name: lastName || null,
            client_dob: sale.customer_date_of_birth || null,

            service_type: serviceTypeLabel,
            category: sale.services?.[0]?.category || 'Field Sales',

            subtotal: subtotal,
            activation_fee: activationFee,
            delivery_fee: deliveryFee,
            installation_fee: installationFee,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            total_amount: totalAmount,

            status: sale.payment_status === 'confirmed' ? 'confirmed' : 'pending',
            payment_status: sale.payment_status || 'pending',
            payment_method: sale.payment_method || 'cash',
            payment_reference: sale.payment_reference || null,
            amount_paid: sale.payment_status === 'confirmed' ? totalAmount : 0,

            appointment_date: sale.appointment_date || null,
            appointment_notes: sale.appointment_notes || null,

            // Shipping fields used by staff/admin flows
            shipping_address: sale.customer_address || null,
            shipping_city: sale.customer_city || null,
            shipping_postal_code: sale.customer_postal_code || null,

            // Keep original channel selection if TV workflow was used
            selected_channels: sale.selected_channels || [],

            // Contract/billing engines read structured line_items from equipment_details
            equipment_details: wrapLineItemsForOrder(lineItems),

            notes: `Vente terrain (ID: ${sale.id})\nClient: ${sale.customer_name || customerEmail}\nTéléphone: ${sale.customer_phone || '—'}\nAdresse: ${sale.customer_address || '—'}, ${sale.customer_city || ''} ${sale.customer_postal_code || ''}`.trim(),
            internal_notes: `[VENTE TERRAIN]\nPar: ${repProfile?.full_name || 'Vendeur'} (${repProfile?.email || '—'})\n${sale.internal_notes || ''}`.trim(),
          })
          .select('id, order_number')
          .single();

        if (orderError) {
          console.error(`[field-sales-sync] Error creating order:`, orderError);
          throw orderError;
        }

        console.log(`[field-sales-sync] Created order ${newOrder.order_number} for sale ${sale.id}`);

        // Update field_sales_orders with converted_order_id and sync status
        const { error: updateError } = await supabaseAdmin
          .from('field_sales_orders')
          .update({
            converted_order_id: newOrder.id,
            converted_at: new Date().toISOString(),
            sync_status: 'synced',
            synced_at: new Date().toISOString(),
            sync_error: null,
          })
          .eq('id', sale.id);

        if (updateError) {
          console.error(`[field-sales-sync] Error updating sale status:`, updateError);
        }

        // Calculate and record commission (10% of monthly)
        const commissionAmount = monthlyTotal * 0.10;
        
        if (commissionAmount > 0) {
          await supabaseAdmin
            .from('sales_commissions')
            .upsert({
              salesperson_id: sale.salesperson_id,
              field_order_id: sale.id,
              converted_order_id: newOrder.id,
              sale_amount: monthlyTotal,
              commission_rate: 0.10,
              commission_amount: commissionAmount,
              status: 'pending',
              created_at: new Date().toISOString(),
            }, {
              onConflict: 'field_order_id',
              ignoreDuplicates: false,
            });
        }

        return { success: true, orderId: newOrder.id, order_number: newOrder.order_number };

      } catch (error: any) {
        console.error(`[field-sales-sync] Error syncing sale ${sale.id}:`, error);
        
        // Mark as failed
        await supabaseAdmin
          .from('field_sales_orders')
          .update({ sync_status: 'failed', sync_error: error?.message || String(error) })
          .eq('id', sale.id);

        return { success: false, error: error.message };
      }
    }

    // ACTION: sync_single - Called immediately after field sale creation
    // Also handles convert_single for admin conversion
    const saleIdToSync = sale_id || body.field_order_id;
    if ((action === 'sync_single' || action === 'convert_single') && saleIdToSync) {
      // Get the sale
      const { data: sale, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .eq('id', saleIdToSync)
        .single();

      if (fetchError || !sale) {
        console.error('[field-sales-sync] Sale not found:', saleIdToSync, fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Vente non trouvée' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Verify the caller is the salesperson or an admin
      const isOwner = sale.salesperson_id === claims.user.id;
       const { data: adminRole, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', claims.user.id)
         // user_roles.role is enum app_role (admin, client, technician, employee, influencer, field_sales)
         .in('role', ['admin', 'employee'])
        .eq('is_active', true)
        .maybeSingle();

       if (roleError) {
         console.error('[field-sales-sync] Role check error:', roleError);
       }

      if (!isOwner && !adminRole) {
        console.error('[field-sales-sync] Unauthorized:', claims.user.id);
        return new Response(
          JSON.stringify({ success: false, error: 'Non autorisé' }),
          { status: 403, headers: corsHeaders }
        );
      }

      console.log('[field-sales-sync] Converting sale:', saleIdToSync, 'by user:', claims.user.id);
      const result = await syncSaleToOrders(sale);
      
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: corsHeaders }
      );
    }

    // ACTION: force_sync_all - Admin only, sync all pending sales
    if (action === 'force_sync_all') {
      // Require admin
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', claims.user.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Accès administrateur requis' }),
          { status: 403, headers: corsHeaders }
        );
      }

      // Get all pending sales (not yet synced to orders)
      const { data: pendingSales, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .or('sync_status.eq.pending,sync_status.eq.failed,converted_order_id.is.null');

      if (fetchError) {
        console.error('[field-sales-sync] Error fetching pending sales:', fetchError);
        throw fetchError;
      }

      if (!pendingSales || pendingSales.length === 0) {
        return new Response(
          JSON.stringify({ success: true, synced: 0, message: 'Aucune vente en attente' }),
          { headers: corsHeaders }
        );
      }

      let synced = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const sale of pendingSales) {
        const result = await syncSaleToOrders(sale);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`Sale ${sale.id}: ${result.error}`);
        }
      }

      console.log(`[field-sales-sync] Bulk sync complete: ${synced} synced, ${failed} failed`);

      return new Response(
        JSON.stringify({
          success: true,
          synced,
          failed,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: corsHeaders }
      );
    }

    // ACTION: get_stats - Get sync statistics
    if (action === 'get_stats') {
      const { data: allSales } = await supabaseAdmin
        .from('field_sales_orders')
        .select('sync_status, converted_order_id');

      const pending = allSales?.filter((d: any) => d.sync_status === 'pending' || !d.converted_order_id).length || 0;
      const synced = allSales?.filter((d: any) => d.sync_status === 'synced' && d.converted_order_id).length || 0;
      const failed = allSales?.filter((d: any) => d.sync_status === 'failed').length || 0;

      return new Response(
        JSON.stringify({ 
          success: true, 
          stats: { 
            pending, 
            synced, 
            failed, 
            total: allSales?.length || 0 
          } 
        }),
        { headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Action non reconnue' }),
      { status: 400, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[field-sales-sync] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
