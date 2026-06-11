/**
 * provisioning-engine — Nivra OSS Provisioning Layer
 *
 * Abstract provisioning engine that decouples commercial events from
 * network operations. Designed to be adapter-agnostic:
 *
 *   Commercial event (payment, cancellation, plan change)
 *       ↓
 *   Provisioning Engine
 *       ↓
 *   Adapter (RADIUS / OLT / ONT / MikroTik / Ubiquiti / TR-069 / Manual)
 *       ↓
 *   Network service activated / deactivated / modified
 *
 * Current adapters:
 *   - "manual"  : logs the command + alerts admin for manual execution
 *
 * Future adapters (add without changing this interface):
 *   - "radius"  : FreeRADIUS / RadiusDesk API
 *   - "olt"     : GPON OLT (ZTE / Huawei / FiberHome) via NETCONF/REST
 *   - "mikrotik": RouterOS API
 *   - "ubiquiti": UniFi Controller API
 *   - "tr069"   : ACS (GenieACS / OpenACS)
 *
 * Trigger sources:
 *   - paypal-webhook         (payment received)
 *   - billing-lifecycle      (suspension / reactivation)
 *   - cancel-account         (termination)
 *   - billing-generate-renewals (new cycle)
 *   - client-plan-change     (speed / plan modification)
 *
 * Every provisioning action is logged in provisioning_log.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ProvisioningAction =
  | "activate"      // Service actif → RADIUS allow / OLT enable / DHCP lease
  | "deactivate"    // Suspension → RADIUS deny / OLT disable
  | "terminate"     // Résiliation → deactivate + remove config
  | "modify"        // Changement de forfait → speed change, VLAN update
  | "reset"         // Reset équipement / mot de passe
  | "suspend"       // Suspension temporaire (J+5)
  | "reactivate";   // Réactivation après paiement

type AdapterType = "manual" | "radius" | "olt" | "mikrotik" | "ubiquiti" | "tr069";

interface ProvisioningRequest {
  action: ProvisioningAction;
  subscription_id: string;
  customer_id: string;
  trigger?: string;                // Source de la demande
  adapter?: AdapterType;           // Forcer un adaptateur spécifique
  parameters?: Record<string, unknown>; // Paramètres additionnels
  // Metadata optionnel
  plan_name?: string;
  plan_speed_down?: number;        // Mbps
  plan_speed_up?: number;          // Mbps
  ip_address?: string;
  mac_address?: string;
  ont_serial?: string;
  vlan_id?: number;
  pppoe_username?: string;
  radius_username?: string;
}

interface ProvisioningResult {
  success: boolean;
  action: ProvisioningAction;
  adapter: AdapterType;
  status: "success" | "queued_manual" | "failed" | "skipped";
  log_id?: string;
  message: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER: MANUAL (always available — logs + admin alert)
// ─────────────────────────────────────────────────────────────────────────────

async function manualAdapter(
  supabase: ReturnType<typeof createClient>,
  req: ProvisioningRequest,
): Promise<{ status: "queued_manual"; message: string }> {
  const actionLabels: Record<ProvisioningAction, string> = {
    activate:   "Activer le service",
    deactivate: "Désactiver le service",
    terminate:  "Résilier et supprimer la config",
    modify:     "Modifier les paramètres du service",
    reset:      "Réinitialiser l'équipement",
    suspend:    "Suspendre le service",
    reactivate: "Réactiver le service après paiement",
  };

  // Alert admin for manual execution
  await supabase.from("billing_system_alerts").insert({
    alert_type: "provisioning_manual_required",
    entity_type: "billing_subscription",
    entity_id: req.subscription_id,
    severity: req.action === "terminate" ? "high" : "warning",
    message: `[PROVISIONING MANUEL REQUIS] ${actionLabels[req.action]} — abonnement ${req.subscription_id}`,
    details: {
      action: req.action,
      customer_id: req.customer_id,
      trigger: req.trigger,
      plan_name: req.plan_name,
      ip_address: req.ip_address,
      mac_address: req.mac_address,
      ont_serial: req.ont_serial,
      vlan_id: req.vlan_id,
      pppoe_username: req.pppoe_username,
      instructions: actionLabels[req.action],
    },
    resolved: false,
  }).catch(() => {});

  return {
    status: "queued_manual",
    message: `Action "${req.action}" mise en file — exécution manuelle requise`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER: RADIUS (stub — ready for FreeRADIUS/RadiusDesk integration)
// ─────────────────────────────────────────────────────────────────────────────

async function radiusAdapter(
  _supabase: ReturnType<typeof createClient>,
  req: ProvisioningRequest,
): Promise<{ status: "success" | "failed"; message: string }> {
  const radiusApiUrl = Deno.env.get("RADIUS_API_URL");
  const radiusApiKey = Deno.env.get("RADIUS_API_KEY");

  if (!radiusApiUrl || !radiusApiKey) {
    console.warn("[provisioning-engine] RADIUS_API_URL or RADIUS_API_KEY not configured");
    return { status: "failed", message: "RADIUS adapter not configured" };
  }

  // Map Nivra action → RADIUS command
  const radiusCommands: Record<ProvisioningAction, string> = {
    activate:   "enable",
    reactivate: "enable",
    deactivate: "disable",
    suspend:    "disable",
    terminate:  "delete",
    modify:     "update",
    reset:      "reset",
  };

  try {
    const response = await fetch(`${radiusApiUrl}/api/users/${req.radius_username || req.pppoe_username}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${radiusApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: radiusCommands[req.action],
        attributes: {
          "Mikrotik-Rate-Limit": req.plan_speed_down
            ? `${req.plan_speed_up || req.plan_speed_down}M/${req.plan_speed_down}M`
            : undefined,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { status: "failed", message: `RADIUS API error: ${response.status} ${err}` };
    }

    return { status: "success", message: `RADIUS ${radiusCommands[req.action]} applied` };
  } catch (e: unknown) {
    return { status: "failed", message: `RADIUS adapter exception: ${e}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER: OLT (stub — ready for GPON integration)
// ─────────────────────────────────────────────────────────────────────────────

async function oltAdapter(
  _supabase: ReturnType<typeof createClient>,
  req: ProvisioningRequest,
): Promise<{ status: "success" | "failed"; message: string }> {
  const oltApiUrl = Deno.env.get("OLT_API_URL");
  if (!oltApiUrl) return { status: "failed", message: "OLT adapter not configured" };

  // ONT serial required for OLT operations
  if (!req.ont_serial) return { status: "failed", message: "ont_serial required for OLT adapter" };

  try {
    const endpoint = req.action === "activate" || req.action === "reactivate"
      ? "enable" : req.action === "terminate" ? "delete" : "disable";

    const response = await fetch(`${oltApiUrl}/api/ont/${req.ont_serial}/${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OLT_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vlan_id: req.vlan_id }),
    });

    if (!response.ok) return { status: "failed", message: `OLT API error ${response.status}` };
    return { status: "success", message: `OLT ONT ${req.ont_serial} ${endpoint}` };
  } catch (e: unknown) {
    return { status: "failed", message: `OLT exception: ${e}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

function selectAdapter(req: ProvisioningRequest): AdapterType {
  // Explicit adapter override
  if (req.adapter) return req.adapter;

  // Auto-select based on available env vars
  if (Deno.env.get("RADIUS_API_URL") && req.radius_username) return "radius";
  if (Deno.env.get("OLT_API_URL") && req.ont_serial) return "olt";

  // Default: manual (always safe)
  return "manual";
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENGINE
// ─────────────────────────────────────────────────────────────────────────────

async function executeProvisioning(
  supabase: ReturnType<typeof createClient>,
  req: ProvisioningRequest,
): Promise<ProvisioningResult> {
  const adapter = selectAdapter(req);
  const startedAt = new Date().toISOString();

  console.log(`[provisioning-engine] ${req.action} | adapter:${adapter} | sub:${req.subscription_id} | trigger:${req.trigger}`);

  // Execute against selected adapter
  let adapterResult: { status: "success" | "failed" | "queued_manual"; message: string };

  switch (adapter) {
    case "radius":
      adapterResult = await radiusAdapter(supabase, req);
      break;
    case "olt":
      adapterResult = await oltAdapter(supabase, req);
      break;
    default:
      adapterResult = await manualAdapter(supabase, req);
  }

  const success = adapterResult.status === "success";

  // ── Log to provisioning_log ─────────────────────────────────────
  const { data: logRow } = await supabase.from("provisioning_log").insert({
    subscription_id: req.subscription_id,
    customer_id: req.customer_id,
    action: req.action,
    adapter,
    trigger: req.trigger || "api",
    status: adapterResult.status,
    details: {
      ...req.parameters,
      plan_name: req.plan_name,
      ip_address: req.ip_address,
      mac_address: req.mac_address,
      ont_serial: req.ont_serial,
      vlan_id: req.vlan_id,
      pppoe_username: req.pppoe_username,
      adapter_message: adapterResult.message,
    },
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  }).select("id").single().catch(() => ({ data: null }));

  return {
    success,
    action: req.action,
    adapter,
    status: adapterResult.status as ProvisioningResult["status"],
    log_id: logRow?.id,
    message: adapterResult.message,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Accept service role key as auth (internal calls only)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceKey) {
      return json(403, { error: "Service role key required" });
    }

    const body = await req.json() as ProvisioningRequest;

    if (!body.action || !body.subscription_id || !body.customer_id) {
      return json(400, { error: "action, subscription_id, customer_id required" });
    }

    const result = await executeProvisioning(supabase, body);
    return json(result.success || result.status === "queued_manual" ? 200 : 500, result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[provisioning-engine] Error:", msg);
    return json(500, { error: msg });
  }
});
