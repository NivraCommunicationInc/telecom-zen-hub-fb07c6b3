import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Verify and decode JWT-like token
async function verifyToken(token: string, secret: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid token format" };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
    const signatureBytes = Uint8Array.from(atob(signatureStr), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
    
    if (!valid) {
      return { valid: false, error: "Invalid signature" };
    }

    const payload = JSON.parse(atob(payloadB64));
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "Token expired" };
    }

    return { valid: true, payload };
  } catch (error) {
    console.error("[verifyToken] Error:", error);
    return { valid: false, error: "Token verification failed" };
  }
}

// Valid status transitions
const validTransitions: Record<string, string[]> = {
  assigned: ["in_progress", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const token = req.headers.get('x-technician-token');
    
    if (!token) {
      console.log("[technician-update-status] Missing token");
      return new Response(
        JSON.stringify({ error: "Token de session requis" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenSecret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const verification = await verifyToken(token, tokenSecret);
    
    if (!verification.valid) {
      console.log("[technician-update-status] Invalid token:", verification.error);
      return new Response(
        JSON.stringify({ error: "Session invalide ou expirée. Veuillez vous reconnecter." }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { technicianId, fullName } = verification.payload;
    
    const { workOrderId, newStatus, note, checklist } = await req.json();
    
    if (!workOrderId || !newStatus) {
      return new Response(
        JSON.stringify({ error: "workOrderId et newStatus requis" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[technician-update-status] Tech: ${fullName} (${technicianId}) updating ${workOrderId} to ${newStatus}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Handle legacy items (order-xxx or appointment-xxx)
    if (workOrderId.startsWith("order-")) {
      const orderId = workOrderId.replace("order-", "");
      
      const { data: order, error: orderFetchError } = await supabase
        .from("orders")
        .select("id, technician_id, status")
        .eq("id", orderId)
        .single();
      
      if (orderFetchError || !order) {
        console.error("[technician-update-status] Order not found:", orderFetchError);
        return new Response(
          JSON.stringify({ error: "Commande non trouvée" }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (order.technician_id !== technicianId) {
        console.log("[technician-update-status] Technician not assigned to order");
        return new Response(
          JSON.stringify({ error: "Vous n'êtes pas assigné à cette commande" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const orderStatus = newStatus === "completed" ? "completed_installation" : 
                        newStatus === "in_progress" ? "processing" : 
                        newStatus === "cancelled" ? "cancelled" : "shipped";
      
      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          status: orderStatus,
          updated_at: now,
        })
        .eq("id", orderId);
      
      if (updateError) {
        console.error("[technician-update-status] Order update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la mise à jour de la commande" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[technician-update-status] Order ${orderId} updated to ${orderStatus}`);
      return new Response(
        JSON.stringify({ success: true, message: "Statut mis à jour" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (workOrderId.startsWith("appointment-")) {
      const appointmentId = workOrderId.replace("appointment-", "");
      
      const { data: appointment, error: aptFetchError } = await supabase
        .from("appointments")
        .select("id, technician_id, status")
        .eq("id", appointmentId)
        .single();
      
      if (aptFetchError || !appointment) {
        console.error("[technician-update-status] Appointment not found:", aptFetchError);
        return new Response(
          JSON.stringify({ error: "Rendez-vous non trouvé" }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (appointment.technician_id !== technicianId) {
        console.log("[technician-update-status] Technician not assigned to appointment");
        return new Response(
          JSON.stringify({ error: "Vous n'êtes pas assigné à ce rendez-vous" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const aptStatus = newStatus === "completed" ? "completed" : 
                       newStatus === "in_progress" ? "in_progress" : 
                       newStatus === "cancelled" ? "cancelled" : "technician_assigned";
      
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: aptStatus,
          updated_at: now,
        })
        .eq("id", appointmentId);
      
      if (updateError) {
        console.error("[technician-update-status] Appointment update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Erreur lors de la mise à jour du rendez-vous" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[technician-update-status] Appointment ${appointmentId} updated to ${aptStatus}`);
      return new Response(
        JSON.stringify({ success: true, message: "Statut mis à jour" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle work_orders table
    const { data: workOrder, error: fetchError } = await supabase
      .from("work_orders")
      .select("id, status, assigned_technician_id, linked_order_id, linked_appointment_id")
      .eq("id", workOrderId)
      .single();
    
    if (fetchError || !workOrder) {
      console.error("[technician-update-status] Work order not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Bon de travail non trouvé" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (workOrder.assigned_technician_id !== technicianId) {
      console.log("[technician-update-status] Technician not assigned to work order");
      return new Response(
        JSON.stringify({ error: "Vous n'êtes pas assigné à ce bon de travail" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const currentStatus = workOrder.status;
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      const message = currentStatus === "completed" 
        ? "Ce bon de travail est déjà terminé"
        : currentStatus === "cancelled"
        ? "Ce bon de travail a été annulé"
        : `Transition invalide de "${currentStatus}" vers "${newStatus}"`;
      
      console.log(`[technician-update-status] Invalid transition: ${currentStatus} -> ${newStatus}`);
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: now,
    };

    if (newStatus === "in_progress") {
      updateData.started_at = now;
    } else if (newStatus === "completed") {
      updateData.completed_at = now;
      if (checklist) {
        updateData.checklist = checklist;
      }
    }

    const { error: updateError } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", workOrderId);

    if (updateError) {
      console.error("[technician-update-status] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la mise à jour: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: logError } = await supabase.from("work_order_updates").insert({
      work_order_id: workOrderId,
      actor_id: technicianId,
      actor_role: "technician",
      actor_name: fullName,
      old_status: currentStatus,
      new_status: newStatus,
      action: "status_change",
      note: note || (newStatus === "in_progress" ? "Travail commencé" : newStatus === "completed" ? "Travail terminé" : "Statut modifié"),
    });

    if (logError) {
      console.warn("[technician-update-status] Log insert warning:", logError);
    }

    if (workOrder.linked_order_id) {
      const orderStatus = newStatus === "completed" ? "completed_installation" : 
                        newStatus === "in_progress" ? "processing" : undefined;
      
      if (orderStatus) {
        await supabase
          .from("orders")
          .update({ status: orderStatus, updated_at: now })
          .eq("id", workOrder.linked_order_id);
      }
    }

    if (workOrder.linked_appointment_id) {
      await supabase
        .from("appointments")
        .update({ 
          status: newStatus === "completed" ? "completed" : 
                 newStatus === "in_progress" ? "in_progress" : "technician_assigned",
          updated_at: now,
        })
        .eq("id", workOrder.linked_appointment_id);
    }

    console.log(`[technician-update-status] Success: ${workOrderId} updated to ${newStatus}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: newStatus === "in_progress" ? "Tâche démarrée" : newStatus === "completed" ? "Tâche terminée" : "Statut mis à jour"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[technician-update-status] Unexpected error:", error);
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: "Erreur inattendue. Veuillez réessayer." }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
