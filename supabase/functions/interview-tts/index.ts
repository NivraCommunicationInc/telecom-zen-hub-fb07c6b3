/**
 * interview-tts — Public TTS for the candidate interview page.
 * Gated by a valid interview_token (no Supabase auth). Returns MP3 binary.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Alice (clear multilingual premium) and Sarah (natural English)
const VOICE_FR = "Xb7hH8MSUJpSbSDYk0k2";
const VOICE_EN = "EXAVITQu4vr4xnSDxMaL";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY missing" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;
    const text: string | undefined = body.text;
    const lang: "fr" | "en" = body.lang === "en" ? "en" : "fr";

    if (!token || !text) {
      return new Response(JSON.stringify({ error: "token and text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the interview token — must exist and not yet completed
    const { data: applicant } = await sb
      .from("job_applicants")
      .select("id, interview_completed_at")
      .eq("interview_token", token)
      .maybeSingle();

    if (!applicant) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (applicant.interview_completed_at) {
      return new Response(JSON.stringify({ error: "already_submitted" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeText = String(text).slice(0, 4000);
    const voiceId = lang === "en" ? VOICE_EN : VOICE_FR;
    const preparedText = lang === "fr"
      ? safeText
          .replace(/Nivra Telecom/g, "Nivra Télécom")
          .replace(/Bell/g, "Belle")
          .replace(/\?/g, "? ...")
      : safeText.replace(/\?/g, "? ...");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.68,
            similarity_boost: 0.9,
            style: 0.22,
            use_speaker_boost: true,
            speed: 0.82,
          },
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `elevenlabs ${res.status}`, detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(res.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
