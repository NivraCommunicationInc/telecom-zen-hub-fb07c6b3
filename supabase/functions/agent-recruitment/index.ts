/**
 * agent-recruitment — Processes new job applicants, sends invitations,
 * follow-ups, auto-rejection, and daily pipeline summary.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = "https://nivra-telecom.ca";
const INTERNAL_EMAIL = "support@nivra-telecom.ca";

async function logAudit(supabase: any, action: string, result: string, details: unknown, ms: number, err?: string) {
  await supabase.from("agent_audit_log").insert({
    agent_name: "agent-recruitment", action, result, details, execution_time_ms: ms, error_message: err,
  });
}

function ageOk(dob: string | null): boolean {
  if (!dob) return false;
  const a = (Date.now() - new Date(dob).getTime()) / (365.25 * 86400_000);
  return a >= 18;
}

async function inviteNew(supabase: any) {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: apps } = await supabase.from("job_applicants")
    .select("*").eq("status", "new").eq("skip_interview", false)
    .is("invitation_sent_at", null).lt("created_at", oneHourAgo).limit(50);

  let invited = 0, excluded = 0;
  for (const a of (apps ?? []) as any[]) {
    const reasons: string[] = [];
    if (!ageOk(a.date_of_birth)) reasons.push("Moins de 18 ans");
    if (a.accepts_commission_only === false) reasons.push("Refus commission only");
    const equip = Array.isArray(a.available_equipment) ? a.available_equipment : [];
    // Load equipment pattern from DB if available, otherwise use default
    const { data: equipRule } = await supabase
      .from("recruitment_rules").select("value").eq("key", "required_equipment_pattern").eq("is_active", true).maybeSingle()
      .catch(() => ({ data: null }));
    const equipPattern = equipRule?.value ? new RegExp(String(equipRule.value), "i") : /ipad|tablet|tablette/i;
    if (!equip.some((e: string) => equipPattern.test(e))) reasons.push("Pas d'iPad/tablette");

    const { data: existing } = await supabase.from("profiles").select("user_id")
      .eq("email", String(a.email).toLowerCase()).eq("account_status", "active").maybeSingle();
    if (existing) reasons.push("Email déjà actif comme agent");

    if (reasons.length > 0) {
      await supabase.from("job_applicants").update({
        status: "excluded", skip_reason: reasons.join("; "), updated_at: new Date().toISOString(),
      }).eq("id", a.id);
      excluded++;
      continue;
    }

    const interviewUrl = `${APP_URL}/interview/${a.interview_token}`;
    await enqueueCommunication(supabase, {
      channel: "email",
      recipient: a.email,
      templateKey: "interview_invitation",
      subject: "Invitation à votre entrevue Nivra Telecom",
      idempotencyKey: `recruit:invitation:${a.id}`,
      templateVars: {
    client_name: `${a.first_name ?? ""} ${a.last_name ?? "",
    }),
        first_name: a.first_name ?? "Candidat",
        interview_url: interviewUrl,
        days_valid: 7,
      },
      status: "queued",
    });
    await supabase.from("job_applicants").update({
      status: "invited", invitation_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", a.id);
    invited++;
  }
  return { invited, excluded };
}

async function followUp(supabase: any) {
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: pending } = await supabase.from("job_applicants")
    .select("*").eq("status", "invited")
    .lt("invitation_sent_at", cutoff).is("interview_started_at", null).limit(50);

  let reminded = 0;
  for (const a of (pending ?? []) as any[]) {
    const interviewUrl = `${APP_URL}/interview/${a.interview_token}`;
    const daysLeft = Math.max(1, 7 - Math.floor((Date.now() - new Date(a.invitation_sent_at).getTime()) / 86400_000));
    await enqueueCommunication(supabase, {
      channel: "email",
      recipient: a.email,
      templateKey: "interview_reminder",
      subject: "Rappel — Votre entrevue Nivra vous attend",
      idempotencyKey: `recruit:reminder:${a.id}:${new Date().toISOString().slice(0,10)}`,
      templateVars: {
    client_name: `${a.first_name ?? ""} ${a.last_name ?? "",
    }),
        first_name: a.first_name ?? "Candidat",
        interview_url: interviewUrl,
        days_valid: daysLeft,
      },
      status: "queued",
    });
    reminded++;
  }
  return { reminded };
}

async function autoReject(supabase: any) {
  const { data: bad } = await supabase.from("job_applicants")
    .select("id, email, first_name").eq("status", "interview_completed")
    .eq("interview_recommendation", "strongly_not_recommend")
    .lt("interview_score", 30).is("rejected_at", null).limit(50);

  let rejected = 0;
  for (const a of (bad ?? []) as any[]) {
    await supabase.from("job_applicants").update({
      status: "rejected", rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", a.id);
    await enqueueCommunication(supabase, {
      channel: "email",
      recipient: a.email,
      templateKey: "interview_rejection_polite",
      subject: "Suivi de votre candidature Nivra Telecom",
      idempotencyKey: `recruit:reject:${a.id}`,
      templateVars: {
    first_name: a.first_name ?? "Candidat",
    client_name: a.first_name ?? "Candidat",
  },
    });
    rejected++;
  }
  return { auto_rejected: rejected };
}

async function pipelineSummary(supabase: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { count: newCount } = await supabase.from("job_applicants").select("*", { count: "exact", head: true }).eq("status", "new");
  const { count: invitedCount } = await supabase.from("job_applicants").select("*", { count: "exact", head: true }).eq("status", "invited");
  const { count: completedCount } = await supabase.from("job_applicants").select("*", { count: "exact", head: true }).eq("status", "interview_completed");
  const { count: pendingDecision } = await supabase.from("job_applicants").select("*", { count: "exact", head: true })
    .eq("status", "interview_completed").is("hired_at", null).is("rejected_at", null);
  const { count: hiredWeek } = await supabase.from("job_applicants").select("*", { count: "exact", head: true })
    .gte("hired_at", weekAgo);

  await enqueueCommunication(supabase, {
      channel: "email",
      recipient: INTERNAL_EMAIL,
      templateKey: "recruitment_pipeline_summary",
      subject: `Pipeline recrutement — ${today.toLocaleDateString("fr-CA"),
      idempotencyKey: `recruit:pipeline:${today.toISOString().slice(0,10)}`,
      templateVars: {},
    }),
      new_count: newCount ?? 0,
      invited_count: invitedCount ?? 0,
      completed_count: completedCount ?? 0,
      pending_decision: pendingDecision ?? 0,
      hired_week: hiredWeek ?? 0,
    },
    status: "queued",
  });
  return { summary_sent: 1, new_count: newCount, hired_week: hiredWeek };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    let body: any = {};
    try { body = await req.json(); } catch (_e) { /* */ }

    if (body.action === "pipeline_summary") {
      const r = await pipelineSummary(supabase);
      await logAudit(supabase, "pipeline_summary", "success", r, Date.now() - startedAt);
      return new Response(JSON.stringify({ ok: true, ...r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const inv = await inviteNew(supabase);
    const fu = await followUp(supabase);
    const rj = await autoReject(supabase);
    const result = { ...inv, ...fu, ...rj };
    await logAudit(supabase, "process", "success", result, Date.now() - startedAt);
    return new Response(JSON.stringify({ ok: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logAudit(supabase, "error", "failure", null, Date.now() - startedAt, String(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
