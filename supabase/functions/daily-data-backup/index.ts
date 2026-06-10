/**
 * daily-data-backup — Export critical Nivra business data to Supabase Storage
 *
 * Exports the following tables as JSON snapshots to the "backups" bucket:
 *   - orders (last 90 days)
 *   - billing_customers
 *   - billing_subscriptions (active)
 *   - billing_invoices (last 90 days)
 *   - billing_payments (last 90 days)
 *   - field_payment_intents (last 90 days)
 *
 * Files are stored as: backups/YYYY-MM-DD/{table}.json
 * Retention: keep 90 days (older files are overwritten on re-run, older dates
 * are never touched — full history accumulates in Storage).
 *
 * Called daily via pg_cron at 02:00 UTC.
 * Can also be triggered manually from Core admin.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "backups";
const TABLES = [
  {
    name: "orders",
    query: (sb: any, cutoff: string) =>
      sb.from("orders")
        .select("id, order_number, user_id, status, payment_status, payment_method, total_amount, created_at, source, service_type, client_email, client_first_name, client_last_name")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_customers",
    query: (sb: any, _cutoff: string) =>
      sb.from("billing_customers")
        .select("id, email, first_name, last_name, phone, status, created_at")
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_subscriptions",
    query: (sb: any, _cutoff: string) =>
      sb.from("billing_subscriptions")
        .select("id, customer_id, plan_name, plan_code, plan_price, status, cycle_start_date, cycle_end_date, created_at")
        .in("status", ["active", "pending", "suspended"])
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_invoices",
    query: (sb: any, cutoff: string) =>
      sb.from("billing_invoices")
        .select("id, invoice_number, customer_id, subscription_id, order_id, status, total, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_payments",
    query: (sb: any, cutoff: string) =>
      sb.from("billing_payments")
        .select("id, invoice_id, customer_id, amount, method, provider, status, provider_payment_id, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false }),
  },
  {
    name: "field_payment_intents",
    query: (sb: any, cutoff: string) =>
      sb.from("field_payment_intents" as any)
        .select("id, agent_id, quote_id, amount, status, customer_email, customer_name, paid_at, converted_order_id, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false }),
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require service role or admin authorization
  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isServiceRole = authHeader === `Bearer ${serviceKey}`;

  if (!isServiceRole) {
    return new Response(
      JSON.stringify({ error: "Service role required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase: any = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0]; // YYYY-MM-DD
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString();

    const results: Record<string, { rows: number; bytes: number; error?: string }> = {};

    // Ensure bucket exists (idempotent)
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    }).catch(() => {}); // Already exists — ignore error

    for (const table of TABLES) {
      try {
        const { data, error } = await table.query(supabase, cutoffStr);
        if (error) {
          console.error(`[backup] ${table.name} query error:`, error.message);
          results[table.name] = { rows: 0, bytes: 0, error: error.message };
          continue;
        }

        const rows = data || [];
        const json = JSON.stringify({ exported_at: today.toISOString(), table: table.name, rows });
        const bytes = new TextEncoder().encode(json);
        const path = `${dateStr}/${table.name}.json`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: "application/json", upsert: true });

        if (uploadError) {
          console.error(`[backup] upload ${path} error:`, uploadError.message);
          results[table.name] = { rows: rows.length, bytes: bytes.length, error: uploadError.message };
        } else {
          console.log(`[backup] ✓ ${path} (${rows.length} rows, ${bytes.length} bytes)`);
          results[table.name] = { rows: rows.length, bytes: bytes.length };
        }
      } catch (tableErr: any) {
        console.error(`[backup] ${table.name} exception:`, tableErr?.message || tableErr);
        results[table.name] = { rows: 0, bytes: 0, error: tableErr?.message || String(tableErr) };
      }
    }

    const totalRows = Object.values(results).reduce((s, r) => s + r.rows, 0);
    const errors = Object.entries(results).filter(([, r]) => r.error).map(([t, r]) => `${t}: ${r.error}`);

    console.log(`[backup] Complete for ${dateStr}: ${totalRows} rows total, ${errors.length} errors`);

    if (errors.length > 0) {
      // Log to billing_system_alerts so admins are notified
      await supabase.from("billing_system_alerts").insert({
        alert_type: "backup_partial_failure",
        entity_type: "daily_backup",
        severity: "high",
        details: { date: dateStr, errors, results },
        resolved: false,
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ ok: true, date: dateStr, results, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[backup] Fatal error:", error);
    reportEdgeError(error, { function: "daily-data-backup" }).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
