/**
 * daily-account-report
 *
 * Envoie chaque jour à support@nivra-telecom.ca un rapport HTML complet
 * de tous les comptes : abonnements, services, rabais, adresses, équipements.
 * Zéro donnée manquante — si un champ est vide la valeur réelle est affichée.
 *
 * Cron recommandé : tous les jours à 07h00 HAE (11:00 UTC)
 *   select cron.schedule('daily-account-report','0 11 * * *',
 *     $$select net.http_post(url:='https://<PROJECT_REF>.supabase.co/functions/v1/daily-account-report',
 *       headers:'{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
 *       body:'{}'::jsonb) as request_id$$);
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { violetShell } from "../_shared/violetEmailShell.ts";

const REPORT_TO = "support@nivra-telecom.ca";
const FROM_EMAIL = "Nivra Telecom <noreply@nivra-telecom.ca>";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  return String(v).substring(0, 10);
}

function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Number(v).toFixed(2)}/mois`;
}

function fmt(v: string | null | undefined, fallback = "—"): string {
  if (v === null || v === undefined) return fallback;
  const s = String(v).trim();
  return s === "" ? fallback : s;
}

function statusBadge(s: string | null | undefined): string {
  if (!s) return "—";
  const map: Record<string, string> = {
    active: "background:#D1FAE5;color:#065F46",
    suspended: "background:#FEF3C7;color:#92400E",
    cancelled: "background:#FEE2E2;color:#991B1B",
    closed: "background:#F3F4F6;color:#6B7280",
  };
  const style = map[s.toLowerCase()] ?? "background:#F3F4F6;color:#374151";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase;${style}">${s}</span>`;
}

// ─────────────────────────────────────────────
// HTML table builder
// ─────────────────────────────────────────────

interface ReportRow {
  account_number: string;
  client: string;
  email: string;
  phone: string;
  compte_statut: string;
  adresse: string;
  plan_name: string;
  abo_statut: string;
  debut_cycle: string;
  fin_cycle: string;
  prochain_renouvellement: string;
  plan_price: number | null;
  recurring_provider: string;
  services: string;
  rabais: string;
  equipement: string;
}

const COL_BLUE = "#0066CC";
const F = "Arial,Helvetica,sans-serif";

function th(label: string, nowrap = true): string {
  return `<th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;background:${COL_BLUE};border-right:1px solid #0050A0;${nowrap ? "white-space:nowrap;" : ""}">${label}</th>`;
}

function td(content: string, extra = ""): string {
  return `<td style="padding:9px 11px;font-size:12px;color:#374151;vertical-align:top;border-bottom:1px solid #E5E7EB;border-right:1px solid #E5E7EB;font-family:${F};${extra}">${content}</td>`;
}

function buildHtmlTable(rows: ReportRow[]): string {
  if (rows.length === 0) {
    return `<p style="color:#6B7280;font-size:13px;">Aucun compte trouvé.</p>`;
  }

  const headerRow = `<tr>
    ${th("# Compte")}
    ${th("Client")}
    ${th("Courriel")}
    ${th("Tél")}
    ${th("Cte")}
    ${th("Forfait")}
    ${th("Abo")}
    ${th("Début cycle")}
    ${th("Fin cycle")}
    ${th("Prochain renouv.")}
    ${th("Prix")}
    ${th("Paiement")}
    ${th("Services", false)}
    ${th("Rabais", false)}
    ${th("Adresse service", false)}
    ${th("Équipement", false)}
  </tr>`;

  const dataRows = rows.map((r, i) => {
    const bg = i % 2 === 0 ? "#FFFFFF" : "#F9FAFB";
    return `<tr style="background:${bg}">
      ${td(`<span style="font-family:monospace;font-weight:700;color:${COL_BLUE};">${fmt(r.account_number)}</span>`)}
      ${td(`<strong>${fmt(r.client)}</strong>`)}
      ${td(fmt(r.email))}
      ${td(`<span style="font-family:monospace;">${fmt(r.phone)}</span>`)}
      ${td(statusBadge(r.compte_statut))}
      ${td(`<strong>${fmt(r.plan_name)}</strong>`, "min-width:120px;")}
      ${td(statusBadge(r.abo_statut))}
      ${td(`<span style="font-family:monospace;">${fmtDate(r.debut_cycle)}</span>`)}
      ${td(`<span style="font-family:monospace;">${fmtDate(r.fin_cycle)}</span>`)}
      ${td(`<span style="font-family:monospace;">${fmtDate(r.prochain_renouvellement)}</span>`)}
      ${td(`<span style="font-family:monospace;color:#059669;font-weight:600;">${fmtPrice(r.plan_price)}</span>`)}
      ${td(fmt(r.recurring_provider))}
      ${td(fmt(r.services), "min-width:140px;white-space:normal;")}
      ${td(fmt(r.rabais) === "—" ? "—" : `<span style="color:#DC2626;">${fmt(r.rabais)}</span>`, "min-width:120px;white-space:normal;")}
      ${td(fmt(r.adresse), "min-width:160px;white-space:normal;")}
      ${td(fmt(r.equipement), "min-width:140px;white-space:normal;")}
    </tr>`;
  }).join("");

  return `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:${F};border:1px solid #E5E7EB;min-width:100%;">
        <thead>${headerRow}</thead>
        <tbody>${dataRows}</tbody>
      </table>
    </div>`;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" },
    });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── 1. Accounts + billing_customers ──────────────────────────────
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select(`
        id,
        account_number,
        status,
        primary_service_address,
        primary_service_city,
        billing_customers (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .order("account_number");

    if (accErr) throw new Error(`accounts query: ${accErr.message}`);

    // ── 2. Subscriptions ─────────────────────────────────────────────
    const { data: subs, error: subErr } = await supabase
      .from("billing_subscriptions")
      .select(`
        id,
        customer_id,
        plan_name,
        status,
        cycle_start_date,
        cycle_end_date,
        next_renewal_at,
        plan_price,
        recurring_provider
      `)
      .order("cycle_end_date");

    if (subErr) throw new Error(`subscriptions query: ${subErr.message}`);

    // ── 3. Services per subscription ─────────────────────────────────
    const { data: services, error: svcErr } = await supabase
      .from("billing_subscription_services")
      .select("subscription_id, service_name, service_type")
      .eq("is_active", true);

    if (svcErr) throw new Error(`services query: ${svcErr.message}`);

    // ── 4. Active discounts per account ──────────────────────────────
    const { data: adjustments, error: adjErr } = await supabase
      .from("account_adjustments")
      .select("account_id, amount, description")
      .eq("status", "active");

    if (adjErr) throw new Error(`adjustments query: ${adjErr.message}`);

    // ── 5. Equipment per account ──────────────────────────────────────
    const { data: equipment, error: eqErr } = await supabase
      .from("equipment_inventory")
      .select("account_id, catalog_name, model, serial_number, imei, mac_address, status")
      .not("account_id", "is", null);

    if (eqErr) throw new Error(`equipment query: ${eqErr.message}`);

    // ── Build lookup maps ─────────────────────────────────────────────
    const servicesBySubId = new Map<string, string[]>();
    for (const s of (services ?? [])) {
      const label = fmt(s.service_name) + (s.service_type ? ` (${s.service_type})` : "");
      if (!servicesBySubId.has(s.subscription_id)) servicesBySubId.set(s.subscription_id, []);
      servicesBySubId.get(s.subscription_id)!.push(label);
    }

    const discountsByAccountId = new Map<string, string[]>();
    for (const a of (adjustments ?? [])) {
      const label = `-$${Math.abs(Number(a.amount)).toFixed(2)}/mois: ${a.description ?? "rabais"}`;
      if (!discountsByAccountId.has(a.account_id)) discountsByAccountId.set(a.account_id, []);
      discountsByAccountId.get(a.account_id)!.push(label);
    }

    const equipmentByAccountId = new Map<string, string[]>();
    for (const e of (equipment ?? [])) {
      const parts = [fmt(e.catalog_name ?? e.model)];
      if (e.serial_number) parts.push(`S/N:${e.serial_number}`);
      else if (e.imei) parts.push(`IMEI:${e.imei}`);
      else if (e.mac_address) parts.push(`MAC:${e.mac_address}`);
      if (e.status && e.status !== "assigned") parts.push(`[${e.status}]`);
      if (!equipmentByAccountId.has(e.account_id)) equipmentByAccountId.set(e.account_id, []);
      equipmentByAccountId.get(e.account_id)!.push(parts.join(" "));
    }

    // customer_id → account_id map via billing_customers
    const customerToAccountId = new Map<string, string>();
    for (const acc of (accounts ?? [])) {
      const customers = Array.isArray(acc.billing_customers) ? acc.billing_customers : (acc.billing_customers ? [acc.billing_customers] : []);
      for (const c of customers) {
        customerToAccountId.set(c.id, acc.id);
      }
    }

    // ── Assemble rows ─────────────────────────────────────────────────
    const rows: ReportRow[] = [];

    for (const acc of (accounts ?? [])) {
      const customers = Array.isArray(acc.billing_customers) ? acc.billing_customers : (acc.billing_customers ? [acc.billing_customers] : []);
      const bc = customers[0];
      if (!bc) continue; // skip accounts with no billing_customer

      const accSubs = (subs ?? []).filter((s: any) => s.customer_id === bc.id);
      const adresse = [acc.primary_service_address, acc.primary_service_city].filter(Boolean).join(", ");
      const rabais = (discountsByAccountId.get(acc.id) ?? []).join(" | ");
      const equip = (equipmentByAccountId.get(acc.id) ?? []).join(" | ");

      if (accSubs.length === 0) {
        // Account with no subscription — still include it
        rows.push({
          account_number: acc.account_number,
          client: `${bc.first_name} ${bc.last_name}`.trim(),
          email: fmt(bc.email),
          phone: fmt(bc.phone),
          compte_statut: acc.status ?? "—",
          adresse: fmt(adresse),
          plan_name: "Aucun abonnement",
          abo_statut: "",
          debut_cycle: "",
          fin_cycle: "",
          prochain_renouvellement: "",
          plan_price: null,
          recurring_provider: "",
          services: "",
          rabais: fmt(rabais),
          equipement: fmt(equip),
        });
      } else {
        for (const sub of accSubs) {
          const services = (servicesBySubId.get(sub.id) ?? []).join(" | ");
          rows.push({
            account_number: acc.account_number,
            client: `${bc.first_name} ${bc.last_name}`.trim(),
            email: fmt(bc.email),
            phone: fmt(bc.phone),
            compte_statut: acc.status ?? "—",
            adresse: fmt(adresse),
            plan_name: fmt(sub.plan_name),
            abo_statut: sub.status ?? "—",
            debut_cycle: sub.cycle_start_date ?? "",
            fin_cycle: sub.cycle_end_date ?? "",
            prochain_renouvellement: sub.next_renewal_at ?? "",
            plan_price: sub.plan_price,
            recurring_provider: fmt(sub.recurring_provider),
            services: fmt(services),
            rabais: fmt(rabais),
            equipement: fmt(equip),
          });
        }
      }
    }

    // Sort: active accounts first, then by account_number
    rows.sort((a, b) => {
      if (a.compte_statut === "active" && b.compte_statut !== "active") return -1;
      if (a.compte_statut !== "active" && b.compte_statut === "active") return 1;
      return a.account_number.localeCompare(b.account_number);
    });

    // ── Build email ───────────────────────────────────────────────────
    const today = new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const activeCount = rows.filter(r => r.compte_statut === "active" && r.abo_statut === "active").length;
    const suspendedCount = rows.filter(r => r.abo_statut === "suspended").length;
    const tableHtml = buildHtmlTable(rows);

    const emailHtml = violetShell({
      badge: "RAPPORT QUOTIDIEN",
      heroTitle: "État des comptes Nivra",
      heroSub: today,
      bodyHtml: `Rapport automatique de tous les comptes — abonnements, services, rabais, adresses et équipements.`,
      cardTitle: "Résumé",
      cardRows: [
        ["Total comptes", String(accounts?.length ?? 0)],
        ["Abonnements actifs", String(activeCount)],
        ["Abonnements suspendus", suspendedCount > 0 ? `⚠️ ${suspendedCount}` : "0"],
        ["Rapport généré", new Date().toLocaleString("fr-CA", { timeZone: "America/Toronto" })],
      ],
      extraBodyHtml: `
        <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">📋 Tableau complet de tous les comptes — faites défiler horizontalement si nécessaire.</p>
        ${tableHtml}
      `,
    });

    // ── Send via Resend ───────────────────────────────────────────────
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [REPORT_TO],
        subject: `📊 Rapport comptes Nivra — ${today}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend error ${res.status}: ${errText}`);
    }

    const resendData = await res.json();
    console.log("[daily-account-report] Sent:", resendData.id);

    return new Response(JSON.stringify({
      ok: true,
      sent_to: REPORT_TO,
      accounts: accounts?.length ?? 0,
      rows: rows.length,
      resend_id: resendData.id,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[daily-account-report] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
