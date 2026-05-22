/**
 * agent-directories — Weekly Monday 9h UTC.
 * Sends reminder of pending free-directory submissions to admin.
 */
import {
  corsHeaders, makeClient, logEvent, logAudit, updateRegistry,
  queueEmail, jsonResponse, ADMIN_EMAIL,
} from "../_shared/agentHelpers.ts";

const AGENT = "directories";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const supabase = makeClient();
  try {
    await logEvent(supabase, AGENT, "info", "Démarrage Directories — rappel hebdomadaire");

    const { data: pending } = await supabase
      .from("directory_submissions")
      .select("directory_name, submission_url, directory_url")
      .eq("status", "pending")
      .order("directory_name", { ascending: true });

    const list = (pending ?? []).map((d: any) => ({
      name: d.directory_name as string,
      url: (d.submission_url || d.directory_url) as string,
    }));

    if (list.length === 0) {
      await logEvent(supabase, AGENT, "success", "Tous les répertoires sont soumis ✓");
      await logAudit(supabase, AGENT, "weekly_reminder", "skipped", { reason: "no_pending" }, Date.now() - t0);
      await updateRegistry(supabase, AGENT, true);
      return jsonResponse({ ok: true, pending: 0 });
    }

    await queueEmail(supabase, {
      toEmail: ADMIN_EMAIL,
      templateKey: "directories_reminder",
      subject: `Action requise — Soumettre Nivra dans ${list.length} répertoires gratuits`,
      templateVars: { pending_directories: list, pending_count: list.length },
      eventKey: `directories-weekly-${new Date().toISOString().slice(0, 10)}`,
    });

    await logEvent(supabase, AGENT, "email_sent",
      `Rappel envoyé — ${list.length} répertoires en attente`,
      { count: list.length });
    await logAudit(supabase, AGENT, "weekly_reminder", "success", { pending_count: list.length }, Date.now() - t0);
    await updateRegistry(supabase, AGENT, true);
    return jsonResponse({ ok: true, pending: list.length });
  } catch (e) {
    const msg = String(e);
    await logEvent(supabase, AGENT, "error", "Échec Directories", { error: msg });
    await logAudit(supabase, AGENT, "weekly_reminder", "failure", null, Date.now() - t0, msg);
    await updateRegistry(supabase, AGENT, false, msg);
    return jsonResponse({ ok: false, error: msg }, 500);
  }
});
