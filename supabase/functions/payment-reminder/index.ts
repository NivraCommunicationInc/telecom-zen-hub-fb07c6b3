// Daily payment reminder for unpaid Field orders.
// Runs via pg_cron at 10:00 AM. For each pending field_payment_intents
// row created in the last 3 days, sends up to 3 reminders (Violet Bold
// "payment_reminder" template). After 3 reminders, cancels the intent
// and marks the linked quote as cancelled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: intents, error } = await supabase
      .from("field_payment_intents")
      .select("id, quote_id, amount, paypal_approval_url, status, created_at")
      .in("status", ["pending"])
      .gte("created_at", since);

    if (error) throw error;

    let sent = 0, cancelled = 0;
    for (const it of intents ?? []) {
      // Get quote for client info + agent
      const { data: q } = await supabase
        .from("field_quotes")
        .select("client_info, services, agent_name, agent_id")
        .eq("id", (it as any).quote_id)
        .maybeSingle();
      const ci: any = (q as any)?.client_info ?? {};
      const email = ci.email;
      if (!email) continue;

      // Count existing reminders
      const { count } = await supabase
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("template_key", "payment_reminder")
        .ilike("event_key", `payment_reminder_${(it as any).id}_%`);

      if ((count ?? 0) >= 3) {
        await supabase.from("field_payment_intents")
          .update({ status: "cancelled" }).eq("id", (it as any).id);
        await supabase.from("field_quotes")
          .update({ status: "cancelled" }).eq("id", (it as any).quote_id);
        cancelled++;
        continue;
      }

      const fullName = `${ci.first_name || ""} ${ci.last_name || ""}`.trim() || "Client";
      const services = Array.isArray((q as any)?.services)
        ? (q as any).services.map((s: any) => s.name).filter(Boolean).join(", ")
        : "Services Nivra";
      const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

      const { error: insErr } = await supabase.from("email_queue").insert({
        event_key: `payment_reminder_${(it as any).id}_${Date.now()}`,
        to_email: email,
        template_key: "payment_reminder",
        template_vars: {
          client_name: fullName,
          first_name: ci.first_name || "Client",
          order_number: (it as any).id,
          total: Number((it as any).amount).toFixed(2),
          payment_url: (it as any).paypal_approval_url || "#",
          approval_url: (it as any).paypal_approval_url || "#",
          summary: services,
          services,
          valid_until: validUntil,
          agent_name: (q as any)?.agent_name || "Nivra Telecom",
          reminder_index: (count ?? 0) + 1,
        },
        status: "queued",
      } as any);
      if (!insErr) sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, cancelled, scanned: intents?.length ?? 0 }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
