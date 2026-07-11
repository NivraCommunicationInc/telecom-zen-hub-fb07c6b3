// Send interview invitation emails to applicants (admin only)
import { createClient } from "npm:@supabase/supabase-js@2";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.nivra-telecom.ca";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin or supervisor
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
    const { data: roleOk } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: supOk } = await supabase.rpc("has_role", { _user_id: user.id, _role: "supervisor" });
    if (!roleOk && !supOk) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const applicantIds: string[] | undefined = body.applicant_ids;
    const onlyNew: boolean = body.only_new ?? !applicantIds;

    let query = supabase
      .from("job_applicants")
      .select("id, first_name, last_name, email, interview_token, interview_language, status, invitation_sent_at");
    if (applicantIds?.length) query = query.in("id", applicantIds);
    else if (onlyNew) query = query.eq("status", "new").is("invitation_sent_at", null);

    const { data: applicants, error: aErr } = await query;
    if (aErr) throw aErr;
    if (!applicants?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "no applicants" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const a of applicants) {
      if (!a.email) { errors.push(`${a.id}: no email`); continue; }
      const interviewUrl = `${BASE_URL}/entrevue/${a.interview_token}`;
      const lang = (a.interview_language || "fr") as string;

      let qErr: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "interview_invitation",
        recipient: a.email,
        idempotencyKey: `interview_invite_${a.id}_${Date.now()}`,
        templateVars: { first_name: a.first_name || "",
          last_name: a.last_name || "",
          interview_url: interviewUrl, language: lang },
      }); } catch (__e) { qErr = __e; }
      if (qErr) { errors.push(`${a.id}: ${qErr.message}`); continue; }

      await supabase
        .from("applicant_emails")
        .insert({
          applicant_id: a.id,
          email_type: "interview_invitation",
          sent_to: a.email,
          subject: lang === "en" ? "Nivra Telecom — Interview invitation" : "Nivra Telecom — Invitation à l'entrevue",
          status: "queued",
        });

      await supabase
        .from("job_applicants")
        .update({
          invitation_sent_at: new Date().toISOString(),
          status: a.status === "new" ? "invited" : a.status,
        })
        .eq("id", a.id);

      sent++;
    }

    return new Response(JSON.stringify({ sent, total: applicants.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
