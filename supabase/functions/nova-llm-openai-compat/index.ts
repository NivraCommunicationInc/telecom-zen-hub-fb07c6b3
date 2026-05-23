/**
 * nova-llm-openai-compat — OpenAI-compatible wrapper around nova-brain.
 *
 * Purpose: ElevenLabs Conversational AI lets you plug a "Custom LLM" by giving
 * it an OpenAI Chat Completions-compatible endpoint. This function is that
 * endpoint. Each call is translated into a nova-brain invocation (Claude
 * Sonnet 4.7 + tools + memory) and the response is shaped back into the
 * OpenAI format.
 *
 * Endpoint URL (to paste in ElevenLabs agent → LLM → Custom LLM URL):
 *   https://<project>.supabase.co/functions/v1/nova-llm-openai-compat
 *
 * Auth (in ElevenLabs agent config):
 *   Bearer token = the value you set in ELEVENLABS_AGENT_SECRET in Lovable
 *   secrets. We refuse any call without this token.
 *
 * Why a wrapper instead of letting ElevenLabs call nova-brain directly:
 *   nova-brain returns {content, tool_calls, usage, ...} which is not what
 *   OpenAI clients expect. ElevenLabs needs {choices: [{message: {role,
 *   content}}], ...}. We do the format translation here so nova-brain stays
 *   focused on the business logic.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { reportEdgeError } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT_SECRET = Deno.env.get("ELEVENLABS_AGENT_SECRET") ?? "";

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
}

interface OpenAIRequest {
  model?: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
}

function isAuthorized(req: Request): boolean {
  if (!AGENT_SECRET) return false; // refuse all calls when secret is unconfigured
  const auth = req.headers.get("Authorization") ?? "";
  // Accept both "Bearer <secret>" and raw <secret> for ElevenLabs flexibility
  return auth === `Bearer ${AGENT_SECRET}` || auth === AGENT_SECRET;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: { message: "unauthorized", type: "auth_error" } }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: OpenAIRequest = await req.json();
    const messages = body.messages ?? [];

    // ElevenLabs sends the entire conversation incl. its own system prompt.
    // We strip system messages because nova-brain has its OWN system prompt
    // (NOVA personality + memory + context). We just need the user/assistant
    // turns.
    const filteredMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content ?? "" }));

    if (filteredMessages.length === 0) {
      return new Response(
        JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "nova-brain",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Bonjour ! Je suis NOVA, prêt à t'aider." },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call our nova-brain edge function (service-role auth, tools enabled).
    const novaRes = await fetch(`${SUPABASE_URL}/functions/v1/nova-brain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: filteredMessages,
        enable_tools: true,
      }),
    });

    if (!novaRes.ok) {
      const errText = await novaRes.text();
      console.error("[nova-llm-compat] nova-brain failed:", novaRes.status, errText);
      return new Response(
        JSON.stringify({ error: { message: `nova-brain ${novaRes.status}`, type: "upstream_error" } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const novaData = await novaRes.json();
    const replyText: string = novaData.content ?? "";

    // ElevenLabs supports streaming; we do non-streaming for simplicity (the
    // voice latency dominates anyway). To switch to streaming later, return
    // text/event-stream with delta chunks per OpenAI spec.
    const responsePayload = {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "nova-brain-claude-sonnet-4-7",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: replyText },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: novaData.usage?.input_tokens ?? 0,
        completion_tokens: novaData.usage?.output_tokens ?? 0,
        total_tokens:
          (novaData.usage?.input_tokens ?? 0) + (novaData.usage?.output_tokens ?? 0),
      },
      // Non-OpenAI extension fields for debugging — ElevenLabs ignores these.
      _nova_metadata: {
        tool_calls: novaData.tool_calls,
        reasoning_log_id: novaData.reasoning_log_id,
        duration_ms: novaData.duration_ms,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[nova-llm-compat] fatal:", err);
    reportEdgeError(err, { function: "nova-llm-openai-compat" }).catch(() => {});
    return new Response(
      JSON.stringify({
        error: {
          message: err instanceof Error ? err.message : String(err),
          type: "internal_error",
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
