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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    async function syncSaleToOrders(sale: any): Promise<{ success: boolean; orderId?: string; error?: string }> {
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

        // Calculate totals from services
        const services = sale.services || [];
        let monthlyTotal = 0;
        let setupTotal = 0;
        
        for (const svc of services) {
          monthlyTotal += (svc.price_monthly || 0) * (svc.quantity || 1);
          setupTotal += (svc.price_setup || 0) * (svc.quantity || 1);
        }

        // Calculate taxes (Quebec)
        const subtotal = monthlyTotal + setupTotal;
        const tpsAmount = subtotal * 0.05;
        const tvqAmount = subtotal * 0.09975;
        const total = subtotal + tpsAmount + tvqAmount;

        // Generate order number
        const orderNumber = generateOrderNumber();

        // Build services list for order items
        const orderItems = services.map((svc: any) => ({
          type: svc.category || 'service',
          name: svc.name,
          price: svc.price_monthly || 0,
          quantity: svc.quantity || 1,
          setup_fee: svc.price_setup || 0,
        }));

        // Create order in main orders table
        const { data: newOrder, error: orderError } = await supabaseAdmin
          .from('orders')
          .insert({
            order_number: orderNumber,
            customer_email: sale.customer_email,
            customer_phone: sale.customer_phone,
            status: sale.payment_status === 'confirmed' ? 'confirmed' : 'pending',
            total: total,
            subtotal: subtotal,
            tps_amount: tpsAmount,
            tvq_amount: tvqAmount,
            payment_status: sale.payment_status || 'pending',
            payment_method: sale.payment_method || 'cash',
            payment_reference: sale.payment_reference,
            services: orderItems,
            source: 'field_sales',
            source_reference: sale.id,
            delivery_address: sale.customer_address,
            delivery_city: sale.customer_city,
            delivery_postal_code: sale.customer_postal_code,
            internal_notes: `[VENTE TERRAIN] Par: ${repProfile?.full_name || 'Vendeur'}\n${sale.internal_notes || ''}`,
            customer_snapshot: {
              full_name: sale.customer_name,
              email: sale.customer_email,
              phone: sale.customer_phone,
              address: sale.customer_address,
              city: sale.customer_city,
              postal_code: sale.customer_postal_code,
              date_of_birth: sale.customer_date_of_birth,
              collected_by: repProfile?.full_name || 'Field Sales Rep',
              source: 'field_sales',
            },
            created_at: sale.created_at,
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

        return { success: true, orderId: newOrder.id };

      } catch (error: any) {
        console.error(`[field-sales-sync] Error syncing sale ${sale.id}:`, error);
        
        // Mark as failed
        await supabaseAdmin
          .from('field_sales_orders')
          .update({ sync_status: 'failed' })
          .eq('id', sale.id);

        return { success: false, error: error.message };
      }
    }

    // ACTION: sync_single - Called immediately after field sale creation
    if (action === 'sync_single' && sale_id) {
      // Get the sale
      const { data: sale, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .eq('id', sale_id)
        .single();

      if (fetchError || !sale) {
        return new Response(
          JSON.stringify({ success: false, error: 'Vente non trouvée' }),
          { status: 404, headers: corsHeaders }
        );
      }

      // Verify the caller is the salesperson or an admin
      const isOwner = sale.salesperson_id === claims.user.id;
      const { data: adminRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', claims.user.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .maybeSingle();

      if (!isOwner && !adminRole) {
        return new Response(
          JSON.stringify({ success: false, error: 'Non autorisé' }),
          { status: 403, headers: corsHeaders }
        );
      }

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
