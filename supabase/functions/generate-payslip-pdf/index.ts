import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  division: "Service à la clientèle — Division facturation",
};

/* ── tiny PDF builder (no jsPDF needed) ── */
function buildPayslipPDF(d: {
  payrollNumber: string;
  employeeName: string;
  employeeEmail: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  hoursWorked: number;
  overtimeHours: number;
  baseSalary: number;
  commissionTotal: number;
  bonusTotal: number;
  grossPay: number;
  deductionsTotal: number;
  netPay: number;
  adjustments: { label: string; amount: number; type: string }[];
  generatedAt: string;
}): Uint8Array {
  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
  const dateFR = (s: string) => {
    try { return new Date(s).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return s; }
  };

  // Build a clean text-based PDF manually (PDF 1.4 spec)
  const lines: string[] = [];
  const addLine = (text: string) => lines.push(text);

  addLine("═══════════════════════════════════════════════════════════════");
  addLine(`                    ${NIVRA.legalName}`);
  addLine(`                         ${NIVRA.tradeName}`);
  addLine(`                    ${NIVRA.address}`);
  addLine(`              ${NIVRA.email}  |  ${NIVRA.website}`);
  addLine(`              ${NIVRA.tpsLabel}  |  ${NIVRA.tvqLabel}`);
  addLine("═══════════════════════════════════════════════════════════════");
  addLine("");
  addLine(`                    FICHE DE PAIE / PAYSLIP`);
  addLine(`                    Référence: ${d.payrollNumber}`);
  addLine("");
  addLine("───────────────────────────────────────────────────────────────");
  addLine(`  Employé:        ${d.employeeName}`);
  addLine(`  Courriel:       ${d.employeeEmail}`);
  addLine(`  Période:        ${dateFR(d.periodStart)} au ${dateFR(d.periodEnd)}`);
  addLine(`  Statut:         ${d.status.toUpperCase()}`);
  addLine(`  Généré le:      ${dateFR(d.generatedAt)}`);
  addLine("───────────────────────────────────────────────────────────────");
  addLine("");
  addLine("  DÉTAIL DES REVENUS");
  addLine("  ─────────────────────────────────────────────────");
  addLine(`  Heures travaillées          ${d.hoursWorked.toFixed(1)} h`);
  if (d.overtimeHours > 0)
    addLine(`  Heures supplémentaires      ${d.overtimeHours.toFixed(1)} h`);
  addLine(`  Salaire de base             ${fmt(d.baseSalary)}`);
  addLine(`  Commissions                 ${fmt(d.commissionTotal)}`);
  addLine(`  Bonus                       ${fmt(d.bonusTotal)}`);
  addLine("  ─────────────────────────────────────────────────");
  addLine(`  REVENU BRUT                 ${fmt(d.grossPay)}`);
  addLine("");

  if (d.adjustments.length > 0) {
    addLine("  AJUSTEMENTS / RETENUES");
    addLine("  ─────────────────────────────────────────────────");
    for (const adj of d.adjustments) {
      const sign = adj.type === "deduction" ? "-" : "+";
      addLine(`  ${adj.label.padEnd(30)} ${sign} ${fmt(Math.abs(adj.amount))}`);
    }
    addLine("  ─────────────────────────────────────────────────");
    addLine(`  Total retenues              - ${fmt(d.deductionsTotal)}`);
    addLine("");
  }

  addLine("═══════════════════════════════════════════════════════════════");
  addLine(`  MONTANT NET PAYÉ            ${fmt(d.netPay)}`);
  addLine("═══════════════════════════════════════════════════════════════");
  addLine("");
  addLine(`  ${NIVRA.division}`);
  addLine(`  NEQ: ${NIVRA.neq}`);
  addLine("");
  addLine("  Ce document est généré électroniquement et ne nécessite");
  addLine("  pas de signature. Conservez-le pour vos dossiers.");

  const content = lines.join("\n");

  // Build a minimal valid PDF with the text content
  const textStream = unescape(encodeURIComponent(content));
  const pageHeight = 800;
  const fontSize = 9;
  const lineHeight = 12;
  const marginLeft = 40;
  let startY = pageHeight - 40;

  // Build text operators
  let textOps = `BT\n/F1 ${fontSize} Tf\n`;
  for (const line of lines) {
    const escaped = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    textOps += `1 0 0 1 ${marginLeft} ${startY} Tm\n(${escaped}) Tj\n`;
    startY -= lineHeight;
    if (startY < 40) {
      startY = pageHeight - 40;
    }
  }
  textOps += "ET";

  const streamBytes = new TextEncoder().encode(textOps);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${streamBytes.length} >>
stream
${textOps}
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(317 + streamBytes.length).toString().padStart(4, "0")} 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

  return new TextEncoder().encode(pdf);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payroll_entry_id } = await req.json();
    if (!payroll_entry_id) {
      return new Response(JSON.stringify({ error: "payroll_entry_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payroll entry + pay period
    const { data: entry, error: entryErr } = await supabase
      .from("payroll_entries")
      .select("*, pay_periods(*)")
      .eq("id", payroll_entry_id)
      .single();

    if (entryErr || !entry) {
      return new Response(JSON.stringify({ error: "Payroll entry not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", entry.user_id)
      .single();

    // Fetch adjustments
    const { data: adjustments } = await supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("payroll_entry_id", payroll_entry_id);

    const period = entry.pay_periods;
    const generatedAt = new Date().toISOString();
    const payrollNumber = `PAY-${period?.label?.replace(/\s/g, "") || "X"}-${payroll_entry_id.substring(0, 8).toUpperCase()}`;

    // Generate PDF
    const pdfBytes = buildPayslipPDF({
      payrollNumber,
      employeeName: profile ? `${profile.first_name} ${profile.last_name}` : "Employé",
      employeeEmail: profile?.email || "",
      periodLabel: period?.label || "",
      periodStart: period?.start_date || "",
      periodEnd: period?.end_date || "",
      status: entry.status,
      hoursWorked: entry.hours_worked || 0,
      overtimeHours: entry.overtime_hours || 0,
      baseSalary: entry.base_salary || 0,
      commissionTotal: entry.commission_total || 0,
      bonusTotal: entry.bonus_total || 0,
      grossPay: entry.gross_pay || 0,
      deductionsTotal: entry.deductions_total || 0,
      netPay: entry.net_pay || 0,
      adjustments: (adjustments || []).map((a: any) => ({
        label: a.label || a.adjustment_type || "Ajustement",
        amount: a.amount || 0,
        type: a.adjustment_type === "deduction" ? "deduction" : "bonus",
      })),
      generatedAt,
    });

    // Upload to storage
    const storagePath = `${entry.user_id}/${payrollNumber}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("payslips")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload PDF", details: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL (7 days)
    const { data: signed } = await supabase.storage
      .from("payslips")
      .createSignedUrl(storagePath, 604800);

    // Update payroll entry with PDF URL and payroll number
    await supabase.from("payroll_entries").update({
      pdf_url: storagePath,
      payroll_number: payrollNumber,
    }).eq("id", payroll_entry_id);

    return new Response(JSON.stringify({
      success: true,
      payroll_number: payrollNumber,
      pdf_url: signed?.signedUrl || storagePath,
      storage_path: storagePath,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Payslip generation error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
