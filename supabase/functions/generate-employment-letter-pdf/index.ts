/**
 * generate-employment-letter-pdf — Professional employment letter generator
 * Generates formal employment confirmation letters with Nivra branding.
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
  address: "1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5",
  email: "Support@nivra-telecom.ca",
  website: "www.nivra-telecom.ca",
  division: "Division des ressources humaines",
};

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [0, 102, 204];
const LIGHT_BG: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const TEXT: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const WHITE: [number, number, number] = [255, 255, 255];

const fmtDateFR = (s: string): string => {
  if (!s) return "\u2014";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
  } catch { return s; }
};

interface LetterData {
  employeeName: string;
  employeeAddress?: string;
  jobTitle: string;
  employmentType: string; // full_time, part_time, contract, commission
  startDate: string;
  salary?: string;
  letterType: string; // confirmation, offer, termination, reference
  customContent?: string;
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  contract: "Contractuel",
  commission: "Sur commission",
};

function buildEmploymentLetterPDF(d: LetterData, letterNumber: string): ArrayBuffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const ml = 25;
  const mr = pw - 25;
  let y = 0;

  // Header bar
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pw, 32, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 28, pw, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text("NIVRA TELECOM", ml, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(NIVRA.division, ml, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(letterNumber, mr, 14, { align: "right" });

  y = 42;

  // Date and reference
  const today = fmtDateFR(new Date().toISOString());
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Laval, le ${today}`, mr, y, { align: "right" });
  y += 14;

  // Recipient
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(d.employeeName, ml, y);
  y += 5;
  if (d.employeeAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    // Split address by comma
    const addrParts = d.employeeAddress.split(",").map(s => s.trim());
    for (const part of addrParts) {
      doc.text(part, ml, y);
      y += 5;
    }
  }

  y += 8;

  // Object line
  const titleMap: Record<string, string> = {
    confirmation: "Confirmation d\u2019emploi",
    offer: "Offre d\u2019emploi",
    termination: "Fin d\u2019emploi",
    reference: "Lettre de r\u00e9f\u00e9rence",
  };
  const letterTitle = titleMap[d.letterType] || "Lettre d\u2019emploi";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`Objet : ${letterTitle}`, ml, y);
  y += 3;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  doc.line(ml, y, mr, y);
  y += 10;

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const lineHeight = 6;

  const empTypeLabel = EMPLOYMENT_TYPE_LABELS[d.employmentType] || d.employmentType;

  if (d.letterType === "confirmation" || d.letterType === "offer") {
    const paragraphs = [
      `Madame, Monsieur,`,
      `Par la pr\u00e9sente, nous confirmons que ${d.employeeName} est employ\u00e9(e) chez ${NIVRA.tradeName} (${NIVRA.legalName}) depuis le ${fmtDateFR(d.startDate)}.`,
      `Titre du poste : ${d.jobTitle}`,
      `Type d\u2019emploi : ${empTypeLabel}`,
      d.salary ? `R\u00e9mun\u00e9ration : ${d.salary}` : null,
      `${d.employeeName} occupe ce poste de mani\u00e8re continue et ses responsabilit\u00e9s incluent les t\u00e2ches associ\u00e9es au r\u00f4le de ${d.jobTitle} au sein de notre \u00e9quipe.`,
      `Cette lettre est \u00e9mise \u00e0 la demande de l\u2019employ\u00e9(e) pour les fins qu\u2019il ou elle jugera utiles.`,
      d.customContent || null,
      `Pour toute question, n\u2019h\u00e9sitez pas \u00e0 communiquer avec notre division des ressources humaines \u00e0 l\u2019adresse ${NIVRA.email}.`,
      `Veuillez agr\u00e9er l\u2019expression de nos salutations distingu\u00e9es.`,
    ].filter(Boolean) as string[];

    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para, mr - ml);
      for (const line of lines) {
        if (y > ph - 40) {
          doc.addPage();
          y = 25;
        }
        doc.text(line, ml, y);
        y += lineHeight;
      }
      y += 3;
    }
  } else if (d.letterType === "reference") {
    const paragraphs = [
      `\u00c0 qui de droit,`,
      `Par la pr\u00e9sente, nous attestons que ${d.employeeName} a \u00e9t\u00e9 employ\u00e9(e) chez ${NIVRA.tradeName} (${NIVRA.legalName}) \u00e0 titre de ${d.jobTitle} depuis le ${fmtDateFR(d.startDate)}.`,
      `Durant son emploi, ${d.employeeName} a fait preuve de professionnalisme, de rigueur et d\u2019un engagement constant envers la qualit\u00e9 du service.`,
      d.customContent || null,
      `Nous recommandons ${d.employeeName} sans r\u00e9serve pour tout poste correspondant \u00e0 ses comp\u00e9tences et \u00e0 son exp\u00e9rience.`,
      `Pour toute v\u00e9rification, veuillez communiquer avec notre division des ressources humaines.`,
      `Cordialement,`,
    ].filter(Boolean) as string[];

    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para, mr - ml);
      for (const line of lines) {
        if (y > ph - 40) { doc.addPage(); y = 25; }
        doc.text(line, ml, y);
        y += lineHeight;
      }
      y += 3;
    }
  }

  // Signature block
  y += 10;
  if (y > ph - 50) { doc.addPage(); y = 25; }
  doc.setDrawColor(...BORDER);
  doc.line(ml, y, ml + 60, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(NIVRA.division, ml, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  doc.text(NIVRA.tradeName, ml, y);

  // Footer
  doc.setDrawColor(...BORDER);
  doc.line(ml, ph - 22, mr, ph - 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(`${NIVRA.legalName} | ${NIVRA.address}`, pw / 2, ph - 17, { align: "center" });
  doc.text(`${NIVRA.email} | ${NIVRA.website} | NEQ: ${NIVRA.neq}`, pw / 2, ph - 13, { align: "center" });

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

    const body = await req.json();
    const { employment_letter_id } = body;

    if (!employment_letter_id) {
      return new Response(JSON.stringify({ error: "employment_letter_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch letter record
    const { data: letter, error: lErr } = await supabase
      .from("employment_letters")
      .select("*")
      .eq("id", employment_letter_id)
      .single();

    if (lErr || !letter) {
      return new Response(JSON.stringify({ error: "Employment letter not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch employee profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, phone, full_name, job_title")
      .eq("user_id", letter.user_id)
      .single();

    const letterNumber = letter.letter_number || `LTR-${letter.id.substring(0, 8).toUpperCase()}`;

    const pdfBuffer = buildEmploymentLetterPDF({
      employeeName: profile?.full_name || `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Employ\u00e9",
      employeeAddress: letter.employee_address || undefined,
      jobTitle: letter.job_title || profile?.job_title || "Agent(e) de ventes",
      employmentType: letter.employment_type || "commission",
      startDate: letter.start_date || letter.created_at,
      salary: letter.salary_info || undefined,
      letterType: letter.letter_type || "confirmation",
      customContent: letter.custom_content || undefined,
    }, letterNumber);

    // Upload
    const storagePath = `${letter.user_id}/letters/${letterNumber}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("payslips")
      .upload(storagePath, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signed } = await supabase.storage
      .from("payslips")
      .createSignedUrl(storagePath, 604800);

    // Update letter record
    await supabase.from("employment_letters").update({
      pdf_url: storagePath,
      letter_number: letterNumber,
      status: "generated",
      generated_at: new Date().toISOString(),
    }).eq("id", employment_letter_id);

    return new Response(JSON.stringify({
      success: true,
      letter_number: letterNumber,
      pdf_url: signed?.signedUrl || storagePath,
      storage_path: storagePath,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Employment letter error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
