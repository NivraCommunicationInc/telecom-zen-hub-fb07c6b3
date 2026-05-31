import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const log: string[] = [];
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = "nivratelecom@gmail.com";
    const password = "Ketlie1971$";

    log.push("finding profile...");
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, email")
      .ilike("email", email)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.user_id) {
      return new Response(JSON.stringify({ error: "user not found", log }), { status: 404 });
    }

    log.push("updating password...");
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
      password,
      email_confirm: true,
    });
    if (updateError) throw updateError;

    return new Response(JSON.stringify({ ok: true, user: { id: updateData.user.id, email: updateData.user.email }, log }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e), log }), { status: 500 });
  }
});
