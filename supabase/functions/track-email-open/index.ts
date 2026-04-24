import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0),
);

/**
 * Open tracking pixel.
 * GET ?cid=<campaign_id>&rid=<email_send_id>
 * Always returns the pixel (never blocks the image load).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const cid = url.searchParams.get("cid");
    const rid = url.searchParams.get("rid");

    if (cid || rid) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Update email_sends recipient row
      if (rid) {
        const { data: send } = await supabase
          .from("email_sends")
          .select("id, opened_at, open_count, campaign_id")
          .eq("id", rid)
          .maybeSingle();

        if (send) {
          const isFirstOpen = !send.opened_at;
          await supabase
            .from("email_sends")
            .update({
              status: "opened",
              opened_at: send.opened_at || new Date().toISOString(),
              open_count: (send.open_count || 0) + 1,
            })
            .eq("id", rid);

          // Increment campaign counter only on first open
          if (isFirstOpen && send.campaign_id) {
            try {
              await supabase.rpc("increment_campaign_stat", {
                p_campaign_id: send.campaign_id,
                p_field: "total_opened",
                p_increment: 1,
              });
            } catch { /* ignore if RPC missing */ }
          }
        }
      }
    }
  } catch (err) {
    console.error("[track-email-open]", err);
  }

  return new Response(PIXEL, {
    headers: {
      ...corsHeaders,
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
});
