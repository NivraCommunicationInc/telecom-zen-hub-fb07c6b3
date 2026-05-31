import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const log: string[] = [];
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const email = "nivratelecom@gmail.com";
    const password = "Ketlie1971$";

    log.push("listing users...");
    let userId: string | null = null;
    for (let page = 1; page <= 20 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) { log.push("listErr p"+page+": "+JSON.stringify(error)); break; }
      const u = data.users.find((x) => x.email?.toLowerCase() === email);
      if (u) userId = u.id;
      log.push(`page ${page}: ${data.users.length} users`);
      if (data.users.length < 200) break;
    }
    if (!userId) return new Response(JSON.stringify({ error: "user not found", log }), { status: 404 });

    log.push("updating user "+userId);
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      log.push("updErr: "+JSON.stringify(updErr));
      return new Response(JSON.stringify({ error: "update failed", log }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, id: userId, log }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e), log }), { status: 500 });
  }
});
