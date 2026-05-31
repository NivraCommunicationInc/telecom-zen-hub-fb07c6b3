import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) Fetch active accounts
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, account_number, status, created_at, client_id")
    .eq("status", "active")
    .order("account_number");

  console.log("Accounts query error:", accountsError);
  console.log("Total active accounts:", accounts?.length || 0);
  console.log("Sample account:", JSON.stringify(accounts?.slice(0, 1)));

  if (!accounts || accounts.length === 0) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "checkup",
      action: "weekly_report",
      result: "no_clients",
      details: { message: "No active accounts found", error: accountsError?.message },
    });
    return new Response(
      JSON.stringify({ ok: true, sent: 0, error: accountsError?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const accountIds = accounts.map((a) => a.id);
  const clientIds = Array.from(new Set(accounts.map((a) => a.client_id).filter(Boolean)));

  // 2) Fetch related data in parallel
  const [
    profilesRes,
    addressesRes,
    equipmentRes,
    suppliersRes,
    customersRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, full_name, first_name, last_name, email, phone")
      .in("user_id", clientIds),
    supabase
      .from("service_addresses")
      .select("account_id, civic_number, apartment, street, city, province, postal_code")
      .in("account_id", accountIds),
    supabase
      .from("equipment_inventory")
      .select("account_id, equipment_type, serial_number, model, status")
      .in("account_id", accountIds),
    supabase
      .from("supplier_accounts")
      .select("client_id, service_name, account_email, monthly_price, status, notes")
      .in("client_id", clientIds),
    supabase
      .from("billing_customers")
      .select("id, user_id")
      .in("user_id", clientIds),
  ]);

  const customerIds = (customersRes.data || []).map((c: any) => c.id);
  const customerToUser = new Map(
    (customersRes.data || []).map((c: any) => [c.id, c.user_id])
  );

  const [subsRes, paymentsRes, invoicesRes] = await Promise.all([
    supabase
      .from("billing_subscriptions")
      .select("customer_id, plan_name, monthly_amount, status, next_renewal_at")
      .in("customer_id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("billing_payments")
      .select("customer_id, amount, paid_at, payment_method, status")
      .in("customer_id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("billing_invoices")
      .select("customer_id, invoice_number, total_amount, balance_due, status, due_date")
      .in("customer_id", customerIds.length ? customerIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  // Index by user/account
  const byUserId = <T extends { user_id?: string }>(arr: T[] | null) => {
    const m = new Map<string, T[]>();
    (arr || []).forEach((r) => {
      const k = (r as any).user_id;
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  };
  const byAccountId = <T extends { account_id?: string }>(arr: T[] | null) => {
    const m = new Map<string, T[]>();
    (arr || []).forEach((r) => {
      const k = (r as any).account_id;
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  };
  const byClientId = <T extends { client_id?: string }>(arr: T[] | null) => {
    const m = new Map<string, T[]>();
    (arr || []).forEach((r) => {
      const k = (r as any).client_id;
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    });
    return m;
  };
  const byCustomerToUser = <T extends { customer_id?: string }>(arr: T[] | null) => {
    const m = new Map<string, T[]>();
    (arr || []).forEach((r) => {
      const uid = customerToUser.get((r as any).customer_id);
      if (!uid) return;
      if (!m.has(uid)) m.set(uid, []);
      m.get(uid)!.push(r);
    });
    return m;
  };

  const profilesByUser = byUserId(profilesRes.data as any);
  const addressesByAccount = byAccountId(addressesRes.data as any);
  const equipmentByAccount = byAccountId(equipmentRes.data as any);
  const suppliersByClient = byClientId(suppliersRes.data as any);
  const subsByUser = byCustomerToUser(subsRes.data as any);
  const paymentsByUser = byCustomerToUser(paymentsRes.data as any);
  const invoicesByUser = byCustomerToUser(invoicesRes.data as any);

  const clients = accounts;

  // Build CSV content
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
    "Date activation",
    "Équipements",
    "Numéros de série",
    "Fournisseur service",
    "Fournisseur email",
    "Fournisseur prix",
    "Fournisseur statut",
    "Fournisseur notes",
    "Derniers paiements (3)",
    "Factures impayées",
    "Statut compte",
  ];

  const rows = clients.map((c: any) => {
    const profile = (profilesByUser.get(c.client_id) || [])[0];
    const subs = subsByUser.get(c.client_id) || [];
    const sub = subs.find((s: any) => s.status === "active") || subs[0];
    const addr = (addressesByAccount.get(c.id) || [])[0];
    const supplier = (suppliersByClient.get(c.client_id) || [])[0];
    const equipment = equipmentByAccount.get(c.id) || [];
    const payments = paymentsByUser.get(c.client_id) || [];
    const invoices = invoicesByUser.get(c.client_id) || [];

    const fullAddress = addr
      ? [addr.civic_number, addr.apartment || "", addr.street, addr.city, addr.province, addr.postal_code]
          .filter(Boolean)
          .join(" ")
      : "";

    const equipements = equipment
      .filter((e: any) => e.status === "assigned")
      .map((e: any) => e.equipment_type + (e.model ? " " + e.model : ""))
      .join(" | ");

    const serials = equipment
      .filter((e: any) => e.status === "assigned")
      .map((e: any) => e.serial_number || "N/A")
      .join(" | ");

    const paiements = payments
      .sort((a: any, b: any) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
      .slice(0, 3)
      .map(
        (p: any) =>
          (p.paid_at ? new Date(p.paid_at).toLocaleDateString("fr-CA") : "N/A") +
          " | " + p.amount + "$ | " + (p.payment_method || "") + " | " + p.status
      )
      .join(" || ");

    const facturesImpayees = invoices
      .filter((bi: any) => bi.status !== "paid" && Number(bi.balance_due) > 0)
      .map(
        (bi: any) =>
          bi.invoice_number + " | " + bi.balance_due + "$ | " +
          (bi.due_date ? new Date(bi.due_date).toLocaleDateString("fr-CA") : "N/A")
      )
      .join(" || ") || "Aucune";

    return [
      c.account_number || "",
      profile?.full_name || ((profile?.first_name || "") + " " + (profile?.last_name || "")).trim() || "",
      profile?.email || "",
      profile?.phone || "",
      fullAddress,
      sub?.plan_name || "",
      sub?.monthly_amount ? sub.monthly_amount + "$" : "",
      sub?.status || "",
      sub?.next_renewal_at ? new Date(sub.next_renewal_at).toLocaleDateString("fr-CA") : "",
      c.created_at ? new Date(c.created_at).toLocaleDateString("fr-CA") : "",
      equipements,
      serials,
      supplier?.service_name || "",
      supplier?.account_email || "",
      supplier?.monthly_price ? supplier.monthly_price + "$" : "",
      supplier?.status || "",
      supplier?.notes || "",
      paiements,
      facturesImpayees,
      c.status || "",
    ].map((v) => '"' + String(v).replace(/"/g, '""') + '"');
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
      to: ["nivratelecom@gmail.com"],
      subject: `📊 Rapport hebdomadaire clients Nivra — ${today} (${clients.length} clients actifs)`,
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
  <div style="background: #0066CC; padding: 32px 24px; color: #ffffff;">
    <h1 style="margin: 0; font-size: 24px;">📊 Rapport Hebdomadaire</h1>
    <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Nivra Telecom — ${today}</p>
  </div>
  <div style="padding: 32px 24px; color: #111111;">
    <h2 style="margin: 0 0 16px; font-size: 18px;">Résumé de la semaine</h2>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">
      <strong>${clients.length} clients actifs</strong> dans le rapport ci-joint.
    </p>
    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #444;">
      Le fichier CSV contient toutes les informations : coordonnées, forfaits,
      équipements, paiements, factures et fournisseurs.
    </p>
  </div>
  <div style="padding: 16px 24px; background: #F7F7F7; color: #666; font-size: 12px; text-align: center;">
    Nivra Communications Inc. — support@nivra-telecom.ca
  </div>
</div>
      `,
      attachments: [
        {
          filename: filename,
          content: base64CSV,
          content_type: "text/csv",
        },
      ],
    }),
  });

  const emailResult = await emailRes.json();

  await supabase.from("agent_audit_log").insert({
    agent_name: "checkup",
    action: "weekly_report",
    result: "success",
    details: {
      clients_count: clients.length,
      filename: filename,
      email_id: emailResult.id,
      date: today,
    },
  });

  await supabase.from("agent_events").insert({
    agent_name: "checkup",
    event_type: "success",
    message: `Rapport hebdomadaire envoyé — ${clients.length} clients actifs`,
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
      clients_count: clients.length,
      filename: filename,
      email_sent: emailResult.id ? true : false,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
