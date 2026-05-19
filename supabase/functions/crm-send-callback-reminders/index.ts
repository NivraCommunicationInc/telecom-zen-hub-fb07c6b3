/**
 * crm-send-callback-reminders
 * Cron-driven. Finds CRM contacts with an upcoming callback (within next ~30min)
 * whose reminder email hasn't been sent yet, and emails the assigned agent.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Pull contacts whose callback fires within the next 30 minutes and not yet notified
  const upper = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const lower = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: contacts, error } = await admin
    .from("crm_contacts")
    .select("id, first_name, last_name, full_name, phone, email, city, next_callback_at, callback_agent_id, assigned_to, call_notes")
    .lte("next_callback_at", upper)
    .gte("next_callback_at", lower)
    .is("callback_reminder_sent_at", null)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const c of contacts ?? []) {
    const agentId = c.callback_agent_id ?? c.assigned_to;
    if (!agentId) continue;

    const { data: profile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", agentId)
      .maybeSingle();

    if (!profile?.email) continue;

    const name = c.full_name ?? [c.first_name, c.last_name].filter(Boolean).join(" ") ?? "prospect";
    const when = new Date(c.next_callback_at as string).toLocaleString("fr-CA", { timeZone: "America/Toronto" });
    const subject = `🔔 Rappel CRM : appeler ${name} à ${when}`;
    const message = `Bonjour ${profile.full_name ?? ""},\n\nRappel programmé : vous devez appeler ${name} (${c.phone ?? "—"}) à ${when}.\n\nVille : ${c.city ?? "—"}\nCourriel : ${c.email ?? "—"}\n\nDernières notes :\n${(c.call_notes ?? "—").slice(-500)}\n\n— Nivra CRM Prospect`;

    try {
      await admin.functions.invoke("send-communication-email", {
        body: {
          subject,
          message,
          recipients: [{ email: profile.email, name: profile.full_name ?? profile.email, client_id: c.id }],
        },
      });
      await admin.from("crm_contacts").update({ callback_reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
      sent++;
    } catch (e) {
      console.error("[crm-send-callback-reminders] failed for contact", c.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, scanned: contacts?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
