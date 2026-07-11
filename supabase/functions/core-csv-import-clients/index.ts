import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

interface CsvClient {
  name: string;
  first_name?: string;
  last_name?: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  birthday?: string | null;
  square_customer_id?: string | null;
  external_reference?: string | null;
}

// Fake/placeholder email fragments to coerce to NULL
const FAKE_EMAIL_FRAGMENTS = ["noemail@", "x@gmail", "kersten@master", "nizarabd@hotmail"];
// Fake/placeholder phones to skip entirely
const FAKE_PHONES = new Set(["1111111111", "0000000000"]);
// Names that mean "no real contact" — skip the row
const SKIP_NAMES_LC = new Set(["pix", "x", "xxxxxx", "xxx", "xxxx", "xxxxx"]);

const stripAccents = (s: string | null | undefined): string | null => {
  if (!s) return null;
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const capitalize = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  return t.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const parseBirthday = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // Accept YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) {
    const m = us[1].padStart(2, "0");
    const d = us[2].padStart(2, "0");
    return `${us[3]}-${m}-${d}`;
  }
  const d2 = new Date(t);
  if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  return null;
};

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

    // Load existing data:
    // - crm_contacts: used for dedup (these are the actual leads we're managing)
    // - profiles: used ONLY to detect prospect↔client conversion (NOT for dedup)
    //   Rationale: Shopify/Square exports are prospects. A contact already in profiles
    //   is a client — we still import it as a CRM lead but tag it with converted_to_user_id.
    const fetchAll = async (table: string, cols: string) => {
      const all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await admin.from(table).select(cols).range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return all;
    };
    const [profiles, crmContactsExisting] = await Promise.all([
      fetchAll("profiles", "user_id, email, phone"),
      fetchAll("crm_contacts", "email, phone"),
    ]);

    // Normalize phone to 10-digit canonical form (same as frontend)
    const normPhoneForDedup = (p: string | null): string | null => {
      if (!p) return null;
      let d = p.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
      return d.length === 10 ? d : null;
    };

    // Dedup Sets — crm_contacts ONLY
    const existingEmails = new Set<string>();
    const existingPhones = new Set<string>();
    for (const c of crmContactsExisting) {
      if (c.email) existingEmails.add(c.email.toLowerCase());
      const np = normPhoneForDedup(c.phone);
      if (np) existingPhones.add(np);
    }

    // Profile lookup maps — for converted_to_user_id tagging
    const profileByEmail = new Map<string, string>();
    const profileByPhone = new Map<string, string>();
    for (const p of profiles) {
      if (p.email && p.user_id) profileByEmail.set(p.email.toLowerCase(), p.user_id);
      const np = normPhoneForDedup(p.phone);
      if (np && p.user_id) profileByPhone.set(np, p.user_id);
    }


    const cleanPhone = (p: string | null): string | null => {
      if (!p) return null;
      let d = p.replace(/\D/g, "");
      if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
      return d.length === 10 ? d : null;
    };
    const cleanEmail = (e: string | null | undefined): string | null => {
      if (!e) return null;
      const t = e.trim().toLowerCase();
      if (!t) return null;
      // Coerce known fake emails to NULL
      for (const frag of FAKE_EMAIL_FRAGMENTS) {
        if (t.includes(frag)) return null;
      }
      return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(t) ? t : null;
    };

    // Generate a batch ID for this import
    const batchId = crypto.randomUUID();

    const results: Array<{ name: string; status: "imported" | "duplicate" | "invalid" | "failed"; reason?: string; rejection_code?: string }> = [];
    let imported = 0, duplicates = 0, invalid = 0, failed = 0;
    const toInsert: Array<Record<string, unknown>> = [];

    // In-batch dedup by (phone, last_name) per spec
    const seenPhoneLast = new Set<string>();

    for (const client of clients) {
      const firstNameClean = capitalize(client.first_name) || capitalize((client.name || "").split(" ")[0]);
      const lastNameClean = capitalize(client.last_name) || capitalize((client.name || "").split(" ").slice(1).join(" "));
      const name = (client.name || [firstNameClean, lastNameClean].filter(Boolean).join(" ")).trim();
      const email = cleanEmail(client.email);
      let rawPhone = cleanPhone(client.phone);
      // Fallback: Reference ID (external_reference) often contains the phone in Shopify/Square exports
      if (!rawPhone && client.external_reference) {
        const ref = client.external_reference.trim();
        const refDigits = ref.replace(/\D/g, "");
        if (refDigits.length >= 7 && refDigits.length <= 11) {
          rawPhone = cleanPhone(ref);
        }
      }
      const phone = rawPhone && !FAKE_PHONES.has(rawPhone) ? rawPhone : null;

      const addressClean = stripAccents(client.address) || null;
      const cityClean = stripAccents(client.city) || null;

      // SKIP rules: PIX / x / xxxxxx / empty names
      const fnLc = (firstNameClean || "").toLowerCase().trim();
      const lnLc = (lastNameClean || "").toLowerCase().trim();
      if (
        (SKIP_NAMES_LC.has(fnLc) && SKIP_NAMES_LC.has(lnLc)) ||
        SKIP_NAMES_LC.has(fnLc) ||
        (!fnLc && !lnLc)
      ) {
        results.push({ name: name || "—", status: "invalid", reason: "Nom placeholder (PIX/x/vide)", rejection_code: "placeholder_name" });
        invalid++;
        continue;
      }

      // Relaxed validation:
      // valid = (real email) OR (real phone) OR (first + last + (city OR address))
      const hasLocatable = !!(fnLc && lnLc && (cityClean || addressClean));
      if (!email && !phone && !hasLocatable) {
        results.push({ name: name || "—", status: "invalid", reason: "Aucun email, téléphone ni adresse exploitable", rejection_code: "invalid_format" });
        invalid++;
        continue;
      }
      if (!name || name.length < 2) {
        results.push({ name: name || "—", status: "invalid", reason: "Nom invalide", rejection_code: "invalid_format" });
        invalid++;
        continue;
      }

      // Dedup: same email OR (same phone AND same last_name)
      const phoneLastKey = phone && lnLc ? `${phone}|${lnLc}` : null;
      const dupE = email && existingEmails.has(email);
      const dupPL = phoneLastKey && seenPhoneLast.has(phoneLastKey);
      // Also dedup against any existing phone (legacy behaviour kept as soft check)
      const dupP = phone && existingPhones.has(phone);
      if (dupE || dupPL || dupP) {
        results.push({
          name,
          status: "duplicate",
          reason: dupE ? `Courriel existant: ${email}` : (dupPL ? `Téléphone + nom déjà importés` : `Téléphone existant: ${phone}`),
          rejection_code: dupE ? "duplicate_email" : "duplicate_phone",
        });
        duplicates++;
        continue;
      }

      // Track for in-batch dedup
      if (email) existingEmails.add(email);
      if (phone) existingPhones.add(phone);
      if (phoneLastKey) seenPhoneLast.add(phoneLastKey);

      // Detect prospect↔client conversion (informational only — does NOT block import)
      const normPhone = normPhoneForDedup(phone);
      const convertedUserId =
        (email && profileByEmail.get(email)) ||
        (normPhone && profileByPhone.get(normPhone)) ||
        null;

      toInsert.push({
        full_name: name,
        first_name: firstNameClean,
        last_name: lastNameClean,
        email,
        phone,
        address: addressClean,
        city: cityClean,
        postal_code: client.postal_code ? client.postal_code.trim().toUpperCase() : null,
        birthday: parseBirthday(client.birthday),
        square_customer_id: client.square_customer_id?.trim() || null,
        external_reference: client.external_reference?.trim() || null,
        source: (client.square_customer_id || client.external_reference) ? "shopify_import" : "csv_import",
        status: convertedUserId ? "converted" : "lead",
        call_status: "not_called",
        priority: 2,
        imported_by: user.id,
        import_batch_id: batchId,
        converted_to_user_id: convertedUserId,
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
          const code = insertErr.code === "23505" ? "constraint_violation" : "db_error";
          for (let j = i; j < i + chunk.length; j++) {
            const idx = results.findIndex((r, ri) => ri >= j && r.status === "imported");
            if (idx >= 0) { results[idx].status = "failed"; results[idx].reason = insertErr.message; results[idx].rejection_code = code; imported--; failed++; }
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

    await writeAccountJournal(admin, {
      targetTable: "activity_logs",
      payload: {
        user_id: user.id,
        action: "csv_import_crm_contacts",
        entity_type: "crm_contacts",
        actor_email: user.email,
        actor_role: "admin",
        details: { file_name: fileName, batch_id: batchId, total: clients.length, imported, duplicates, invalid, failed },
      },
      eventKey: `csv_import:${batchId}:crm_contacts:summary`,
      actor: { userId: user.id, role: "admin", name: user.email ?? "admin", email: user.email ?? null },
    });

    return json({ imported, duplicates, invalid, failed, total: clients.length, batch_id: batchId, results });
  } catch (error) {
    console.error("CSV import error:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});
