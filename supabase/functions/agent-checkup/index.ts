import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get ALL active clients with complete information
  const { data: clients, error: clientsError } = await supabase
    .from("accounts")
    .select(`
      id,
      account_number,
      status,
      activated_at,
      client_id,
      profiles!inner(
        full_name,
        first_name,
        last_name,
        email,
        phone
      ),
      billing_subscriptions!left(
        plan_name,
        monthly_amount,
        status,
        next_renewal_at
      ),
      service_addresses!left(
        civic_number,
        apartment,
        street,
        city,
        province,
        postal_code
      ),
      equipment_inventory!left(
        equipment_type,
        serial_number,
        model,
        status
      ),
      supplier_accounts!left(
        name,
        contact_name,
        phone,
        email,
        account_number,
        notes
      ),
      billing_payments!left(
        amount,
        paid_at,
        payment_method,
        status
      ),
      billing_invoices!left(
        invoice_number,
        total_amount,
        balance_due,
        status,
        due_date
      )
    `)
    .eq("status", "active");

  console.log("Clients query error:", clientsError);
  console.log("Clients found:", clients?.length, JSON.stringify(clients?.slice(0, 1)));
  console.log("Total active clients:", clients?.length || 0);

  if (!clients || clients.length === 0) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "checkup",
      action: "weekly_report",
      result: "no_clients",
      details: { message: "No active clients found", error: clientsError?.message },
    });
    return new Response(
      JSON.stringify({ ok: true, sent: 0, error: clientsError?.message }),
      { headers: { "Content-Type": "application/json" } }
    );
  }


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
    "Promotions actives",
    "Rabais actifs",
    "Équipements",
    "Numéros de série",
    "Fournisseur nom",
    "Fournisseur contact",
    "Fournisseur téléphone",
    "Fournisseur email",
    "Fournisseur compte",
    "Fournisseur notes",
    "Derniers paiements (3)",
    "Factures impayées",
    "Statut compte",
  ];

  const rows = clients.map((c: any) => {
    const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const sub =
      c.billing_subscriptions?.find((s: any) => s.status === "active") ||
      c.billing_subscriptions?.[0];
    const addr = c.service_addresses?.[0];
    const supplier = c.supplier_accounts?.[0];

    const fullAddress = addr
      ? [
          addr.civic_number,
          addr.apartment || "",
          addr.street,
          addr.city,
          addr.province,
          addr.postal_code,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

    const equipements =
      c.equipment_inventory
        ?.filter((e: any) => e.status === "assigned")
        ?.map((e: any) => e.equipment_type + (e.model ? " " + e.model : ""))
        ?.join(" | ") || "";

    const serials =
      c.equipment_inventory
        ?.filter((e: any) => e.status === "assigned")
        ?.map((e: any) => e.serial_number || "N/A")
        ?.join(" | ") || "";

    const promotions =
      c.account_promotions
        ?.map((ap: any) => ap.promotions?.name || "")
        ?.filter(Boolean)
        ?.join(" | ") || "";

    const rabais =
      c.account_adjustments
        ?.filter((adj: any) => adj.status === "active")
        ?.map((adj: any) => adj.description + " (" + adj.amount + "$)")
        ?.join(" | ") || "";

    const paiements =
      c.billing_payments
        ?.sort(
          (a: any, b: any) =>
            new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
        )
        ?.slice(0, 3)
        ?.map(
          (p: any) =>
            new Date(p.paid_at).toLocaleDateString("fr-CA") +
            " | " +
            p.amount +
            "$ | " +
            p.payment_method +
            " | " +
            p.status
        )
        ?.join(" || ") || "";

    const facturesImpayees =
      c.billing_invoices
        ?.filter((bi: any) => bi.status !== "paid" && bi.balance_due > 0)
        ?.map(
          (bi: any) =>
            bi.invoice_number +
            " | " +
            bi.balance_due +
            "$ | " +
            (bi.due_date
              ? new Date(bi.due_date).toLocaleDateString("fr-CA")
              : "N/A")
        )
        ?.join(" || ") || "Aucune";

    return [
      c.account_number || "",
      profile?.full_name ||
        (profile?.first_name + " " + profile?.last_name) ||
        "",
      profile?.email || "",
      profile?.phone || "",
      fullAddress,
      sub?.plan_name || "",
      sub?.monthly_amount ? sub.monthly_amount + "$" : "",
      sub?.status || "",
      sub?.next_renewal_at
        ? new Date(sub.next_renewal_at).toLocaleDateString("fr-CA")
        : "",
      c.activated_at
        ? new Date(c.activated_at).toLocaleDateString("fr-CA")
        : "",
      promotions,
      rabais,
      equipements,
      serials,
      supplier?.name || "",
      supplier?.contact_name || "",
      supplier?.phone || "",
      supplier?.email || "",
      supplier?.account_number || "",
      supplier?.notes || "",
      paiements,
      facturesImpayees,
      c.status || "",
    ].map((v) => '"' + String(v).replace(/"/g, '""') + '"');
  });

  // Build CSV string
  const csvContent = [
    headers.map((h) => '"' + h + '"').join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  // Add BOM for Excel UTF-8
  const csvWithBOM = "\uFEFF" + csvContent;

  // Convert to base64
  const base64CSV = btoa(unescape(encodeURIComponent(csvWithBOM)));

  const today = new Date().toLocaleDateString("fr-CA");
  const filename = `rapport-clients-nivra-${today}.csv`;

  // Send email with attachment via Resend
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

  // Log in agent_audit_log
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

  // Update agent_registry last_run
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
