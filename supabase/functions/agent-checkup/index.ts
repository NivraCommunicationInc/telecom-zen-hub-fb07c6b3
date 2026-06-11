import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) Active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select(
      "id, account_number, status, created_at, client_id, primary_service_address, primary_service_city, primary_service_province, primary_service_postal_code"
    )
    .eq("status", "active")
    .order("account_number");

  console.log("Accounts error:", accountsError);
  console.log("Total active accounts:", accounts?.length || 0);

  if (!accounts || accounts.length === 0) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "checkup",
      action: "weekly_report",
      result: "no_clients",
      details: { message: "No active accounts", error: accountsError?.message },
    });
    return new Response(
      JSON.stringify({ ok: true, sent: 0, error: accountsError?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const accountIds = accounts.map((a) => a.id);
  const clientIds = Array.from(new Set(accounts.map((a) => a.client_id).filter(Boolean)));

  // 2) Related data — parallel
  const [
    profilesRes,
    addressesRes,
    equipmentRes,
    suppliersRes,
    customersRes,
    promosRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, first_name, last_name, email, phone")
      .in("user_id", clientIds),
    supabase
      .from("service_addresses")
      .select("account_id, address_line, city, province, postal_code, is_primary, is_default")
      .in("account_id", accountIds),
    supabase
      .from("equipment_inventory")
      .select("account_id, catalog_name, category, sku, serial_number, status")
      .in("account_id", accountIds),
    supabase
      .from("supplier_accounts")
      .select(
        "id, client_id, first_name, last_name, date_of_birth, account_email, service_name, monthly_price, status, notes"
      )
      .in("client_id", clientIds),
    supabase.from("billing_customers").select("id, user_id").in("user_id", clientIds),
    supabase
      .from("account_promotions")
      .select("account_id, label, promo_code, promotion_type, amount, months_remaining, is_active")
      .in("account_id", accountIds)
      .eq("is_active", true),
  ]);

  console.log("profiles:", profilesRes.data?.length, "addresses:", addressesRes.data?.length,
    "equipment:", equipmentRes.data?.length, "suppliers:", suppliersRes.data?.length,
    "customers:", customersRes.data?.length, "promos:", promosRes.data?.length);

  const customerIds = (customersRes.data || []).map((c: any) => c.id);
  const customerToUser = new Map((customersRes.data || []).map((c: any) => [c.id, c.user_id]));
  const safeIds = customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"];

  const [subsRes, paymentsRes, invoicesRes] = await Promise.all([
    supabase
      .from("billing_subscriptions")
      .select(
        "customer_id, plan_name, plan_price, status, next_renewal_at, referral_discount_active, referral_discount_amount, referral_discount_months_remaining"
      )
      .in("customer_id", safeIds),
    supabase
      .from("billing_payments")
      .select("customer_id, amount, received_at, method, status")
      .in("customer_id", safeIds),
    supabase
      .from("billing_invoices")
      .select("customer_id, invoice_number, total, balance_due, status, due_date")
      .in("customer_id", safeIds),
  ]);

  console.log("subs:", subsRes.data?.length, "payments:", paymentsRes.data?.length, "invoices:", invoicesRes.data?.length);

  // 3) Decrypt supplier passwords (service-role only RPC)
  const supplierIds = (suppliersRes.data || []).map((s: any) => s.id);
  const supplierPasswords = new Map<string, string>();
  if (supplierIds.length) {
    const { data: pwdData, error: pwdErr } = await supabase.rpc(
      "_agent_get_supplier_passwords",
      { p_ids: supplierIds }
    );
    console.log("supplier pwd err:", pwdErr?.message);
    (pwdData || []).forEach((r: any) => supplierPasswords.set(r.id, r.password));
  }

  // ── Index helpers ───────────────────────────────────────────
  const groupBy = <T>(arr: T[] | null, key: (r: T) => string | undefined | null) => {
    const m = new Map<string, T[]>();
    (arr || []).forEach((r) => {
      const k = key(r);
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  };

  const profilesByUser = groupBy(profilesRes.data as any[], (r: any) => r.user_id);
  const addressesByAccount = groupBy(addressesRes.data as any[], (r: any) => r.account_id);
  const equipmentByAccount = groupBy(equipmentRes.data as any[], (r: any) => r.account_id);
  const suppliersByClient = groupBy(suppliersRes.data as any[], (r: any) => r.client_id);
  const promosByAccount = groupBy(promosRes.data as any[], (r: any) => r.account_id);
  const subsByUser = groupBy(subsRes.data as any[], (r: any) => customerToUser.get(r.customer_id));
  const paymentsByUser = groupBy(paymentsRes.data as any[], (r: any) => customerToUser.get(r.customer_id));
  const invoicesByUser = groupBy(invoicesRes.data as any[], (r: any) => customerToUser.get(r.customer_id));

  // ── CSV ─────────────────────────────────────────────────────
  const headers = [
    "Numéro de compte",
    "Nom complet",
    "Email",
    "Téléphone",
    "Adresse complète",
    "Forfait",
    "Prix mensuel",
    "Statut abonnement",
    "Prochain renouvellement",
    "Date activation compte",
    "Promotions actives",
    "Rabais actifs",
    "Équipements",
    "Numéros de série",
    "Fournisseur — Nom",
    "Fournisseur — Prénom",
    "Fournisseur — Date naissance",
    "Fournisseur — Email",
    "Fournisseur — Mot de passe",
    "Fournisseur — Statut",
    "Paiement 1",
    "Paiement 2",
    "Paiement 3",
    "Factures impayées",
    "Statut compte",
  ];

  const fmtDate = (d: any) =>
    d ? new Date(d).toLocaleDateString("fr-CA") : "";
  const fmtMoney = (n: any) =>
    n != null && !Number.isNaN(Number(n)) ? Number(n).toFixed(2) + "$" : "";

  const rows = accounts.map((c: any) => {
    const profile = (profilesByUser.get(c.client_id) || [])[0];
    const subs = subsByUser.get(c.client_id) || [];
    const sub = subs.find((s: any) => s.status === "active") || subs[0];
    const addrList = addressesByAccount.get(c.id) || [];
    const addr =
      addrList.find((a: any) => a.is_primary) ||
      addrList.find((a: any) => a.is_default) ||
      addrList[0];
    const supplier = (suppliersByClient.get(c.client_id) || [])[0];
    const equipment = (equipmentByAccount.get(c.id) || []).filter(
      (e: any) => e.status === "assigned" || e.status === "deployed"
    );
    const payments = (paymentsByUser.get(c.client_id) || [])
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime()
      );
    const invoices = invoicesByUser.get(c.client_id) || [];
    const promos = promosByAccount.get(c.id) || [];

    const fullAddress = addr
      ? [addr.address_line, addr.city, addr.province, addr.postal_code]
          .filter(Boolean)
          .join(", ")
      : [
          c.primary_service_address,
          c.primary_service_city,
          c.primary_service_province,
          c.primary_service_postal_code,
        ]
          .filter(Boolean)
          .join(", ");

    const equipmentName = (e: any): string => {
      const cat = String(e.category || "").toLowerCase();
      const name = String(e.catalog_name || "");
      if (cat === "borne_wifi" || /borne|wifi|nivra-fi/i.test(name)) return "Borne WiFi";
      if (cat === "terminal" || /terminal/i.test(name)) return "Terminal TV 4K";
      if (cat === "sim_card" || /\bsim\b/i.test(name)) return "SIM";
      const cleaned = name
        .replace(/^Manuel\s*—\s*/i, "")
        .replace(/borne_wifi/gi, "Borne WiFi")
        .replace(/terminal_tv|terminal/gi, "Terminal TV 4K")
        .trim();
      return cleaned || "N/A";
    };

    const isValidSerial = (s: any): boolean => {
      const v = String(s ?? "").trim();
      if (v.length < 8) return false;
      if (!/[0-9]/.test(v)) return false;
      return true;
    };

    const equipementsArr = equipment.map(equipmentName);
    const serialsArr = equipment.map((e: any) =>
      isValidSerial(e.serial_number) ? String(e.serial_number).trim() : "N/A"
    );
    const equipements = equipementsArr.length ? equipementsArr.join(" | ") : "N/A";
    const serials = serialsArr.length ? serialsArr.join(" | ") : "N/A";

    const promoLabels =
      promos
        .filter((p: any) => p.promotion_type !== "discount")
        .map((p: any) =>
          [p.label || p.promo_code, p.months_remaining ? `(${p.months_remaining} mois)` : ""]
            .filter(Boolean)
            .join(" ")
        )
        .join(" | ") || "N/A";

    const rabaisParts: string[] = [];
    promos
      .filter((p: any) => p.promotion_type === "discount" || Number(p.amount) > 0)
      .forEach((p: any) => {
        rabaisParts.push(
          `${p.label || p.promo_code || "Rabais"}: ${fmtMoney(p.amount)}${
            p.months_remaining ? ` (${p.months_remaining} mois)` : ""
          }`
        );
      });
    if (sub?.referral_discount_active && Number(sub.referral_discount_amount) > 0) {
      rabaisParts.push(
        `Parrainage: ${fmtMoney(sub.referral_discount_amount)}${
          sub.referral_discount_months_remaining
            ? ` (${sub.referral_discount_months_remaining} mois)`
            : ""
        }`
      );
    }
    const rabais = rabaisParts.length ? rabaisParts.join(" | ") : "N/A";

    const p1 = payments[0];
    const p2 = payments[1];
    const p3 = payments[2];
    const fmtPay = (p: any) =>
      p ? `${fmtDate(p.received_at)} | ${fmtMoney(p.amount)} | ${p.method || "N/A"}` : "N/A";

    const facturesImpayees =
      invoices
        .filter((bi: any) => bi.status !== "paid" && Number(bi.balance_due) > 0)
        .map(
          (bi: any) =>
            `${bi.invoice_number} | ${fmtMoney(bi.balance_due)} | ${fmtDate(bi.due_date)}`
        )
        .join(" || ") || "Aucune";

    const NA = "N/A";
    const orNA = (v: any) => {
      const s = v == null ? "" : String(v).trim();
      return s.length ? s : NA;
    };
    const supplierPwd = supplier ? supplierPasswords.get(supplier.id) : "";

    return [
      orNA(c.account_number),
      orNA(
        profile?.full_name ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
      ),
      orNA(profile?.email),
      orNA(profile?.phone),
      orNA(fullAddress),
      orNA(sub?.plan_name),
      sub?.plan_price != null ? fmtMoney(sub.plan_price) : NA,
      orNA(sub?.status),
      sub?.next_renewal_at ? fmtDate(sub.next_renewal_at) : NA,
      c.created_at ? fmtDate(c.created_at) : NA,
      promoLabels,
      rabais,
      equipements,
      serials,
      supplier ? orNA(supplier.last_name) : NA,
      supplier ? orNA(supplier.first_name) : NA,
      supplier ? (supplier.date_of_birth ? fmtDate(supplier.date_of_birth) : NA) : NA,
      supplier ? orNA(supplier.account_email) : NA,
      supplier ? orNA(supplierPwd) : NA,
      supplier ? orNA(supplier.status) : NA,
      fmtPay(p1),
      fmtPay(p2),
      fmtPay(p3),
      facturesImpayees,
      orNA(c.status),
    ].map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"');
  });

  const csvContent = [
    headers.map((h) => '"' + h + '"').join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  const csvWithBOM = "\uFEFF" + csvContent;
  const base64CSV = btoa(unescape(encodeURIComponent(csvWithBOM)));

  const today = new Date().toLocaleDateString("fr-CA");
  const filename = `rapport-clients-nivra-${today}.csv`;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: ["support@nivra-telecom.ca"],
      subject: `📊 Rapport hebdomadaire clients Nivra — ${today} (${accounts.length} clients actifs)`,
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: #0066CC; padding: 32px 24px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px;">📊 Rapport Hebdomadaire</h1>
    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Nivra Telecom — ${today}</p>
  </div>
  <div style="padding: 32px 24px; color: #111111;">
    <h2 style="margin: 0 0 16px; font-size: 18px;">Résumé de la semaine</h2>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">
      <strong>${accounts.length} clients actifs</strong> dans le rapport ci-joint.
    </p>
    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #444;">
      Le fichier CSV contient toutes les informations : coordonnées, adresse,
      forfait, équipements, promotions, rabais, fournisseur, paiements et factures.
    </p>
  </div>
  <div style="padding: 16px 24px; background: #F7F7F7; color: #666; font-size: 12px; text-align: center;">
    Nivra Communications Inc. — support@nivra-telecom.ca
  </div>
</div>
      `,
      attachments: [
        { filename, content: base64CSV, content_type: "text/csv" },
      ],
    }),
  });

  const emailResult = await emailRes.json();

  await supabase.from("agent_audit_log").insert({
    agent_name: "checkup",
    action: "weekly_report",
    result: "success",
    details: {
      clients_count: accounts.length,
      filename,
      email_id: emailResult.id,
      date: today,
    },
  });

  await supabase.from("agent_events").insert({
    agent_name: "checkup",
    event_type: "success",
    message: `Rapport hebdomadaire envoyé — ${accounts.length} clients actifs`,
    details: { filename, date: today },
  });

  await supabase
    .from("agent_registry")
    .update({
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
    })
    .eq("agent_name", "checkup");

  return new Response(
    JSON.stringify({
      ok: true,
      clients_count: accounts.length,
      filename,
      email_sent: !!emailResult.id,
      sample: rows[0] ? Object.fromEntries(headers.map((h, i) => [h, rows[0][i].slice(1, -1)])) : null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
