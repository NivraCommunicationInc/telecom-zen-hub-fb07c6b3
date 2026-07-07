import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resendGateway.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const BACKUP_EMAIL = "Nivrasolutions@gmail.com";
const BACKUP_FROM = "backup@nivra-telecom.ca";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAllTables(): Promise<string[]> {
  const { data, error } = await supabase
    .from("information_schema.tables" as never)
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_type", "BASE TABLE");

  if (error || !data) {
    // Fallback: liste minimale des tables critiques
    return [
      "profiles", "accounts", "user_roles", "orders", "order_items",
      "billing_subscriptions", "billing_invoices", "billing_payments",
      "billing_customers", "billing_subscription_services",
      "support_tickets", "ticket_replies", "client_internal_notes",
      "loyalty_points", "loyalty_transactions", "loyalty_rewards",
      "service_addresses", "operational_fees", "email_templates",
      "email_trigger_queue", "stripe_plan_mapping", "partner_program_terms",
      "contracts", "field_quotes", "field_payment_intents",
      "installations", "services", "equipment_inventory",
      "crm_contacts", "marketing_campaigns", "nova_memory",
      "admin_users", "employees", "agent_registry",
      "promotions", "referral_codes", "kyc_verifications",
      "site_settings", "admin_notification_settings",
    ];
  }
  return (data as { table_name: string }[]).map((r) => r.table_name);
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

Deno.serve(async (req) => {
  // Vérifier que c'est un appel autorisé (cron interne ou manuel)
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${SERVICE_KEY}` && req.method !== "POST") {
    return new Response("Non autorisé", { status: 401 });
  }

  const startTime = Date.now();
  const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const results: { table: string; rows: number; status: string }[] = [];

  try {
    // 1. Récupérer toutes les tables
    const tables = await getAllTables();

    // 2. Exporter chaque table
    const csvFiles: { name: string; content: string }[] = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table as never)
          .select("*")
          .limit(500000);

        if (error || !data || (data as unknown[]).length === 0) {
          results.push({ table, rows: 0, status: "vide ou erreur" });
          continue;
        }

        const rows = data as Record<string, unknown>[];
        const csv = toCSV(rows);
        csvFiles.push({ name: `${table}.csv`, content: csv });
        results.push({ table, rows: rows.length, status: "✓" });
      } catch {
        results.push({ table, rows: 0, status: "erreur" });
      }
    }

    // 3. Exporter les utilisateurs Auth
    try {
      const authResp = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`,
        { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
      );
      if (authResp.ok) {
        const authData = await authResp.json();
        const users = authData.users || [];
        if (users.length > 0) {
          csvFiles.push({ name: "auth_users.csv", content: toCSV(users) });
          results.push({ table: "auth_users", rows: users.length, status: "✓" });
        }
      }
    } catch {
      results.push({ table: "auth_users", rows: 0, status: "erreur" });
    }

    // 4. Upload vers Supabase Storage (bucket "backups")
    await supabase.storage.createBucket("backups", { public: false }).catch(() => {});

    const uploadedFiles: { name: string; url: string }[] = [];
    for (const file of csvFiles) {
      const path = `backup-${date}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("backups")
        .upload(path, new TextEncoder().encode(file.content), {
          contentType: "text/csv",
          upsert: true,
        });

      if (!uploadError) {
        const { data: signedData } = await supabase.storage
          .from("backups")
          .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 jours
        if (signedData) {
          uploadedFiles.push({ name: file.name, url: signedData.signedUrl });
        }
      }
    }

    // 5. Calculer le résumé
    const totalRows = results.reduce((sum, r) => sum + r.rows, 0);
    const successCount = results.filter((r) => r.status === "✓").length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // 6. Envoyer l'email avec Resend
    const tableRows = results
      .filter((r) => r.rows > 0)
      .sort((a, b) => b.rows - a.rows)
      .map((r) => `<tr><td style="padding:4px 12px">${r.table}</td><td style="padding:4px 12px;text-align:right"><b>${r.rows.toLocaleString()}</b></td></tr>`)
      .join("");

    const downloadLinks = uploadedFiles
      .slice(0, 20)
      .map((f) => `<li><a href="${f.url}">${f.name}</a> (7 jours)</li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">📦 Backup Nivra Telecom</h2>
    <p style="margin:4px 0 0;opacity:.7">${new Date().toLocaleDateString("fr-CA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px;border-radius:0 0 8px 8px">
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <div style="flex:1;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:bold;color:#16a34a">${successCount}</div>
        <div style="color:#15803d;font-size:13px">tables exportées</div>
      </div>
      <div style="flex:1;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:bold;color:#1d4ed8">${totalRows.toLocaleString()}</div>
        <div style="color:#1e40af;font-size:13px">lignes totales</div>
      </div>
      <div style="flex:1;background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:bold;color:#a16207">${elapsed}s</div>
        <div style="color:#92400e;font-size:13px">durée</div>
      </div>
    </div>

    <h3>Télécharger les fichiers (liens valides 7 jours)</h3>
    <ul>${downloadLinks || "<li>Aucun fichier uploadé</li>"}</ul>
    ${uploadedFiles.length > 20 ? `<p>... et ${uploadedFiles.length - 20} autres fichiers dans le bucket "backups" sur Supabase.</p>` : ""}

    <h3>Données exportées</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f8f9fa">
        <th style="padding:4px 12px;text-align:left">Table</th>
        <th style="padding:4px 12px;text-align:right">Rows</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <p style="margin-top:20px;color:#6b7280;font-size:12px">
      Backup automatique Nivra Telecom · Projet xtgngmtxggascbxnswvb<br>
      Prochain backup dans 3 jours
    </p>
  </div>
</body>
</html>`;

    await sendResendEmail({
      from: BACKUP_FROM,
      to: [BACKUP_EMAIL],
      subject: `📦 Backup Nivra — ${new Date().toLocaleDateString("fr-CA")} — ${successCount} tables / ${totalRows.toLocaleString()} rows`,
      html,
    });


    return new Response(
      JSON.stringify({ success: true, tables: successCount, rows: totalRows, elapsed }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
