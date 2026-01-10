/**
 * Service Instances Auto-Creation Utility
 * Creates service_instances (1 per service) from order.equipment_details.line_items
 */
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { createAuditNote } from "@/lib/clientAuditNotes";

interface LineItem {
  type: string;
  name: string;
  category: string;
  unit_price: number;
  period?: string;
  ref_id?: string;
}

interface OrderData {
  id: string;
  user_id: string;
  order_number?: string;
  equipment_details?: {
    line_items?: LineItem[];
    [key: string]: any;
  };
  service_type?: string;
}

// Map line item types to service_type in service_instances
const SERVICE_TYPE_MAP: Record<string, string> = {
  mobile: 'mobile',
  tv: 'tv',
  internet: 'internet',
  streaming: 'streaming',
  security: 'security',
  other: 'other',
};

/**
 * Creates service_instances for each service-type line_item in an order
 * Prevents duplicates by checking existing instances for the order
 */
export async function createServiceInstancesFromOrder(
  order: OrderData,
  actorId?: string,
  actorRole: 'admin' | 'employee' | 'system' = 'admin'
): Promise<{ success: boolean; created: number; skipped: number; error?: string }> {
  try {
    const lineItems = order.equipment_details?.line_items || [];
    
    // Filter only service-type items (not equipment, fees, discounts)
    const serviceItems = lineItems.filter(
      (item) => item.category === 'service' && SERVICE_TYPE_MAP[item.type]
    );

    if (serviceItems.length === 0) {
      console.log(`[createServiceInstancesFromOrder] No service items found for order ${order.id}`);
      return { success: true, created: 0, skipped: 0 };
    }

    // Fetch existing service_instances for this order to prevent duplicates
    const { data: existingInstances, error: fetchError } = await supabase
      .from("service_instances")
      .select("id, service_type, plan_name")
      .eq("order_id", order.id);

    if (fetchError) {
      console.error("[createServiceInstancesFromOrder] Error fetching existing instances:", fetchError);
      return { success: false, created: 0, skipped: 0, error: fetchError.message };
    }

    const existingKeys = new Set(
      (existingInstances || []).map((inst) => `${inst.service_type}::${inst.plan_name}`)
    );

    // Prepare new instances to insert
    const newInstances = serviceItems
      .filter((item) => {
        const key = `${SERVICE_TYPE_MAP[item.type]}::${item.name}`;
        return !existingKeys.has(key);
      })
      .map((item) => ({
        user_id: order.user_id,
        order_id: order.id,
        service_type: SERVICE_TYPE_MAP[item.type] || item.type,
        plan_name: item.name,
        status: 'active',
        monthly_price: item.unit_price,
        start_date: new Date().toISOString().split('T')[0],
        metadata: {
          ref_id: item.ref_id,
          period: item.period,
          created_from: 'order_completion',
          order_number: order.order_number,
        },
      }));

    if (newInstances.length === 0) {
      console.log(`[createServiceInstancesFromOrder] All services already exist for order ${order.id}`);
      return { success: true, created: 0, skipped: serviceItems.length };
    }

    // Insert new service instances
    const { error: insertError } = await supabase
      .from("service_instances")
      .insert(newInstances);

    if (insertError) {
      console.error("[createServiceInstancesFromOrder] Insert error:", insertError);
      return { success: false, created: 0, skipped: 0, error: insertError.message };
    }

    // Create audit note
    await createAuditNote({
      clientId: order.user_id,
      eventType: 'status_changed',
      message: `[SERVICE_INSTANCES_CREATED] ${newInstances.length} service(s) créé(s): ${newInstances.map(i => i.plan_name).join(', ')}`,
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        services_created: newInstances.map(i => ({ type: i.service_type, name: i.plan_name })),
      },
      actorId: actorId || 'system',
      actorRole,
    });

    console.log(`[createServiceInstancesFromOrder] Created ${newInstances.length} service instances for order ${order.id}`);
    
    return { 
      success: true, 
      created: newInstances.length, 
      skipped: serviceItems.length - newInstances.length 
    };
  } catch (err: any) {
    console.error("[createServiceInstancesFromOrder] Unexpected error:", err);
    return { success: false, created: 0, skipped: 0, error: err?.message || 'Unknown error' };
  }
}

/**
 * Fetches active service instances for a user
 */
export async function getActiveServiceInstances(userId: string) {
  const { data, error } = await supabase
    .from("service_instances")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getActiveServiceInstances] Error:", error);
    return [];
  }

  return data || [];
}
