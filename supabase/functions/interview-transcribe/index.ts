/**
 * interview-transcribe — Public transcription of a candidate's recorded
 * answer (video/audio blob) using ElevenLabs Scribe. Token-gated, no auth.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY missing" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";
    const lang = (url.searchParams.get("lang") || "fr") as "fr" | "en";

    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const audioBlob = await req.blob();
    if (!audioBlob || audioBlob.size === 0) {
      return new Response(JSON.stringify({ error: "empty_audio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audioBlob.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "audio_too_large" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = new FormData();
    form.append("file", audioBlob, "answer.webm");
    form.append("model_id", "scribe_v2");
    form.append("language_code", lang === "en" ? "eng" : "fra");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      return new Response(JSON.stringify({ error: `elevenlabs ${res.status}`, detail: txt }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const transcript = String(data?.text || "").trim();
    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
