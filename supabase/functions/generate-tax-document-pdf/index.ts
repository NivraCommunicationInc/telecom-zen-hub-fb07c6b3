import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NIVRA = {
  legalName: "NIVRA COMMUNICATIONS INC.",
  tradeName: "Nivra Telecom",
  neq: "2291249786",
  tpsLabel: "TPS : 732287291 RT0001",
  tvqLabel: "TVQ : 1229249786 TQ0001",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
};

function buildTaxDocPDF(d: {
  docType: string;
  taxYear: number;
  employeeName: string;
  employeeEmail: string;
  totalEarnings: number;
  totalCommissions: number;
  totalDeductions: number;
  netPay: number;
  hoursWorked: number;
  generatedAt: string;
  docId: string;
}): Uint8Array {
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

  const typeLabel = d.docType === "t4" ? "FEUILLET T4 — ÉTAT DE LA RÉMUNÉRATION PAYÉE"
    : d.docType === "rl1" || d.docType === "releve1" ? "RELEVÉ 1 — REVENUS D'EMPLOI ET REVENUS DIVERS"
    : `DOCUMENT FISCAL — ${d.docType.toUpperCase()}`;

  const lines: string[] = [];
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(`                    ${NIVRA.legalName}`);
  lines.push(`                         ${NIVRA.tradeName}`);
  lines.push(`                    ${NIVRA.address}`);
  lines.push(`              NEQ: ${NIVRA.neq}`);
  lines.push(`              ${NIVRA.tpsLabel}  |  ${NIVRA.tvqLabel}`);
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`                    ${typeLabel}`);
  lines.push(`                    Année fiscale: ${d.taxYear}`);
  lines.push(`                    Réf: ${d.docId}`);
  lines.push("");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("  IDENTIFICATION DE L'EMPLOYÉ");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push(`  Nom:              ${d.employeeName}`);
  lines.push(`  Courriel:         ${d.employeeEmail}`);
  lines.push("");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("  SOMMAIRE DES REVENUS");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push(`  Revenus bruts totaux        ${fmt(d.totalEarnings)}`);
  lines.push(`  Commissions totales         ${fmt(d.totalCommissions)}`);
  lines.push(`  Heures travaillées          ${d.hoursWorked.toFixed(1)} h`);
  lines.push("");
  lines.push("───────────────────────────────────────────────────────────────");
  lines.push("  RETENUES ET DÉDUCTIONS");
  lines.push("───────────────────────────────────────────────────────────────");

  if (d.docType === "t4") {
    const cpp = Math.min(d.totalEarnings * 0.0595, 3867.50);
    const ei = Math.min(d.totalEarnings * 0.0163, 1049.12);
    const fedTax = d.totalEarnings * 0.15;
    lines.push(`  RPC/RRQ cotisations         ${fmt(cpp)}`);
    lines.push(`  AE cotisations              ${fmt(ei)}`);
    lines.push(`  Impôt fédéral retenu        ${fmt(fedTax)}`);
    lines.push(`  Total retenues fédérales    ${fmt(cpp + ei + fedTax)}`);
  } else {
    const qpp = Math.min(d.totalEarnings * 0.064, 4160);
    const qpip = Math.min(d.totalEarnings * 0.00494, 449.54);
    const provTax = d.totalEarnings * 0.15;
    lines.push(`  RRQ cotisations             ${fmt(qpp)}`);
    lines.push(`  RQAP cotisations            ${fmt(qpip)}`);
    lines.push(`  Impôt provincial retenu     ${fmt(provTax)}`);
    lines.push(`  Total retenues provinciales ${fmt(qpp + qpip + provTax)}`);
  }

  lines.push("");
  lines.push(`  Total déductions reportées  ${fmt(d.totalDeductions)}`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(`  REVENU NET                  ${fmt(d.netPay)}`);
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`  Document généré le: ${d.generatedAt}`);
  lines.push("");
  lines.push("  Ce document est un sommaire à des fins de référence.");
  lines.push("  Le feuillet officiel émis par l'ARC/Revenu Québec fait foi.");
  lines.push("  Conservez ce document pour vos dossiers personnels.");

  const content = lines.join("\n");
  const pageHeight = 800;
  const lineHeight = 12;
  const marginLeft = 40;
  let startY = pageHeight - 40;

  let textOps = `BT\n/F1 9 Tf\n`;
  for (const line of lines) {
    const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    textOps += `1 0 0 1 ${marginLeft} ${startY} Tm\n(${escaped}) Tj\n`;
    startY -= lineHeight;
    if (startY < 40) startY = pageHeight - 40;
  }
  textOps += "ET";

  const streamBytes = new TextEncoder().encode(textOps);
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 ${pageHeight}]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${streamBytes.length}>>stream
${textOps}
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Courier>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000230 00000 n 
0000000${(280 + streamBytes.length).toString().padStart(4, "0")} 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref 0
%%EOF`;

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { tax_document_id } = await req.json();
    if (!tax_document_id) return new Response(JSON.stringify({ error: "tax_document_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch tax document
    const { data: doc, error: docErr } = await supabase.from("tax_documents").select("*").eq("id", tax_document_id).single();
    if (docErr || !doc) return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch employee
    const { data: profile } = await supabase.from("profiles").select("first_name, last_name, email").eq("id", doc.user_id).single();

    // Aggregate payroll data for tax year
    const { data: payrollData } = await supabase.from("payroll_entries").select("gross_pay, commission_total, bonus_total, deductions_total, net_pay, hours_worked").eq("user_id", doc.user_id);

    const totals = (payrollData || []).reduce((acc, pe) => ({
      earnings: acc.earnings + Number(pe.gross_pay || 0),
      commissions: acc.commissions + Number(pe.commission_total || 0),
      deductions: acc.deductions + Number(pe.deductions_total || 0),
      net: acc.net + Number(pe.net_pay || 0),
      hours: acc.hours + Number(pe.hours_worked || 0),
    }), { earnings: 0, commissions: 0, deductions: 0, net: 0, hours: 0 });

    const generatedAt = new Date().toISOString().split("T")[0];
    const docRef = `${doc.document_type.toUpperCase()}-${doc.tax_year}-${tax_document_id.substring(0, 8).toUpperCase()}`;

    const pdfBytes = buildTaxDocPDF({
      docType: doc.document_type,
      taxYear: doc.tax_year,
      employeeName: profile ? `${profile.first_name} ${profile.last_name}` : "Employé",
      employeeEmail: profile?.email || "",
      totalEarnings: totals.earnings,
      totalCommissions: totals.commissions,
      totalDeductions: totals.deductions,
      netPay: totals.net,
      hoursWorked: totals.hours,
      generatedAt,
      docId: docRef,
    });

    const storagePath = `${doc.user_id}/${docRef}.pdf`;
    const { error: uploadErr } = await supabase.storage.from("payslips").upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (uploadErr) return new Response(JSON.stringify({ error: "Upload failed", details: uploadErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: signed } = await supabase.storage.from("payslips").createSignedUrl(storagePath, 604800);

    await supabase.from("tax_documents").update({ pdf_url: storagePath, status: "generated", generated_at: new Date().toISOString() }).eq("id", tax_document_id);

    return new Response(JSON.stringify({ success: true, doc_ref: docRef, pdf_url: signed?.signedUrl || storagePath, storage_path: storagePath }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Tax doc PDF error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
