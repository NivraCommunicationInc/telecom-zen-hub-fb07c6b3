/**
 * field-order-engine â€” Canonical order lifecycle + dashboard + leads + notifications for field sales.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { requireAuth, checkBodySize, sanitizeString } from "../_shared/security.ts";

Deno.serve(async (req) => {
  const cors = handleCorsPreflightRequest(req);
  if (cors) return cors;

  const origin = req.headers.get("origin");
  const authHeader = req.headers.get("Authorization") || "";
  const headers = { ...getCorsHeaders(origin), "Content-Type": "application/json" };

  try {
    checkBodySize(req);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRoleCall = !!serviceRoleKey && token === serviceRoleKey;
    const { userId } = isServiceRoleCall
      ? { userId: "00000000-0000-0000-0000-000000000000" }
      : await requireAuth(req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const domain = url.searchParams.get("domain") || "";

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DASHBOARD
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (req.method === "GET" && action === "dashboard-summary") {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      const startOfWeekISO = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate()).toISOString();

      const [ordersAll, ordersToday, ordersWeek, ordersMonth, commissionsRes, profileRes, leadsRes, leadsWon, leadsLost] = await Promise.all([
        admin.from("field_sales_orders").select("id, payment_status, sync_status, total_amount, created_at", { count: "exact" }).eq("salesperson_id", userId),
        admin.from("field_sales_orders").select("id, total_amount", { count: "exact" }).eq("salesperson_id", userId).gte("created_at", startOfDay),
        admin.from("field_sales_orders").select("id", { count: "exact", head: true }).eq("salesperson_id", userId).gte("created_at", startOfWeekISO),
        admin.from("field_sales_orders").select("id, total_amount", { count: "exact" }).eq("salesperson_id", userId).gte("created_at", startOfMonth),
        admin.from("sales_commissions").select("commission_amount, status").eq("salesperson_id", userId),
        admin.from("profiles").select("full_name, phone, job_title").eq("user_id", userId).maybeSingle(),
        admin.from("field_leads").select("id, status, created_at", { count: "exact" }).eq("agent_id", userId).not("status", "in", '("won","lost")'),
        admin.from("field_leads").select("id", { count: "exact", head: true }).eq("agent_id", userId).eq("status", "won"),
        admin.from("field_leads").select("id", { count: "exact", head: true }).eq("agent_id", userId).eq("status", "lost"),
      ]);

      // Get config for daily goal
      const { data: configRows } = await admin.from("field_sales_config").select("config_key, config_value").in("config_key", ["default_daily_target"]);
      const dailyGoal = Number(configRows?.find((r: any) => r.config_key === "default_daily_target")?.config_value || 3);

      const commissions = commissionsRes.data || [];
      const pendingCommissions = commissions.filter((c: any) => ["pending", "pending_activation"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0);
      const approvedCommissions = commissions.filter((c: any) => ["approved", "validated"].includes(c.status)).reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0);
      const paidCommissions = commissions.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.commission_amount || 0), 0);

      const allOrders = ordersAll.data || [];
      const pendingPayment = allOrders.filter((o: any) => o.payment_status === "pending").length;
      const syncErrors = allOrders.filter((o: any) => o.sync_status === "error").length;
      const pendingSync = allOrders.filter((o: any) => o.sync_status === "pending").length;

      const todayRevenue = (ordersToday.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      const monthRevenue = (ordersMonth.data || []).reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

      const totalLeadsAll = (leadsWon.count ?? 0) + (leadsLost.count ?? 0) + (leadsRes.count ?? 0);
      const conversionRate = totalLeadsAll > 0 ? Math.round(((leadsWon.count ?? 0) / totalLeadsAll) * 100) : 0;

      const salesTodayCount = ordersToday.count ?? 0;
      const goalProgress = Math.min(100, Math.round((salesTodayCount / dailyGoal) * 100));

      return new Response(JSON.stringify({
        salesToday: salesTodayCount,
        salesWeek: ordersWeek.count ?? 0,
        salesMonth: ordersMonth.count ?? 0,
        pendingCommissions,
        totalEarned: approvedCommissions + paidCommissions,
        paidCommissions,
        pendingPayment,
        syncErrors,
        pendingSync,
        openLeads: leadsRes.count ?? 0,
        wonLeads: leadsWon.count ?? 0,
        lostLeads: leadsLost.count ?? 0,
        totalOrders: ordersAll.count ?? 0,
        userName: profileRes.data?.full_name ?? null,
        jobTitle: profileRes.data?.job_title ?? "Agent terrain",
        todayRevenue,
        monthRevenue,
        conversionRate,
        dailyGoal,
        goalProgress,
      }), { headers });
    }

    // â”€â”€ Dashboard activity â”€â”€
    if (req.method === "GET" && action === "dashboard-activity") {
      const [recentOrders, recentLeads] = await Promise.all([
        admin.from("field_sales_orders")
          .select("id, customer_name, payment_status, sync_status, total_amount, created_at, services, customer_address")
          .eq("salesperson_id", userId).order("created_at", { ascending: false }).limit(8),
        admin.from("field_leads")
          .select("id, first_name, last_name, status, phone, created_at, service_need")
          .eq("agent_id", userId).order("created_at", { ascending: false }).limit(5),
      ]);

      return new Response(JSON.stringify({
        recentOrders: recentOrders.data || [],
        recentLeads: recentLeads.data || [],
      }), { headers });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // TRACKING SUMMARY
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (req.method === "GET" && action === "tracking-summary") {
      const [leadsRes, ordersRes] = await Promise.all([
        admin.from("field_leads").select("status").eq("agent_id", userId),
        admin.from("field_sales_orders").select("payment_status, sync_status").eq("salesperson_id", userId),
      ]);

      const leadCounts: Record<string, number> = {};
      for (const l of leadsRes.data || []) leadCounts[l.status] = (leadCounts[l.status] || 0) + 1;

      const paymentCounts: Record<string, number> = {};
      const syncCounts: Record<string, number> = {};
      for (const o of ordersRes.data || []) {
        const ps = o.payment_status || "pending";
        const ss = o.sync_status || "pending";
        paymentCounts[ps] = (paymentCounts[ps] || 0) + 1;
        syncCounts[ss] = (syncCounts[ss] || 0) + 1;
      }

      return new Response(JSON.stringify({
        leadCounts,
        paymentCounts,
        syncCounts,
        totalLeads: (leadsRes.data || []).length,
        totalOrders: (ordersRes.data || []).length,
      }), { headers });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DAILY REPORT (end-of-day summary)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (req.method === "GET" && action === "daily-report") {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();

      let agentName: string | null = null;
      try {
        const { data: prof } = await admin.from("profiles").select("first_name, last_name, full_name").eq("user_id", userId).maybeSingle();
        if (prof) agentName = (prof as any).full_name || [(prof as any).first_name, (prof as any).last_name].filter(Boolean).join(" ") || null;
      } catch (_) { /* ignore */ }

      const [salesRes, leadsRes, commRes] = await Promise.all([
        admin.from("field_sales_orders")
          .select("id, customer_name, customer_address, total_amount, payment_status, sync_status, created_at")
          .eq("salesperson_id", userId).gte("created_at", startIso).order("created_at", { ascending: false }),
        admin.from("field_leads")
          .select("id, first_name, last_name, status, service_need, created_at")
          .eq("agent_id", userId).gte("created_at", startIso).order("created_at", { ascending: false }),
        admin.from("field_commissions")
          .select("commission_amount, created_at")
          .eq("agent_id", userId).gte("created_at", startIso),
      ]);

      const sales = salesRes.data || [];
      const leads = leadsRes.data || [];
      const commissions = commRes.data || [];

      const totalRevenue = sales.reduce((a: number, s: any) => a + Number(s.total_amount || 0), 0);
      const totalCommissions = commissions.reduce((a: number, c: any) => a + Number(c.commission_amount || 0), 0);
      const paidSales = sales.filter((s: any) => s.payment_status === "paid").length;
      const syncedSales = sales.filter((s: any) => s.sync_status === "synced").length;

      return new Response(JSON.stringify({
        agentName,
        sales,
        leads,
        salesCount: sales.length,
        leadsCount: leads.length,
        totalRevenue,
        totalCommissions,
        paidSales,
        syncedSales,
      }), { headers });
    }



    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LEADS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (domain === "leads") {
      if (req.method === "GET" && action === "list") {
        const status = url.searchParams.get("status");
        const search = url.searchParams.get("search");

        let query = admin.from("field_leads").select("*").eq("agent_id", userId).order("created_at", { ascending: false }).limit(100);
        if (status && status !== "all") query = query.eq("status", status);

        const { data, error } = await query;
        if (error) throw error;

        let leads = data || [];
        if (search) {
          const q = search.toLowerCase();
          leads = leads.filter((l: any) => l.first_name?.toLowerCase().includes(q) || l.last_name?.toLowerCase().includes(q) || l.phone?.includes(q));
        }

        return new Response(JSON.stringify({ leads }), { headers });
      }

      if (req.method === "GET" && action === "lead-detail") {
        const leadId = url.searchParams.get("lead_id");
        if (!leadId) return new Response(JSON.stringify({ error: "lead_id requis" }), { status: 400, headers });

        const { data, error } = await admin.from("field_leads").select("*").eq("id", leadId).single();
        if (error) throw error;

        return new Response(JSON.stringify({ lead: data }), { headers });
      }

      if (req.method === "POST" && action === "update-lead") {
        const body = await req.json();
        const leadId = body.lead_id;
        const newStatus = sanitizeString(body.status || "", 50);
        if (!leadId || !newStatus) return new Response(JSON.stringify({ error: "lead_id et status requis" }), { status: 400, headers });

        const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
        if (newStatus === "lost") updates.lost_at = new Date().toISOString();

        const { error } = await admin.from("field_leads").update(updates).eq("id", leadId);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (req.method === "POST" && action === "convert-lead") {
        const body = await req.json();
        const leadId = body.lead_id;
        if (!leadId) return new Response(JSON.stringify({ error: "lead_id requis" }), { status: 400, headers });

        await admin.from("field_leads").update({ status: "submitted", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", leadId);

        return new Response(JSON.stringify({ success: true, message: "Lead converti" }), { headers });
      }

      if (req.method === "POST" && action === "create-lead") {
        const body = await req.json();
        const firstName = sanitizeString(body.first_name || "", 100);
        const lastName = sanitizeString(body.last_name || "", 100);
        const phone = sanitizeString(body.phone || "", 30);
        if (!firstName || !lastName || !phone) {
          return new Response(JSON.stringify({ error: "first_name, last_name et phone requis" }), { status: 400, headers });
        }

        let agentName: string | null = null;
        try {
          const { data: prof } = await admin.from("profiles").select("first_name, last_name, full_name").eq("user_id", userId).maybeSingle();
          if (prof) agentName = (prof as any).full_name || [(prof as any).first_name, (prof as any).last_name].filter(Boolean).join(" ") || null;
        } catch (_) { /* ignore */ }

        const insertRow: Record<string, unknown> = {
          agent_id: userId,
          agent_name: agentName,
          status: "new",
          lead_stage: "new",
          source_channel: "door_to_door",
          first_name: firstName,
          last_name: lastName,
          phone,
          email: sanitizeString(body.email || "", 255) || null,
          address: sanitizeString(body.address || "", 255) || null,
          city: sanitizeString(body.city || "", 100) || null,
          postal_code: sanitizeString(body.postal_code || "", 20) || null,
          service_need: sanitizeString(body.service_need || "", 100) || null,
          eligibility_notes: sanitizeString(body.eligibility_notes || "", 2000) || null,
          payment_method_intent: sanitizeString(body.payment_method_intent || "", 100) || null,
          notes: sanitizeString(body.notes || "", 2000) || null,
        };

        const { data, error } = await admin.from("field_leads").insert(insertRow).select("id").single();
        if (error) {
          console.error("[create-lead] insert failed", error);
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
        }

        return new Response(JSON.stringify({ success: true, lead_id: data.id }), { headers });
      }

      return new Response(JSON.stringify({ error: "Action leads inconnue" }), { status: 400, headers });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // NOTIFICATIONS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    if (domain === "notifications") {
      if (req.method === "GET" && action === "notifications") {
        const [dbNotifs, recentOrders] = await Promise.all([
          admin.from("employee_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
          admin.from("field_sales_orders").select("id, customer_name, sync_status, payment_status, created_at, updated_at").eq("salesperson_id", userId).order("updated_at", { ascending: false }).limit(10),
        ]);

        const notifications = (dbNotifs.data || []).map((n: any) => ({
          id: n.id, type: "system", title: n.title || "Notification", description: n.message || "", time: n.created_at, isRead: n.is_read, source: "db",
          status: "info",
        }));

        for (const order of recentOrders.data || []) {
          if (order.sync_status === "synced") {
            notifications.push({ id: `sync-${order.id}`, type: "sync", title: "Commande synchronisée", description: `${order.customer_name}`, time: order.updated_at || order.created_at, isRead: true, source: "derived", status: "success" });
          } else if (order.sync_status === "error") {
            notifications.push({ id: `sync-err-${order.id}`, type: "sync", title: "Sync Ã  relancer", description: `${order.customer_name}`, time: order.updated_at || order.created_at, isRead: false, source: "derived", status: "error" });
          } else if (order.payment_status === "pending") {
            notifications.push({ id: `pay-${order.id}`, type: "sale", title: "Paiement en attente", description: `${order.customer_name}`, time: order.updated_at || order.created_at, isRead: false, source: "derived", status: "warning" });
          }
        }

        notifications.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());

        return new Response(JSON.stringify({ notifications: notifications.slice(0, 30) }), { headers });
      }

      if (req.method === "POST" && action === "mark-read") {
        await admin.from("employee_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", userId).eq("is_read", false);
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      return new Response(JSON.stringify({ error: "Action notifications inconnue" }), { status: 400, headers });
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ORDERS
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    // GET: Order detail
    if (req.method === "GET" && action === "detail") {
      const orderId = url.searchParams.get("order_id");
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      const [orderRes, historyRes, syncRes, notesRes] = await Promise.all([
        admin.from("field_sales_orders").select("*").eq("id", orderId).single(),
        admin.from("field_order_status_history").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
        admin.from("field_order_sync_events").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
        admin.from("field_order_notes").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
      ]);

      const order = orderRes.data;
      if (!order) return new Response(JSON.stringify({ error: "Commande introuvable" }), { status: 404, headers });

      // IDOR guard: agents can only view their own orders
      if (order.salesperson_id !== userId) {
        const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("status", "active").maybeSingle();
        const managerRoles = ["admin", "super_admin", "owner", "supervisor"];
        if (!roleRow || !managerRoles.includes(roleRow.role)) {
          return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers });
        }
      }

      // Fetch related canonical data if converted
      let canonical = null;
      let invoice = null;
      let payment = null;
      let appointment = null;
      let subscription = null;
      let commission = null;

      if (order.converted_order_id) {
        const [coreRes, invRes, apptRes, subRes] = await Promise.all([
          admin.from("orders").select("id, order_number, status, total_amount, payment_status, service_type").eq("id", order.converted_order_id).maybeSingle(),
          admin.from("billing_invoices").select("id, invoice_number, status, total, amount_paid, balance_due, due_date").eq("order_id", order.converted_order_id).maybeSingle(),
          admin.from("appointments").select("id, appointment_number, title, scheduled_at, status, service_address").eq("order_id", order.converted_order_id).maybeSingle(),
          admin.from("billing_subscriptions").select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date").eq("order_id", order.converted_order_id).maybeSingle(),
        ]);
        canonical = coreRes.data;
        invoice = invRes.data;
        appointment = apptRes.data;
        subscription = subRes.data;

        if (invRes.data?.id) {
          const { data: payData } = await admin.from("billing_payments").select("id, payment_number, status, amount, method, provider, received_at").eq("invoice_id", invRes.data.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
          payment = payData;
        }
      }

      // Get commission
      const { data: commData } = await admin.from("field_commissions").select("id, amount, status, reason").eq("sale_id", orderId).maybeSingle();
      commission = commData;

      return new Response(JSON.stringify({
        order,
        canonical,
        invoice,
        payment,
        appointment,
        subscription,
        commission,
        status_history: historyRes.data || [],
        sync_events: syncRes.data || [],
        notes: notesRes.data || [],
      }), { headers });
    }

    // GET: Order list
    if (req.method === "GET" && action === "list") {
      const status = url.searchParams.get("status");
      const paymentStatus = url.searchParams.get("payment_status");
      const syncStatus = url.searchParams.get("sync_status");
      const mine = url.searchParams.get("mine") === "true";

      let query = admin.from("field_sales_orders").select("*").order("created_at", { ascending: false }).limit(100);
      if (mine) {
        query = query.eq("salesperson_id", userId);
      } else {
        // Non-mine list: only admin/supervisor can see all orders â€” others see their own
        const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("status", "active").maybeSingle();
        const managerRoles = ["admin", "super_admin", "owner", "supervisor"];
        if (!roleRow || !managerRoles.includes(roleRow.role)) {
          query = query.eq("salesperson_id", userId);
        }
      }
      if (status) query = query.eq("status", status);
      if (paymentStatus) query = query.eq("payment_status", paymentStatus);
      if (syncStatus) query = query.eq("sync_status", syncStatus);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify({ orders: data || [] }), { headers });
    }

    // GET: Order history
    if (req.method === "GET" && action === "history") {
      const orderId = url.searchParams.get("order_id");
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      const [historyRes, syncRes] = await Promise.all([
        admin.from("field_order_status_history").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
        admin.from("field_order_sync_events").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }),
      ]);

      return new Response(JSON.stringify({ status_history: historyRes.data || [], sync_events: syncRes.data || [] }), { headers });
    }

    // POST actions
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Méthode non supportée" }), { status: 405, headers });
    }

    const body = await req.json();
    const postAction = body.action || action;

    // Finalize a paid field_payment_intent into a real Core order/invoice.
    // Called by internal payment processors after PayPal/card capture.
    if (postAction === "finalize_paid_intent") {
      if (!isServiceRoleCall) return new Response(JSON.stringify({ error: "Accès refusé" }), { status: 403, headers });
      const intentId = body.field_payment_intent_id;
      if (!intentId) return new Response(JSON.stringify({ error: "field_payment_intent_id requis" }), { status: 400, headers });

      const { data: intent } = await admin
        .from("field_payment_intents")
        .select("id, quote_id, agent_id, amount, status, customer_email, customer_name, converted_field_order_id, converted_order_id")
        .eq("id", intentId)
        .maybeSingle();
      if (!intent) return new Response(JSON.stringify({ error: "Intent terrain introuvable" }), { status: 404, headers });
      if (intent.converted_order_id) {
        return new Response(JSON.stringify({ success: true, order_id: intent.converted_order_id, field_order_id: intent.converted_field_order_id }), { headers });
      }

      const { data: quote } = await admin.from("field_quotes").select("*").eq("id", intent.quote_id).maybeSingle();
      if (!quote) return new Response(JSON.stringify({ error: "Soumission terrain introuvable" }), { status: 404, headers });

      const ci: any = quote.client_info || {};
      const customerName = [ci.first_name, ci.last_name].filter(Boolean).join(" ").trim() || intent.customer_name || "Client";
      const fieldServices = [
        ...((Array.isArray(quote.services) ? quote.services : []) as any[]),
        ...((Array.isArray(quote.equipment) ? quote.equipment : []) as any[]),
      ];
      const { data: fieldOrder, error: fieldOrderError } = await admin
        .from("field_sales_orders")
        .insert({
          salesperson_id: intent.agent_id,
          customer_name: customerName,
          customer_email: ci.email || intent.customer_email || null,
          customer_phone: ci.phone || null,
          customer_address: ci.address || null,
          customer_city: ci.city || null,
          customer_postal_code: ci.postal_code || ci.postalCode || null,
          customer_date_of_birth: ci.date_of_birth || ci.dob || null,
          services: fieldServices,
          total_amount: Number(intent.amount || quote.total || 0),
          payment_method: body.payment_method || "card_manual",
          payment_reference: body.paypal_order_id || null,
          payment_status: "confirmed",
          sync_status: "pending",
          discount_data: quote.discount || null,
          source_quote_id: quote.id,
          source_field_payment_intent_id: intent.id,
          internal_notes: `Intent Field ${intent.id} finalisé automatiquement`,
        } as any)
        .select("id")
        .single();
      if (fieldOrderError || !fieldOrder) throw fieldOrderError ?? new Error("Création vente Field échouée");

      const syncResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
        body: JSON.stringify({ action: "sync_single", field_order_id: fieldOrder.id, internal: true }),
      });
      const syncData = await syncResp.json().catch(() => null);
      if (!syncResp.ok || !syncData?.success || !syncData?.orderId) {
        throw new Error(syncData?.error || "Création commande Core échouée");
      }

      await admin.from("field_quotes").update({ status: "converted", converted_order_id: syncData.orderId }).eq("id", quote.id);
      await admin.from("field_payment_intents").update({
        status: "completed",
        paid_at: new Date().toISOString(),
        converted_field_order_id: fieldOrder.id,
        converted_order_id: syncData.orderId,
        converted_invoice_id: syncData.invoice_id ?? null,
      }).eq("id", intent.id);

      return new Response(JSON.stringify({ success: true, field_order_id: fieldOrder.id, order_id: syncData.orderId, invoice_id: syncData.invoice_id ?? null }), { headers });
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // FIX 1 â€” materialize_from_quote: called by paypal-webhook
    // after a field_payment_intent capture is confirmed. Reads the
    // stored field_quote and creates the real Core order/invoice.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (postAction === "materialize_from_quote") {
      const quoteId = body.quote_id;
      if (!quoteId) return new Response(JSON.stringify({ error: "quote_id requis" }), { status: 400, headers });

      const { data: quote } = await admin.from("field_quotes").select("*").eq("id", quoteId).maybeSingle();
      if (!quote) return new Response(JSON.stringify({ error: "Soumission introuvable" }), { status: 404, headers });
      const agentIdParam = body.agent_id || quote.agent_id || userId;

      const c: any = quote.client_info || {};
      const services: any[] = (quote.services as any[]) || [];
      const equipment: any[] = (quote.equipment as any[]) || [];

      const normalizedServices = [
        ...services.map((s: any) => ({
          name: s.name, category: s.category || "Service",
          quantity: 1, price_monthly: Number(s.monthlyPrice ?? s.price_monthly ?? 0), price_setup: 0,
        })),
        ...equipment.map((e: any) => ({
          name: e.name, category: e.category || "Équipement",
          quantity: Number(e.quantity || 1), price_monthly: 0, price_setup: Number(e.price || 0),
        })),
      ];

      const customerName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client";
      const { data: fieldOrder, error: foErr } = await admin
        .from("field_sales_orders").insert({
          salesperson_id: agentIdParam,
          customer_name: customerName,
          customer_email: c.email || null,
          customer_phone: c.phone || "",
          customer_address: c.address || "",
          customer_city: c.city || null,
          customer_postal_code: c.postal_code || null,
          customer_date_of_birth: c.date_of_birth || null,
          services: normalizedServices,
          total_amount: Number(quote.total || 0),
          payment_method: "paypal",
          payment_status: "confirmed",
          sync_status: "pending",
          source_quote_id: quoteId,
          internal_notes: `Commande terrain â€” Agent: ${quote.agent_name || ""} (quote ${quoteId})`,
        } as any).select("id").single();
      if (foErr || !fieldOrder) throw foErr ?? new Error("Création field_sales_orders échouée");

      // Trigger sync to Core to create order + invoice + commission
      const syncResp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
        },
        body: JSON.stringify({ action: "sync_single", field_order_id: fieldOrder.id, internal: true }),
      });
      const syncData = await syncResp.json().catch(() => null);

      return new Response(JSON.stringify({
        success: true,
        field_order_id: fieldOrder.id,
        order_id: syncData?.orderId || syncData?.order_id || null,
        invoice_id: syncData?.invoice_id || null,
      }), { headers });
    }

    if (postAction === "create-draft" || postAction === "submit-sale") {
      const customer = body.customer || {};
      const rawServices = Array.isArray(body.services) ? body.services : [];
      const rawEquipment = Array.isArray(body.equipment) ? body.equipment : [];

      const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
      if (!customerName) return new Response(JSON.stringify({ error: "Nom du client requis" }), { status: 400, headers });
      if (!customer.phone?.trim()) return new Response(JSON.stringify({ error: "Téléphone du client requis" }), { status: 400, headers });
      if (!customer.address?.trim()) return new Response(JSON.stringify({ error: "Adresse du client requise" }), { status: 400, headers });
      if (rawServices.length === 0) return new Response(JSON.stringify({ error: "Au moins un service est requis" }), { status: 400, headers });

      const normalizedServices = [
        ...rawServices.map((service: any) => ({
          name: service.name,
          category: service.category || "Service",
          quantity: Number(service.quantity || 1),
          price_monthly: Number(service.price_monthly ?? service.monthlyPrice ?? 0),
          price_setup: Number(service.price_setup ?? 0),
        })),
        ...rawEquipment.map((equipment: any) => ({
          name: equipment.name,
          category: equipment.category || "Équipement",
          quantity: Number(equipment.quantity || 1),
          price_monthly: 0,
          price_setup: Number(equipment.price || 0),
        })),
      ];

      const now = new Date().toISOString();
      const paymentMethod = body.payment?.method === "paypal" ? "paypal" : sanitizeString(body.payment?.method || "paypal", 50);
      const paymentStatus = sanitizeString(body.payment?.status || "pending", 50);

      const draftInsert = {
        salesperson_id: userId,
        customer_name: customerName,
        customer_email: customer.email || null,
        customer_phone: customer.phone,
        customer_address: customer.address,
        customer_city: customer.city || null,
        customer_postal_code: customer.postal_code || null,
        customer_date_of_birth: customer.date_of_birth || null,
        services: normalizedServices,
        total_amount: Number(body.total_amount || 0),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        selected_channels: [],
        internal_notes: customer.notes || null,
        sync_status: postAction === "submit-sale" ? "pending" : "draft",
        created_at: now,
        updated_at: now,
      };

      const { data: fieldOrder, error: fieldOrderError } = await admin
        .from("field_sales_orders")
        .insert(draftInsert as any)
        .select("id")
        .single();

      if (fieldOrderError || !fieldOrder) throw fieldOrderError || new Error("Impossible de créer la vente terrain");

      await admin.from("field_order_status_history").insert({
        field_order_id: fieldOrder.id,
        status_domain: "order",
        old_status: null,
        new_status: postAction === "submit-sale" ? "submitted" : "draft",
        changed_by_user_id: userId,
        change_reason: postAction === "submit-sale" ? "Création depuis le portail Field" : "Brouillon créé depuis le portail Field",
      } as any);

      if (postAction === "create-draft") {
        return new Response(JSON.stringify({ success: true, order_id: fieldOrder.id, sync_status: "draft" }), { headers });
      }

      await admin.from("field_order_sync_events").insert({
        field_order_id: fieldOrder.id,
        sync_target: "core",
        sync_action: "create_order",
        sync_status: "pending",
        attempt_count: 0,
      } as any);

      const syncResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({ action: "sync_single", field_order_id: fieldOrder.id, internal: true }),
      });

      const syncData = await syncResponse.json().catch(() => null);
      if (!syncResponse.ok) {
        throw new Error(syncData?.error || `La synchronisation de la vente a échoué (${syncResponse.status})`);
      }
      if (!syncData?.success || !syncData?.invoice_id) {
        throw new Error(syncData?.error || "La synchronisation de la vente a échoué");
      }

      return new Response(JSON.stringify({
        success: true,
        field_order_id: fieldOrder.id,
        order_id: syncData.orderId || null,
        order_number: syncData.order_number || null,
        invoice_id: syncData.invoice_id,
        payment_id: syncData.payment_id || null,
        sync_status: "synced",
      }), { headers });
    }

    // Validate
    if (postAction === "validate") {
      const issues: string[] = [];
      const warnings: string[] = [];

      if (!body.customer_name?.trim()) issues.push("Nom du client requis");
      if (!body.customer_phone?.trim()) issues.push("Téléphone du client requis");
      if (!body.customer_email?.trim()) issues.push("Courriel du client requis");
      if (!body.customer_address?.trim()) issues.push("Adresse du client requise");
      if (!body.customer_postal_code?.trim()) issues.push("Code postal requis");
      if (!body.customer_date_of_birth?.trim()) issues.push("Date de naissance requise");
      if (!body.services || body.services.length === 0) issues.push("Au moins un service requis");

      const routerCount = (body.equipment || []).filter((e: any) => e.category === "Routeur" || e.name?.toLowerCase().includes("routeur")).reduce((sum: number, e: any) => sum + (e.quantity || 1), 0);
      if (routerCount > 1) issues.push("Maximum 1 routeur par commande");

      const terminalCount = (body.equipment || []).filter((e: any) => e.category === "Terminal" || e.name?.toLowerCase().includes("terminal")).reduce((sum: number, e: any) => sum + (e.quantity || 1), 0);
      if (terminalCount > 5) issues.push("Maximum 5 terminaux par commande");

      if (body.customer_date_of_birth) {
        const dob = new Date(body.customer_date_of_birth);
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 18) issues.push("Le client doit avoir 18 ans ou plus");
      }

      return new Response(JSON.stringify({ valid: issues.length === 0, issues, warnings }), { headers });
    }

    // Submit
    if (postAction === "submit") {
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      await admin.from("field_order_status_history").insert({ field_order_id: orderId, status_domain: "order", old_status: "draft", new_status: "submitted", changed_by_user_id: userId, change_reason: "Soumission par l'agent terrain" });
      await admin.from("field_order_sync_events").insert({ field_order_id: orderId, sync_target: "core", sync_action: "create_order", sync_status: "pending", attempt_count: 0 });

      const syncResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}`, "apikey": serviceRoleKey },
        body: JSON.stringify({ action: "sync_single", field_order_id: orderId, internal: true }),
      });
      const syncData = await syncResponse.json().catch(() => null);
      if (!syncResponse.ok || !syncData?.success) {
        throw new Error(syncData?.error || `La synchronisation de la vente a échoué (${syncResponse.status})`);
      }

      return new Response(JSON.stringify({ success: true, order_id: orderId, core_order_id: syncData.orderId || null, invoice_id: syncData.invoice_id || null, sync_status: "synced", message: "Commande soumise" }), { headers });
    }

    // Update payment
    if (postAction === "update-payment") {
      const orderId = body.order_id;
      const newStatus = sanitizeString(body.payment_status || "", 50);
      const reference = body.payment_reference || null;
      if (!orderId || !newStatus) return new Response(JSON.stringify({ error: "order_id et payment_status requis" }), { status: 400, headers });

      const { data: order } = await admin.from("field_sales_orders").select("payment_status").eq("id", orderId).single();
      await admin.from("field_sales_orders").update({ payment_status: newStatus, payment_reference: reference, updated_at: new Date().toISOString() }).eq("id", orderId);
      await admin.from("field_order_status_history").insert({ field_order_id: orderId, status_domain: "payment", old_status: order?.payment_status || "unknown", new_status: newStatus, changed_by_user_id: userId, change_reason: reference ? `Ref: ${reference}` : null });

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Retry sync
    if (postAction === "retry-sync") {
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      const { data: configRows } = await admin.from("field_sales_config").select("config_key, config_value").in("config_key", ["sync_retry_max_attempts"]);
      const maxAttempts = Number(configRows?.find((r: any) => r.config_key === "sync_retry_max_attempts")?.config_value || 3);

      const { data: lastSync } = await admin.from("field_order_sync_events").select("*").eq("field_order_id", orderId).order("created_at", { ascending: false }).limit(1).single();

      if (lastSync && lastSync.attempt_count >= maxAttempts) {
        return new Response(JSON.stringify({ success: false, message: `Max ${maxAttempts} tentatives atteint.` }), { headers });
      }

      const newCount = (lastSync?.attempt_count || 0) + 1;
      await admin.from("field_order_sync_events").insert({ field_order_id: orderId, sync_target: "core", sync_action: "retry", sync_status: "pending", attempt_count: newCount });
      await admin.from("field_sales_orders").update({ sync_status: "pending", sync_error: null }).eq("id", orderId);
      await admin.from("field_order_status_history").insert({ field_order_id: orderId, status_domain: "sync", old_status: "error", new_status: "pending", changed_by_user_id: userId, change_reason: `Resync #${newCount}` });

      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/field-sales-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
          },
          body: JSON.stringify({ action: "sync_single", field_order_id: orderId, internal: true }),
        });
      } catch (_e) {}

      return new Response(JSON.stringify({ success: true, message: "Sync relancée", attempt_count: newCount }), { headers });
    }

    // Add note
    if (postAction === "add-note") {
      const orderId = body.order_id;
      const content = sanitizeString(body.content || "", 2000);
      if (!orderId || !content) return new Response(JSON.stringify({ error: "order_id et content requis" }), { status: 400, headers });

      await admin.from("field_order_notes").insert({ field_order_id: orderId, note_type: body.note_type || "internal", created_by_user_id: userId, content, is_internal: body.is_internal !== false });

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Cancel order
    if (postAction === "cancel") {
      const orderId = body.order_id;
      if (!orderId) return new Response(JSON.stringify({ error: "order_id requis" }), { status: 400, headers });

      const { data: order } = await admin.from("field_sales_orders").select("payment_status, sync_status").eq("id", orderId).single();
      if (order?.payment_status === "confirmed" || order?.sync_status === "synced") {
        return new Response(JSON.stringify({ error: "Impossible d'annuler une commande payée ou synchronisée" }), { status: 400, headers });
      }

      await admin.from("field_sales_orders").update({ payment_status: "cancelled", sync_status: "error", sync_error: "Cancelled by agent", updated_at: new Date().toISOString() }).eq("id", orderId);
      await admin.from("field_order_status_history").insert({ field_order_id: orderId, status_domain: "order", old_status: order?.payment_status, new_status: "cancelled", changed_by_user_id: userId, change_reason: "Annulée par l'agent" });

      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });

  } catch (err) {
    const status = err.status || 500;
    return new Response(JSON.stringify({ error: err.message || "Erreur serveur" }), { status, headers });
  }
});
