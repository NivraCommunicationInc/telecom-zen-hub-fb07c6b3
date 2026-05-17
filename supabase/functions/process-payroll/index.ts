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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────── Constants 2026 ───────────
const PAY_PERIODS_BIWEEKLY = 26;
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
  const taxable = Math.max(0, annualIncome - claimAmount);
  for (const b of brackets) {
    const max = b.max_income ?? Infinity;
    if (taxable > Number(b.min_income) && taxable <= max) {
      return taxable * Number(b.rate) - Number(b.constant ?? 0);
    }
  }
  // Above highest bracket — use last
  const last = brackets[brackets.length - 1];
  if (!last) return 0;
  return taxable * Number(last.rate) - Number(last.constant ?? 0);
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
  const annualGross = grossPay * PAY_PERIODS_BIWEEKLY;

  const federalAnnual = Math.max(0, bracketTax(annualGross, fedBrackets, settings.federal_claim_amount));
  const quebecAnnual = Math.max(0, bracketTax(annualGross, qcBrackets, settings.quebec_claim_amount));
  const federal_tax = federalAnnual / PAY_PERIODS_BIWEEKLY;
  const quebec_tax = quebecAnnual / PAY_PERIODS_BIWEEKLY;

  const rrqAnnual = Math.min(
    Math.max(0, annualGross - RRQ_BASIC_EXEMPTION) * RRQ_RATE,
    (RRQ_MAX_PENSIONABLE - RRQ_BASIC_EXEMPTION) * RRQ_RATE,
  );
  const rrq = rrqAnnual / PAY_PERIODS_BIWEEKLY;

  const aeAnnual = Math.min(annualGross * AE_RATE, AE_MAX_INSURABLE * AE_RATE);
  const ae = aeAnnual / PAY_PERIODS_BIWEEKLY;

  const rqapAnnual = Math.min(annualGross * RQAP_RATE, RQAP_MAX_INSURABLE * RQAP_RATE);
  const rqap = rqapAnnual / PAY_PERIODS_BIWEEKLY;

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
    .select("total_gross, federal_tax, quebec_tax, rrq, ae, rqap, disability_insurance, net_pay")
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
    ytd_net: round2(rows.reduce((s, r) => s + Number(r.net_pay || 0), 0)),
  };
}

async function uploadPaystubPdf(pdf: Uint8Array, runId: string, employeeId: string): Promise<string | null> {
  const path = `paystubs/${runId}/${employeeId}.pdf`;
  const { error } = await supabase.storage.from("documents").upload(path, pdf, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    console.error("[process-payroll] upload paystub failed:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("documents").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

async function enqueuePaystubEmail(toEmail: string, vars: Record<string, unknown>) {
  if (!toEmail) return;
  try {
    await supabase.from("email_queue").insert({
      template_key: "paystub_notification",
      to_email: toEmail,
      vars,
      status: "queued",
    });
  } catch (e) {
    console.error("[process-payroll] enqueue email failed:", e);
  }
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
      .select("id, agent_id, amount, commission_type, description, earned_at, order_id")
      .eq("status", "approved");
    if (cmErr) throw cmErr;
    const approved = (approvedRaw ?? []).filter((c: any) => !excludedCommissionIds.has(c.id));

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
    type AdjLine = { id: string; amount: number; is_taxable: boolean; adjustment_type: string; description: string };
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
      const taxAdj = adj.filter((a) => a.is_taxable).reduce((sum, a) => sum + a.amount, 0);
      const ntAdj = adj.filter((a) => !a.is_taxable).reduce((sum, a) => sum + a.amount, 0);

      const totalSource = regularPay + overtimePay + c.gross + taxAdj + ntAdj;
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
      const bonus = lastFriday ? Number(body.bonus_overrides?.[previewEmployeeId] || 0) : 0;
      const taxableGross = round2(b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments + bonus);
      const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);
      const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
      const netPay = round2(totalGrossAgent - ded.total_deductions);
      const prevYtd = await fetchYtd(previewEmployeeId, year);
      const pdf = buildPaystubPdf({
        paystub_number: `APERÇU-${previewEmployeeId.slice(0, 6)}`,
        pay_date: payDate,
        period_start: pStart.toISOString().slice(0, 10),
        period_end: pEnd.toISOString().slice(0, 10),
        employee_name: profile?.full_name || profile?.email || "Employé",
        agent_number: profile?.agent_number ?? null,
        employee_role: b.settings.employee_role ?? null,
        payment_method: b.settings.payment_method ?? "interac",
        commission_gross: round2(b.commissionGross),
        regular_hours_pay: round2(b.regularPay),
        overtime_hours_pay: round2(b.overtimePay),
        allocation_total: round2(b.taxableAdjustments + b.nonTaxableAdjustments),
        bonus_amount: round2(bonus),
        total_gross: totalGrossAgent,
        federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
        rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
        disability_insurance: ded.disability_insurance,
        total_deductions: ded.total_deductions,
        net_pay: netPay,
        ytd_gross: round2(prevYtd.ytd_gross + totalGrossAgent),
        ytd_deductions: round2(prevYtd.ytd_federal_tax + prevYtd.ytd_quebec_tax + prevYtd.ytd_rrq + prevYtd.ytd_ae + prevYtd.ytd_rqap + prevYtd.ytd_disability + ded.total_deductions),
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
        const taxableGross = b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments;
        const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);
        const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
        employees.push({ employee_id: empId, gross: totalGrossAgent, ...ded, net_pay: round2(totalGrossAgent - ded.total_deductions) });
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

      const bonus = lastFriday ? Number(body.bonus_overrides?.[empId] || 0) : 0;
      const taxableGross = round2(b.regularPay + b.overtimePay + b.commissionGross + b.taxableAdjustments + bonus);
      const totalGrossAgent = round2(taxableGross + b.nonTaxableAdjustments);

      const ded = await calculateDeductions(taxableGross, eff, fedBrackets, qcBrackets);
      const netPay = round2(totalGrossAgent - ded.total_deductions);
      const prevYtd = await fetchYtd(empId, year);

      const ytd_gross = round2(prevYtd.ytd_gross + totalGrossAgent);
      const ytd_federal_tax = round2(prevYtd.ytd_federal_tax + ded.federal_tax);
      const ytd_quebec_tax = round2(prevYtd.ytd_quebec_tax + ded.quebec_tax);
      const ytd_rrq = round2(prevYtd.ytd_rrq + ded.rrq);
      const ytd_ae = round2(prevYtd.ytd_ae + ded.ae);
      const ytd_rqap = round2(prevYtd.ytd_rqap + ded.rqap);
      const ytd_disability = round2(prevYtd.ytd_disability + ded.disability_insurance);
      const ytd_net = round2(prevYtd.ytd_net + netPay);

      const { data: entry, error: entryErr } = await supabase
        .from("payroll_entries")
        .insert({
          run_id: run.id, user_id: empId, employee_id: empId,
          agent_number: profile?.agent_number ?? null,
          commission_gross: round2(b.commissionGross),
          bonus_amount: round2(bonus),
          hours_worked: round2((tsByEmp.get(empId)?.reg || 0)),
          overtime_hours: round2((tsByEmp.get(empId)?.ot || 0)),
          total_gross: totalGrossAgent,
          gross_pay: totalGrossAgent,
          federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
          rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
          disability_insurance: ded.disability_insurance,
          deductions_total: ded.total_deductions,
          net_pay: netPay,
          payment_method: paymentMethod, payment_status: "processing",
          ytd_gross, ytd_federal_tax, ytd_quebec_tax, ytd_rrq, ytd_ae, ytd_rqap, ytd_disability, ytd_net,
          commission_ids: b.commissionIds,
          status: "approved",
          payroll_number: `${runNumber}-${(profile?.agent_number || empId).slice(0, 6)}`,
        })
        .select("*").single();
      if (entryErr) { console.error("[process-payroll] insert entry failed:", entryErr.message); continue; }

      const pdf = buildPaystubPdf({
        paystub_number: entry.payroll_number, pay_date: payDate,
        period_start: pStart.toISOString().slice(0, 10),
        period_end: pEnd.toISOString().slice(0, 10),
        employee_name: profile?.full_name || profile?.email || "Employé",
        agent_number: profile?.agent_number ?? null,
        employee_role: b.settings.employee_role ?? null,
        payment_method: paymentMethod,
        commission_gross: round2(b.commissionGross),
        regular_hours_pay: round2(b.regularPay),
        overtime_hours_pay: round2(b.overtimePay),
        allocation_total: round2(b.taxableAdjustments + b.nonTaxableAdjustments),
        bonus_amount: round2(bonus),
        total_gross: totalGrossAgent,
        federal_tax: ded.federal_tax, quebec_tax: ded.quebec_tax,
        rrq: ded.rrq, ae: ded.ae, rqap: ded.rqap,
        disability_insurance: ded.disability_insurance,
        total_deductions: ded.total_deductions,
        net_pay: netPay,
        ytd_gross,
        ytd_deductions: round2(ytd_federal_tax + ytd_quebec_tax + ytd_rrq + ytd_ae + ytd_rqap + ytd_disability),
        ytd_net,
      });
      const pdfUrl = await uploadPaystubPdf(pdf, run.id, empId);
      if (pdfUrl) await supabase.from("payroll_entries").update({ paystub_pdf_url: pdfUrl, pdf_url: pdfUrl }).eq("id", entry.id);

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
        await enqueuePaystubEmail(profile.email, {
          agent_name: profile.full_name || profile.email,
          agent_number: profile.agent_number || "—",
          period_start: pStart.toISOString().slice(0, 10),
          period_end: pEnd.toISOString().slice(0, 10),
          pay_date: payDate,
          commission_gross: round2(b.commissionGross),
          bonus_amount: round2(bonus),
          total_gross: totalGrossAgent,
          total_deductions: ded.total_deductions,
          net_pay: netPay,
          payment_method: paymentMethod,
          paystub_url: pdfUrl,
          portal_url: "https://nivra-telecom.ca/field/profile",
        });
      }

      totalGross += totalGrossAgent;
      totalDed += ded.total_deductions;
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
