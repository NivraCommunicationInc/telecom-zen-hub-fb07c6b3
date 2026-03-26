import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface CsvClient {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
}

interface ImportRequest {
  clients: CsvClient[];
  file_name: string;
}

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalide" }, 401);

    // Admin check
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (role?.role !== "admin") return json({ error: "Accès refusé" }, 403);

    const body: ImportRequest = await req.json();
    if (!body.clients?.length) return json({ error: "Liste vide" }, 400);

    // Load existing profiles for dedup
    const { data: existingProfiles } = await admin
      .from("profiles")
      .select("email, phone");

    const existingEmails = new Set((existingProfiles || []).filter(p => p.email).map(p => p.email!.toLowerCase()));
    const existingPhones = new Set((existingProfiles || []).filter(p => p.phone).map(p => p.phone!.replace(/\D/g, "")));

    const results: Array<{ name: string; status: "imported" | "duplicate" | "invalid" | "failed"; reason?: string }> = [];
    let imported = 0, duplicates = 0, invalid = 0, failed = 0;

    const cleanPhone = (p: string | null): string | null => {
      if (!p) return null;
      let digits = p.replace(/\D/g, "");
      if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
      if (digits.length !== 10) return null;
      return digits;
    };

    const cleanEmail = (e: string | null): string | null => {
      if (!e) return null;
      const trimmed = e.trim().toLowerCase();
      if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(trimmed)) return null;
      return trimmed;
    };

    const generatePassword = (): string => {
      const arr = new Uint8Array(20);
      crypto.getRandomValues(arr);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*";
      return Array.from(arr, b => chars[b % chars.length]).join("");
    };

    for (const client of body.clients) {
      const name = (client.name || [client.first_name, client.last_name].filter(Boolean).join(" ")).trim();
      const email = cleanEmail(client.email);
      const phone = cleanPhone(client.phone);

      // Must have at least one contact
      if (!email && !phone) {
        results.push({ name: name || "—", status: "invalid", reason: "Aucun courriel ni téléphone" });
        invalid++;
        continue;
      }
      if (!name || name.length < 2) {
        results.push({ name: name || "—", status: "invalid", reason: "Nom invalide" });
        invalid++;
        continue;
      }

      // Dedup
      const dupEmail = email && existingEmails.has(email);
      const dupPhone = phone && existingPhones.has(phone);
      if (dupEmail || dupPhone) {
        results.push({ name, status: "duplicate", reason: dupEmail ? `Courriel existant: ${email}` : `Téléphone existant: ${phone}` });
        duplicates++;
        continue;
      }

      // Create user
      const tempEmail = email || `import.${phone}@nivra.temp`;
      try {
        const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
          email: tempEmail,
          password: generatePassword(),
          email_confirm: true,
          user_metadata: { full_name: name, phone: phone || undefined },
        });
        if (createErr || !newUser.user) {
          results.push({ name, status: "failed", reason: createErr?.message || "Erreur création" });
          failed++;
          continue;
        }

        // Update profile
        const firstName = client.first_name || name.split(" ")[0];
        const lastName = client.last_name || name.split(" ").slice(1).join(" ") || null;

        await admin.from("profiles").update({
          full_name: name,
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          email: email,
          account_status: "active",
          service_province: "QC",
        }).eq("user_id", newUser.user.id);

        await admin.from("user_roles").upsert({ user_id: newUser.user.id, role: "client" }, { onConflict: "user_id" });

        // Track for in-batch dedup
        if (email) existingEmails.add(email);
        if (phone) existingPhones.add(phone);

        results.push({ name, status: "imported" });
        imported++;
      } catch (err) {
        results.push({ name, status: "failed", reason: err instanceof Error ? err.message : "Erreur inconnue" });
        failed++;
      }
    }

    // Audit log
    await admin.from("csv_import_logs").insert({
      imported_by: user.id,
      file_name: body.file_name || "unknown.csv",
      total_rows: body.clients.length,
      imported_count: imported,
      duplicate_count: duplicates,
      invalid_count: invalid,
      failed_count: failed,
      details: results,
    });

    await admin.from("activity_logs").insert({
      user_id: user.id,
      action: "csv_import_clients",
      entity_type: "profiles",
      actor_email: user.email,
      actor_role: "admin",
      details: { file_name: body.file_name, total: body.clients.length, imported, duplicates, invalid, failed },
    });

    return json({ imported, duplicates, invalid, failed, total: body.clients.length, results });
  } catch (error) {
    console.error("CSV import error:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});
