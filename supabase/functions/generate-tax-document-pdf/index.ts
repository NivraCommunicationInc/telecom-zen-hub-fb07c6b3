/**
 * generate-tax-document-pdf — Sommaire fiscal interne Nivra
 * Génère un SOMMAIRE EMPLOYEUR (pas un T4/RL-1 officiel).
 * Uses jsPDF with Helvetica for proper accents and professional layout.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import jsPDFModule from "npm:jspdf@2";
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
  address: "1799 Av. Pierre-P\u00e9ladeau, Laval, QC H7T 2Y5",
};

const NAVY: [number, number, number] = [15, 23, 42];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const WHITE: [number, number, number] = [255, 255, 255];
const TEAL: [number, number, number] = [20, 184, 166];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n || 0);

interface TaxData {
  docType: string;
  taxYear: number;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  totalEarnings: number;
  totalCommissions: number;
  totalDeductions: number;
  netPay: number;
  hoursWorked: number;
  generatedAt: string;
  docRef: string;
}

function drawRow(doc: any, y: number, label: string, value: string, ml: number, mr: number, alt: boolean) {
  if (alt) {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(ml, y - 4.5, mr - ml, 7, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(label, ml + 4, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(value, mr - 4, y, { align: "right" });
  return y + 7;
}

function buildTaxDocPDF(d: TaxData): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 15;
  const mr = pw - 15;
  let y = 0;

  const isT4 = d.docType === "t4";

  // ═══ HEADER — Clearly labeled as INTERNAL SUMMARY ═══
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 44, "F");
  doc.setFillColor(...TEAL);
  doc.rect(0, 40, pw, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text("NIVRA TELECOM", ml, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SOMMAIRE FISCAL INTERNE", ml, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(isT4 ? "R\u00e9f\u00e9rence f\u00e9d\u00e9rale (type T4)" : "R\u00e9f\u00e9rence provinciale (type RL-1)", ml, 31);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(d.docRef, mr, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Ann\u00e9e fiscale ${d.taxYear}`, mr, 24, { align: "right" });

  // Badge
  doc.setFillColor(...TEAL);
  const badgeText = `SOMMAIRE ${isT4 ? "F\u00c9D\u00c9RAL" : "PROVINCIAL"}`;
  const btw = doc.getTextWidth(badgeText) + 10;
  doc.roundedRect(mr - btw, 29, btw + 2, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text(badgeText, mr - btw / 2 + 1, 34, { align: "center" });

  y = 54;

  // ═══ DISCLAIMER BANNER ═══
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(ml, y, pw - 30, 10, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text("DOCUMENT INTERNE \u2014 Ce sommaire est pr\u00e9par\u00e9 par l\u2019employeur \u00e0 titre informatif. Il ne remplace pas les feuillets officiels (ARC / Revenu Qu\u00e9bec).", ml + 4, y + 6.5);
  y += 16;

  // ═══ EMPLOYER INFO ═══
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ml, y, pw - 30, 22, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(ml, y, pw - 30, 22, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("EMPLOYEUR", ml + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(NIVRA.legalName, ml + 4, y + 12);
  doc.setFontSize(8);
  doc.text(`${NIVRA.address} | NEQ: ${NIVRA.neq}`, ml + 4, y + 17);

  y += 28;

  // ═══ EMPLOYEE INFO ═══
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ml, y, pw - 30, 18, 2, 2, "F");
  doc.setDrawColor(...BORDER);
  doc.roundedRect(ml, y, pw - 30, 18, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("EMPLOY\u00c9(E)", ml + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  doc.text(d.employeeName, ml + 4, y + 12);
  doc.setFontSize(8);
  doc.text(`${d.employeeEmail}${d.employeeRole ? ` | ${d.employeeRole}` : ""}`, 110, y + 12);

  y += 24;

  // ═══ TITLE ═══
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(isT4
    ? "SOMMAIRE DE R\u00c9MUN\u00c9RATION \u2014 R\u00c9F\u00c9RENCE F\u00c9D\u00c9RALE"
    : "SOMMAIRE DE R\u00c9MUN\u00c9RATION \u2014 R\u00c9F\u00c9RENCE PROVINCIALE",
    ml, y);
  y += 3;

  // Table header
  doc.setFillColor(...NAVY);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("Description", ml + 4, y + 5.5);
  doc.text("Montant", mr - 4, y + 5.5, { align: "right" });
  y += 8;

  // ═══ ROWS ═══
  let rowIdx = 0;
  y = drawRow(doc, y + 5, "Revenus d\u2019emploi bruts", fmt(d.totalEarnings), ml, mr, rowIdx++ % 2 === 0);

  if (isT4) {
    const cpp = Math.min(d.totalEarnings * 0.0595, 3867.50);
    y = drawRow(doc, y, "Cotisations RPC/RRQ (estim\u00e9)", fmt(cpp), ml, mr, rowIdx++ % 2 === 0);
    const ei = Math.min(d.totalEarnings * 0.0163, 1049.12);
    y = drawRow(doc, y, "Cotisations AE (estim\u00e9)", fmt(ei), ml, mr, rowIdx++ % 2 === 0);
    const fedTax = d.totalEarnings * 0.15;
    y = drawRow(doc, y, "Imp\u00f4t f\u00e9d\u00e9ral retenu (estim\u00e9)", fmt(fedTax), ml, mr, rowIdx++ % 2 === 0);
  } else {
    const qpp = Math.min(d.totalEarnings * 0.064, 4160);
    y = drawRow(doc, y, "Cotisations RRQ (estim\u00e9)", fmt(qpp), ml, mr, rowIdx++ % 2 === 0);
    const qpip = Math.min(d.totalEarnings * 0.00494, 449.54);
    y = drawRow(doc, y, "Cotisations RQAP (estim\u00e9)", fmt(qpip), ml, mr, rowIdx++ % 2 === 0);
    const provTax = d.totalEarnings * 0.15;
    y = drawRow(doc, y, "Imp\u00f4t provincial retenu (estim\u00e9)", fmt(provTax), ml, mr, rowIdx++ % 2 === 0);
  }

  if (d.totalCommissions > 0) {
    y = drawRow(doc, y, "Commissions sur ventes", fmt(d.totalCommissions), ml, mr, rowIdx++ % 2 === 0);
  }
  y = drawRow(doc, y, "Heures travaill\u00e9es", `${d.hoursWorked.toFixed(1)} h`, ml, mr, rowIdx++ % 2 === 0);

  // Total deductions
  doc.setFillColor(...NAVY);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL RETENUES (ESTIMATIONS)", ml + 4, y + 5.5);
  doc.text(fmt(d.totalDeductions), mr - 4, y + 5.5, { align: "right" });
  y += 14;

  // ═══ NET BOX ═══
  doc.setFillColor(...TEAL);
  doc.roundedRect(ml, y, pw - 30, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text("REVENU NET", ml + 6, y + 9.5);
  doc.setFontSize(14);
  doc.text(fmt(d.netPay), mr - 6, y + 10, { align: "right" });
  y += 22;

  // ═══ LEGAL NOTICE ═══
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const notices = [
    "AVIS IMPORTANT : Ce document est un sommaire interne pr\u00e9par\u00e9 par l\u2019employeur \u00e0 des fins de r\u00e9f\u00e9rence uniquement.",
    "Il ne constitue PAS un feuillet fiscal officiel et ne doit pas \u00eatre utilis\u00e9 pour vos d\u00e9clarations de revenus.",
    isT4
      ? "Seul le feuillet T4 \u00e9mis par l\u2019Agence du revenu du Canada (ARC) fait foi pour les d\u00e9clarations f\u00e9d\u00e9rales."
      : "Seul le relev\u00e9 1 \u00e9mis par Revenu Qu\u00e9bec fait foi pour les d\u00e9clarations provinciales.",
    "Les montants de retenues sont des estimations. Conservez ce document pour vos dossiers personnels.",
  ];
  notices.forEach(n => {
    doc.text(n, ml, y);
    y += 4;
  });

  // ═══ FOOTER ═══
  doc.setDrawColor(...BORDER);
  doc.line(ml, ph - 25, mr, ph - 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`${NIVRA.legalName} | ${NIVRA.address}`, pw / 2, ph - 20, { align: "center" });
  doc.text(`${NIVRA.email} | ${NIVRA.website} | NEQ: ${NIVRA.neq}`, pw / 2, ph - 16, { align: "center" });
  doc.text(`TPS: ${NIVRA.tps} | TVQ: ${NIVRA.tvq}`, pw / 2, ph - 12, { align: "center" });
  doc.text(`G\u00e9n\u00e9r\u00e9 le ${d.generatedAt} \u2014 Document interne, non officiel`, pw / 2, ph - 8, { align: "center" });

  return doc.output("arraybuffer");
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

    const { data: doc, error: docErr } = await supabase.from("tax_documents").select("*").eq("id", tax_document_id).single();
    if (docErr || !doc) return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ═══ EMPLOYEE NAME RESOLUTION — profiles → employees fallback ═══
    let employeeName = "";
    let employeeEmail = "";
    let employeeRole = "";

    const { data: profile } = await supabase.from("profiles").select("first_name, last_name, email").eq("user_id", doc.user_id).single();
    if (profile?.first_name && profile?.last_name) {
      employeeName = `${profile.first_name} ${profile.last_name}`.trim();
      employeeEmail = profile.email || "";
    }

    // Fallback to employees table if profiles has generic/missing data
    if (!employeeName || employeeName.toLowerCase().includes("nivra") || employeeName.toLowerCase().includes("team")) {
      const { data: emp } = await supabase.from("employees").select("full_name, email, role, job_title").eq("user_id", doc.user_id).single();
      if (emp?.full_name) {
        employeeName = emp.full_name;
        employeeEmail = emp.email || employeeEmail;
        employeeRole = emp.job_title || emp.role || "";
      }
    }

    if (!employeeName) employeeName = "Employ\u00e9(e)";

    const { data: payrollData } = await supabase.from("payroll_entries").select("gross_pay, commission_total, bonus_total, deductions_total, net_pay, hours_worked").eq("user_id", doc.user_id);

    const totals = (payrollData || []).reduce((acc, pe) => ({
      earnings: acc.earnings + Number(pe.gross_pay || 0),
      commissions: acc.commissions + Number(pe.commission_total || 0),
      deductions: acc.deductions + Number(pe.deductions_total || 0),
      net: acc.net + Number(pe.net_pay || 0),
      hours: acc.hours + Number(pe.hours_worked || 0),
    }), { earnings: 0, commissions: 0, deductions: 0, net: 0, hours: 0 });

    const generatedAt = new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
    const docRef = `SOM-${doc.document_type.toUpperCase()}-${doc.tax_year}-${tax_document_id.substring(0, 8).toUpperCase()}`;

    const pdfBuffer = buildTaxDocPDF({
      docType: doc.document_type,
      taxYear: doc.tax_year,
      employeeName,
      employeeEmail,
      employeeRole,
      totalEarnings: totals.earnings,
      totalCommissions: totals.commissions,
      totalDeductions: totals.deductions,
      netPay: totals.net,
      hoursWorked: totals.hours,
      generatedAt,
      docRef,
    });

    const storagePath = `${doc.user_id}/${docRef}.pdf`;
    const { error: uploadErr } = await supabase.storage.from("payslips").upload(storagePath, new Uint8Array(pdfBuffer), { contentType: "application/pdf", upsert: true });
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
