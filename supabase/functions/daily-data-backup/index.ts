/**
 * daily-data-backup — Export critical Nivra business data
 *
 * Primary:  Supabase Storage bucket "backups" (YYYY-MM-DD/{table}.json)
 * Secondary: Cloudflare R2 (offsite, best-effort — errors don't fail the run)
 *
 * Tables exported:
 *   orders, billing_customers, billing_subscriptions, billing_invoices,
 *   billing_payments, field_payment_intents, accounts, profiles, account_adjustments
 *
 * Cron: daily at 02:00 UTC
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "backups";
const R2_BUCKET = "nivra-backups";

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
    query: (sb: any, _c: string) =>
      sb.from("billing_customers")
        .select("id, email, first_name, last_name, phone, status, created_at")
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_subscriptions",
    query: (sb: any, _c: string) =>
      sb.from("billing_subscriptions")
        .select("id, customer_id, plan_name, plan_code, plan_price, status, cycle_start_date, cycle_end_date, created_at")
        .in("status", ["active", "pending", "suspended"])
        .order("created_at", { ascending: false }),
  },
  {
    name: "billing_invoices",
    query: (sb: any, cutoff: string) =>
      sb.from("billing_invoices")
        .select("id, invoice_number, customer_id, subscription_id, order_id, status, total, balance_due, amount_paid, created_at")
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
    name: "accounts",
    query: (sb: any, _c: string) =>
      sb.from("accounts")
        .select("id, client_id, account_number, status, primary_service_address, primary_service_city, created_at")
        .order("created_at", { ascending: false }),
  },
  {
    name: "profiles",
    query: (sb: any, _c: string) =>
      sb.from("profiles")
        .select("user_id, email, first_name, last_name, phone, status, created_at")
        .order("created_at", { ascending: false }),
  },
  {
    name: "account_adjustments",
    query: (sb: any, cutoff: string) =>
      sb.from("account_adjustments")
        .select("id, account_id, type, amount, description, status, is_permanent, months_remaining, duration_months, created_at")
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

// ── AWS S3 Signature V4 helpers (native Deno crypto, no npm dep) ─────────────
const te = new TextEncoder();

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, te.encode(msg));
}

async function deriveSigningKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  let key: ArrayBuffer = te.encode(`AWS4${secret}`).buffer;
  for (const part of [date, region, service, "aws4_request"]) {
    key = await hmacSha256(key, part);
  }
  return key;
}

async function uploadToR2(
  path: string,
  data: Uint8Array,
  endpoint: string,
  accessKey: string,
  secretKey: string,
): Promise<void> {
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateOnly = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(data);
  const host = new URL(endpoint).host;
  const canonicalUri = `/${R2_BUCKET}/${path}`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateOnly}/${region}/${service}/aws4_request`;
  const canonicalHash = await sha256Hex(te.encode(canonicalRequest));
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${canonicalHash}`;

  const signingKey = await deriveSigningKey(secretKey, dateOnly, region, service);
  const sigBytes = await hmacSha256(signingKey, stringToSign);
  const signature = [...new Uint8Array(sigBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`${endpoint}/${R2_BUCKET}/${path}`, {
    method: "PUT",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
    },
    body: data,
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 PUT ${res.status}: ${txt.slice(0, 300)}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Service role required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase: any = createClient(supabaseUrl, serviceKey);

    const r2Endpoint = Deno.env.get("CLOUDFLARE_R2_ENDPOINT") || "";
    const r2AccessKey = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID") || "";
    const r2SecretKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY") || "";
    const r2Enabled = !!(r2Endpoint && r2AccessKey && r2SecretKey);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString();

    const results: Record<string, { rows: number; bytes: number; error?: string; r2?: string }> = {};

    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 50 * 1024 * 1024 }).catch(() => {});

    for (const table of TABLES) {
      try {
        const { data, error } = await table.query(supabase, cutoffStr);
        if (error) {
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

        results[table.name] = uploadError
          ? { rows: rows.length, bytes: bytes.length, error: uploadError.message }
          : { rows: rows.length, bytes: bytes.length };

        // Secondary R2 upload (offsite) — best-effort, never fails the run
        if (r2Enabled) {
          uploadToR2(path, bytes, r2Endpoint, r2AccessKey, r2SecretKey)
            .then(() => { results[table.name].r2 = "ok"; })
            .catch((e) => { results[table.name].r2 = `error: ${e.message}`; });
        }

        console.log(`[backup] ${path} — ${rows.length} rows, ${bytes.length} bytes`);
      } catch (tableErr: any) {
        results[table.name] = { rows: 0, bytes: 0, error: tableErr?.message || String(tableErr) };
      }
    }

    // Give R2 uploads a moment to complete before returning
    if (r2Enabled) await new Promise((r) => setTimeout(r, 3000));

    const totalRows = Object.values(results).reduce((s, r) => s + r.rows, 0);
    const errors = Object.entries(results).filter(([, r]) => r.error).map(([t, r]) => `${t}: ${r.error}`);

    if (errors.length > 0) {
      await supabase.from("billing_system_alerts").insert({
        alert_type: "backup_partial_failure",
        entity_type: "daily_backup",
        severity: "high",
        details: { date: dateStr, errors, results },
        resolved: false,
      }).catch(() => {});
    }

    console.log(`[backup] Done ${dateStr}: ${totalRows} rows, ${errors.length} errors, r2_enabled=${r2Enabled}`);

    return new Response(
      JSON.stringify({ ok: true, date: dateStr, results, errors, r2_enabled: r2Enabled }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    reportEdgeError(error, { function: "daily-data-backup" }).catch(() => {});
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
