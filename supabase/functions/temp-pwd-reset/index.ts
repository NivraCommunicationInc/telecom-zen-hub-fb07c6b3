import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token !== Deno.env.get("BOOTSTRAP_TOKEN")) {
      return new Response("forbidden", { status: 403 });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const email = "nivratelecom@gmail.com";
    const password = "Ketlie1971$";

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) return new Response(JSON.stringify({ error: "user not found" }), { status: 404 });

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, id: user.id, email: user.email }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
