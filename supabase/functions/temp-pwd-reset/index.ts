import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const log: string[] = [];
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = "nivratelecom@gmail.com";
    const password = "Ketlie1971$";

    log.push("finding user id from Nivra profile...");
    let userId: string | null = null;

    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id")
      .ilike("email", email)
      .maybeSingle();

    if (profileError) log.push(`profile lookup failed: ${profileError.message}`);
    userId = (profileData as { user_id?: string } | null)?.user_id ?? null;

    if (!userId) {
      log.push("profile not found, falling back to auth users scan...");
      for (let page = 1; page <= 20 && !userId; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
        userId = found?.id ?? null;
        if (data.users.length < 1000) break;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "auth user not found", log }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log.push("updating password...");
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      log.push(`auth update failed: ${JSON.stringify(updateError)}`);
      throw updateError;
    }

    return new Response(JSON.stringify({ ok: true, user: { id: updateData.user.id, email: updateData.user.email }, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e), log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
