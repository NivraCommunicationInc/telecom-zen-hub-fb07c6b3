import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * Click tracking redirect.
 * GET ?cid=<campaign_id>&rid=<email_send_id>&url=<encoded_destination>
 * Records the click, then 302-redirects to the destination URL.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const cid = url.searchParams.get("cid");
  const rid = url.searchParams.get("rid");
  const dest = url.searchParams.get("url");

  if (!dest) {
    return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
  }

  // Validate destination URL — only allow http/https
  let target: URL;
  try {
    target = new URL(dest);
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch (_e) {
    return new Response("Invalid url", { status: 400, headers: corsHeaders });
  }

  try {
    if (rid) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: send } = await supabase
        .from("email_sends")
        .select("id, clicked_at, click_count, click_urls, campaign_id")
        .eq("id", rid)
        .maybeSingle();

      if (send) {
        const isFirstClick = !send.clicked_at;
        const clickUrls = Array.isArray(send.click_urls) ? send.click_urls : [];
        if (!clickUrls.includes(target.toString())) clickUrls.push(target.toString());

        await supabase
          .from("email_sends")
          .update({
            status: "clicked",
            clicked_at: send.clicked_at || new Date().toISOString(),
            click_count: (send.click_count || 0) + 1,
            click_urls: clickUrls,
          })
          .eq("id", rid);

        if (isFirstClick && send.campaign_id) {
          try {
            await supabase.rpc("increment_campaign_stat", {
              p_campaign_id: send.campaign_id,
              p_field: "total_clicked",
              p_increment: 1,
            });
          } catch (_e) { /* ignore */ }
        }
      }
    }
  } catch (err) {
    console.error("[track-email-click]", err);
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: target.toString() },
  });
});
