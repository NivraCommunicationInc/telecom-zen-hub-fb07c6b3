/**
 * generate-tax-document-pdf — Professional T4/RL-1 tax document generator
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
const BLUE: [number, number, number] = [0, 102, 204];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const WHITE: [number, number, number] = [255, 255, 255];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 }).format(n || 0);

interface TaxData {
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
  docRef: string;
}

function drawRow(doc: any, y: number, label: string, box: string, value: string, ml: number, mr: number, alt: boolean) {
  if (alt) {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(ml, y - 4.5, mr - ml, 7, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(label, ml + 4, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(box, 120, y);
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
  const typeLabel = isT4
    ? "FEUILLET T4 \u2014 \u00c9TAT DE LA R\u00c9MUN\u00c9RATION PAY\u00c9E"
    : "RELEV\u00c9 1 \u2014 REVENUS D\u2019EMPLOI ET REVENUS DIVERS";
  const accentColor: [number, number, number] = isT4 ? [220, 38, 38] : [37, 99, 235];

  // ═══ HEADER ═══
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 42, "F");
  doc.setFillColor(...accentColor);
  doc.rect(0, 38, pw, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text("NIVRA TELECOM", ml, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(isT4 ? "DOCUMENT FISCAL F\u00c9D\u00c9RAL" : "DOCUMENT FISCAL PROVINCIAL", ml, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(d.docRef, mr, 16, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Ann\u00e9e fiscale ${d.taxYear}`, mr, 26, { align: "right" });

  // Type badge
  doc.setFillColor(...accentColor);
  const badgeText = isT4 ? "T4" : "RL-1";
  const btw = doc.getTextWidth(badgeText) + 10;
  doc.roundedRect(mr - btw, 29, btw + 2, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(badgeText, mr - btw / 2 + 1, 34, { align: "center" });

  y = 52;

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
  doc.text(d.employeeEmail, 120, y + 12);

  y += 24;

  // ═══ TITLE BAR ═══
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(typeLabel, ml, y);
  y += 3;

  // Table header
  doc.setFillColor(...NAVY);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("Description", ml + 4, y + 5.5);
  doc.text("Case", 120, y + 5.5);
  doc.text("Montant", mr - 4, y + 5.5, { align: "right" });
  y += 8;

  // ═══ ROWS ═══
  let rowIdx = 0;
  if (isT4) {
    // T4 boxes
    y = drawRow(doc, y + 5, "Revenus d\u2019emploi", "Case 14", fmt(d.totalEarnings), ml, mr, rowIdx++ % 2 === 0);
    const cpp = Math.min(d.totalEarnings * 0.0595, 3867.50);
    y = drawRow(doc, y, "Cotisations au RPC/RRQ", "Case 16", fmt(cpp), ml, mr, rowIdx++ % 2 === 0);
    const ei = Math.min(d.totalEarnings * 0.0163, 1049.12);
    y = drawRow(doc, y, "Cotisations \u00e0 l\u2019AE", "Case 18", fmt(ei), ml, mr, rowIdx++ % 2 === 0);
    const fedTax = d.totalEarnings * 0.15;
    y = drawRow(doc, y, "Imp\u00f4t f\u00e9d\u00e9ral retenu", "Case 22", fmt(fedTax), ml, mr, rowIdx++ % 2 === 0);
    if (d.totalCommissions > 0) {
      y = drawRow(doc, y, "Commissions sur ventes", "Case 42", fmt(d.totalCommissions), ml, mr, rowIdx++ % 2 === 0);
    }
    y = drawRow(doc, y, "Heures travaill\u00e9es", "\u2014", `${d.hoursWorked.toFixed(1)} h`, ml, mr, rowIdx++ % 2 === 0);
  } else {
    // RL-1 boxes
    y = drawRow(doc, y + 5, "Revenus d\u2019emploi", "Case A", fmt(d.totalEarnings), ml, mr, rowIdx++ % 2 === 0);
    const qpp = Math.min(d.totalEarnings * 0.064, 4160);
    y = drawRow(doc, y, "Cotisations au RRQ", "Case B", fmt(qpp), ml, mr, rowIdx++ % 2 === 0);
    const qpip = Math.min(d.totalEarnings * 0.00494, 449.54);
    y = drawRow(doc, y, "Cotisations au RQAP", "Case H", fmt(qpip), ml, mr, rowIdx++ % 2 === 0);
    const provTax = d.totalEarnings * 0.15;
    y = drawRow(doc, y, "Imp\u00f4t provincial retenu", "Case E", fmt(provTax), ml, mr, rowIdx++ % 2 === 0);
    if (d.totalCommissions > 0) {
      y = drawRow(doc, y, "Commissions", "Case G-1", fmt(d.totalCommissions), ml, mr, rowIdx++ % 2 === 0);
    }
    y = drawRow(doc, y, "Heures travaill\u00e9es", "\u2014", `${d.hoursWorked.toFixed(1)} h`, ml, mr, rowIdx++ % 2 === 0);
  }

  // Total deductions
  doc.setFillColor(...accentColor);
  doc.rect(ml, y, pw - 30, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL RETENUES", ml + 4, y + 5.5);
  doc.text(fmt(d.totalDeductions), mr - 4, y + 5.5, { align: "right" });
  y += 14;

  // ═══ NET BOX ═══
  const netColor: [number, number, number] = [22, 163, 74];
  doc.setFillColor(...netColor);
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
    "Ce document est un sommaire pr\u00e9par\u00e9 \u00e0 des fins de r\u00e9f\u00e9rence par l\u2019employeur.",
    isT4
      ? "Le feuillet T4 officiel \u00e9mis par l\u2019Agence du revenu du Canada (ARC) fait foi."
      : "Le relev\u00e9 1 officiel \u00e9mis par Revenu Qu\u00e9bec fait foi.",
    "Conservez ce document pour vos dossiers personnels et fiscaux.",
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
  doc.text(`G\u00e9n\u00e9r\u00e9 le ${d.generatedAt}`, pw / 2, ph - 8, { align: "center" });

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

    const { data: profile } = await supabase.from("profiles").select("first_name, last_name, email").eq("user_id", doc.user_id).single();

    const { data: payrollData } = await supabase.from("payroll_entries").select("gross_pay, commission_total, bonus_total, deductions_total, net_pay, hours_worked").eq("user_id", doc.user_id);

    const totals = (payrollData || []).reduce((acc, pe) => ({
      earnings: acc.earnings + Number(pe.gross_pay || 0),
      commissions: acc.commissions + Number(pe.commission_total || 0),
      deductions: acc.deductions + Number(pe.deductions_total || 0),
      net: acc.net + Number(pe.net_pay || 0),
      hours: acc.hours + Number(pe.hours_worked || 0),
    }), { earnings: 0, commissions: 0, deductions: 0, net: 0, hours: 0 });

    const generatedAt = new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
    const docRef = `${doc.document_type.toUpperCase()}-${doc.tax_year}-${tax_document_id.substring(0, 8).toUpperCase()}`;

    const pdfBuffer = buildTaxDocPDF({
      docType: doc.document_type,
      taxYear: doc.tax_year,
      employeeName: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Employ\u00e9",
      employeeEmail: profile?.email || "",
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
