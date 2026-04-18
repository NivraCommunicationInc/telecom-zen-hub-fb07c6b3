/**
 * marketing-send-sms — Admin-only manual SMS send via OpenPhone.
 * Logs into telephony_logs + marketing_conversations.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Normalize phone number to E.164 format (+1XXXXXXXXXX for North America)
function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  // If already starts with + and has enough digits, return as-is (cleaned)
  if (trimmed.startsWith("+")) {
    const digitsOnly = trimmed.slice(1).replace(/\D/g, "");
    if (digitsOnly.length >= 10) return `+${digitsOnly}`;
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await userClient.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
    if (!OPENPHONE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENPHONE_API_KEY not set" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, message, conversation_id, debug_test } = await req.json();

    if (debug_test) {
      const testPayload = {
        content: "Test Nivra",
        from: "+14385442233",
        to: ["+14385403112"],
      };

      console.log(
        `[marketing-send-sms-${reqId}] debug test payload=${
          JSON.stringify(testPayload)
        }`,
      );

      const debugResponse = await fetch(
        "https://api.openphone.com/v1/messages",
        {
          method: "POST",
          headers: {
            Authorization: OPENPHONE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(testPayload),
        },
      );

      const debugText = await debugResponse.text();
      console.log(
        `[marketing-send-sms-${reqId}] OpenPhone response status: ${debugResponse.status}`,
      );
      console.log(
        `[marketing-send-sms-${reqId}] OpenPhone response body: ${debugText}`,
      );

      return new Response(
        JSON.stringify({
          debug: true,
          status: debugResponse.status,
          body: debugText,
        }),
        {
          status: debugResponse.ok ? 200 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "to and message required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize recipient phone to E.164
    const normalizedTo = normalizePhoneToE164(to);
    console.log(
      `[marketing-send-sms-${reqId}] to(raw)=${to} → normalized=${normalizedTo}`,
    );
    if (!normalizedTo) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format", raw: to }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch OpenPhone numbers
    const pnRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: {
        Authorization: OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
    });
    const pnText = await pnRes.text();
    let pnJson: any = null;
    try {
      pnJson = JSON.parse(pnText);
    } catch { /* keep raw */ }
    console.log(
      `[marketing-send-sms-${reqId}] phone-numbers status=${pnRes.status} body=${
        pnText.slice(0, 500)
      }`,
    );

    if (!pnRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch OpenPhone numbers",
          status: pnRes.status,
          details: pnJson || pnText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Pick a number that can actually send SMS to Canada.
    // Prefer numbers where messaging.CA === "unrestricted" (typically local 10DLC),
    // skipping toll-free numbers which are usually restricted until TFN verification.
    const allPns: any[] = Array.isArray(pnJson?.data) ? pnJson.data : [];
    const smsCapable = allPns.find(
      (p) => p?.restrictions?.messaging?.CA === "unrestricted",
    );
    const chosenPn = smsCapable || allPns[0];
    const fromNumber = chosenPn?.phoneNumber || chosenPn?.number || null;
    const fromId = chosenPn?.id || null;
    console.log(
      `[marketing-send-sms-${reqId}] chosen number=${fromNumber} id=${fromId} sms_ca=${chosenPn?.restrictions?.messaging?.CA}`,
    );
    console.log(
      `[marketing-send-sms-${reqId}] from candidate phoneNumber=${fromNumber} id=${fromId}`,
    );

    if (!fromNumber && !fromId) {
      return new Response(
        JSON.stringify({
          error: "No OpenPhone number available",
          pn_payload: pnJson,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // OpenPhone requires `from` to be a valid OpenPhone-owned number/ID. Prefer phoneNumberId for safety.
    const fromValue = fromId || fromNumber;

    const sendBody = { content: message, from: fromValue, to: [normalizedTo] };
    console.log(
      `[marketing-send-sms-${reqId}] POST /v1/messages body=${
        JSON.stringify(sendBody)
      }`,
    );

    const sendRes = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });
    const sendText = await sendRes.text();
    let sendJson: any = null;
    try {
      sendJson = JSON.parse(sendText);
    } catch { /* keep raw */ }
    console.log(
      `[marketing-send-sms-${reqId}] OpenPhone send status=${sendRes.status} body=${
        sendText.slice(0, 1000)
      }`,
    );

    if (!sendRes.ok) {
      // If `from` as ID failed, retry with E.164 number (some accounts require this)
      if (fromId && fromNumber && fromValue === fromId) {
        console.log(
          `[marketing-send-sms-${reqId}] retry with from=E.164 ${fromNumber}`,
        );
        const retryBody = {
          content: message,
          from: fromNumber,
          to: [normalizedTo],
        };
        const retryRes = await fetch("https://api.openphone.com/v1/messages", {
          method: "POST",
          headers: {
            Authorization: OPENPHONE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(retryBody),
        });
        const retryText = await retryRes.text();
        let retryJson: any = null;
        try {
          retryJson = JSON.parse(retryText);
        } catch { /* keep raw */ }
        console.log(
          `[marketing-send-sms-${reqId}] retry status=${retryRes.status} body=${
            retryText.slice(0, 1000)
          }`,
        );
        if (retryRes.ok) {
          // success on retry — fall through with retryJson
          return await finishSuccess(
            admin,
            retryJson,
            normalizedTo,
            message,
            user,
            conversation_id,
            corsHeaders,
          );
        }
        return new Response(
          JSON.stringify({
            error: "OpenPhone send failed",
            status: retryRes.status,
            attempts: {
              primary: sendJson || sendText,
              retry: retryJson || retryText,
            },
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({
          error: "OpenPhone send failed",
          status: sendRes.status,
          details: sendJson || sendText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return await finishSuccess(
      admin,
      sendJson,
      normalizedTo,
      message,
      user,
      conversation_id,
      corsHeaders,
    );
  } catch (e) {
    console.error(`[marketing-send-sms-${reqId}] uncaught error`, e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

async function finishSuccess(
  admin: any,
  sendJson: any,
  normalizedTo: string,
  message: string,
  user: any,
  conversation_id: string | null,
  corsHeaders: Record<string, string>,
) {
  // Resolve / upsert conversation
  let convId = conversation_id || null;
  if (!convId) {
    const { data: existing } = await admin
      .from("marketing_conversations").select("id").eq(
        "phone_number",
        normalizedTo,
      ).maybeSingle();
    if (existing) convId = existing.id;
    else {
      const { data: created } = await admin
        .from("marketing_conversations")
        .insert({
          phone_number: normalizedTo,
          status: "human_takeover",
          ai_enabled: false,
        })
        .select("id").single();
      convId = created?.id || null;
    }
  }

  if (convId) {
    await admin.from("marketing_conversations").update({
      last_message_preview: message.substring(0, 280),
      last_message_at: new Date().toISOString(),
    }).eq("id", convId);
  }

  await admin.from("telephony_logs").insert({
    phone_number: normalizedTo,
    action: "sms",
    direction: "outbound",
    openphone_message_id: sendJson?.data?.id || null,
    message_preview: message.substring(0, 500),
    status: "sent",
    agent_user_id: user.id,
    agent_email: user.email || null,
    marketing_conversation_id: convId,
  });

  return new Response(
    JSON.stringify({
      success: true,
      message_id: sendJson?.data?.id,
      conversation_id: convId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
