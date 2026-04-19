// One-shot validator — renders a real queue template via renderQueueTemplate
// to confirm every email in the system now uses the new central design.
import { Resend } from "../_shared/ResendProxy.ts";
import { renderQueueTemplate } from "../_shared/customQueueTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY missing");
    const resend = new Resend(apiKey);

    const result = renderQueueTemplate("order_confirmation", {
      client_name: "Oldo",
      order_number: "99999",
      monthly_total_tax_in: 120.72,
      plan_name: "GIGA Internet + TV 25 choix",
      created_at: new Date().toISOString(),
    });
    if (!result) throw new Error("Template not found");
    const { html, subject } = result;

    const sent = await resend.emails.send({
      from: "Nivra Telecom <support@nivra-telecom.ca>",
      to: ["support@nivra-telecom.ca"],
      subject: `[REFACTOR-TEST] ${subject}`,
      html,
    });

    return new Response(JSON.stringify({ success: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
