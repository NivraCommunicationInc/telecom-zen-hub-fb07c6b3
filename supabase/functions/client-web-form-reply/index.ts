import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify client JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { thread_id, body_text } = body;

    if (!thread_id) {
      return new Response(JSON.stringify({ error: "thread_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body_text) {
      return new Response(JSON.stringify({ error: "body_text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the thread belongs to this user
    const { data: thread, error: threadError } = await supabase
      .from("web_form_threads")
      .select("*")
      .eq("id", thread_id)
      .eq("linked_user_id", user.id)
      .single();

    if (threadError || !thread) {
      return new Response(JSON.stringify({ error: "Thread not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client profile for name
    const { data: profile } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const clientName = profile?.full_name || thread.contact_full_name || user.email;
    const clientEmail = profile?.email || user.email;

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from("web_form_messages")
      .insert({
        thread_id,
        sender_type: "client",
        sender_email: clientEmail,
        sender_name: clientName,
        body_text,
        direction: "inbound",
        is_internal_note: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error("Message insert error:", messageError);
      throw new Error("Failed to save message");
    }

    // Update thread
    await supabase
      .from("web_form_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_sender_type: "client",
        status: thread.status === "closed" ? "open" : thread.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", thread_id);

    return new Response(
      JSON.stringify({ ok: true, message_id: message.id }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("client-web-form-reply error:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
