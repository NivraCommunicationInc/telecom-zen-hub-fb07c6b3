/**
 * generate-payslip-pdf — Professional enterprise payslip PDF generator
 * Uses jsPDF with Helvetica for proper accents and professional layout.
 * Matches the canonical Nivra document style (blue header, structured sections).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import jsPDFModule from "npm:jspdf@2.5.2";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NIVRA = {
  legalName: "NIVRA COMMUNICATIONS INC.",
  tradeName: "Nivra Telecom",
  neq: "2291249786",
  tps: "732287291 RT0001",
  tvq: "1229249786 TQ0001",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  division: "Division des ressources humaines",
};

const BLUE: [number, number, number] = [0, 102, 204];
const NAVY: [number, number, number] = [15, 23, 42];
const TEAL: [number, number, number] = [20, 184, 166];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const WHITE: [number, number, number] = [255, 255, 255];
const SUCCESS: [number, number, number] = [22, 163, 74];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n || 0);

const fmtDateFR = (s: string): string => {
  if (!s) return "\u2014";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch { return s; }
};

const STATUS_LABELS: Record<string, string> = {
  draft: "BROUILLON", approved: "APPROUV\u00c9", paid: "PAY\u00c9", processing: "EN TRAITEMENT",
};

function buildPayslipPDF(d: {
  payrollNumber: string;
  employeeName: string;
  employeeEmail: string;
  employeePhone?: string;
  jobTitle?: string;
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
}): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth(); // 210
  const ph = doc.internal.pageSize.getHeight(); // 297
  const ml = 15; // margin left
  const mr = pw - 15; // margin right
  let y = 0;

  // ═══════════════════════════════════════════════════════════════
  // HEADER — Blue gradient bar
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 42, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 38, pw, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text("NIVRA TELECOM", ml, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("FICHE DE PAIE", ml, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(d.payrollNumber, mr, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`G\u00e9n\u00e9r\u00e9 le ${fmtDateFR(d.generatedAt)}`, mr, 26, { align: "right" });

  // Status badge
  const statusText = STATUS_LABELS[d.status] || d.status.toUpperCase();
  const statusColor = d.status === "paid" ? SUCCESS : d.status === "approved" ? BLUE : MUTED;
  doc.setFillColor(...statusColor);
  const stw = doc.getTextWidth(statusText) + 8;
  doc.roundedRect(mr - stw - 2, 29, stw + 4, 7, 1.5, 1.5, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(statusText, mr - stw / 2, 34, { align: "center" });

  y = 52;

  // ═══════════════════════════════════════════════════════════════
  // EMPLOYEE INFO BLOCK
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ml, y, pw - 30, 28, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(ml, y, pw - 30, 28, 2, 2, "S");

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("EMPLOY\u00c9", ml + 5, y);
  doc.text("P\u00c9RIODE", 120, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(d.employeeName, ml + 5, y);
  doc.text(d.periodLabel || `${fmtDateFR(d.periodStart)} au ${fmtDateFR(d.periodEnd)}`, 120, y);

  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(d.employeeEmail, ml + 5, y);
  doc.text(`Du ${fmtDateFR(d.periodStart)} au ${fmtDateFR(d.periodEnd)}`, 120, y);

  if (d.jobTitle) {
    y += 5;
    doc.text(d.jobTitle, ml + 5, y);
  }

  y = 88;

  // ═══════════════════════════════════════════════════════════════
  // REVENUE TABLE
  // ═══════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("D\u00c9TAIL DES REVENUS", ml, y);
  y += 3;

  // Table header
  doc.setFillColor(...NAVY);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("Description", ml + 4, y + 5.5);
  doc.text("Quantit\u00e9", 120, y + 5.5);
  doc.text("Montant", mr - 4, y + 5.5, { align: "right" });
  y += 8;

  // Revenue rows
  const revenueLines: { label: string; qty: string; amount: number }[] = [];
  if (d.hoursWorked > 0) revenueLines.push({ label: "Heures travaill\u00e9es", qty: `${d.hoursWorked.toFixed(1)} h`, amount: d.baseSalary });
  if (d.overtimeHours > 0) revenueLines.push({ label: "Heures suppl\u00e9mentaires", qty: `${d.overtimeHours.toFixed(1)} h`, amount: 0 });
  if (d.commissionTotal > 0) revenueLines.push({ label: "Commissions sur ventes", qty: "\u2014", amount: d.commissionTotal });
  if (d.bonusTotal > 0) revenueLines.push({ label: "Bonus de performance", qty: "\u2014", amount: d.bonusTotal });
  if (d.baseSalary > 0 && d.hoursWorked === 0) revenueLines.push({ label: "Salaire de base", qty: "\u2014", amount: d.baseSalary });

  if (revenueLines.length === 0) {
    revenueLines.push({ label: "Revenu total", qty: "\u2014", amount: d.grossPay });
  }

  revenueLines.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(ml, y, pw - 30, 7, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXT);
    doc.text(line.label, ml + 4, y + 5);
    doc.text(line.qty, 120, y + 5);
    doc.setFont("helvetica", "bold");
    doc.text(line.amount > 0 ? fmt(line.amount) : "\u2014", mr - 4, y + 5, { align: "right" });
    y += 7;
  });

  // Gross pay row
  doc.setFillColor(...NAVY);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("REVENU BRUT", ml + 4, y + 5.5);
  doc.text(fmt(d.grossPay), mr - 4, y + 5.5, { align: "right" });
  y += 14;

  // ═══════════════════════════════════════════════════════════════
  // ADJUSTMENTS / DEDUCTIONS TABLE
  // ═══════════════════════════════════════════════════════════════
  if (d.adjustments.length > 0 || d.deductionsTotal > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text("RETENUES ET AJUSTEMENTS", ml, y);
    y += 3;

    doc.setFillColor(239, 68, 68);
    doc.rect(ml, y, pw - 30, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text("Description", ml + 4, y + 5.5);
    doc.text("Type", 120, y + 5.5);
    doc.text("Montant", mr - 4, y + 5.5, { align: "right" });
    y += 8;

    const ADJ_TYPE_LABELS: Record<string, string> = {
      deduction: "Retenue", bonus: "Bonus", correction: "Correction",
      clawback: "R\u00e9cup\u00e9ration", tax_withholding: "Imp\u00f4t", other: "Autre",
    };

    if (d.adjustments.length > 0) {
      d.adjustments.forEach((adj, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(254, 242, 242);
          doc.rect(ml, y, pw - 30, 7, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...TEXT);
        doc.text(adj.label, ml + 4, y + 5);
        doc.text(ADJ_TYPE_LABELS[adj.type] || adj.type, 120, y + 5);
        const sign = adj.type === "bonus" || adj.type === "correction" ? "+" : "-";
        doc.setFont("helvetica", "bold");
        doc.setTextColor(adj.type === "bonus" ? 22 : 239, adj.type === "bonus" ? 163 : 68, adj.type === "bonus" ? 74 : 68);
        doc.text(`${sign} ${fmt(Math.abs(adj.amount))}`, mr - 4, y + 5, { align: "right" });
        y += 7;
      });
    } else {
      // Show estimated deductions
      doc.setFillColor(254, 242, 242);
      doc.rect(ml, y, pw - 30, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT);
      doc.text("Retenues estim\u00e9es (imp\u00f4ts et cotisations)", ml + 4, y + 5);
      doc.text("Retenue", 120, y + 5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(239, 68, 68);
      doc.text(`- ${fmt(d.deductionsTotal)}`, mr - 4, y + 5, { align: "right" });
      y += 7;
    }

    // Total deductions
    doc.setFillColor(239, 68, 68);
    doc.rect(ml, y, pw - 30, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text("TOTAL RETENUES", ml + 4, y + 5.5);
    doc.text(`- ${fmt(d.deductionsTotal)}`, mr - 4, y + 5.5, { align: "right" });
    y += 14;
  }

  // ═══════════════════════════════════════════════════════════════
  // NET PAY — Big highlight box
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...SUCCESS);
  doc.roundedRect(ml, y, pw - 30, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text("MONTANT NET", ml + 6, y + 10.5);
  doc.setFontSize(16);
  doc.text(fmt(d.netPay), mr - 6, y + 11, { align: "right" });
  y += 24;

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY BOX
  // ═══════════════════════════════════════════════════════════════
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ml, y, pw - 30, 20, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(ml, y, pw - 30, 20, 2, 2, "S");

  const cols = [
    { label: "Brut", value: fmt(d.grossPay) },
    { label: "Retenues", value: `- ${fmt(d.deductionsTotal)}` },
    { label: "Net", value: fmt(d.netPay) },
    { label: "Heures", value: `${d.hoursWorked.toFixed(1)} h` },
  ];
  const colW = (pw - 30) / cols.length;
  cols.forEach((col, i) => {
    const cx = ml + colW * i + colW / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(col.label, cx, y + 7, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(col.value, cx, y + 14, { align: "center" });
  });

  y += 28;

  // ═══════════════════════════════════════════════════════════════
  // LEGAL NOTICE
  // ═══════════════════════════════════════════════════════════════
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Ce document est g\u00e9n\u00e9r\u00e9 \u00e9lectroniquement et ne n\u00e9cessite pas de signature.", ml, y);
  doc.text("Conservez ce document pour vos dossiers personnels et fiscaux.", ml, y + 4);

  // ═══════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════
  doc.setDrawColor(...BORDER);
  doc.line(ml, ph - 25, mr, ph - 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`${NIVRA.legalName} | ${NIVRA.address}`, pw / 2, ph - 20, { align: "center" });
  doc.text(`${NIVRA.email} | ${NIVRA.website} | NEQ: ${NIVRA.neq}`, pw / 2, ph - 16, { align: "center" });
  doc.text(`TPS: ${NIVRA.tps} | TVQ: ${NIVRA.tvq}`, pw / 2, ph - 12, { align: "center" });
  doc.text(NIVRA.division, pw / 2, ph - 8, { align: "center" });

  return doc.output("arraybuffer");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
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

    // IDOR guard: caller must own this payroll entry or be admin/hr
    const entryUserId = entry.user_id || entry.employee_id;
    if (entryUserId !== user.id) {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("status", "active").maybeSingle();
      const adminHrRoles = ["admin", "super_admin", "owner", "hr"];
      if (!roleRow || !adminHrRoles.includes(roleRow.role)) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, job_title")
      .eq("user_id", entry.user_id)
      .single();

    // Fetch adjustments
    const { data: adjustments } = await supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("payroll_entry_id", payroll_entry_id);

    const period = entry.pay_periods;
    const generatedAt = new Date().toISOString();
    const payrollNumber = entry.payroll_number || `PAY-${(period?.period_name || "X").replace(/\s+/g, "-").substring(0, 20)}-${payroll_entry_id.substring(0, 8).toUpperCase()}`;

    const pdfBuffer = buildPayslipPDF({
      payrollNumber,
      employeeName: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Employ\u00e9",
      employeeEmail: profile?.email || "",
      employeePhone: profile?.phone || undefined,
      jobTitle: profile?.job_title || undefined,
      periodLabel: period?.period_name || "",
      periodStart: period?.start_date || "",
      periodEnd: period?.end_date || "",
      status: entry.status,
      hoursWorked: Number(entry.hours_worked) || 0,
      overtimeHours: Number(entry.overtime_hours) || 0,
      baseSalary: Number(entry.base_salary) || 0,
      commissionTotal: Number(entry.commission_total) || 0,
      bonusTotal: Number(entry.bonus_total) || 0,
      grossPay: Number(entry.gross_pay) || 0,
      deductionsTotal: Number(entry.deductions_total) || 0,
      netPay: Number(entry.net_pay) || 0,
      adjustments: (adjustments || []).map((a: any) => ({
        label: a.label || a.adjustment_type || "Ajustement",
        amount: Number(a.amount) || 0,
        type: a.adjustment_type || "other",
      })),
      generatedAt,
    });

    // Upload to storage
    const storagePath = `${entry.user_id}/${payrollNumber}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("payslips")
      .upload(storagePath, new Uint8Array(pdfBuffer), {
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

    // Update payroll entry
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
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
