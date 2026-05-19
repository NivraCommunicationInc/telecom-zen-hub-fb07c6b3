// Public endpoint: submit interview answers + run AI analysis (Gemini)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "support@nivra-telecom.com";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Answer = { question_id: string; answer_text: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, answers } = await req.json() as { token?: string; answers?: Answer[] };
    if (!token || !Array.isArray(answers) || answers.length === 0) {
      return new Response(JSON.stringify({ error: "token and answers required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up applicant by token
    const { data: applicant, error: aErr } = await supabase
      .from("job_applicants")
      .select("id, first_name, last_name, email, interview_language, status, interview_completed_at")
      .eq("interview_token", token)
      .maybeSingle();
    if (aErr || !applicant) {
      return new Response(JSON.stringify({ error: "invalid_token" }), { status: 404, headers: corsHeaders });
    }
    if (applicant.interview_completed_at) {
      return new Response(JSON.stringify({ error: "already_submitted" }), { status: 409, headers: corsHeaders });
    }

    // Load all questions for context
    const { data: questions } = await supabase
      .from("interview_questions")
      .select("id, question_fr, question_en, category, weight, order_index")
      .eq("is_active", true)
      .order("order_index");

    const lang = (applicant.interview_language || "fr") as "fr" | "en";
    const qMap = new Map((questions || []).map((q: any) => [q.id, q]));

    // Persist answers
    const answerRows = answers
      .filter(a => qMap.has(a.question_id))
      .map(a => ({
        applicant_id: applicant.id,
        question_id: a.question_id,
        answer_text: (a.answer_text || "").slice(0, 4000),
      }));
    if (answerRows.length === 0) {
      return new Response(JSON.stringify({ error: "no_valid_answers" }), { status: 400, headers: corsHeaders });
    }
    // Replace any existing answers (safety)
    await supabase.from("interview_answers").delete().eq("applicant_id", applicant.id);
    const { error: insErr } = await supabase.from("interview_answers").insert(answerRows);
    if (insErr) throw insErr;

    // Build prompt for Gemini
    // Preserve question order from interview_questions for stable indexing
    const orderedAnswerRows = answerRows
      .map(row => ({ row, q: qMap.get(row.question_id) as any }))
      .filter(x => !!x.q)
      .sort((a, b) => (a.q.order_index ?? 0) - (b.q.order_index ?? 0));

    const qaBlocks = orderedAnswerRows.map(({ row, q }, i) => {
      const qText = lang === "en" ? q.question_en : q.question_fr;
      return `Q${i + 1} [order_index=${q.order_index}] [${q.category}] (poids ${q.weight}): ${qText}\nRéponse: ${row.answer_text}`;
    }).join("\n\n");

    const systemPrompt = `Tu es un recruteur senior expert en vente porte-à-porte pour une entreprise de télécommunications québécoise (Nivra Telecom). Tu évalues des candidats agents commerciaux 100% commission qui doivent faire du porte-à-porte au Québec.

Critères clés:
- Résilience face au rejet (CRITIQUE pour porte-à-porte)
- Motivation par commission seule (pas de salaire de base)
- Capacité à représenter professionnellement Nivra
- Disponibilité réelle et fiabilité
- Honnêteté et intégrité (pas de promesses fausses)
- Expérience vente (atout mais pas obligatoire si attitude excellente)
- Communication claire en français (et anglais selon zone)

Tu dois retourner UNIQUEMENT du JSON valide, sans markdown, sans backticks, sans commentaires:
{
  "questions": [
    { "question_index": <order_index entier>, "score": <0-100>, "feedback": "<feedback court 1-2 phrases>" }
  ],
  "score": <entier 0-100 score global pondéré>,
  "recommendation": "hire" | "interview_human" | "reject",
  "summary": "<résumé 2-3 phrases en français>",
  "strengths": ["<force 1>", "<force 2>", "..."],
  "concerns": ["<préoccupation 1>", "..."],
  "red_flags": ["<drapeau rouge 1>", "..."]
}

Règles:
- Tu DOIS retourner un objet "questions" avec UNE entrée par question évaluée, en utilisant le order_index exact fourni.
- score global 80-100 = "hire", 60-79 = "interview_human", 0-59 = "reject"
- Drapeaux rouges automatiques: refus du commission-only, refus du porte-à-porte, fausses promesses, agressivité, malhonnêteté détectée, indisponibilité totale.
- Maximum 5 éléments par liste strengths/concerns/red_flags. Sois concis et factuel.`;

    const userPrompt = `Candidat: ${applicant.first_name} ${applicant.last_name}\nLangue entrevue: ${lang}\n\nRÉPONSES À ÉVALUER:\n\n${qaBlocks}`;

    let aiScore = 0;
    let aiRecommendation: "hire" | "interview_human" | "reject" = "interview_human";
    let aiSummary = "";
    let aiStrengths: string[] = [];
    let aiConcerns: string[] = [];
    let aiRedFlags: string[] = [];
    let aiPerQuestion: Array<{ question_index: number; score: number; feedback: string }> = [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY missing");
    } else {
      try {
        const aiResp = await fetch(LOVABLE_AI_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          console.error("AI gateway error", aiResp.status, errText);
        } else {
          const aiJson = await aiResp.json();
          const raw = aiJson.choices?.[0]?.message?.content || "{}";
          const cleaned = raw.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          aiScore = Math.max(0, Math.min(100, Number(parsed.score) || 0));
          const rec = String(parsed.recommendation || "").toLowerCase();
          if (rec === "hire" || rec === "interview_human" || rec === "reject") aiRecommendation = rec;
          aiSummary = String(parsed.summary || "").slice(0, 1500);
          aiStrengths = (Array.isArray(parsed.strengths) ? parsed.strengths : []).map(String).slice(0, 5);
          aiConcerns = (Array.isArray(parsed.concerns) ? parsed.concerns : []).map(String).slice(0, 5);
          aiRedFlags = (Array.isArray(parsed.red_flags) ? parsed.red_flags : []).map(String).slice(0, 5);
          if (Array.isArray(parsed.questions)) {
            aiPerQuestion = parsed.questions
              .map((q: any) => ({
                question_index: Number(q.question_index),
                score: Math.max(0, Math.min(100, Number(q.score) || 0)),
                feedback: String(q.feedback || "").slice(0, 1000),
              }))
              .filter((q: any) => Number.isFinite(q.question_index));
          }
        }
      } catch (e) {
        console.error("AI analyse failed", e);
      }
    }

    // Persist per-question ai_score / ai_feedback into interview_answers
    if (aiPerQuestion.length > 0) {
      // Map order_index -> question_id from loaded questions
      const orderToQid = new Map<number, string>();
      for (const q of (questions || []) as any[]) {
        orderToQid.set(q.order_index, q.id);
      }
      for (const pq of aiPerQuestion) {
        const qid = orderToQid.get(pq.question_index);
        if (!qid) {
          console.warn("[per-q] no question_id for order_index", pq.question_index);
          continue;
        }
        const { error: updErr } = await supabase
          .from("interview_answers")
          .update({ ai_score: pq.score, ai_feedback: pq.feedback })
          .eq("applicant_id", applicant.id)
          .eq("question_id", qid);
        if (updErr) console.error("[per-q] update failed", pq, updErr);
      }
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("job_applicants")
      .update({
        status: "interview_completed",
        interview_completed_at: nowIso,
        interview_started_at: applicant.status === "interview_started" ? undefined : nowIso,
        interview_score: aiScore,
        interview_recommendation: aiRecommendation,
        interview_notes: aiSummary,
        interview_strengths: aiStrengths,
        interview_concerns: aiConcerns,
        interview_red_flags: aiRedFlags,
      })
      .eq("id", applicant.id);

    // Queue admin notification email
    await supabase.from("email_queue").insert({
      event_key: `interview_done_${applicant.id}`,
      to_email: ADMIN_EMAIL,
      template_key: "interview_completed_admin",
      template_vars: {
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        email: applicant.email,
        score: aiScore,
        recommendation: aiRecommendation,
        summary: aiSummary,
        strengths: aiStrengths,
        concerns: aiConcerns,
        red_flags: aiRedFlags,
        review_url: `https://www.nivra-telecom.ca/hr/applications`,
      },
      language: "fr",
      status: "queued",
    });

    await supabase.from("applicant_emails").insert({
      applicant_id: applicant.id,
      email_type: "interview_completed_admin",
      to_email: ADMIN_EMAIL,
      subject: `Entrevue IA terminée — ${applicant.first_name} ${applicant.last_name} (${aiScore}/100)`,
    });

    return new Response(JSON.stringify({
      success: true,
      score: aiScore,
      recommendation: aiRecommendation,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("interview-submit error", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
