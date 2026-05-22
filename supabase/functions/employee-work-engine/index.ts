/**
 * Employee Work Engine — Handles:
 * 1. Ingesting new work items from orders/payments/kyc/tickets
 * 2. Auto-assignment via round-robin to team members
 * 3. SLA evaluation and breach detection
 * 4. Internal notification generation
 * 
 * Called by: scheduled cron job or webhook triggers
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface AssignmentRule {
  item_type: string;
  team: string;
  sla_hours: number;
  at_risk_hours: number;
  auto_assign: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "full_cycle";

    const results: Record<string, unknown> = {};

    // Step 1: Ingest new work items from source tables
    if (action === "full_cycle" || action === "ingest") {
      results.ingested = await ingestWorkItems(supabase);
    }

    // Step 2: Auto-assign unassigned items
    if (action === "full_cycle" || action === "assign") {
      results.assigned = await autoAssignItems(supabase);
    }

    // Step 3: Evaluate SLA status
    if (action === "full_cycle" || action === "sla") {
      results.sla = await evaluateSLA(supabase);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[WorkEngine] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── INGEST ───────────────────────────────────────────────
async function ingestWorkItems(supabase: any) {
  const rules = await getAssignmentRules(supabase);
  let ingested = 0;

  // Orders
  const orderRule = rules.find((r) => r.item_type === "order");
  if (orderRule) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, user_id, status, created_at")
      .in("status", ["pending", "submitted", "received", "processing", "on_hold"])
      .eq("environment", "live")
      .limit(100);

    if (orders?.length) {
      const userIds = [...new Set(orders.map((o: any) => o.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.user_id, p]));

      for (const order of orders) {
        const profile = profileMap.get(order.user_id);
        const slaDeadline = new Date(new Date(order.created_at).getTime() + orderRule.sla_hours * 3600000);
        
        const { error } = await supabase.from("employee_work_items").upsert({
          item_type: "order",
          source_id: order.id,
          source_reference: order.order_number || order.id.slice(0, 8),
          client_id: order.user_id,
          client_name: profile?.full_name || null,
          client_email: profile?.email || null,
          team: orderRule.team,
          sla_deadline_at: slaDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "item_type,source_id", ignoreDuplicates: false });

        if (!error) ingested++;
      }
    }
  }

  // Payments (manual pending)
  const payRule = rules.find((r) => r.item_type === "payment");
  if (payRule) {
    const { data: payments } = await supabase
      .from("billing_payments")
      .select("id, payment_number, customer_id, status, created_at")
      .eq("status", "pending")
      .eq("environment", "live")
      .limit(100);

    if (payments?.length) {
      for (const pay of payments) {
        const slaDeadline = new Date(new Date(pay.created_at).getTime() + payRule.sla_hours * 3600000);
        const { error } = await supabase.from("employee_work_items").upsert({
          item_type: "payment",
          source_id: pay.id,
          source_reference: pay.payment_number,
          team: payRule.team,
          sla_deadline_at: slaDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "item_type,source_id", ignoreDuplicates: false });
        if (!error) ingested++;
      }
    }
  }

  // KYC
  const kycRule = rules.find((r) => r.item_type === "kyc");
  if (kycRule) {
    const { data: kycs } = await supabase
      .from("order_identity_data")
      .select("id, order_id, verification_status, created_at")
      .eq("verification_status", "pending")
      .limit(100);

    if (kycs?.length) {
      for (const kyc of kycs) {
        const slaDeadline = new Date(new Date(kyc.created_at).getTime() + kycRule.sla_hours * 3600000);
        const { error } = await supabase.from("employee_work_items").upsert({
          item_type: "kyc",
          source_id: kyc.id,
          source_reference: kyc.order_id?.slice(0, 8) || kyc.id.slice(0, 8),
          team: kycRule.team,
          sla_deadline_at: slaDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "item_type,source_id", ignoreDuplicates: false });
        if (!error) ingested++;
      }
    }
  }

  // Tickets
  const ticketRule = rules.find((r) => r.item_type === "ticket");
  if (ticketRule) {
    const { data: tickets } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, status, priority, created_at, assigned_to_user_id, user_id")
      .in("status", ["open", "in_progress"])
      .limit(100);

    if (tickets?.length) {
      // Resolve assignee names from profiles in one batch
      const assigneeIds = Array.from(new Set((tickets as any[]).map(t => t.assigned_to_user_id).filter(Boolean)));
      const nameMap: Record<string, string> = {};
      if (assigneeIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", assigneeIds);
        (profs as any[] | null)?.forEach(p => { if (p?.id) nameMap[p.id] = p.full_name || ""; });
      }
      for (const t of tickets as any[]) {
        const slaDeadline = new Date(new Date(t.created_at).getTime() + ticketRule.sla_hours * 3600000);
        const { error } = await supabase.from("employee_work_items").upsert({
          item_type: "ticket",
          source_id: t.id,
          source_reference: t.ticket_number || t.id.slice(0, 8),
          client_id: t.user_id,
          team: ticketRule.team,
          assigned_to_id: t.assigned_to_user_id,
          assigned_to_name: t.assigned_to_user_id ? (nameMap[t.assigned_to_user_id] || null) : null,
          priority: t.priority === "urgent" || t.priority === "high" ? "urgent" : "normal",
          sla_deadline_at: slaDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "item_type,source_id", ignoreDuplicates: false });
        if (!error) ingested++;
      }
    }
  }

  // Activations
  const actRule = rules.find((r) => r.item_type === "activation");
  if (actRule) {
    const { data: activations } = await supabase
      .from("orders")
      .select("id, order_number, user_id, status, created_at")
      .in("status", ["delivered", "installed"])
      .eq("environment", "live")
      .limit(100);

    if (activations?.length) {
      for (const a of activations) {
        const slaDeadline = new Date(new Date(a.created_at).getTime() + actRule.sla_hours * 3600000);
        const { error } = await supabase.from("employee_work_items").upsert({
          item_type: "activation",
          source_id: a.id,
          source_reference: a.order_number || a.id.slice(0, 8),
          client_id: a.user_id,
          team: actRule.team,
          sla_deadline_at: slaDeadline.toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "item_type,source_id", ignoreDuplicates: false });
        if (!error) ingested++;
      }
    }
  }

  // Mark completed items that no longer match active filters
  await supabase
    .from("employee_work_items")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("status", "open")
    .lt("updated_at", new Date(Date.now() - 5 * 60000).toISOString()); // stale > 5min = source resolved

  return ingested;
}

// ─── AUTO-ASSIGN ──────────────────────────────────────────
async function autoAssignItems(supabase: any) {
  const rules = await getAssignmentRules(supabase);
  let assigned = 0;

  for (const rule of rules) {
    if (!rule.auto_assign) continue;

    // Get unassigned items for this team
    const { data: unassigned } = await supabase
      .from("employee_work_items")
      .select("id")
      .eq("team", rule.team)
      .is("assigned_to_id", null)
      .in("status", ["open"])
      .order("created_at", { ascending: true })
      .limit(50);

    if (!unassigned?.length) continue;

    // Get available agents for this team
    const teamRoleMap: Record<string, string[]> = {
      orders: ["admin", "employee", "supervisor", "sales"],
      billing: ["admin", "employee", "billing_admin"],
      verification: ["admin", "employee", "kyc_agent", "supervisor"],
      activation: ["admin", "employee", "techops", "supervisor"],
      support: ["admin", "employee", "support", "supervisor"],
    };

    const roles = teamRoleMap[rule.team] || ["admin", "employee"];
    
    const { data: agents } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", roles)
      .eq("status", "active")
      .eq("is_active", true)
      .eq("can_access_employee", true);

    if (!agents?.length) continue;

    // Get agent names
    const agentIds = agents.map((a: any) => a.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", agentIds);
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    // Count current assignments per agent for round-robin
    const { data: currentAssignments } = await supabase
      .from("employee_work_items")
      .select("assigned_to_id")
      .in("assigned_to_id", agentIds)
      .in("status", ["assigned", "in_progress"]);

    const loadMap = new Map<string, number>();
    for (const id of agentIds) loadMap.set(id, 0);
    for (const a of currentAssignments ?? []) {
      if (a.assigned_to_id) loadMap.set(a.assigned_to_id, (loadMap.get(a.assigned_to_id) || 0) + 1);
    }

    // Sort agents by current load (least loaded first)
    const sortedAgents = [...loadMap.entries()].sort((a, b) => a[1] - b[1]);

    // Assign items round-robin
    for (let i = 0; i < unassigned.length; i++) {
      const agentEntry = sortedAgents[i % sortedAgents.length];
      const agentId = agentEntry[0];
      const agentName = nameMap.get(agentId) || "Agent";

      const { error } = await supabase
        .from("employee_work_items")
        .update({
          assigned_to_id: agentId,
          assigned_to_name: agentName,
          status: "assigned",
          updated_at: new Date().toISOString(),
        })
        .eq("id", unassigned[i].id)
        .is("assigned_to_id", null); // prevent race condition

      if (!error) {
        assigned++;
        // Create notification for the assigned agent
        await supabase.from("employee_notifications").insert({
          user_id: agentId,
          notification_type: "assignment",
          title: "Nouvelle tâche assignée",
          message: `Tâche ${rule.item_type} assignée automatiquement`,
          work_item_id: unassigned[i].id,
        });
      }
    }
  }

  return assigned;
}

// ─── SLA EVALUATION ───────────────────────────────────────
async function evaluateSLA(supabase: any) {
  const rules = await getAssignmentRules(supabase);
  const now = new Date();
  let updated = 0;

  for (const rule of rules) {
    const atRiskThreshold = new Date(now.getTime() - rule.at_risk_hours * 3600000);
    const breachThreshold = new Date(now.getTime() - rule.sla_hours * 3600000);

    // Get active items for this type
    const { data: items } = await supabase
      .from("employee_work_items")
      .select("id, created_at, sla_status, sla_deadline_at, assigned_to_id")
      .eq("item_type", rule.item_type)
      .in("status", ["open", "assigned", "in_progress"])
      .limit(200);

    if (!items?.length) continue;

    for (const item of items) {
      const deadline = item.sla_deadline_at ? new Date(item.sla_deadline_at) : null;
      if (!deadline) continue;

      let newSlaStatus: string;
      if (now >= deadline) {
        newSlaStatus = "breached";
      } else {
        const timeLeft = deadline.getTime() - now.getTime();
        const totalSla = rule.sla_hours * 3600000;
        const atRiskWindow = (rule.sla_hours - rule.at_risk_hours) * 3600000;
        newSlaStatus = timeLeft <= atRiskWindow ? "at_risk" : "on_time";
      }

      if (newSlaStatus !== item.sla_status) {
        const updateData: Record<string, unknown> = {
          sla_status: newSlaStatus,
          updated_at: now.toISOString(),
        };
        if (newSlaStatus === "breached" && item.sla_status !== "breached") {
          updateData.sla_breached_at = now.toISOString();
          updateData.priority = "urgent";
        } else if (newSlaStatus === "at_risk" && item.sla_status === "on_time") {
          updateData.priority = "high";
        }

        const { error } = await supabase
          .from("employee_work_items")
          .update(updateData)
          .eq("id", item.id);

        if (!error) {
          updated++;

          // Notify assigned agent on breach or at_risk
          if (item.assigned_to_id && (newSlaStatus === "breached" || newSlaStatus === "at_risk")) {
            const notifType = newSlaStatus === "breached" ? "sla_breach" : "urgent";
            const title = newSlaStatus === "breached"
              ? "⚠️ SLA dépassé"
              : "⏰ SLA à risque";
            
            await supabase.from("employee_notifications").insert({
              user_id: item.assigned_to_id,
              notification_type: notifType,
              title,
              message: `${rule.item_type} — délai ${newSlaStatus === "breached" ? "dépassé" : "critique"}`,
              work_item_id: item.id,
            });
          }
        }
      }
    }
  }

  return updated;
}

// ─── HELPERS ──────────────────────────────────────────────
async function getAssignmentRules(supabase: any): Promise<AssignmentRule[]> {
  const { data } = await supabase
    .from("assignment_rules")
    .select("*")
    .eq("is_active", true);
  return (data as AssignmentRule[]) || [];
}
