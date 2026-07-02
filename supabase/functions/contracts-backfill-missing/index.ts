import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Service role client - bypasses RLS for automated backfill
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface BackfillResult {
  created: number;
  skipped: number;
  errors: string[];
  details: Array<{
    orderId: string;
    orderNumber: string;
    action: "created" | "skipped" | "error";
    contractId?: string;
    reason?: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Auth: require either a valid JWT (admin/employee) or the service role key (cron jobs)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Authentification requise" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    let isAdminRequest = false;

    // Service role key bypass (for cron jobs)
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isServiceRole) {
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Session invalide" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleRows } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "active");
      isAdminRequest = (roleRows || []).some((r: any) =>
        ["admin", "supervisor", "employee"].includes(r.role)
      );
      if (!isAdminRequest) {
        return new Response(JSON.stringify({ success: false, error: "Accès refusé — rôle insuffisant" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[ContractsBackfill] Admin request from:", user.email);
    } else {
      isAdminRequest = false; // cron via service role
    }

    console.log("[ContractsBackfill] Starting backfill (admin:", isAdminRequest, "service_role:", isServiceRole, ")");

    const result: BackfillResult = {
      created: 0,
      skipped: 0,
      errors: [],
      details: [],
    };

    // 1. Find orders with confirmed payments but NO active contract
    const { data: ordersWithoutContract, error: queryError } = await db
      .from("orders")
      .select(`
        id, order_number, confirmation_number, user_id, client_email,
        payment_status, payment_confirmed_at, created_at, updated_at,
        related_contract_id
      `)
      .in("payment_status", ["captured", "paid", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(500); // Process in batches

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    console.log(`[ContractsBackfill] Found ${ordersWithoutContract?.length || 0} confirmed orders to check`);

    for (const order of ordersWithoutContract || []) {
      try {
        // Check if active contract exists for this order
        const { data: existingContract } = await db
          .from("contracts")
          .select("id, status")
          .eq("order_id", order.id)
          .not("status", "in", "(void,superseded)")
          .maybeSingle();

        if (existingContract) {
          result.skipped++;
          result.details.push({
            orderId: order.id,
            orderNumber: order.order_number || order.confirmation_number || "N/A",
            action: "skipped",
            contractId: existingContract.id,
            reason: `Contract exists with status: ${existingContract.status}`,
          });
          continue;
        }

        // Generate contract number (Rule 2-9: starts with 2-9)
        const contractNumber = String(Math.floor(Math.random() * 8) + 2) + 
          String(Math.floor(Math.random() * 100000000)).padStart(8, "0");

        // Create contract
        const { data: newContract, error: insertError } = await db
          .from("contracts")
          .insert({
            user_id: order.user_id,
            owner_user_id: order.user_id,
            contract_name: `Contrat de Service - Commande #${order.order_number || order.confirmation_number || order.id.slice(0, 8)}`,
            contract_url: "",
            contract_number: contractNumber,
            order_id: order.id,
            version: 1,
            status: "waiting_client_signature",
            template_id: "contract_template_v2026_02_06",
            template_version: "v2026.02.07-Backfill",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          // Check if it's a unique violation (race condition)
          if (insertError.code === "23505") {
            result.skipped++;
            result.details.push({
              orderId: order.id,
              orderNumber: order.order_number || "N/A",
              action: "skipped",
              reason: "Contract created by concurrent process",
            });
            continue;
          }
          throw insertError;
        }

        // Link contract to order if not linked
        if (!order.related_contract_id) {
          await db
            .from("orders")
            .update({ related_contract_id: newContract.id })
            .eq("id", order.id);
        }

        // Get client profile for email
        const { data: profile } = await db
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", order.user_id)
          .maybeSingle();

        const clientEmail = profile?.email || order.client_email;
        const clientName = profile?.full_name || "Client";

        // Queue signature email with idempotency - check first, then insert if not exists
        const idempotencyKey = `contract_sig_backfill_${order.id}`;
        
        const { data: existingEmail } = await db
          .from("email_queue")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        
        if (!existingEmail) {
          await db
            .from("email_queue")
            .insert({
              event_key: `contract_backfill_${newContract.id}`,
              to_email: clientEmail,
              template_key: "contract_ready_for_signature",
              template_vars: {
                clientName,
                contractNumber,
                contractId: newContract.id,
                orderNumber: order.order_number || order.confirmation_number,
                signatureUrl: "https://nivra-telecom.ca/portal/contracts",
              },
              priority: 0,
              idempotency_key: idempotencyKey,
              created_at: new Date().toISOString(),
            });
        }

        result.created++;
        result.details.push({
          orderId: order.id,
          orderNumber: order.order_number || order.confirmation_number || "N/A",
          action: "created",
          contractId: newContract.id,
        });

        console.log(`[ContractsBackfill] Created contract ${contractNumber} for order ${order.id}`);

      } catch (orderError) {
        result.errors.push(`Order ${order.id}: ${orderError.message}`);
        result.details.push({
          orderId: order.id,
          orderNumber: order.order_number || "N/A",
          action: "error",
          reason: orderError.message,
        });
      }
    }

    console.log(`[ContractsBackfill] Complete: created=${result.created}, skipped=${result.skipped}, errors=${result.errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[ContractsBackfill] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
