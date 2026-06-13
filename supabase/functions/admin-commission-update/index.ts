import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

type Action = "approve" | "hold" | "reject";

interface Body {
  commission_id?: string;
  action?: Action;
  reason?: string;
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ ok: false, error: "Unauthorized" });
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
      return respond({ ok: false, error: "Unauthorized" });
    }
    const adminId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authorization: must be admin/super_admin/owner
    const { data: roles, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId);
    if (roleErr) return respond({ ok: false, error: roleErr.message });
    const allowed = (roles || []).some((r: any) =>
      ["admin", "super_admin", "owner"].includes(String(r.role))
    );
    if (!allowed) return respond({ ok: false, error: "Forbidden" });

    const body = (await req.json().catch(() => ({}))) as Body;
    const { commission_id, action, reason } = body;
    if (!commission_id || !action) {
      return respond({ ok: false, error: "commission_id and action are required" });
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
          return respond({ ok: false, error: "reason required" });
        }
        update = {
          status: "clawback",
          clawback_reason: reason.trim(),
          clawback_at: new Date().toISOString(),
        };
        break;
      default:
        return respond({ ok: false, error: "Invalid action" });
    }

    const { data, error } = await admin
      .from("field_commissions")
      .update(update)
      .eq("id", commission_id)
      .select("id, status, approved_at, approved_by, clawback_reason, clawback_at, agent_id, amount")
      .single();

    if (error) return respond({ ok: false, error: error.message });

    if (action === "approve" && data) {
      await admin.from("employee_notifications").insert({
        user_id: (data as any).agent_id,
        notification_type: "system",
        title: "Commission approuvÃ©e",
        message: `Une commission de ${(data as any).amount}$ a Ã©tÃ© approuvÃ©e.`,
        is_read: false,
      } as any);
    }

    return respond({ ok: true, data });
  } catch (e) {
    return respond({ ok: false, error: e?.message || "Internal error" });
  }
});
