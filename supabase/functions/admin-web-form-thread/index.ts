import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify admin/staff JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is admin/staff
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    // Check if user is admin or staff
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    const { data: employee } = await supabase
      .from("employees")
      .select("id, is_active, role, full_name, email")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser && !employee) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffName = employee?.full_name || user.email || "Admin";
    const staffEmail = employee?.email || user.email;

    // Get thread ID from body (functions.invoke) or URL params
    let threadId: string | null = null;
    let bodyData: Record<string, unknown> = {};
    
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        bodyData = await req.json();
        threadId = (bodyData.thread_id as string) || null;
      } catch {
        // Ignore parse errors
      }
    }
    
    // Fallback to URL params
    if (!threadId) {
      const url = new URL(req.url);
      threadId = url.searchParams.get("thread_id");
    }

    if (!threadId) {
      return new Response(JSON.stringify({ error: "thread_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle GET (or POST without updates = fetch)
    if (req.method === "GET" || (req.method === "POST" && !bodyData.status && !bodyData.admin_assignee_user_id && !bodyData.admin_tags)) {
      // Fetch thread and messages
      const { data: thread, error: threadError } = await supabase
        .from("web_form_threads")
        .select("*")
        .eq("id", threadId)
        .single();

      if (threadError || !thread) {
        return new Response(JSON.stringify({ error: "Thread not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: messages, error: messagesError } = await supabase
        .from("web_form_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("Messages fetch error:", messagesError);
        throw new Error("Failed to fetch messages");
      }

      return new Response(
        JSON.stringify({ thread, messages }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle PATCH/POST with updates
    if (req.method === "PATCH" || (req.method === "POST" && (bodyData.status || bodyData.admin_assignee_user_id !== undefined || bodyData.admin_tags !== undefined))) {
      const updates: Record<string, unknown> = {};

      if (bodyData.status) updates.status = bodyData.status;
      if (bodyData.admin_assignee_user_id !== undefined) updates.admin_assignee_user_id = bodyData.admin_assignee_user_id;
      if (bodyData.admin_tags !== undefined) updates.admin_tags = bodyData.admin_tags;

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "No updates provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedThread, error: updateError } = await supabase
        .from("web_form_threads")
        .update(updates)
        .eq("id", threadId)
        .select()
        .single();

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error("Failed to update thread");
      }

      if (bodyData.status) {
        await supabase.from("web_form_messages").insert({
          thread_id: threadId,
          sender_type: "system",
          sender_name: staffName,
          sender_email: staffEmail,
          body_text: `Statut changé à "${bodyData.status}" par ${staffName}`,
          direction: "outbound",
          is_internal_note: true,
        });
      }

      return new Response(
        JSON.stringify({ ok: true, thread: updatedThread }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fallback (should never reach here)
    return new Response(JSON.stringify({ error: "Unhandled request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-web-form-thread error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
