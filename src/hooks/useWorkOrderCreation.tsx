import { supabase } from "@/integrations/supabase/client";

interface WorkOrderData {
  type?: "installation" | "service_call" | "replacement" | "maintenance";
  linkedOrderId?: string;
  linkedAppointmentId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceAddress?: string;
  serviceCity?: string;
  servicePostalCode?: string;
  serviceProvince?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  assignedTechnicianId: string;
  assignedBy?: string;
  priority?: "normal" | "urgent" | "low";
  serviceType?: string;
  notes?: string;
  equipmentDetails?: any[];
}

interface CreateWorkOrderResult {
  success: boolean;
  workOrderId?: string;
  workOrderNumber?: string;
  error?: string;
}

/**
 * Creates a work order in the work_orders table.
 * This is the single source of truth for technician assignments.
 */
export const createWorkOrder = async (data: WorkOrderData): Promise<CreateWorkOrderResult> => {
  try {
    // Check if a work order already exists for this order/appointment
    let existingQuery = supabase.from("work_orders").select("id, work_order_number");
    
    if (data.linkedOrderId) {
      existingQuery = existingQuery.eq("linked_order_id", data.linkedOrderId);
    } else if (data.linkedAppointmentId) {
      existingQuery = existingQuery.eq("linked_appointment_id", data.linkedAppointmentId);
    }
    
    const { data: existing } = await existingQuery.maybeSingle();
    
    if (existing) {
      // Update existing work order with new technician
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({
          assigned_technician_id: data.assignedTechnicianId,
          assigned_at: new Date().toISOString(),
          assigned_by: data.assignedBy,
          status: "assigned",
          // Update client info if provided
          client_name: data.clientName || undefined,
          client_email: data.clientEmail || undefined,
          client_phone: data.clientPhone || undefined,
          service_address: data.serviceAddress || undefined,
          service_city: data.serviceCity || undefined,
          service_postal_code: data.servicePostalCode || undefined,
          scheduled_start: data.scheduledStart || undefined,
        })
        .eq("id", existing.id);
      
      if (updateError) throw updateError;
      
      // Log the update
      await supabase.from("work_order_updates").insert({
        work_order_id: existing.id,
        actor_id: data.assignedBy,
        actor_role: "admin",
        action: "technician_reassigned",
        new_status: "assigned",
        note: "Technicien réassigné",
      });
      
      return { 
        success: true, 
        workOrderId: existing.id, 
        workOrderNumber: existing.work_order_number 
      };
    }
    
    // Create new work order
    const { data: newWorkOrder, error: insertError } = await supabase
      .from("work_orders")
      .insert({
        type: data.type || "installation",
        linked_order_id: data.linkedOrderId || null,
        linked_appointment_id: data.linkedAppointmentId || null,
        client_id: data.clientId || null,
        client_name: data.clientName || null,
        client_email: data.clientEmail || null,
        client_phone: data.clientPhone || null,
        service_address: data.serviceAddress || null,
        service_city: data.serviceCity || null,
        service_postal_code: data.servicePostalCode || null,
        service_province: data.serviceProvince || "QC",
        scheduled_start: data.scheduledStart || null,
        scheduled_end: data.scheduledEnd || null,
        assigned_technician_id: data.assignedTechnicianId,
        assigned_at: new Date().toISOString(),
        assigned_by: data.assignedBy || null,
        status: "assigned",
        priority: data.priority || "normal",
        service_type: data.serviceType || null,
        notes: data.notes || null,
        equipment_details: data.equipmentDetails || [],
        created_by: data.assignedBy || null,
      })
      .select("id, work_order_number")
      .single();
    
    if (insertError) throw insertError;
    
    // Log the creation
    await supabase.from("work_order_updates").insert({
      work_order_id: newWorkOrder.id,
      actor_id: data.assignedBy,
      actor_role: "admin",
      action: "created",
      new_status: "assigned",
      note: "Bon de travail créé et technicien assigné",
    });
    
    return { 
      success: true, 
      workOrderId: newWorkOrder.id, 
      workOrderNumber: newWorkOrder.work_order_number 
    };
  } catch (error: any) {
    console.error("Error creating work order:", error);
    return { 
      success: false, 
      error: error.message || "Failed to create work order" 
    };
  }
};

/**
 * Updates the status of a work order.
 */
export const updateWorkOrderStatus = async (
  workOrderId: string,
  newStatus: "assigned" | "scheduled" | "in_progress" | "completed" | "cancelled",
  actorId?: string,
  actorRole?: string,
  note?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get current status
    const { data: current } = await supabase
      .from("work_orders")
      .select("status")
      .eq("id", workOrderId)
      .single();
    
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    
    if (newStatus === "in_progress") {
      updateData.started_at = new Date().toISOString();
    } else if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", workOrderId);
    
    if (error) throw error;
    
    // Log the status change
    await supabase.from("work_order_updates").insert({
      work_order_id: workOrderId,
      actor_id: actorId,
      actor_role: actorRole || "admin",
      old_status: current?.status,
      new_status: newStatus,
      action: "status_change",
      note: note || `Statut changé à ${newStatus}`,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("Error updating work order status:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancels a work order and optionally unassigns the technician.
 */
export const cancelWorkOrder = async (
  workOrderId: string,
  actorId?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("work_orders")
      .update({
        status: "cancelled",
        assigned_technician_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workOrderId);
    
    if (error) throw error;
    
    await supabase.from("work_order_updates").insert({
      work_order_id: workOrderId,
      actor_id: actorId,
      actor_role: "admin",
      action: "cancelled",
      new_status: "cancelled",
      note: reason || "Bon de travail annulé",
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
