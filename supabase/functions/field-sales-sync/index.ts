import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Field Sales Sync Edge Function
 * Handles server-side synchronization of offline field sales
 * - Force sync all pending sales
 * - Convert field sales to orders
 * - Calculate commissions
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

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

    // Verify admin authorization
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

    // Check if user is admin
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

    const { action } = await req.json();

    if (action === 'force_sync_all') {
      // Get all pending sales
      const { data: pendingSales, error: fetchError } = await supabaseAdmin
        .from('field_sales_orders')
        .select('*')
        .eq('sync_status', 'pending');

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
        try {
          // Update sync status
          const { error: updateError } = await supabaseAdmin
            .from('field_sales_orders')
            .update({
              sync_status: 'synced',
              synced_at: new Date().toISOString(),
            })
            .eq('id', sale.id);

          if (updateError) {
            throw updateError;
          }

          // Calculate and record commission (10% of monthly price)
          const commissionAmount = (sale.monthly_price || 0) * 0.10;
          
          if (commissionAmount > 0) {
            await supabaseAdmin
              .from('sales_commissions')
              .upsert({
                salesperson_id: sale.salesperson_id,
                field_sale_id: sale.id,
                amount: commissionAmount,
                status: 'pending',
                created_at: new Date().toISOString(),
              }, {
                onConflict: 'field_sale_id',
              });
          }

          synced++;
        } catch (error: any) {
          console.error(`[field-sales-sync] Error syncing sale ${sale.id}:`, error);
          failed++;
          errors.push(`Sale ${sale.id}: ${error.message}`);

          // Mark as failed
          await supabaseAdmin
            .from('field_sales_orders')
            .update({ sync_status: 'failed' })
            .eq('id', sale.id);
        }
      }

      console.log(`[field-sales-sync] Sync complete: ${synced} synced, ${failed} failed`);

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

    if (action === 'get_stats') {
      // Get sync statistics
      const { data: stats } = await supabaseAdmin
        .from('field_sales_orders')
        .select('sync_status')
        .then(({ data }) => {
          const pending = data?.filter(d => d.sync_status === 'pending').length || 0;
          const synced = data?.filter(d => d.sync_status === 'synced').length || 0;
          const failed = data?.filter(d => d.sync_status === 'failed').length || 0;
          return { data: { pending, synced, failed, total: data?.length || 0 } };
        });

      return new Response(
        JSON.stringify({ success: true, stats }),
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
