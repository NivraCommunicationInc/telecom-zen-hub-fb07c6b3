// rewards-catalog-admin — Module 32 (F32-7)
// CRUD audité du catalogue loyalty_rewards. Admins uniquement.
// Ne remplace pas les policies existantes ; verrouille la voie serveur-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Reward {
  id?: string;
  name_fr: string;
  name_en: string;
  description_fr?: string | null;
  description_en?: string | null;
  points_required: number;
  reward_type: string;
  reward_value?: number | null;
  is_active?: boolean;
  stock_limit?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userRes.user) return json({ error: "unauthorized" }, 401);
    const actor = userRes.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: actor.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json();
    const { action, reward, id } = body as { action: string; reward?: Reward; id?: string };

    const audit = async (act: string, oldV: any, newV: any, targetId: string | null) => {
      await admin.from("admin_audit_log").insert({
        admin_user_id: actor.id,
        admin_email: actor.email,
        action: `loyalty.catalog.${act}`,
        target_type: "loyalty_reward",
        target_id: targetId,
        details: { old: oldV, new: newV },
      });
    };

    if (action === "list") {
      const { data, error } = await admin.from("loyalty_rewards").select("*").order("points_required");
      if (error) throw error;
      return json({ ok: true, rewards: data });
    }

    if (action === "create") {
      if (!reward) return json({ error: "reward_required" }, 400);
      if (!reward.name_fr || !reward.name_en || !reward.reward_type) return json({ error: "invalid_fields" }, 400);
      if (!Number.isInteger(reward.points_required) || reward.points_required <= 0) return json({ error: "invalid_points" }, 400);
      const { data, error } = await admin.from("loyalty_rewards").insert({
        name_fr: reward.name_fr, name_en: reward.name_en,
        description_fr: reward.description_fr ?? null, description_en: reward.description_en ?? null,
        points_required: reward.points_required,
        reward_type: reward.reward_type,
        reward_value: reward.reward_value ?? null,
        is_active: reward.is_active ?? true,
        stock_limit: reward.stock_limit ?? null,
      }).select().single();
      if (error) throw error;
      await audit("create", null, data, data.id);
      return json({ ok: true, reward: data });
    }

    if (action === "update") {
      if (!id || !reward) return json({ error: "id_and_reward_required" }, 400);
      const { data: old } = await admin.from("loyalty_rewards").select("*").eq("id", id).maybeSingle();
      if (!old) return json({ error: "not_found" }, 404);
      const patch: any = {};
      for (const k of ["name_fr","name_en","description_fr","description_en","points_required","reward_type","reward_value","is_active","stock_limit"]) {
        if (k in reward) patch[k] = (reward as any)[k];
      }
      if ("points_required" in patch && (!Number.isInteger(patch.points_required) || patch.points_required <= 0)) {
        return json({ error: "invalid_points" }, 400);
      }
      const { data, error } = await admin.from("loyalty_rewards").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await audit("update", old, data, id);
      return json({ ok: true, reward: data });
    }

    if (action === "toggle_active") {
      if (!id) return json({ error: "id_required" }, 400);
      const { data: old } = await admin.from("loyalty_rewards").select("*").eq("id", id).maybeSingle();
      if (!old) return json({ error: "not_found" }, 404);
      const { data, error } = await admin.from("loyalty_rewards").update({ is_active: !old.is_active }).eq("id", id).select().single();
      if (error) throw error;
      await audit("toggle_active", { is_active: old.is_active }, { is_active: data.is_active }, id);
      return json({ ok: true, reward: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("[rewards-catalog-admin]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
