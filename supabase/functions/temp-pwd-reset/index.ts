import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async (_req) => {
  const log: string[] = [];
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const sql = postgres(dbUrl, { prepare: false, max: 1 });
    const email = "nivratelecom@gmail.com";
    const password = "Ketlie1971$";

    log.push("updating via SQL...");
    const rows = await sql`
      UPDATE auth.users
      SET encrypted_password = crypt(${password}, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE email = ${email}
      RETURNING id, email
    `;
    await sql.end();

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "user not found", log }), { status: 404 });
    }
    return new Response(JSON.stringify({ ok: true, user: rows[0], log }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e), log }), { status: 500 });
  }
});
