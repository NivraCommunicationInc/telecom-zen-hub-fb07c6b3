/**
 * contract-signature-reminders — Daily cron worker
 *
 * Runs once per day (pg_cron 03:15 UTC). For each unsigned contract:
 *   - J+3 : first reminder (email + auto note)
 *   - J+7 : final reminder (email + auto note)
 *   - J+14: mark as `expired`, drop staff alert note
 *
 * Never spams: guarded by `last_reminder_at`, `reminder_count`, and status transitions.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const _cronStartedAt = now;
  const stats = { scanned: 0, reminded_j3: 0, reminded_j7: 0, expired: 0, errors: 0 };


  try {
    const { data: pending, error } = await supabase
      .from("contracts")
      .select("id, order_id, user_id, contract_name, contract_number, created_at, status, is_signed, last_reminder_at, reminder_count, signature_token")
      .eq("is_signed", false)
      .in("status", ["draft", "waiting_client_signature", "sent"])
      .limit(500);

    if (error) throw error;
    stats.scanned = pending?.length || 0;

    for (const c of pending || []) {
      try {
        const created = new Date(c.created_at);
        const age = daysBetween(created, now);
        const lastReminder = c.last_reminder_at ? new Date(c.last_reminder_at) : null;
        const daysSinceLast = lastReminder ? daysBetween(lastReminder, now) : 999;

        // Fetch client contact
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", c.user_id)
          .maybeSingle();
        const email = profile?.email;
        const name = profile?.full_name || "Client";

        // ─── J+14: expire ───
        if (age >= 14) {
          await supabase.from("contracts").update({
            status: "expired",
            expired_at: now.toISOString(),
          }).eq("id", c.id);

          await supabase.from("client_internal_notes").insert({
            client_user_id: c.user_id,
            category: "contract",
            note: `Contrat ${c.contract_number || c.id.slice(0, 8)} EXPIRÉ après 14 jours sans signature. Suivi manuel requis.`,
            created_by: null,
            author_name: "Système — relance auto",
          } as any);

          stats.expired++;
          continue;
        }

        // ─── J+7: final reminder ───
        if (age >= 7 && (c.reminder_count ?? 0) < 2 && daysSinceLast >= 3) {
          if (email) {
            await supabase.from("email_queue").insert({
              event_key: `contract_reminder_j7_${c.id}`,
              to_email: email,
              template_key: "contract_ready",
              template_vars: {
                client_name: name,
                contract_name: c.contract_name || "Contrat de service",
                contract_number: c.contract_number || "",
                portal_path: "/portal/contracts",
                is_reminder: true,
                reminder_stage: "final",
                subject_override: "⏰ Dernier rappel — Signature de contrat requise",
              } as any,
              priority: 5,
              status: "queued",
            } as any);
          }
          await supabase.from("contracts").update({
            last_reminder_at: now.toISOString(),
            reminder_count: (c.reminder_count ?? 0) + 1,
          }).eq("id", c.id);
          await supabase.from("client_internal_notes").insert({
            client_user_id: c.user_id,
            category: "contract",
            note: `Rappel FINAL de signature (J+7) envoyé pour contrat ${c.contract_number || c.id.slice(0, 8)}.`,
            author_name: "Système — relance auto",
          } as any);
          stats.reminded_j7++;
          continue;
        }

        // ─── J+3: first reminder ───
        if (age >= 3 && (c.reminder_count ?? 0) < 1 && daysSinceLast >= 3) {
          if (email) {
            await supabase.from("email_queue").insert({
              event_key: `contract_reminder_j3_${c.id}`,
              to_email: email,
              template_key: "contract_ready",
              template_vars: {
                client_name: name,
                contract_name: c.contract_name || "Contrat de service",
                contract_number: c.contract_number || "",
                portal_path: "/portal/contracts",
                is_reminder: true,
                reminder_stage: "first",
                subject_override: "Rappel — Signature de contrat en attente",
              } as any,
              priority: 5,
              status: "queued",
            } as any);
          }
          await supabase.from("contracts").update({
            last_reminder_at: now.toISOString(),
            reminder_count: (c.reminder_count ?? 0) + 1,
          }).eq("id", c.id);
          await supabase.from("client_internal_notes").insert({
            client_user_id: c.user_id,
            category: "contract",
            note: `Rappel de signature (J+3) envoyé pour contrat ${c.contract_number || c.id.slice(0, 8)}.`,
            author_name: "Système — relance auto",
          } as any);
          stats.reminded_j3++;
        }
      } catch (e) {
        console.error("[contract-signature-reminders] per-contract error:", e);
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[contract-signature-reminders] fatal:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message, stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
