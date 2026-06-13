import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
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
      .select("id, is_active, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!adminUser && !employee) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse query params from body (since we're using functions.invoke)
    let status: string | null = null;
    let search: string | null = null;
    let limit = 50;
    let offset = 0;

    // Try to get params from body (functions.invoke sends JSON body)
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const body = await req.json();
        status = body.status || null;
        search = body.search || null;
        limit = parseInt(body.limit) || 50;
        offset = parseInt(body.offset) || 0;
      } catch (_e) {
        // Ignore parse errors
      }
    } else {
      // Fallback to URL params for GET requests
      const url = new URL(req.url);
      status = url.searchParams.get("status");
      search = url.searchParams.get("search");
      limit = parseInt(url.searchParams.get("limit") || "50");
      offset = parseInt(url.searchParams.get("offset") || "0");
    }

    // Build query
    let query = supabase
      .from("web_form_threads")
      .select("*", { count: "exact" })
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`contact_email.ilike.%${search}%,contact_full_name.ilike.%${search}%,thread_number.ilike.%${search}%`);
    }

    const { data: threads, count, error: queryError } = await query;

    if (queryError) {
      console.error("Query error:", queryError);
      throw new Error("Failed to fetch threads");
    }

    // Get message counts for each thread
    const threadIds = threads?.map((t) => t.id) || [];
    const { data: messageCounts } = await supabase
      .from("web_form_messages")
      .select("thread_id")
      .in("thread_id", threadIds);

    const countMap: Record<string, number> = {};
    messageCounts?.forEach((m) => {
      countMap[m.thread_id] = (countMap[m.thread_id] || 0) + 1;
    });

    const threadsWithCounts = threads?.map((t) => ({
      ...t,
      message_count: countMap[t.id] || 0,
    }));

    return new Response(
      JSON.stringify({
        threads: threadsWithCounts,
        total: count,
        limit,
        offset,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-web-form-list error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
