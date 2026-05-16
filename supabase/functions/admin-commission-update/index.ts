import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "approve" | "hold" | "reject";

interface Body {
  commission_id?: string;
  action?: Action;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const adminId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authorization: must be admin or super_admin
    const { data: roles, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);
    if (roleErr) return json({ ok: false, error: roleErr.message }, 500);
    const allowed = (roles || []).some((r: any) =>
      ["admin", "super_admin", "owner"].includes(String(r.role))
    );
    if (!allowed) return json({ ok: false, error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Body;
    const { commission_id, action, reason } = body;
    if (!commission_id || !action) {
      return json({ ok: false, error: "commission_id and action are required" }, 400);
    }

    let update: Record<string, unknown>;
    switch (action) {
      case "approve":
        update = {
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: adminId,
        };
        break;
      case "hold":
        update = { status: "on_hold" };
        break;
      case "reject":
        if (!reason || !reason.trim()) {
          return json({ ok: false, error: "reason required" }, 400);
        }
        update = {
          status: "clawback",
          clawback_reason: reason.trim(),
          clawback_at: new Date().toISOString(),
        };
        break;
      default:
        return json({ ok: false, error: "Invalid action" }, 400);
    }

    const { data, error } = await admin
      .from("field_commissions")
      .update(update)
      .eq("id", commission_id)
      .select("id, status, approved_at, approved_by, clawback_reason, clawback_at, agent_id, amount")
      .single();

    if (error) return json({ ok: false, error: error.message }, 400);

    if (action === "approve" && data) {
      await admin.from("employee_notifications").insert({
        user_id: (data as any).agent_id,
        notification_type: "system",
        title: "Commission approuvée",
        message: `Une commission de ${(data as any).amount}$ a été approuvée.`,
        is_read: false,
      } as any);
    }

    return json({ ok: true, data });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
