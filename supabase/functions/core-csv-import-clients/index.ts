import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface CsvClient {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
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

    // Auth + admin role check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalide" }, 401);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (role?.role !== "admin") return json({ error: "Accès refusé" }, 403);

    const body = await req.json();
    const clients: CsvClient[] = body.clients;
    const fileName: string = body.file_name || "unknown.csv";
    if (!clients?.length) return json({ error: "Liste vide" }, 400);

    // Load ALL existing data for dedup (paginate past 1000-row limit)
    const fetchAll = async (table: string) => {
      const all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await admin.from(table).select("email, phone").range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };
    const [profiles, crmContactsExisting] = await Promise.all([
      fetchAll("profiles"),
      fetchAll("crm_contacts"),
    ]);

    // Normalize phone to 10-digit canonical form (same as frontend)
    const normPhoneForDedup = (p: string | null): string | null => {
      if (!p) return null;
      let d = p.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
      return d.length === 10 ? d : null;
    };

    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    for (const p of [...profiles, ...crmContactsExisting]) {
      if (p.email) existingEmails.add(p.email.toLowerCase());
      const np = normPhoneForDedup(p.phone);
      if (np) existingPhones.add(np);
    }

    const cleanPhone = (p: string | null): string | null => {
      if (!p) return null;
      let d = p.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
      return d.length === 10 ? d : null;
    };
    const cleanEmail = (e: string | null): string | null => {
      if (!e) return null;
      const t = e.trim().toLowerCase();
      return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(t) ? t : null;
    };

    // Generate a batch ID for this import
    const batchId = crypto.randomUUID();

    const results: Array<{ name: string; status: "imported" | "duplicate" | "invalid" | "failed"; reason?: string; rejection_code?: string }> = [];
    let imported = 0, duplicates = 0, invalid = 0, failed = 0;
    const toInsert: Array<Record<string, unknown>> = [];

    for (const client of clients) {
      const name = (client.name || [client.first_name, client.last_name].filter(Boolean).join(" ")).trim();
      const email = cleanEmail(client.email);
      const phone = cleanPhone(client.phone);

      if (!email && !phone) { results.push({ name: name || "—", status: "invalid", reason: "Aucun contact valide", rejection_code: "invalid_format" }); invalid++; continue; }
      if (!name || name.length < 2) { results.push({ name: name || "—", status: "invalid", reason: "Nom invalide", rejection_code: "invalid_format" }); invalid++; continue; }

      const dupE = email && existingEmails.has(email);
      const dupP = phone && existingPhones.has(phone);
      if (dupE || dupP) {
        results.push({ name, status: "duplicate", reason: dupE ? `Courriel existant: ${email}` : `Téléphone existant: ${phone}`, rejection_code: dupE ? "duplicate_email" : "duplicate_phone" });
        duplicates++;
        continue;
      }

      // Track for in-batch dedup
      if (email) existingEmails.add(email);
      if (phone) existingPhones.add(phone);

      toInsert.push({
        full_name: name,
        first_name: client.first_name || name.split(" ")[0],
        last_name: client.last_name || name.split(" ").slice(1).join(" ") || null,
        email,
        phone,
        source: "csv_import",
        status: "lead",
        imported_by: user.id,
        import_batch_id: batchId,
      });
      results.push({ name, status: "imported" });
      imported++;
    }

    // Batch insert into crm_contacts
    if (toInsert.length > 0) {
      const CHUNK = 50;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: insertErr } = await admin.from("crm_contacts").insert(chunk);
        if (insertErr) {
          console.error("Batch insert error:", insertErr);
          // Mark these as failed
          for (let j = i; j < i + chunk.length; j++) {
            const idx = results.findIndex((r, ri) => ri >= j && r.status === "imported");
            if (idx >= 0) { results[idx].status = "failed"; results[idx].reason = insertErr.message; imported--; failed++; }
          }
        }
      }
    }

    // Audit
    await admin.from("csv_import_logs").insert({
      imported_by: user.id,
      file_name: fileName,
      total_rows: clients.length,
      imported_count: imported,
      duplicate_count: duplicates,
      invalid_count: invalid,
      failed_count: failed,
      target_table: "crm_contacts",
      details: results,
    });

    await admin.from("activity_logs").insert({
      user_id: user.id,
      action: "csv_import_crm_contacts",
      entity_type: "crm_contacts",
      actor_email: user.email,
      actor_role: "admin",
      details: { file_name: fileName, batch_id: batchId, total: clients.length, imported, duplicates, invalid, failed },
    });

    return json({ imported, duplicates, invalid, failed, total: clients.length, batch_id: batchId, results });
  } catch (error) {
    console.error("CSV import error:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});
