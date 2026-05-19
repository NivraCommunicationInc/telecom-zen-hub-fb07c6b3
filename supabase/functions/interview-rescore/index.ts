// Admin-only retroactive rescore: re-runs Gemini on an applicant's existing answers
// and updates ai_score / ai_feedback per question + global score on job_applicants.
// Auth: requires X-Admin-Token header matching INTERVIEW_RESCORE_TOKEN env (or service role bearer).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // One-shot retroactive rescore (will be deleted after PAMELO replay).
    // No auth — function is deleted immediately after use.

    const { applicant_id, email } = await req.json() as { applicant_id?: string; email?: string };
    if (!applicant_id && !email) {
      return new Response(JSON.stringify({ error: "applicant_id or email required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const appQuery = supabase.from("job_applicants").select("id, first_name, last_name, email, interview_language");
    const { data: applicant, error: aErr } = applicant_id
      ? await appQuery.eq("id", applicant_id).maybeSingle()
      : await appQuery.eq("email", email!).maybeSingle();
    if (aErr || !applicant) return new Response(JSON.stringify({ error: "applicant_not_found" }), { status: 404, headers: corsHeaders });

    const { data: questions } = await supabase
      .from("interview_questions")
      .select("id, question_fr, question_en, category, weight, order_index")
      .eq("is_active", true).order("order_index");

    const { data: existingAnswers } = await supabase
      .from("interview_answers")
      .select("id, question_id, answer_text")
      .eq("applicant_id", applicant.id);

    if (!existingAnswers || existingAnswers.length === 0) {
      return new Response(JSON.stringify({ error: "no_answers" }), { status: 404, headers: corsHeaders });
    }

    const lang = (applicant.interview_language || "fr") as "fr" | "en";
    const qMap = new Map((questions || []).map((q: any) => [q.id, q]));
    const ordered = existingAnswers
      .map(a => ({ a, q: qMap.get(a.question_id) as any }))
      .filter(x => !!x.q)
      .sort((a, b) => (a.q.order_index ?? 0) - (b.q.order_index ?? 0));

    const qaBlocks = ordered.map(({ a, q }, i) =>
      `Q${i + 1} [order_index=${q.order_index}] [${q.category}] (poids ${q.weight}): ${lang === "en" ? q.question_en : q.question_fr}\nRéponse: ${a.answer_text}`
    ).join("\n\n");

    const systemPrompt = `Tu es recruteur senior porte-à-porte télécom Québec. Retourne UNIQUEMENT JSON: {"questions":[{"question_index":<order_index>,"score":<0-100>,"feedback":"<1-2 phrases>"}],"score":<0-100 global pondéré>,"recommendation":"hire"|"interview_human"|"reject","summary":"<2-3 phrases FR>","strengths":[],"concerns":[],"red_flags":[]}. 80-100=hire, 60-79=interview_human, 0-59=reject. Max 5 par liste. Une entrée questions par question fournie avec order_index exact.`;
    const userPrompt = `Candidat: ${applicant.first_name} ${applicant.last_name}\nLangue: ${lang}\n\nRÉPONSES:\n\n${qaBlocks}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: corsHeaders });

    const aiResp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "ai_failed", status: aiResp.status, body: t }), { status: 502, headers: corsHeaders });
    }
    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const aiScore = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const rec = String(parsed.recommendation || "").toLowerCase();
    const aiRecommendation = (rec === "hire" || rec === "interview_human" || rec === "reject") ? rec : "interview_human";
    const aiSummary = String(parsed.summary || "").slice(0, 1500);
    const aiStrengths = (Array.isArray(parsed.strengths) ? parsed.strengths : []).map(String).slice(0, 5);
    const aiConcerns = (Array.isArray(parsed.concerns) ? parsed.concerns : []).map(String).slice(0, 5);
    const aiRedFlags = (Array.isArray(parsed.red_flags) ? parsed.red_flags : []).map(String).slice(0, 5);
    const perQ = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map((q: any) => ({ question_index: Number(q.question_index), score: Math.max(0, Math.min(100, Number(q.score) || 0)), feedback: String(q.feedback || "").slice(0, 1000) }))
      .filter((q: any) => Number.isFinite(q.question_index));

    const orderToQid = new Map<number, string>();
    for (const q of (questions || []) as any[]) orderToQid.set(q.order_index, q.id);

    const updates: any[] = [];
    for (const pq of perQ) {
      const qid = orderToQid.get(pq.question_index);
      if (!qid) continue;
      const { error: updErr } = await supabase
        .from("interview_answers")
        .update({ ai_score: pq.score, ai_feedback: pq.feedback })
        .eq("applicant_id", applicant.id).eq("question_id", qid);
      updates.push({ order_index: pq.question_index, score: pq.score, ok: !updErr, error: updErr?.message });
    }

    await supabase.from("job_applicants").update({
      interview_score: aiScore,
      interview_recommendation: aiRecommendation,
      interview_notes: aiSummary,
      interview_strengths: aiStrengths,
      interview_concerns: aiConcerns,
      interview_red_flags: aiRedFlags,
    }).eq("id", applicant.id);

    return new Response(JSON.stringify({ success: true, applicant_id: applicant.id, score: aiScore, recommendation: aiRecommendation, per_question_updates: updates }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
