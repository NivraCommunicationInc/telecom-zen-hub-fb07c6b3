/**
 * Order Orchestration Engine (Client-side)
 * 
 * Calls the DB-side `orchestrate_order` RPC to atomically create
 * order_items, provisioning_jobs, and shipments from a confirmed order.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

// Re-export pure logic for consumers
export {
  buildProvisioningGraph,
  detectServiceCategories,
  SERVICE_DEPENDENCIES,
  SERVICE_JOB_MAP,
  type ServiceCategory,
  type ServiceDependency,
  type ProvisioningNode,
} from "./orderOrchestration.pure";

export interface OrchestrationResult {
  status: 'orchestrated' | 'already_orchestrated' | 'error';
  order_id: string;
  items_created?: number;
  jobs_created?: number;
  shipments_created?: number;
  has_internet?: boolean;
  has_tv?: boolean;
  has_mobile?: boolean;
  error?: string;
}

/**
 * Orchestrate an order: create order_items, provisioning_jobs, shipments.
 * Idempotent — safe to call multiple times.
 * @param client - Optional supabase client to use (portal/admin). Falls back to default client.
 */
export async function orchestrateOrder(orderId: string, client?: SupabaseClient): Promise<OrchestrationResult> {
  const db = client || supabase;
  try {
    const { data, error } = await db.rpc('orchestrate_order', {
      p_order_id: orderId,
    });

    if (error) {
      console.error('[Orchestration] RPC error:', error);
      return { status: 'error', order_id: orderId, error: error.message };
    }

    const result = data as unknown as OrchestrationResult;
    console.log('[Orchestration] Result:', result);
    return result;
  } catch (err: any) {
    console.error('[Orchestration] Exception:', err);
    return { status: 'error', order_id: orderId, error: err.message };
  }
}
