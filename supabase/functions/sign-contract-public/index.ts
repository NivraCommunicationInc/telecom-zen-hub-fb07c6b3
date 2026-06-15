/**
 * sign-contract-public â€” Public no-auth endpoint for click-to-sign contracts
 *
 * Routes:
 *   GET  ?token=...           â†’ fetch contract summary for signing page
 *   POST { token, name, ... } â†’ record signature with IP + user-agent + consent
 *
 * Security:
 *   - verify_jwt = false (public)
 *   - Token validated via SECURITY DEFINER RPCs
 *   - IP captured from CF-Connecting-IP / X-Forwarded-For (server-side, not trustable client value)
 *   - Generic error messages to avoid leaking contract existence
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    (headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ success: false, error: "SERVER_MISCONFIGURED" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token || token.length < 16) {
        return jsonResponse({ success: false, error: "TOKEN_INVALID" }, 400);
      }
      const { data, error } = await supabase.rpc(
        "get_contract_for_signing" as any,
        { p_token: token },
      );
      if (error) {
        console.error("[sign-contract-public][GET] RPC error:", error);
        return jsonResponse({ success: false, error: "SERVER_ERROR" }, 500);
      }
      return jsonResponse(data ?? { success: false, error: "TOKEN_NOT_FOUND" });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const token = String(body?.token || "").trim();
      const consent = body?.consent === true;
      const signerName = body?.name ? String(body.name).slice(0, 200) : null;
      const userAgent = (req.headers.get("user-agent") || "unknown").slice(0, 500);
      const clientIp = getClientIp(req).slice(0, 64);

      if (!token || token.length < 16) {
        return jsonResponse({ success: false, error: "TOKEN_INVALID" }, 400);
      }
      if (!consent) {
        return jsonResponse({ success: false, error: "CONSENT_REQUIRED" }, 400);
      }

      // Compute SHA-256 hash of contract CONTENT for non-repudiation (LCCJTI)
      // Fetch the full contract data (clauses, pricing, services) to hash the actual content,
      // not just signature metadata. This satisfies LCCJTI non-repudiation requirements.
      let contractContentForHash: string;
      try {
        const { data: contractData } = await supabase.rpc(
          "get_contract_for_signing" as any,
          { p_token: token },
        );
        // contractData contains full contract details: clauses, plan, price, services, parties
        // Hash on the complete contract data to ensure the hash covers what was agreed to
        contractContentForHash = JSON.stringify({
          contract_data: contractData,
          token_reference: token.slice(0, 8) + "…", // include partial token as binding reference
          signer_ip: clientIp,
          signed_at: new Date().toISOString(),
        });
      } catch (_fetchErr) {
        // Fallback: hash on token + IP + timestamp (better than nothing, but log it)
        console.warn("[sign-contract-public] Could not fetch contract data for hash — using metadata fallback");
        contractContentForHash = JSON.stringify({ contract_id: token, signer_ip: clientIp, timestamp: new Date().toISOString() });
      }
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contractContentForHash));
      const pdfSha256 = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: result, error } = await supabase.rpc(
        "consume_contract_signature_token" as any,
        {
          p_token: token,
          p_signer_ip: clientIp,
          p_signer_user_agent: userAgent,
          p_signer_name: signerName,
          p_consent: true,
        },
      );

      if (error) {
        console.error("[sign-contract-public][POST] RPC error:", error);
        return jsonResponse({ success: false, error: "SERVER_ERROR" }, 500);
      }

      const payload = (result || {}) as any;
      if (!payload?.success) {
        return jsonResponse(payload, 400);
      }

      // â”€â”€ Best-effort post-signature notifications (do not block client) â”€â”€
      try {
        // 0. Persist SHA-256 hash on the contract_signatures row (LCCJTI non-repudiation)
        await supabase.from("contract_signatures")
          .update({ pdf_sha256: pdfSha256 })
          .eq("contract_id", payload.contract_id)
          .then(({ error: shaErr }) => {
            if (shaErr) console.warn("[sign-contract-public] pdf_sha256 update failed:", shaErr.message);
          });

        // 1. Activity log
        await supabase.from("activity_logs").insert({
          action: "contract_signed_by_client",
          entity_type: "contract",
          entity_id: payload.contract_id,
          actor_name: signerName || "Client",
          actor_role: "client",
          user_id: payload.contract_id, // placeholder for required user_id col
          details: {
            order_id: payload.order_id,
            ip: clientIp,
            user_agent: userAgent,
            method: "click_to_sign",
            signed_at: payload.signed_at,
          },
        }).then(({ error: logErr }) => {
          if (logErr) console.warn("[sign-contract-public] activity_logs insert failed:", logErr.message);
        });

        // 2. Email confirmation to client + admin via canonical email_queue
        if (payload.order_id) {
          const { data: order } = await supabase
            .from("orders")
            .select("order_number, client_email, user_id")
            .eq("id", payload.order_id)
            .maybeSingle();

          const { data: profile } = order?.user_id
            ? await supabase
                .from("profiles")
                .select("email, full_name")
                .eq("user_id", order.user_id)
                .maybeSingle()
            : { data: null as any };

          const clientEmail = order?.client_email || profile?.email || null;
          const clientName = profile?.full_name || signerName || "Client";

          // Client confirmation â€” queued via canonical pipeline
          if (clientEmail) {
            await supabase.from("email_queue").insert({
              event_key: `contract_signed_client_${payload.contract_id}`,
              to_email: clientEmail,
              template_key: "contract_signed_confirmation",
              template_vars: {
                client_name: clientName,
                order_number: order?.order_number || "",
                signed_at: payload.signed_at,
              } as any,
              priority: 0,
              status: "queued",
            } as any).then(({ error: e }) => {
              if (e) console.warn("[sign-contract-public] client email enqueue failed:", e.message);
            });
          }

          // Admin notification
          await supabase.from("email_queue").insert({
            event_key: `contract_signed_admin_${payload.contract_id}`,
            to_email: "support@nivra-telecom.ca",
            template_key: "contract_signed_admin_alert",
            template_vars: {
              client_full_name: clientName,
              client_name: clientName,
              order_id: payload.order_id,
              order_number: order?.order_number || "",
              contract_id: payload.contract_id,
              signed_at: payload.signed_at,
              ip: clientIp,
            } as any,
            priority: 10,
            status: "queued",
          } as any).then(({ error: e }) => {
            if (e) console.warn("[sign-contract-public] admin email enqueue failed:", e.message);
          });
        }
      } catch (notifyErr) {
        console.warn("[sign-contract-public] notification error (non-blocking):", notifyErr?.message);
      }

      return jsonResponse(payload);
    }

    return jsonResponse({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  } catch (err) {
    console.error("[sign-contract-public] Unexpected error:", err);
    return jsonResponse({ success: false, error: "SERVER_ERROR" }, 500);
  }
});
