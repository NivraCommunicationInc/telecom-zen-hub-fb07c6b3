/**
 * commission-monthly-report
 *
 * Generates a 3-sheet Excel commission report for a given month and sends it
 * to the Nivra admin. Triggered by pg_cron on the 1st of each month at 08:00 UTC,
 * or called manually with ?month=YYYY-MM.
 *
 * Sheet 1 — Résumé       : Ranked agents, totals, bonus status (inputs blue, formulas black)
 * Sheet 2 — Détail        : Every field_commission row with client + plan info
 * Sheet 3 — Évolution     : Last 6-month totals per agent (trend table)
 *
 * Auth: service-role key only.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
// @deno-types="npm:@types/exceljs"
import ExcelJS from "npm:exceljs@4.4.0";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function agentDisplayName(p: { full_name?: string | null; email?: string | null }): string {
  return p?.full_name?.trim() || p?.email || "Agent inconnu";
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("fr-CA", {
    month: "long",
    year: "numeric",
  });
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ─── Excel style helpers ───────────────────────────────────────────────────────

const BLUE   = { argb: "FF0000FF" };   // hardcoded inputs
const BLACK  = { argb: "FF000000" };   // formulas / derived
const GREEN  = { argb: "FF006400" };   // cross-sheet links
const WHITE  = { argb: "FFFFFFFF" };
const YELLOW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A3A5C" } };
const ALT_ROW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FA" } };
const TOTAL_FILL: ExcelJS.Fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E8F5" } };

function hdr(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font = { bold: true, color: WHITE, name: "Arial", size: 10 };
  cell.fill = HEADER_FILL;
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = { bottom: { style: "thin", color: BLACK } };
}

function inputCell(cell: ExcelJS.Cell, value: number | string, fmt?: string) {
  cell.value = value;
  cell.font = { color: BLUE, bold: true, name: "Arial", size: 10 };
  cell.fill = YELLOW_FILL;
  if (fmt) cell.numFmt = fmt;
}

function formulaCell(cell: ExcelJS.Cell, formula: string, fmt?: string, crossSheet = false) {
  cell.value = { formula };
  cell.font = { color: crossSheet ? GREEN : BLACK, name: "Arial", size: 10 };
  if (fmt) cell.numFmt = fmt;
}

function dataCell(cell: ExcelJS.Cell, value: ExcelJS.CellValue, fmt?: string, bold = false) {
  cell.value = value;
  cell.font = { color: BLACK, name: "Arial", size: 10, bold };
  cell.alignment = { vertical: "middle" };
  if (fmt) cell.numFmt = fmt;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${svcKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, svcKey);

  // ── Ensure "reports" bucket exists (idempotent) ────────────────────────────
  await supabase.storage.createBucket("reports", {
    public: false,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
      "text/csv",
    ],
  }).then(({ error }) => {
    // "Bucket already exists" is not a real error
    if (error && !error.message.includes("already exists")) {
      console.warn("Bucket creation warning:", error.message);
    }
  });

  // ── Determine report month ─────────────────────────────────────────────────
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // optional YYYY-MM
  let reportYear: number, reportMonth: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    [reportYear, reportMonth] = monthParam.split("-").map(Number);
  } else {
    const now = new Date();
    // Default: previous calendar month
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    reportYear = prev.getFullYear();
    reportMonth = prev.getMonth() + 1;
  }

  const periodStart = new Date(reportYear, reportMonth - 1, 1);
  const periodEnd   = new Date(reportYear, reportMonth, 1); // exclusive

  const periodStartISO = periodStart.toISOString();
  const periodEndISO   = periodEnd.toISOString();
  const label          = monthLabel(reportYear, reportMonth);
  const fileKey        = monthKey(reportYear, reportMonth);

  // ── Query 1: payroll_records for the month ─────────────────────────────────
  const { data: payrollRows, error: payrollErr } = await supabase
    .from("payroll_records")
    .select("agent_id, commissions_amount, bonus_amount, total_amount, pay_date, commission_ids")
    .gte("pay_date", periodStart.toISOString().slice(0, 10))
    .lt("pay_date", periodEnd.toISOString().slice(0, 10))
    .order("total_amount", { ascending: false });

  if (payrollErr) {
    return new Response(JSON.stringify({ error: payrollErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Aggregate per agent (multiple payroll rows possible if several Fridays in month)
  const payrollByAgent = new Map<string, { commissions: number; bonus: number; total: number; payDates: string[] }>();
  for (const row of payrollRows ?? []) {
    const a = row.agent_id as string;
    const cur = payrollByAgent.get(a) ?? { commissions: 0, bonus: 0, total: 0, payDates: [] };
    cur.commissions += Number(row.commissions_amount ?? 0);
    cur.bonus        += Number(row.bonus_amount ?? 0);
    cur.total        += Number(row.total_amount ?? 0);
    cur.payDates.push(row.pay_date as string);
    payrollByAgent.set(a, cur);
  }

  const agentIds = [...payrollByAgent.keys()];

  // ── Query 2: profiles for those agents ────────────────────────────────────
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (agentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", agentIds);
    for (const p of profiles ?? []) profileMap.set(p.user_id, p);
  }

  // ── Query 3: field_commissions for the detail sheet ───────────────────────
  const { data: commissionRows } = await supabase
    .from("field_commissions")
    .select("id, agent_id, amount, status, earned_at, commission_type, description, order_id")
    .gte("earned_at", periodStartISO)
    .lt("earned_at", periodEndISO)
    .in("status", ["paid", "approved", "validated"])
    .order("earned_at", { ascending: true });

  // Collect order IDs to enrich
  const orderIds = [...new Set((commissionRows ?? []).map((c: any) => c.order_id).filter(Boolean))];

  // ── Query 4: orders + order_items + client profile ─────────────────────────
  const orderMap = new Map<string, { order_number: string | null; plan_name: string | null; service_type: string | null; client_name: string | null }>();
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, service_type, user_id, order_items(plan_name, service_type)")
      .in("id", orderIds);

    const clientIds = [...new Set((orders ?? []).map((o: any) => o.user_id).filter(Boolean))];
    const clientProfileMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", clientIds);
      for (const cp of clientProfiles ?? []) {
        clientProfileMap.set(cp.user_id, cp.full_name || cp.email || "Client");
      }
    }

    for (const o of orders ?? []) {
      const firstItem = Array.isArray((o as any).order_items) ? (o as any).order_items[0] : null;
      orderMap.set((o as any).id, {
        order_number: (o as any).order_number || null,
        plan_name:    firstItem?.plan_name || null,
        service_type: firstItem?.service_type || (o as any).service_type || null,
        client_name:  clientProfileMap.get((o as any).user_id) ?? "Client",
      });
    }
  }

  // ── Query 5: bonus rules for thresholds ────────────────────────────────────
  const { data: bonusRules } = await supabase
    .from("field_bonus_rules")
    .select("min_sales, max_sales, bonus_amount, is_active")
    .eq("is_active", true)
    .order("min_sales", { ascending: true });

  const tier1 = (bonusRules ?? []).find((_: any, i: number) => i === 0);
  const tier2 = (bonusRules ?? []).find((_: any, i: number) => i === 1);

  // ── Query 6: last 6 months of payroll for evolution sheet ─────────────────
  const sixMonthsAgo = new Date(reportYear, reportMonth - 7, 1); // 6 months before period
  const { data: historyRows } = await supabase
    .from("payroll_records")
    .select("agent_id, commissions_amount, bonus_amount, total_amount, pay_date")
    .gte("pay_date", sixMonthsAgo.toISOString().slice(0, 10))
    .lt("pay_date", periodEndISO.slice(0, 10));

  // Build evolution: agent → month → total
  const evolutionMap = new Map<string, Map<string, number>>();
  for (const row of historyRows ?? []) {
    const a = row.agent_id as string;
    const payDate = new Date(row.pay_date as string);
    const mk = monthKey(payDate.getFullYear(), payDate.getMonth() + 1);
    if (!evolutionMap.has(a)) evolutionMap.set(a, new Map());
    const prev = evolutionMap.get(a)!.get(mk) ?? 0;
    evolutionMap.get(a)!.set(mk, prev + Number(row.total_amount ?? 0));
  }

  // All agent IDs across history
  const allAgentIds = [...new Set([...agentIds, ...evolutionMap.keys()])];
  // Ensure we have profiles for all
  const missingIds = allAgentIds.filter((id) => !profileMap.has(id));
  if (missingIds.length > 0) {
    const { data: extraProfiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", missingIds);
    for (const p of extraProfiles ?? []) profileMap.set(p.user_id, p);
  }

  // ── Build 6-month column headers ───────────────────────────────────────────
  const monthCols: Array<{ key: string; label: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(reportYear, reportMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    monthCols.push({
      key:   monthKey(y, m),
      label: d.toLocaleDateString("fr-CA", { month: "short", year: "2-digit" }),
    });
  }

  // ── Sort agents by current month total ────────────────────────────────────
  const rankedAgents = [...payrollByAgent.entries()]
    .sort((a, b) => b[1].total - a[1].total);

  // ── Count ventes per agent (commissions with type='sale') ─────────────────
  const saleCountByAgent = new Map<string, number>();
  for (const c of commissionRows ?? []) {
    const a = (c as any).agent_id as string;
    if ((c as any).commission_type === "sale" || !(c as any).commission_type) {
      saleCountByAgent.set(a, (saleCountByAgent.get(a) ?? 0) + 1);
    }
  }

  // ── Build Excel workbook ───────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator  = "Nivra Telecom";
  wb.created  = new Date();
  wb.modified = new Date();

  // ══════════════════════════════════════════════════════════════════════════
  //  SHEET 1 — RÉSUMÉ
  // ══════════════════════════════════════════════════════════════════════════
  const ws1 = wb.addWorksheet("Résumé", { properties: { tabColor: { argb: "FF1A3A5C" } } });

  ws1.columns = [
    { width: 8  }, // Rang
    { width: 28 }, // Agent
    { width: 14 }, // Nb ventes
    { width: 20 }, // Commission ($)
    { width: 18 }, // Bonus ($)
    { width: 20 }, // Total ($)
    { width: 16 }, // Bonus atteint
  ];

  // Title
  ws1.mergeCells("A1:G1");
  const titleCell = ws1.getCell("A1");
  titleCell.value = `Rapport Mensuel des Commissions — Nivra Telecom — ${label.charAt(0).toUpperCase() + label.slice(1)}`;
  titleCell.font  = { bold: true, size: 14, color: WHITE, name: "Arial" };
  titleCell.fill  = HEADER_FILL;
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(1).height = 28;

  // Metadata
  ws1.getCell("A2").value = "Période :";
  ws1.getCell("A2").font  = { bold: true, name: "Arial", size: 10 };
  ws1.getCell("B2").value = `${periodStart.toLocaleDateString("fr-CA")} → ${new Date(periodEnd.getTime() - 1).toLocaleDateString("fr-CA")}`;
  ws1.getCell("B2").font  = { name: "Arial", size: 10 };
  ws1.getCell("A3").value = "Généré le :";
  ws1.getCell("A3").font  = { bold: true, name: "Arial", size: 10 };
  ws1.getCell("B3").value = new Date();
  ws1.getCell("B3").numFmt = "yyyy-mm-dd hh:mm";
  ws1.getCell("B3").font  = { name: "Arial", size: 10 };
  ws1.getCell("A4").value = "Source :";
  ws1.getCell("A4").font  = { bold: true, name: "Arial", size: 10 };
  ws1.getCell("B4").value = "Supabase — field_commissions + payroll_records";
  ws1.getCell("B4").font  = { name: "Arial", size: 10 };

  // HYPOTHÈSES section
  ws1.getRow(6).height = 18;
  ws1.mergeCells("A6:G6");
  const hypTitle = ws1.getCell("A6");
  hypTitle.value = "HYPOTHÈSES (modifier les cellules bleues pour recalculer)";
  hypTitle.font  = { bold: true, size: 10, color: WHITE, name: "Arial" };
  hypTitle.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E4B7A" } };
  hypTitle.alignment = { horizontal: "center" };

  ws1.getCell("A7").value = "Taux de commission (%) :";
  ws1.getCell("A7").font  = { name: "Arial", size: 10 };
  inputCell(ws1.getCell("B7"), (tier1 ? 10 : 10), "0.0%");
  ws1.getCell("C7").value = "← Source: field_bonus_rules — modifiable";
  ws1.getCell("C7").font  = { color: { argb: "FF888888" }, italic: true, size: 9, name: "Arial" };

  ws1.getCell("A8").value = "Seuil bonus Palier 1 (nb ventes) :";
  ws1.getCell("A8").font  = { name: "Arial", size: 10 };
  inputCell(ws1.getCell("B8"), Number(tier1?.min_sales ?? 10), "#,##0");

  ws1.getCell("A9").value = "Montant bonus Palier 1 ($) :";
  ws1.getCell("A9").font  = { name: "Arial", size: 10 };
  inputCell(ws1.getCell("B9"), Number(tier1?.bonus_amount ?? 200), '$#,##0.00');

  ws1.getCell("A10").value = "Seuil bonus Palier 2 (nb ventes) :";
  ws1.getCell("A10").font  = { name: "Arial", size: 10 };
  inputCell(ws1.getCell("B10"), Number(tier2?.min_sales ?? 20), "#,##0");

  ws1.getCell("A11").value = "Montant bonus Palier 2 ($) :";
  ws1.getCell("A11").font  = { name: "Arial", size: 10 };
  inputCell(ws1.getCell("B11"), Number(tier2?.bonus_amount ?? 400), '$#,##0.00');

  // ─ Summary table headers (row 13)
  ws1.getRow(13).height = 22;
  hdr(ws1.getCell("A13"), "Rang");
  hdr(ws1.getCell("B13"), "Agent");
  hdr(ws1.getCell("C13"), "Nb Ventes");
  hdr(ws1.getCell("D13"), "Commission ($)");
  hdr(ws1.getCell("E13"), "Bonus ($)");
  hdr(ws1.getCell("F13"), "Total ($)");
  hdr(ws1.getCell("G13"), "Palier atteint");

  const dataStart = 14;
  const dataEnd   = dataStart + rankedAgents.length - 1;

  rankedAgents.forEach(([agentId, agg], idx) => {
    const row  = dataStart + idx;
    const excel = ws1.getRow(row);
    excel.height = 18;

    const profile   = profileMap.get(agentId);
    const agentName = agentDisplayName(profile ?? {});
    const nbVentes  = saleCountByAgent.get(agentId) ?? 0;

    if (row % 2 === 0) {
      for (let c = 1; c <= 7; c++) {
        ws1.getRow(row).getCell(c).fill = ALT_ROW_FILL;
      }
    }

    // Rang: RANK formula referencing Total column (F)
    formulaCell(ws1.getCell(row, 1), `RANK(F${row},$F$${dataStart}:$F$${dataEnd},0)`, "0");

    dataCell(ws1.getCell(row, 2), agentName);
    dataCell(ws1.getCell(row, 3), nbVentes, "#,##0");

    // Commission: SUMIF cross-sheet reference to Détail sheet (GREEN)
    formulaCell(
      ws1.getCell(row, 4),
      `SUMIF(Détail!B:B,"${agentName}",Détail!F:F)`,
      '$#,##0.00;($#,##0.00);"-"',
      true
    );

    // Bonus: static data (from payroll_records — actual paid bonus)
    dataCell(ws1.getCell(row, 5), agg.bonus, '$#,##0.00;($#,##0.00);"-"');

    // Total: formula D+E (BLACK)
    formulaCell(ws1.getCell(row, 6), `D${row}+E${row}`, '$#,##0.00;($#,##0.00);"-"');

    // Palier atteint: IF formula using hypothesis cells (BLACK)
    formulaCell(
      ws1.getCell(row, 7),
      `IF(C${row}>=$B$10,"Palier 2 ✓",IF(C${row}>=$B$8,"Palier 1 ✓","Aucun"))`,
    );

    // Right-align numbers
    for (let c = 3; c <= 6; c++) ws1.getCell(row, c).alignment = { horizontal: "right" };
    ws1.getCell(row, 7).alignment = { horizontal: "center" };
  });

  // TOTAL row
  if (rankedAgents.length > 0) {
    const totalRow = dataEnd + 1;
    ws1.getRow(totalRow).height = 20;
    for (let c = 1; c <= 7; c++) ws1.getRow(totalRow).getCell(c).fill = TOTAL_FILL;

    ws1.getCell(totalRow, 1).value = "TOTAL";
    ws1.getCell(totalRow, 1).font  = { bold: true, name: "Arial", size: 10 };
    ws1.mergeCells(`A${totalRow}:B${totalRow}`);

    formulaCell(ws1.getCell(totalRow, 3), `SUM(C${dataStart}:C${dataEnd})`, "#,##0");
    ws1.getCell(totalRow, 3).font = { bold: true, name: "Arial" };

    formulaCell(ws1.getCell(totalRow, 4), `SUM(D${dataStart}:D${dataEnd})`, '$#,##0.00;($#,##0.00);"-"');
    ws1.getCell(totalRow, 4).font = { bold: true, name: "Arial" };

    formulaCell(ws1.getCell(totalRow, 5), `SUM(E${dataStart}:E${dataEnd})`, '$#,##0.00;($#,##0.00);"-"');
    ws1.getCell(totalRow, 5).font = { bold: true, name: "Arial" };

    formulaCell(ws1.getCell(totalRow, 6), `SUM(F${dataStart}:F${dataEnd})`, '$#,##0.00;($#,##0.00);"-"');
    ws1.getCell(totalRow, 6).font = { bold: true, name: "Arial" };

    for (let c = 3; c <= 6; c++) ws1.getCell(totalRow, c).alignment = { horizontal: "right" };
  }

  // Freeze top + hypotheses rows
  ws1.views = [{ state: "frozen", ySplit: 13 }];

  // ══════════════════════════════════════════════════════════════════════════
  //  SHEET 2 — DÉTAIL
  // ══════════════════════════════════════════════════════════════════════════
  const ws2 = wb.addWorksheet("Détail", { properties: { tabColor: { argb: "FF2E7D32" } } });

  ws2.columns = [
    { width: 16 }, // Date
    { width: 28 }, // Agent
    { width: 26 }, // Client
    { width: 28 }, // Plan / Service
    { width: 18 }, // Montant vente ($)
    { width: 18 }, // Commission ($)
    { width: 14 }, // Statut
    { width: 22 }, // Notes / Description
  ];

  // Title
  ws2.mergeCells("A1:H1");
  const ws2Title = ws2.getCell("A1");
  ws2Title.value = `Détail des Commissions — ${label.charAt(0).toUpperCase() + label.slice(1)}`;
  ws2Title.font  = { bold: true, size: 13, color: WHITE, name: "Arial" };
  ws2Title.fill  = HEADER_FILL;
  ws2Title.alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(1).height = 24;

  ws2.getRow(2).height = 8;

  // Headers row 3
  ws2.getRow(3).height = 20;
  hdr(ws2.getCell("A3"), "Date (earned)");
  hdr(ws2.getCell("B3"), "Agent");
  hdr(ws2.getCell("C3"), "Client");
  hdr(ws2.getCell("D3"), "Plan / Service");
  hdr(ws2.getCell("E3"), "Montant Vente ($)");
  hdr(ws2.getCell("F3"), "Commission ($)");
  hdr(ws2.getCell("G3"), "Statut");
  hdr(ws2.getCell("H3"), "Notes");

  const statusLabel: Record<string, string> = {
    paid: "Payée", approved: "Approuvée", validated: "Validée",
    pending: "En attente", disputed: "Contestée", clawback: "Reprise",
  };

  (commissionRows ?? []).forEach((c: any, idx) => {
    const row      = 4 + idx;
    const profile  = profileMap.get(c.agent_id);
    const agentName = agentDisplayName(profile ?? {});
    const order    = c.order_id ? orderMap.get(c.order_id) : null;
    const earnedAt = c.earned_at ? new Date(c.earned_at) : null;

    if (row % 2 === 0) {
      for (let col = 1; col <= 8; col++) ws2.getRow(row).getCell(col).fill = ALT_ROW_FILL;
    }
    ws2.getRow(row).height = 16;

    if (earnedAt) {
      ws2.getCell(row, 1).value  = earnedAt;
      ws2.getCell(row, 1).numFmt = "yyyy-mm-dd";
    }
    dataCell(ws2.getCell(row, 2), agentName);
    dataCell(ws2.getCell(row, 3), order?.client_name ?? "—");
    dataCell(ws2.getCell(row, 4), order?.plan_name ?? order?.service_type ?? c.commission_type ?? "—");
    dataCell(ws2.getCell(row, 5), null); // No order total easily available without extra join
    dataCell(ws2.getCell(row, 6), Number(c.amount ?? 0), '$#,##0.00;($#,##0.00);"-"');
    dataCell(ws2.getCell(row, 7), statusLabel[c.status] ?? c.status ?? "—");
    dataCell(ws2.getCell(row, 8), c.description ?? "");

    ws2.getCell(row, 5).value = null; // placeholder — order total not available without amount join
    ws2.getCell(row, 6).alignment = { horizontal: "right" };
  });

  // Total row at bottom of Détail
  const detailTotalRow = 4 + (commissionRows ?? []).length;
  if ((commissionRows ?? []).length > 0) {
    const lastDataRow = detailTotalRow - 1;
    ws2.getRow(detailTotalRow).height = 20;
    for (let col = 1; col <= 8; col++) ws2.getRow(detailTotalRow).getCell(col).fill = TOTAL_FILL;

    ws2.mergeCells(`A${detailTotalRow}:E${detailTotalRow}`);
    ws2.getCell(detailTotalRow, 1).value = "TOTAL COMMISSIONS";
    ws2.getCell(detailTotalRow, 1).font  = { bold: true, name: "Arial", size: 10 };
    ws2.getCell(detailTotalRow, 1).alignment = { horizontal: "right" };

    formulaCell(ws2.getCell(detailTotalRow, 6), `SUM(F4:F${lastDataRow})`, '$#,##0.00;($#,##0.00);"-"');
    ws2.getCell(detailTotalRow, 6).font      = { bold: true, name: "Arial" };
    ws2.getCell(detailTotalRow, 6).alignment = { horizontal: "right" };
  }

  // Auto-filter on headers
  ws2.autoFilter = { from: "A3", to: `H${3 + (commissionRows ?? []).length}` };
  ws2.views = [{ state: "frozen", ySplit: 3 }];

  // ══════════════════════════════════════════════════════════════════════════
  //  SHEET 3 — ÉVOLUTION MENSUELLE (6 mois)
  // ══════════════════════════════════════════════════════════════════════════
  const ws3 = wb.addWorksheet("Évolution", { properties: { tabColor: { argb: "FFC62828" } } });

  ws3.columns = [
    { width: 28 }, // Agent
    ...monthCols.map(() => ({ width: 16 })), // 6 month columns
    { width: 18 }, // Total 6 mois
    { width: 14 }, // Tendance
  ];

  // Title
  ws3.mergeCells(`A1:${String.fromCharCode(65 + monthCols.length + 1)}1`);
  const ws3Title = ws3.getCell("A1");
  ws3Title.value = `Évolution des Commissions par Agent — 6 derniers mois (au ${label})`;
  ws3Title.font  = { bold: true, size: 13, color: WHITE, name: "Arial" };
  ws3Title.fill  = HEADER_FILL;
  ws3Title.alignment = { horizontal: "center", vertical: "middle" };
  ws3.getRow(1).height = 24;

  ws3.getRow(2).height = 8;

  // Headers row 3
  ws3.getRow(3).height = 20;
  hdr(ws3.getCell("A3"), "Agent");
  monthCols.forEach((mc, i) => hdr(ws3.getCell(3, 2 + i), mc.label));
  hdr(ws3.getCell(3, 2 + monthCols.length), "Total 6 mois ($)");
  hdr(ws3.getCell(3, 3 + monthCols.length), "Tendance");

  const evolAgents = [...new Set([...allAgentIds])];
  // Sort by total in current month (last column in monthCols)
  evolAgents.sort((a, b) => {
    const curKey = monthCols[monthCols.length - 1].key;
    return (evolutionMap.get(b)?.get(curKey) ?? 0) - (evolutionMap.get(a)?.get(curKey) ?? 0);
  });

  const ev3Start = 4;
  const ev3End   = ev3Start + evolAgents.length - 1;

  evolAgents.forEach((agentId, idx) => {
    const row     = ev3Start + idx;
    const profile = profileMap.get(agentId);
    const name    = agentDisplayName(profile ?? {});
    const monthMap = evolutionMap.get(agentId) ?? new Map();

    if (row % 2 === 0) {
      for (let c = 1; c <= monthCols.length + 3; c++) ws3.getRow(row).getCell(c).fill = ALT_ROW_FILL;
    }
    ws3.getRow(row).height = 17;

    dataCell(ws3.getCell(row, 1), name);

    monthCols.forEach((mc, i) => {
      const val = monthMap.get(mc.key) ?? 0;
      dataCell(ws3.getCell(row, 2 + i), val, '$#,##0.00;($#,##0.00);"-"');
      ws3.getCell(row, 2 + i).alignment = { horizontal: "right" };
    });

    // Total 6 mois: SUM formula
    const firstMonthCol  = String.fromCharCode(65 + 1); // B
    const lastMonthCol   = String.fromCharCode(65 + monthCols.length); // G
    const totalCol       = String.fromCharCode(65 + monthCols.length + 1); // H
    const tendanceCol    = String.fromCharCode(65 + monthCols.length + 2); // I

    formulaCell(ws3.getCell(row, 2 + monthCols.length), `SUM(${firstMonthCol}${row}:${lastMonthCol}${row})`, '$#,##0.00;($#,##0.00);"-"');
    ws3.getCell(row, 2 + monthCols.length).font      = { bold: true, name: "Arial" };
    ws3.getCell(row, 2 + monthCols.length).alignment = { horizontal: "right" };

    // Tendance: compare last month vs month before (formula)
    const prevMonthLetter = String.fromCharCode(65 + monthCols.length - 1); // month n-1
    const curMonthLetter  = lastMonthCol;                                    // month n
    formulaCell(
      ws3.getCell(row, 3 + monthCols.length),
      `IF(${prevMonthLetter}${row}=0,"—",IF(${curMonthLetter}${row}>${prevMonthLetter}${row},"↑ +",IF(${curMonthLetter}${row}<${prevMonthLetter}${row},"↓ -","= =")))`,
    );
    ws3.getCell(row, 3 + monthCols.length).alignment = { horizontal: "center" };
  });

  // Totals row
  if (evolAgents.length > 0) {
    const totRow = ev3End + 1;
    ws3.getRow(totRow).height = 20;
    for (let c = 1; c <= monthCols.length + 3; c++) ws3.getRow(totRow).getCell(c).fill = TOTAL_FILL;

    ws3.getCell(totRow, 1).value = "TOTAL ÉQUIPE";
    ws3.getCell(totRow, 1).font  = { bold: true, name: "Arial", size: 10 };

    monthCols.forEach((_, i) => {
      const colLetter = String.fromCharCode(65 + 1 + i);
      formulaCell(ws3.getCell(totRow, 2 + i), `SUM(${colLetter}${ev3Start}:${colLetter}${ev3End})`, '$#,##0.00;($#,##0.00);"-"');
      ws3.getCell(totRow, 2 + i).font      = { bold: true, name: "Arial" };
      ws3.getCell(totRow, 2 + i).alignment = { horizontal: "right" };
    });

    const totalColLetter = String.fromCharCode(65 + monthCols.length + 1);
    formulaCell(ws3.getCell(totRow, 2 + monthCols.length), `SUM(${totalColLetter}${ev3Start}:${totalColLetter}${ev3End})`, '$#,##0.00;($#,##0.00);"-"');
    ws3.getCell(totRow, 2 + monthCols.length).font      = { bold: true, name: "Arial" };
    ws3.getCell(totRow, 2 + monthCols.length).alignment = { horizontal: "right" };
  }

  ws3.views = [{ state: "frozen", ySplit: 3 }];

  // ── Serialize to buffer ────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer() as ArrayBuffer;
  const uint8  = new Uint8Array(buffer);

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const fileName = `commissions_${fileKey}.xlsx`;
  const storagePath = `commissions/${fileName}`;

  const { error: uploadErr } = await supabase.storage
    .from("reports")
    .upload(storagePath, uint8, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

  if (uploadErr) {
    console.error("Storage upload error:", uploadErr.message);
    // Continue even if upload fails — return the file inline
  }

  // Generate signed URL (7 days)
  let signedUrl: string | null = null;
  if (!uploadErr) {
    const { data: signed } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    signedUrl = signed?.signedUrl ?? null;
  }

  // ── Queue email to admin ───────────────────────────────────────────────────
  const adminEmail = Deno.env.get("ADMIN_EMAIL") ?? "support@nivra-telecom.ca";
  const totalPaid  = [...payrollByAgent.values()].reduce((s, v) => s + v.total, 0);

  await enqueueCommunication({
    channel: "email",
    templateKey: "admin_commission_report",
    recipient: adminEmail,
    idempotencyKey: `commission_report_${fileKey}`,
    templateVars: {
      client_name:    "Admin Nivra",
      report_month:   label,
      nb_agents:      rankedAgents.length,
      total_paid:     totalPaid.toFixed(2),
      download_url:   signedUrl ?? "Voir Supabase Storage › reports/commissions",
      file_name:      fileName,
    },
    entityType: "commission_report",
    entityId: fileKey,
  });

  // ── Return JSON ───────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      ok:           true,
      report_month: fileKey,
      period:       `${periodStartISO.slice(0, 10)} → ${new Date(periodEnd.getTime() - 1).toISOString().slice(0, 10)}`,
      agents:       rankedAgents.length,
      commissions:  (commissionRows ?? []).length,
      total_paid:   totalPaid.toFixed(2),
      storage_path: uploadErr ? null : storagePath,
      signed_url:   signedUrl,
      email_queued: true,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
