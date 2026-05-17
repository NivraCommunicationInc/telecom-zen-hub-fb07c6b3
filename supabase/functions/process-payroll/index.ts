/**
 * process-payroll — Friday weekly payroll engine.
 *
 * - Cutoff = previous Thursday 18:00 EST (or as provided).
 * - Pulls all field_commissions (status=approved), including missing earned_at.
 * - Computes Fed/QC tax + RRQ + AE + RQAP + disability per agent.
 * - Writes payroll_runs row + payroll_entries per agent.
 * - Flips commissions to 'paid'.
 * - Generates paystub PDF, uploads to storage, enqueues paystub email.
 *
 * Caller: HR admin button (recommended) or external cron.
 */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildPaystubPdf } from "../_shared/pdf/paystubTemplate.ts";
import { enqueueEmail } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────── Constants 2026 ───────────
// Paie Nivra = cycle hebdomadaire du vendredi. Les retenues doivent donc être
// annualisées sur 52 périodes, pas 26.
const PAY_PERIODS_WEEKLY = 52;
const FED_BPA_DEFAULT = 15705;
const QC_BPA_DEFAULT = 17183;

const RRQ_RATE = 0.059;
const RRQ_MAX_PENSIONABLE = 68500;
const RRQ_BASIC_EXEMPTION = 3500;

const AE_RATE = 0.0166;
const AE_MAX_INSURABLE = 63200;

const RQAP_RATE = 0.00494;
const RQAP_MAX_INSURABLE = 94000;

const DISABILITY_RATE_DEFAULT = 0.02;
const FEDERAL_WITHHOLDING_FLOOR_RATE = 0.03;
const QUEBEC_WITHHOLDING_FLOOR_RATE = 0.03;

// ─────────── Helpers ───────────
const round2 = (n: number) => Math.round(n * 100) / 100;
const ESTms = (d: Date) => d.getTime() - 5 * 3600_000;

function lastThursdayCutoffUTC(now: Date): Date {
  // Find most recent Thursday at 18:00 EST <= now (in UTC = 23:00 UTC).
  const ref = new Date(now);
  for (let i = 0; i < 8; i++) {
    const d = new Date(ref);
    d.setUTCDate(ref.getUTCDate() - i);
    d.setUTCHours(23, 0, 0, 0); // 18:00 EST
    if (d.getUTCDay() === 4 && d.getTime() <= now.getTime()) return d;
  }
  return ref;
}

function nextFridayPayDate(cutoff: Date): string {
  const f = new Date(cutoff);
  f.setUTCDate(cutoff.getUTCDate() + 1);
  return f.toISOString().slice(0, 10);
}

function periodStart(cutoff: Date): Date {
  const d = new Date(cutoff);
  d.setUTCDate(cutoff.getUTCDate() - 7);
  return d;
}

function isLastFridayOfMonth(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 7);
  return next.getUTCMonth() !== d.getUTCMonth();
}

async function getBrackets(table: string, year: number) {
  const { data } = await supabase
    .from(table)
    .select("min_income, max_income, rate, constant")
    .eq("year", year)
    .order("min_income", { ascending: true });
  return (data ?? []) as Array<{ min_income: number; max_income: number | null; rate: number; constant: number }>;
}

function bracketTax(annualIncome: number, brackets: Awaited<ReturnType<typeof getBrackets>>, claimAmount: number): number {
  const taxable = Math.max(0, annualIncome);
  if (!brackets.length) return 0;
  for (const b of brackets) {
    const max = b.max_income ?? Infinity;
    if (taxable > Number(b.min_income) && taxable <= max) {
      const baseTax = taxable * Number(b.rate) - Number(b.constant ?? 0);
      const creditRate = Number(brackets[0]?.rate || 0);
      return baseTax - Math.max(0, claimAmount) * creditRate;
    }
  }
  // Above highest bracket — use last
  const last = brackets[brackets.length - 1];
  if (!last) return 0;
  const baseTax = taxable * Number(last.rate) - Number(last.constant ?? 0);
  const creditRate = Number(brackets[0]?.rate || 0);
  return baseTax - Math.max(0, claimAmount) * creditRate;
}

interface DeductionSettings {
  federal_claim_amount: number;
  quebec_claim_amount: number;
  disability_insurance_rate: number;
}

async function calculateDeductions(
  grossPay: number,
  settings: DeductionSettings,
  fedBrackets: Awaited<ReturnType<typeof getBrackets>>,
  qcBrackets: Awaited<ReturnType<typeof getBrackets>>,
) {
  const annualGross = grossPay * PAY_PERIODS_WEEKLY;

  const federalAnnual = Math.max(0, bracketTax(annualGross, fedBrackets, settings.federal_claim_amount));
  const quebecAnnual = Math.max(0, bracketTax(annualGross, qcBrackets, settings.quebec_claim_amount));
  // Weekly commission payroll can otherwise show $0 source tax for small
  // periods because annual credits wipe out the first bracket. Nivra needs an
  // explicit withholding line on every taxable paid stub, so we keep the
  // bracket result and apply a conservative source-withholding floor.
  const federal_tax = grossPay > 0 ? Math.max(federalAnnual / PAY_PERIODS_WEEKLY, grossPay * FEDERAL_WITHHOLDING_FLOOR_RATE) : 0;
  const quebec_tax = grossPay > 0 ? Math.max(quebecAnnual / PAY_PERIODS_WEEKLY, grossPay * QUEBEC_WITHHOLDING_FLOOR_RATE) : 0;

  const rrqPeriodExemption = RRQ_BASIC_EXEMPTION / PAY_PERIODS_WEEKLY;
  const rrqPensionableThisPay = Math.min(Math.max(0, grossPay - rrqPeriodExemption), RRQ_MAX_PENSIONABLE / PAY_PERIODS_WEEKLY);
  const rrq = rrqPensionableThisPay * RRQ_RATE;

  const aeAnnual = Math.min(annualGross * AE_RATE, AE_MAX_INSURABLE * AE_RATE);
  const ae = aeAnnual / PAY_PERIODS_WEEKLY;

  const rqapAnnual = Math.min(annualGross * RQAP_RATE, RQAP_MAX_INSURABLE * RQAP_RATE);
  const rqap = rqapAnnual / PAY_PERIODS_WEEKLY;

  const disability = grossPay * (settings.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT);

  const total_deductions = federal_tax + quebec_tax + rrq + ae + rqap + disability;
  const net_pay = grossPay - total_deductions;

  return {
    federal_tax: round2(federal_tax),
    quebec_tax: round2(quebec_tax),
    rrq: round2(rrq),
    ae: round2(ae),
    rqap: round2(rqap),
    disability_insurance: round2(disability),
    total_deductions: round2(total_deductions),
    net_pay: round2(net_pay),
  };
}

async function fetchYtd(employeeId: string, year: number) {
  const { data } = await supabase
    .from("payroll_entries")
    .select("total_gross, federal_tax, quebec_tax, rrq, ae, rqap, disability_insurance, deductions_total, total_deductions, net_pay")
    .eq("employee_id", employeeId)
    .gte("created_at", `${year}-01-01T00:00:00Z`)
    .lte("created_at", `${year}-12-31T23:59:59Z`);
  const rows = data ?? [];
  return {
    ytd_gross: round2(rows.reduce((s, r) => s + Number(r.total_gross || 0), 0)),
    ytd_federal_tax: round2(rows.reduce((s, r) => s + Number(r.federal_tax || 0), 0)),
    ytd_quebec_tax: round2(rows.reduce((s, r) => s + Number(r.quebec_tax || 0), 0)),
    ytd_rrq: round2(rows.reduce((s, r) => s + Number(r.rrq || 0), 0)),
    ytd_ae: round2(rows.reduce((s, r) => s + Number(r.ae || 0), 0)),
    ytd_rqap: round2(rows.reduce((s, r) => s + Number(r.rqap || 0), 0)),
    ytd_disability: round2(rows.reduce((s, r) => s + Number(r.disability_insurance || 0), 0)),
    ytd_deductions: round2(rows.reduce((s, r) => s + Number((r as any).total_deductions ?? (r as any).deductions_total ?? 0), 0)),
    ytd_net: round2(rows.reduce((s, r) => s + Number(r.net_pay || 0), 0)),
  };
}

async function uploadPaystubPdf(pdf: Uint8Array, runId: string, employeeId: string): Promise<{ path: string; signedUrl: string | null } | null> {
  const path = `paystubs/${runId}/${employeeId}.pdf`;
  const { error } = await supabase.storage.from("documents").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    console.error("[process-payroll] upload paystub failed:", error.message);
    return null;
  }
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60 * 24 * 30);
  return { path, signedUrl: data?.signedUrl ?? null };
}

async function enqueuePaystubEmail(toEmail: string, vars: Record<string, unknown>, pdf: Uint8Array, entryId: string): Promise<{ ok: boolean; error?: string }> {
  if (!toEmail) return { ok: false, error: "Aucun courriel employé." };
  try {
    let binary = "";
    for (let i = 0; i < pdf.length; i++) binary += String.fromCharCode(pdf[i]);
    const content = btoa(binary);
    const eventKey = `paystub_notification_${entryId}`;
    const rendered = renderPaystubEmail(vars);
    const direct = await enqueueEmail({
      to: toEmail,
      templateKey: "paystub_notification",
      subject: rendered.subject,
      html: rendered.html,
      eventKey,
      messageType: "paystub_notification",
      entityType: "payroll_entry",
      entityId: entryId,
      attachments: [{ filename: `talon-paie-${String(vars.payroll_number || entryId)}.pdf`, content, contentType: "application/pdf" }],
    });
    if (!direct.success) throw new Error(direct.error || "Échec d'envoi courriel.");
    await supabase.from("email_queue").upsert({
      event_key: eventKey,
      template_key: "paystub_notification",
      to_email: toEmail,
      template_vars: vars,
      message_type: "paystub_notification",
      entity_type: "payroll_entry",
      entity_id: entryId,
      attachments: [{ filename: `talon-paie-${String(vars.payroll_number || entryId)}.pdf`, content, contentType: "application/pdf" }],
      status: "sent",
      attempts: 1,
      last_error: null,
      sent_at: new Date().toISOString(),
      next_retry_at: new Date().toISOString(),
    } as any, { onConflict: "event_key" });
    await supabase.functions.invoke("process-email-queue", { body: { drain_now: true } });
    return { ok: true };
  } catch (e) {
    console.error("[process-payroll] enqueue email failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function renderPaystubEmail(vars: Record<string, unknown>): { subject: string; html: string } {
  const money = (v: unknown) => `${(Number(v) || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  const date = (v: unknown) => v ? new Date(String(v)).toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" }) : "—";
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  const rows: Array<[string, string]> = [
    ["Employé", `${esc(vars.agent_name)}${vars.agent_number ? ` — ${esc(vars.agent_number)}` : ""}`],
    ["Période", `${date(vars.period_start)} au ${date(vars.period_end)}`],
    ["Date de paie", date(vars.pay_date)],
    ["Heures régulières", money(vars.regular_hours_pay)],
    ["Heures supplémentaires", money(vars.overtime_hours_pay)],
    ["Commissions", money(vars.commission_gross)],
    ["Bonus", money(vars.bonus_amount)],
    ["Allocations / suppléments", money(vars.allocation_total)],
    ["Total brut", money(vars.total_gross)],
    ["Impôt fédéral", `-${money(vars.federal_tax)}`],
    ["Impôt provincial Québec", `-${money(vars.quebec_tax)}`],
    ["RRQ", `-${money(vars.rrq)}`],
    ["AE", `-${money(vars.ae)}`],
    ["RQAP", `-${money(vars.rqap)}`],
    ["Assurance invalidité", `-${money(vars.disability_insurance)}`],
    ["Déductions manuelles", `-${money(vars.manual_deductions)}`],
    ["Total déductions", `-${money(vars.total_deductions)}`],
    ["Net à payer", money(vars.net_pay)],
  ];
  const paystubUrl = esc(vars.paystub_url || vars.portal_url || "https://nivra-telecom.ca/rh/paie");
  const htmlRows = rows.map(([k, v], idx) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #ede9fe;color:#4b5563;">${k}</td><td style="padding:10px 12px;border-bottom:1px solid #ede9fe;text-align:right;font-weight:${idx === rows.length - 1 ? 800 : 600};color:${idx === rows.length - 1 ? "#047857" : "#1e1b4b"};">${v}</td></tr>`).join("");
  return {
    subject: `Votre paie Nivra — ${date(vars.pay_date)}`,
    html: `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#1e1b4b;"><div style="max-width:680px;margin:0 auto;padding:28px 18px;"><div style="background:#1e1b4b;color:#fff;padding:24px;border-radius:12px 12px 0 0;"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c4b5fd;">Paie disponible</div><h1 style="margin:8px 0 0;font-size:26px;">Votre paie a été traitée</h1><p style="margin:8px 0 0;color:#ddd6fe;">Votre talon de paie PDF est joint à ce courriel et disponible dans votre section RH.</p></div><div style="border:1px solid #ede9fe;border-top:0;padding:22px;border-radius:0 0 12px 12px;"><p>Bonjour ${esc(vars.agent_name || "")},</p><p>Voici le détail de votre paie. Le même PDF est synchronisé dans votre historique RH.</p><table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ede9fe;border-radius:8px;overflow:hidden;">${htmlRows}</table><p style="text-align:center;margin:24px 0;"><a href="${paystubUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">Voir mon talon de paie</a></p><p style="font-size:12px;color:#6b7280;">Questions ? Écrivez à support@nivra-telecom.ca</p></div></div></body></html>`,
  };
}

async function notifyPayrollReady(empId: string, amount: number, period: string, paystubUrl?: string | null) {
  await supabase.from("employee_notifications").insert({
    user_id: empId,
    notification_type: "payroll",
    title: "Talon de paie disponible",
    message: `Votre paie ${period} est prête. Net à payer : ${round2(amount).toFixed(2)} $.`,
    link_url: paystubUrl || "/rh/paie",
    is_read: false,
  });
}

type AdjLine = { id: string; amount: number; is_taxable: boolean; adjustment_type: string; description: string };

const ADJ_LABEL: Record<string, string> = {
  allocation: "Allocation",
  bonus: "Bonus",
  supplement: "Supplément",
  reimbursement: "Remboursement",
  advance: "Avance sur paie",
  deduction: "Déduction manuelle",
  other: "Autre revenu",
};

function adjLabel(type: string) {
  return ADJ_LABEL[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function makeDeductionBreakdown(ded: any, manualDeductions: number, deductionLines: AdjLine[] = []) {
  return [
    { label: "Impôt fédéral", amount: round2(ded.federal_tax || 0), category: "tax" },
    { label: "Impôt provincial (Québec)", amount: round2(ded.quebec_tax || 0), category: "tax" },
    { label: "RRQ (Régime de rentes du Québec)", amount: round2(ded.rrq || 0), category: "statutory" },
    { label: "Assurance-emploi (AE)", amount: round2(ded.ae || 0), category: "statutory" },
    { label: "RQAP (Assurance parentale)", amount: round2(ded.rqap || 0), category: "statutory" },
    { label: "Assurance invalidité", amount: round2(ded.disability_insurance || 0), category: "benefit" },
    ...deductionLines.map((a) => ({ label: adjLabel(a.adjustment_type), detail: a.description, amount: round2(Math.abs(a.amount)), category: "manual" })),
    ...(manualDeductions > 0 && deductionLines.length === 0 ? [{ label: "Avances / déductions manuelles", amount: round2(manualDeductions), category: "manual" }] : []),
  ].filter((l) => Number(l.amount) > 0 || ["Impôt fédéral", "Impôt provincial (Québec)", "RRQ (Régime de rentes du Québec)"].includes(l.label));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let processedBy: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
      processedBy = u?.user?.id ?? null;
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = Boolean(body.dry_run);
    const explicitCutoff = body.cutoff_date ? new Date(body.cutoff_date) : null;
    const excludedCommissionIds: Set<string> = new Set(
      Array.isArray(body.excluded_commission_ids) ? body.excluded_commission_ids.map((x: any) => String(x)) : []
    );
    const selectedEmployeeIds: Set<string> | null = Array.isArray(body.employee_ids) && body.employee_ids.length
      ? new Set(body.employee_ids.map((x: any) => String(x)))
      : null;
    const previewEmployeeId: string | null = body.preview_employee_id ? String(body.preview_employee_id) : null;
    const resendEntryId: string | null = body.resend_email_for_entry_id ? String(body.resend_email_for_entry_id) : null;

    // ─── Manual resend of paystub email for an existing payroll entry ───
    if (resendEntryId) {
      const { data: entry, error: eErr } = await supabase
        .from("payroll_entries")
        .select("*")
        .eq("id", resendEntryId)
        .maybeSingle();
      if (eErr || !entry) {
        return new Response(JSON.stringify({ error: "Talon introuvable." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabase
        .from("profiles").select("user_id, full_name, email, agent_number")
        .eq("user_id", entry.employee_id).maybeSingle();
      if (!profile?.email) {
        return new Response(JSON.stringify({ error: "Cet employé n'a pas de courriel." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Download existing PDF from storage
      let pdfBytes: Uint8Array | null = null;
      const path = entry.paystub_pdf_url || entry.pdf_url;
      if (path) {
        const cleanPath = String(path).includes("/documents/") ? String(path).split("/documents/").pop()! : String(path);
        const { data: dl } = await supabase.storage.from("documents").download(cleanPath);
        if (dl) pdfBytes = new Uint8Array(await dl.arrayBuffer());
      }
      if (!pdfBytes) {
        return new Response(JSON.stringify({ error: "PDF du talon introuvable dans le stockage." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(
        String(path).includes("/documents/") ? String(path).split("/documents/").pop()! : String(path),
        60 * 60 * 24 * 30,
      );
      const resendResult = await enqueuePaystubEmail(profile.email, {
        agent_name: profile.full_name || profile.email,
        agent_number: profile.agent_number || "—",
        period_start: entry.created_at?.slice(0, 10),
        period_end: entry.created_at?.slice(0, 10),
        pay_date: entry.created_at?.slice(0, 10),
        regular_hours_pay: Number(entry.base_salary || 0),
        overtime_hours_pay: 0,
        commission_gross: Number(entry.commission_gross || 0),
        bonus_amount: Number(entry.bonus_amount || 0),
        allocation_total: Math.max(0, Number(entry.total_gross || 0) - Number(entry.commission_gross || 0) - Number(entry.bonus_amount || 0) - Number(entry.base_salary || 0)),
        total_gross: Number(entry.total_gross || 0),
        federal_tax: Number(entry.federal_tax || 0),
        quebec_tax: Number(entry.quebec_tax || 0),
        rrq: Number(entry.rrq || 0),
        ae: Number(entry.ae || 0),
        rqap: Number(entry.rqap || 0),
        disability_insurance: Number(entry.disability_insurance || 0),
        total_deductions: Number(entry.deductions_total || 0),
        net_pay: Number(entry.net_pay || 0),
        payment_method: entry.payment_method || "interac",
        payroll_number: entry.payroll_number,
        paystub_url: signed?.signedUrl,
        portal_url: "https://nivra-telecom.ca/field/profile",
        resent: true,
      }, pdfBytes, `${entry.id}-resend-${Date.now()}`);
      await supabase.from("payroll_entries").update({
        email_status: resendResult.ok ? "sent" : "failed",
        emailed_at: resendResult.ok ? new Date().toISOString() : null,
        email_last_error: resendResult.error ?? null,
      } as any).eq("id", entry.id);
      await notifyPayrollReady(entry.employee_id, Number(entry.net_pay || 0), "renvoyée", signed?.signedUrl ?? null);
      return new Response(JSON.stringify({ ok: true, resent: true, to: profile.email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date();
    const cutoff = explicitCutoff ?? lastThursdayCutoffUTC(now);
    const pStart = periodStart(cutoff);
    const pEnd = cutoff;
    const payDate = nextFridayPayDate(cutoff);
    const lastFriday = isLastFridayOfMonth(payDate);
    const year = new Date(payDate).getUTCFullYear();

    // 1. Load all active payroll settings (defines who gets paid)
    const { data: settingsAll } = await supabase
      .from("employee_payroll_settings")
      .select("employee_id, pay_type, hourly_rate, employee_role, payment_method, federal_claim_amount, quebec_claim_amount, disability_insurance_rate")
      .eq("is_active", true);

    // 2. Approved commissions are payable immediately (for commission/hourly_commission types)
    const { data: approvedRaw, error: cmErr } = await supabase
      .from("field_commissions")
      .select("id, agent_id, amount, commission_type, description, earned_at, order_id, paid_in_run_id, paid_in_entry_id")
      .eq("status", "approved");
    if (cmErr) throw cmErr;
    const approvedIds = (approvedRaw ?? []).map((c: any) => c.id);
    const { data: linkedRows } = approvedIds.length
      ? await supabase.from("payroll_commission_links").select("commission_id").in("commission_id", approvedIds)
      : { data: [] as any[] };
    const alreadyLinked = new Set((linkedRows ?? []).map((r: any) => String(r.commission_id)));
    const approved = (approvedRaw ?? []).filter((c: any) =>
      !excludedCommissionIds.has(c.id) && !alreadyLinked.has(String(c.id)) && !c.paid_in_run_id && !c.paid_in_entry_id
    );

    type CommLine = { id: string; amount: number; description: string | null; earned_at: string | null; order_id: string | null; commission_type: string | null };
    const commByAgent = new Map<string, { ids: string[]; gross: number; lines: CommLine[] }>();
    for (const c of approved ?? []) {
      const entry = commByAgent.get(c.agent_id) || { ids: [], gross: 0, lines: [] };
      entry.ids.push(c.id);
      entry.gross += Number(c.amount || 0);
      entry.lines.push({ id: c.id, amount: Number(c.amount || 0), description: c.description, earned_at: c.earned_at, order_id: c.order_id, commission_type: c.commission_type });
      commByAgent.set(c.agent_id, entry);
    }

    // 3. Timesheets for this period
    const periodStartStr = pStart.toISOString().slice(0, 10);
    const { data: timesheets } = await supabase
      .from("timesheet_entries")
      .select("employee_id, hours_worked, overtime_hours")
      .eq("pay_period_start", periodStartStr);
    const tsByEmp = new Map<string, { reg: number; ot: number }>();
    for (const t of timesheets ?? []) {
      tsByEmp.set(t.employee_id, { reg: Number(t.hours_worked || 0), ot: Number(t.overtime_hours || 0) });
    }

    // 4. Unattached pay_adjustments
    const { data: pendingAdj } = await supabase
      .from("pay_adjustments")
      .select("id, employee_id, amount, is_taxable, adjustment_type, description")
      .is("payroll_run_id", null);
    const adjByEmp = new Map<string, AdjLine[]>();
    for (const a of pendingAdj ?? []) {
      const arr = adjByEmp.get(a.employee_id) || [];
      arr.push({ id: a.id, amount: Number(a.amount || 0), is_taxable: Boolean(a.is_taxable), adjustment_type: a.adjustment_type, description: a.description });
      adjByEmp.set(a.employee_id, arr);
    }

    // 5. Build payable list — union of all sources
    type AgentBundle = {
      settings: any;
      commissionIds: string[];
      commissionGross: number;
      commissionLines: CommLine[];
      regularPay: number;
      overtimePay: number;
      taxableAdjustments: number;
      nonTaxableAdjustments: number;
      manualDeductions: number;
      adjustmentIds: string[];
      adjustmentLines: AdjLine[];
    };
    const bundle = new Map<string, AgentBundle>();
    for (const s of settingsAll ?? []) {
      if (selectedEmployeeIds && !selectedEmployeeIds.has(s.employee_id)) continue;
      const isHourly = s.pay_type === "hourly" || s.pay_type === "hourly_commission";
      const isCommission = s.pay_type === "commission" || s.pay_type === "hourly_commission";
      const ts = tsByEmp.get(s.employee_id);
      const rate = Number(s.hourly_rate || 0);
      const regularPay = isHourly && ts ? ts.reg * rate : 0;
      const overtimePay = isHourly && ts ? ts.ot * rate * 1.5 : 0;
      const c = isCommission ? (commByAgent.get(s.employee_id) || { ids: [], gross: 0, lines: [] }) : { ids: [], gross: 0, lines: [] as CommLine[] };
      const adj = adjByEmp.get(s.employee_id) || [];
      const earningAdj = adj.filter((a) => !["deduction", "advance"].includes(a.adjustment_type));
      const deductionAdj = adj.filter((a) => ["deduction", "advance"].includes(a.adjustment_type));
      const taxAdj = earningAdj.filter((a) => a.is_taxable).reduce((sum, a) => sum + a.amount, 0);
      const ntAdj = earningAdj.filter((a) => !a.is_taxable).reduce((sum, a) => sum + a.amount, 0);
      const manualDeductions = deductionAdj.reduce((sum, a) => sum + Math.abs(a.amount), 0);
      const pendingBonus = Number(body.bonus_overrides?.[s.employee_id] || 0);

      const totalSource = regularPay + overtimePay + c.gross + taxAdj + ntAdj + manualDeductions + pendingBonus;
      if (totalSource === 0 && !previewEmployeeId) continue; // skip employees with nothing to pay

      bundle.set(s.employee_id, {
        settings: s,
        commissionIds: c.ids,
        commissionGross: c.gross,
        commissionLines: c.lines,
        regularPay,
        overtimePay,
        taxableAdjustments: taxAdj,
        nonTaxableAdjustments: ntAdj,
        manualDeductions,
        adjustmentIds: adj.map((a) => a.id),
        adjustmentLines: adj,
      });
    }

    // ─── Single-employee paystub preview (returns base64 PDF) ───
    if (previewEmployeeId) {
      const b = bundle.get(previewEmployeeId);
      if (!b) {
        return new Response(JSON.stringify({ error: "Aucune donnée payable pour cet employé." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: profile } = await supabase
        .from("profiles").select("user_id, full_name, email, agent_number")
        .eq("user_id", previewEmployeeId).maybeSingle();
      const fedBrackets = await getBrackets("tax_brackets_federal", year);
      const qcBrackets = await getBrackets("tax_brackets_quebec", year);
      const eff: DeductionSettings = {
        federal_claim_amount: Number(b.settings.federal_claim_amount ?? FED_BPA_DEFAULT),
        quebec_claim_amount: Number(b.settings.quebec_claim_amount ?? QC_BPA_DEFAULT),
        disability_insurance_rate: Number(b.settings.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT),
      };
      const bonus = Number(body.bonus_overrides?.[previewEmployeeId] || 0);
      const taxableGross = round2(b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments + bonus);
      const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);
      const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
      const totalDeductions = round2(ded.total_deductions + b.manualDeductions);
      const netPay = round2(totalGrossAgent - totalDeductions);
      const prevYtd = await fetchYtd(previewEmployeeId, year);
      const hRate = Number(b.settings.hourly_rate || 0);
      const hReg = (tsByEmp.get(previewEmployeeId)?.reg || 0);
      const hOt = (tsByEmp.get(previewEmployeeId)?.ot || 0);
      const pdf = buildPaystubPdf({
        paystub_number: `APERÇU-${previewEmployeeId.slice(0, 6)}`,
        pay_date: payDate,
        period_start: pStart.toISOString().slice(0, 10),
        period_end: pEnd.toISOString().slice(0, 10),
        employee_name: profile?.full_name || profile?.email || "Employé",
        employee_email: profile?.email ?? null,
        agent_number: profile?.agent_number ?? null,
        employee_role: b.settings.employee_role ?? null,
        payment_method: b.settings.payment_method ?? "interac",
        commission_gross: round2(b.commissionGross),
        regular_hours_pay: round2(b.regularPay),
        overtime_hours_pay: round2(b.overtimePay),
        hours_regular: hReg, hours_overtime: hOt, hourly_rate: hRate,
        allocation_total: round2(b.taxableAdjustments + b.nonTaxableAdjustments),
        bonus_amount: round2(bonus),
        total_gross: totalGrossAgent,
        commission_lines: b.commissionLines.map((c) => ({
          label: c.order_id ? `Commande ${String(c.order_id).slice(0, 8)}` : (c.commission_type || "Commission"),
          detail: [c.description, c.earned_at ? new Date(c.earned_at).toLocaleDateString("fr-CA") : null].filter(Boolean).join(" · ") || null,
          amount: c.amount,
        })),
        adjustment_lines: b.adjustmentLines.filter((a) => !["deduction", "advance"].includes(a.adjustment_type)).map((a) => ({
          label: adjLabel(a.adjustment_type),
          detail: a.description + (a.is_taxable ? "" : " (non imposable)"),
          amount: a.amount,
        })),
        manual_deduction_lines: b.adjustmentLines.filter((a) => ["deduction", "advance"].includes(a.adjustment_type)).map((a) => ({
          label: adjLabel(a.adjustment_type),
          detail: a.description,
          amount: Math.abs(a.amount),
        })),
        federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
        rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
        disability_insurance: ded.disability_insurance,
        manual_deductions: round2(b.manualDeductions),
        total_deductions: totalDeductions,
        net_pay: netPay,
        ytd_gross: round2(prevYtd.ytd_gross + totalGrossAgent),
        ytd_deductions: round2(prevYtd.ytd_deductions + totalDeductions),
        ytd_net: round2(prevYtd.ytd_net + netPay),
      });
      // base64 encode
      let binary = "";
      for (let i = 0; i < pdf.length; i++) binary += String.fromCharCode(pdf[i]);
      const b64 = btoa(binary);
      return new Response(JSON.stringify({ preview: true, pdf_base64: b64, filename: `apercu-paie-${previewEmployeeId.slice(0,6)}.pdf` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (dryRun) {
      const employees: Array<Record<string, unknown>> = [];
      const fedBrackets = await getBrackets("tax_brackets_federal", year);
      const qcBrackets = await getBrackets("tax_brackets_quebec", year);
      for (const [empId, b] of bundle.entries()) {
        const eff: DeductionSettings = {
          federal_claim_amount: Number(b.settings.federal_claim_amount ?? FED_BPA_DEFAULT),
          quebec_claim_amount: Number(b.settings.quebec_claim_amount ?? QC_BPA_DEFAULT),
          disability_insurance_rate: Number(b.settings.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT),
        };
        const bonus = Number(body.bonus_overrides?.[empId] || 0);
        const taxableGross = b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments + bonus;
        const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);
        const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
        const totalDeductions = round2(ded.total_deductions + b.manualDeductions);
        employees.push({ employee_id: empId, gross: totalGrossAgent, bonus: round2(bonus), manual_deductions: round2(b.manualDeductions), ...ded, total_deductions: totalDeductions, net_pay: round2(totalGrossAgent - totalDeductions) });
      }
      const totalGross = round2(employees.reduce((s, e: any) => s + Number(e.gross || 0), 0));
      const totalDed = round2(employees.reduce((s, e: any) => s + Number(e.total_deductions || 0), 0));
      const totalNet = round2(employees.reduce((s, e: any) => s + Number(e.net_pay || 0), 0));
      return new Response(JSON.stringify({
        dry_run: true, cutoff: cutoff.toISOString(), pay_date: payDate,
        employee_count: employees.length, total_gross: totalGross,
        total_deductions: totalDed, total_net: totalNet, employees,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (bundle.size === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Aucun montant à traiter pour cette période.", employee_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. Create run
    const runNumber = `PAY-${payDate.replace(/-/g, "")}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({
        run_number: runNumber, pay_date: payDate,
        period_start: pStart.toISOString(), period_end: pEnd.toISOString(),
        cutoff_date: cutoff.toISOString(), is_last_friday_of_month: lastFriday,
        status: "processing", processed_by: processedBy, processed_at: new Date().toISOString(),
      })
      .select("*").single();
    if (runErr) throw runErr;

    const fedBrackets = await getBrackets("tax_brackets_federal", year);
    const qcBrackets = await getBrackets("tax_brackets_quebec", year);

    let totalGross = 0, totalDed = 0, totalNet = 0, totalBonus = 0;

    for (const [empId, b] of bundle.entries()) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, agent_number")
        .eq("user_id", empId)
        .maybeSingle();

      const eff: DeductionSettings = {
        federal_claim_amount: Number(b.settings.federal_claim_amount ?? FED_BPA_DEFAULT),
        quebec_claim_amount: Number(b.settings.quebec_claim_amount ?? QC_BPA_DEFAULT),
        disability_insurance_rate: Number(b.settings.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT),
      };
      const paymentMethod = b.settings.payment_method ?? "interac";

      const bonus = Number(body.bonus_overrides?.[empId] || 0);
      const taxableGross = round2(b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments + bonus);
      const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);

      const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
      const totalDeductions = round2(ded.total_deductions + b.manualDeductions);
      const netPay = round2(totalGrossAgent - totalDeductions);
      const prevYtd = await fetchYtd(empId, year);

      const ytd_gross = round2(prevYtd.ytd_gross + totalGrossAgent);
      const ytd_federal_tax = round2(prevYtd.ytd_federal_tax + ded.federal_tax);
      const ytd_quebec_tax = round2(prevYtd.ytd_quebec_tax + ded.quebec_tax);
      const ytd_rrq = round2(prevYtd.ytd_rrq + ded.rrq);
      const ytd_ae = round2(prevYtd.ytd_ae + ded.ae);
      const ytd_rqap = round2(prevYtd.ytd_rqap + ded.rqap);
      const ytd_disability = round2(prevYtd.ytd_disability + ded.disability_insurance);
      const ytd_net = round2(prevYtd.ytd_net + netPay);

      const hReg = (tsByEmp.get(empId)?.reg || 0);
      const hOt = (tsByEmp.get(empId)?.ot || 0);
      const hRate = Number(b.settings.hourly_rate || 0);
      const commissionBreakdown = b.commissionLines.map((c) => ({
        id: c.id,
        label: c.order_id ? `Commande ${String(c.order_id).slice(0, 8)}` : (c.commission_type || "Commission"),
        description: c.description,
        earned_at: c.earned_at,
        order_id: c.order_id,
        amount: round2(c.amount),
      }));
      const earningAdjustments = b.adjustmentLines.filter((a) => !["deduction", "advance"].includes(a.adjustment_type));
      const deductionAdjustments = b.adjustmentLines.filter((a) => ["deduction", "advance"].includes(a.adjustment_type));
      const earningsBreakdown = [
        ...(b.regularPay > 0 ? [{ label: "Heures régulières", detail: `${round2(hReg)} h × ${round2(hRate)} $/h`, amount: round2(b.regularPay), category: "hours" }] : []),
        ...(b.overtimePay > 0 ? [{ label: "Heures supplémentaires", detail: `${round2(hOt)} h × ${round2(hRate * 1.5)} $/h`, amount: round2(b.overtimePay), category: "overtime" }] : []),
        ...(b.commissionGross > 0 ? [{ label: "Commissions", detail: `${b.commissionLines.length} commission(s) payée(s)`, amount: round2(b.commissionGross), category: "commission" }] : []),
        ...(bonus > 0 ? [{ label: "Bonus ponctuel", detail: "Ajout manuel RH", amount: round2(bonus), category: "bonus" }] : []),
        ...earningAdjustments.map((a) => ({ label: adjLabel(a.adjustment_type), detail: `${a.description}${a.is_taxable ? "" : " (non imposable)"}`, amount: round2(a.amount), category: a.adjustment_type })),
      ];
      const deductionBreakdown = makeDeductionBreakdown(ded, b.manualDeductions, deductionAdjustments);

      const { data: entry, error: entryErr } = await supabase
        .from("payroll_entries")
        .insert({
          run_id: run.id, user_id: empId, employee_id: empId,
          agent_number: profile?.agent_number ?? null,
          base_salary: round2(b.regularPay + b.overtimePay),
          commission_total: round2(b.commissionGross),
          bonus_total: round2(bonus),
          commission_gross: round2(b.commissionGross),
          bonus_amount: round2(bonus),
          hours_worked: round2(hReg),
          overtime_hours: round2(hOt),
          total_gross: totalGrossAgent,
          gross_pay: totalGrossAgent,
          federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
          rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
          disability_insurance: ded.disability_insurance,
          deductions_total: totalDeductions,
          total_deductions: totalDeductions,
          net_pay: netPay,
          payment_method: paymentMethod, payment_status: "paid", paid_at: new Date().toISOString(),
          taxable_gross: taxableGross,
          non_taxable_gross: round2(b.nonTaxableAdjustments),
          manual_deductions: round2(b.manualDeductions),
          earnings_breakdown: earningsBreakdown,
          deduction_breakdown: deductionBreakdown,
          commission_breakdown: commissionBreakdown,
          adjustment_breakdown: b.adjustmentLines.map((a) => ({ id: a.id, type: a.adjustment_type, label: adjLabel(a.adjustment_type), description: a.description, amount: round2(a.amount), taxable: a.is_taxable })),
          ytd_gross, ytd_federal_tax, ytd_quebec_tax, ytd_rrq, ytd_ae, ytd_rqap, ytd_disability, ytd_net,
          commission_ids: b.commissionIds,
          status: "approved",
          payroll_number: `${runNumber}-${(profile?.agent_number || empId).slice(0, 6)}`,
        } as any)
        .select("*").single();
      if (entryErr) { console.error("[process-payroll] insert entry failed:", entryErr.message); continue; }

      const pdf = buildPaystubPdf({
        paystub_number: entry.payroll_number, pay_date: payDate,
        period_start: pStart.toISOString().slice(0, 10),
        period_end: pEnd.toISOString().slice(0, 10),
        employee_name: profile?.full_name || profile?.email || "Employé",
        employee_email: profile?.email ?? null,
        agent_number: profile?.agent_number ?? null,
        employee_role: b.settings.employee_role ?? null,
        payment_method: paymentMethod,
        commission_gross: round2(b.commissionGross),
        regular_hours_pay: round2(b.regularPay),
        overtime_hours_pay: round2(b.overtimePay),
        hours_regular: hReg, hours_overtime: hOt, hourly_rate: hRate,
        allocation_total: round2(b.taxableAdjustments + b.nonTaxableAdjustments),
        bonus_amount: round2(bonus),
        total_gross: totalGrossAgent,
        commission_lines: b.commissionLines.map((c) => ({
          label: c.order_id ? `Commande ${String(c.order_id).slice(0, 8)}` : (c.commission_type || "Commission"),
          detail: [c.description, c.earned_at ? new Date(c.earned_at).toLocaleDateString("fr-CA") : null].filter(Boolean).join(" · ") || null,
          amount: c.amount,
        })),
        adjustment_lines: b.adjustmentLines.filter((a) => !["deduction", "advance"].includes(a.adjustment_type)).map((a) => ({
          label: adjLabel(a.adjustment_type),
          detail: a.description + (a.is_taxable ? "" : " (non imposable)"),
          amount: a.amount,
        })),
        manual_deduction_lines: b.adjustmentLines.filter((a) => ["deduction", "advance"].includes(a.adjustment_type)).map((a) => ({
          label: adjLabel(a.adjustment_type),
          detail: a.description,
          amount: Math.abs(a.amount),
        })),
        federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
        rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
        disability_insurance: ded.disability_insurance,
        manual_deductions: round2(b.manualDeductions),
        total_deductions: totalDeductions,
        net_pay: netPay,
        ytd_gross,
        ytd_deductions: round2(prevYtd.ytd_deductions + totalDeductions),
        ytd_net,
      });
      const uploadedPdf = await uploadPaystubPdf(pdf, run.id, empId);
      if (uploadedPdf) await supabase.from("payroll_entries").update({ paystub_pdf_url: uploadedPdf.path, pdf_url: uploadedPdf.path }).eq("id", entry.id);

      if (b.commissionIds.length) {
        await supabase.from("payroll_commission_links").upsert(
          b.commissionLines.map((c) => ({ payroll_entry_id: entry.id, commission_id: c.id, commission_source: "field", amount: c.amount })),
          { onConflict: "commission_id,commission_source" },
        );
      }

      // Flip commissions to paid + record which run/entry paid them
      if (b.commissionIds.length) {
        await supabase.from("field_commissions")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_in_run_id: run.id,
            paid_in_entry_id: entry.id,
          })
          .in("id", b.commissionIds);
      }
      // Attach adjustments to this run
      if (b.adjustmentIds.length) {
        await supabase.from("pay_adjustments")
          .update({ payroll_run_id: run.id })
          .in("id", b.adjustmentIds);
      }
      // Mark this employee's timesheet for the period as approved (idempotent)
      await supabase.from("timesheet_entries")
        .update({ status: "approved" })
        .eq("employee_id", empId)
        .eq("pay_period_start", periodStartStr);

      if (profile?.email) {
        const emailResult = await enqueuePaystubEmail(profile.email, {
          agent_name: profile.full_name || profile.email,
          agent_number: profile.agent_number || "—",
          period_start: pStart.toISOString().slice(0, 10),
          period_end: pEnd.toISOString().slice(0, 10),
          pay_date: payDate,
          regular_hours_pay: round2(b.regularPay),
          overtime_hours_pay: round2(b.overtimePay),
          commission_gross: round2(b.commissionGross),
          bonus_amount: round2(bonus),
          allocation_total: round2(b.taxableAdjustments + b.nonTaxableAdjustments),
          total_gross: totalGrossAgent,
          federal_tax: ded.federal_tax,
          quebec_tax: ded.quebec_tax,
          rrq: ded.rrq,
          ae: ded.ae,
          rqap: ded.rqap,
          disability_insurance: ded.disability_insurance,
          manual_deductions: round2(b.manualDeductions),
          total_deductions: totalDeductions,
          net_pay: netPay,
          payment_method: paymentMethod,
          payroll_number: entry.payroll_number,
          paystub_url: uploadedPdf?.signedUrl,
          portal_url: "https://nivra-telecom.ca/field/profile",
        }, pdf, entry.id);
        await supabase.from("payroll_entries").update({
          email_status: emailResult.ok ? "sent" : "failed",
          emailed_at: emailResult.ok ? new Date().toISOString() : null,
          email_last_error: emailResult.error ?? null,
        } as any).eq("id", entry.id);
      } else {
        await supabase.from("payroll_entries").update({
          email_status: "failed",
          email_last_error: "Aucun courriel employé.",
        } as any).eq("id", entry.id);
      }
      await notifyPayrollReady(
        empId,
        netPay,
        `du ${pStart.toISOString().slice(0, 10)} au ${pEnd.toISOString().slice(0, 10)}`,
        uploadedPdf?.signedUrl ?? null,
      );

      totalGross += totalGrossAgent;
      totalDed += totalDeductions;
      totalNet += netPay;
      totalBonus += bonus;
    }

    await supabase.from("payroll_runs").update({
      total_gross: round2(totalGross),
      total_deductions: round2(totalDed),
      total_net: round2(totalNet),
      total_bonus: round2(totalBonus),
      employee_count: bundle.size,
      status: "completed",
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      ok: true, run_id: run.id, run_number: runNumber, employee_count: bundle.size,
      total_gross: round2(totalGross), total_deductions: round2(totalDed), total_net: round2(totalNet),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[process-payroll] error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
