import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("client_errors").insert({
      message: typeof body.message === "string" ? body.message.slice(0, 500) : null,
      stack: typeof body.stack === "string" ? body.stack.slice(0, 2000) : null,
      component_stack: typeof body.component_stack === "string" ? body.component_stack.slice(0, 2000) : null,
      url: typeof body.url === "string" ? body.url.slice(0, 500) : null,
      error_timestamp: body.timestamp || new Date().toISOString(),
      user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
