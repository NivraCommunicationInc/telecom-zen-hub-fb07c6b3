/**
 * process-payroll — Friday weekly payroll engine.
 *
 * - Cutoff = previous Thursday 18:00 EST (or as provided).
 * - Pulls all field_commissions (status=approved, earned_at<=cutoff).
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

    const now = new Date();
    const cutoff = explicitCutoff ?? lastThursdayCutoffUTC(now);
    const pStart = periodStart(cutoff);
    const pEnd = cutoff;
    const payDate = nextFridayPayDate(cutoff);
    const lastFriday = isLastFridayOfMonth(payDate);
    const year = new Date(payDate).getUTCFullYear();

    // 1. approved commissions before cutoff
    const { data: approved, error: cmErr } = await supabase
      .from("field_commissions")
      .select("id, agent_id, amount, commission_type")
      .eq("status", "approved")
      .lte("earned_at", cutoff.toISOString());

    if (cmErr) throw cmErr;

    const byAgent = new Map<string, { ids: string[]; gross: number }>();
    for (const c of approved ?? []) {
      const entry = byAgent.get(c.agent_id) || { ids: [], gross: 0 };
      entry.ids.push(c.id);
      entry.gross += Number(c.amount || 0);
      byAgent.set(c.agent_id, entry);
    }

    if (dryRun) {
      const employees: Array<Record<string, unknown>> = [];
      const fedBrackets = await getBrackets("tax_brackets_federal", year);
      const qcBrackets = await getBrackets("tax_brackets_quebec", year);

      for (const [agentId, { ids, gross }] of byAgent.entries()) {
        const { data: settings } = await supabase
          .from("employee_payroll_settings")
          .select("federal_claim_amount, quebec_claim_amount, disability_insurance_rate, payment_method")
          .eq("employee_id", agentId)
          .maybeSingle();
        const eff: DeductionSettings = {
          federal_claim_amount: Number(settings?.federal_claim_amount ?? FED_BPA_DEFAULT),
          quebec_claim_amount: Number(settings?.quebec_claim_amount ?? QC_BPA_DEFAULT),
          disability_insurance_rate: Number(settings?.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT),
        };
        const ded = await calculateDeductions(gross, eff, fedBrackets, qcBrackets);
        employees.push({ agent_id: agentId, commission_ids: ids, gross: round2(gross), ...ded });
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

    if (byAgent.size === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No approved commissions to process.", employee_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Create run
    const runNumber = `PAY-${payDate.replace(/-/g, "")}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({
        run_number: runNumber,
        pay_date: payDate,
        period_start: pStart.toISOString(),
        period_end: pEnd.toISOString(),
        cutoff_date: cutoff.toISOString(),
        is_last_friday_of_month: lastFriday,
        status: "processing",
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (runErr) throw runErr;

    const fedBrackets = await getBrackets("tax_brackets_federal", year);
    const qcBrackets = await getBrackets("tax_brackets_quebec", year);

    let totalGross = 0, totalDed = 0, totalNet = 0, totalBonus = 0;

    for (const [agentId, { ids, gross }] of byAgent.entries()) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, agent_number")
        .eq("user_id", agentId)
        .maybeSingle();

      const { data: settings } = await supabase
        .from("employee_payroll_settings")
        .select("federal_claim_amount, quebec_claim_amount, disability_insurance_rate, payment_method")
        .eq("employee_id", agentId)
        .maybeSingle();

      const eff: DeductionSettings = {
        federal_claim_amount: Number(settings?.federal_claim_amount ?? FED_BPA_DEFAULT),
        quebec_claim_amount: Number(settings?.quebec_claim_amount ?? QC_BPA_DEFAULT),
        disability_insurance_rate: Number(settings?.disability_insurance_rate ?? DISABILITY_RATE_DEFAULT),
      };
      const paymentMethod = settings?.payment_method ?? "interac";

      // Bonus (monthly last-friday tier) — currently 0 unless caller passes via body.bonus_overrides[agent_id]
      const bonus = lastFriday ? Number(body.bonus_overrides?.[agentId] || 0) : 0;
      const totalGrossAgent = round2(gross + bonus);

      const ded = await calculateDeductions(totalGrossAgent, eff, fedBrackets, qcBrackets);
      const prevYtd = await fetchYtd(agentId, year);

      const ytd_gross = round2(prevYtd.ytd_gross + totalGrossAgent);
      const ytd_federal_tax = round2(prevYtd.ytd_federal_tax + ded.federal_tax);
      const ytd_quebec_tax = round2(prevYtd.ytd_quebec_tax + ded.quebec_tax);
      const ytd_rrq = round2(prevYtd.ytd_rrq + ded.rrq);
      const ytd_ae = round2(prevYtd.ytd_ae + ded.ae);
      const ytd_rqap = round2(prevYtd.ytd_rqap + ded.rqap);
      const ytd_disability = round2(prevYtd.ytd_disability + ded.disability_insurance);
      const ytd_net = round2(prevYtd.ytd_net + ded.net_pay);

      const { data: entry, error: entryErr } = await supabase
        .from("payroll_entries")
        .insert({
          run_id: run.id,
          user_id: agentId,
          employee_id: agentId,
          agent_number: profile?.agent_number ?? null,
          commission_gross: round2(gross),
          bonus_amount: round2(bonus),
          total_gross: totalGrossAgent,
          gross_pay: totalGrossAgent,
          federal_tax: ded.federal_tax,
          quebec_tax: ded.quebec_tax,
          rrq: ded.rrq,
          ae: ded.ae,
          rqap: ded.rqap,
          disability_insurance: ded.disability_insurance,
          total_deductions: ded.total_deductions,
          deductions_total: ded.total_deductions,
          net_pay: ded.net_pay,
          payment_method: paymentMethod,
          payment_status: "processing",
          ytd_gross, ytd_federal_tax, ytd_quebec_tax, ytd_rrq, ytd_ae, ytd_rqap, ytd_disability, ytd_net,
          commission_ids: ids,
          status: "approved",
          payroll_number: `${runNumber}-${(profile?.agent_number || agentId).slice(0, 6)}`,
        })
        .select("*")
        .single();
      if (entryErr) {
        console.error("[process-payroll] insert entry failed:", entryErr.message);
        continue;
      }

      // Generate PDF + upload
      const pdf = buildPaystubPdf({
        paystub_number: entry.payroll_number,
        pay_date: payDate,
        period_start: pStart.toISOString().slice(0, 10),
        period_end: pEnd.toISOString().slice(0, 10),
        employee_name: profile?.full_name || profile?.email || "Employé",
        agent_number: profile?.agent_number ?? null,
        payment_method: paymentMethod,
        commission_gross: round2(gross),
        bonus_amount: round2(bonus),
        total_gross: totalGrossAgent,
        federal_tax: ded.federal_tax,
        quebec_tax: ded.quebec_tax,
        rrq: ded.rrq,
        ae: ded.ae,
        rqap: ded.rqap,
        disability_insurance: ded.disability_insurance,
        total_deductions: ded.total_deductions,
        net_pay: ded.net_pay,
        ytd_gross,
        ytd_deductions: round2(ytd_federal_tax + ytd_quebec_tax + ytd_rrq + ytd_ae + ytd_rqap + ytd_disability),
        ytd_net,
      });
      const pdfUrl = await uploadPaystubPdf(pdf, run.id, agentId);
      if (pdfUrl) {
        await supabase.from("payroll_entries").update({ paystub_pdf_url: pdfUrl, pdf_url: pdfUrl }).eq("id", entry.id);
      }

      // Flip commissions to paid
      if (ids.length) {
        await supabase.from("field_commissions")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .in("id", ids);
      }

      // Enqueue email
      if (profile?.email) {
        await enqueuePaystubEmail(profile.email, {
          agent_name: profile.full_name || profile.email,
          agent_number: profile.agent_number || "—",
          period_start: pStart.toISOString().slice(0, 10),
          period_end: pEnd.toISOString().slice(0, 10),
          pay_date: payDate,
          commission_gross: round2(gross),
          bonus_amount: round2(bonus),
          total_gross: totalGrossAgent,
          total_deductions: ded.total_deductions,
          net_pay: ded.net_pay,
          payment_method: paymentMethod,
          paystub_url: pdfUrl,
          portal_url: "https://nivra-telecom.ca/field/profile",
        });
      }

      totalGross += totalGrossAgent;
      totalDed += ded.total_deductions;
      totalNet += ded.net_pay;
      totalBonus += bonus;
    }

    await supabase.from("payroll_runs").update({
      total_gross: round2(totalGross),
      total_deductions: round2(totalDed),
      total_net: round2(totalNet),
      total_bonus: round2(totalBonus),
      employee_count: byAgent.size,
      status: "completed",
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      ok: true, run_id: run.id, run_number: runNumber, employee_count: byAgent.size,
      total_gross: round2(totalGross), total_deductions: round2(totalDed), total_net: round2(totalNet),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[process-payroll] error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
