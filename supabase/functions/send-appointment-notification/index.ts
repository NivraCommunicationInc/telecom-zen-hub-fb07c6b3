/**
 * send-appointment-notification
 * Queues email notifications for appointment events via pgmq
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

interface NotificationRequest {
  email: string;
  name: string;
  appointmentTitle: string;
  appointmentDate: string;
  appointmentTime?: string;
  appointmentType?: string;
  orderNumber?: string;
  serviceAddress?: string;
  serviceAddressLine2?: string;
  instructions?: string;
  status: "confirmed" | "updated" | "cancelled" | "completed";
  notes?: string;
  appointmentId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const { 
      email, name, appointmentTitle, appointmentDate, appointmentTime,
      appointmentType, orderNumber, serviceAddress, serviceAddressLine2,
      instructions, status, notes, appointmentId,
    } = body;

    console.log(`[${requestId}] Queuing appointment notification: status=${status}, to=${email?.substring(0, 3)}***`);

    // SAFEGUARD: If this is a confirmation request, validate the appointment has a linked order
    if (status === "confirmed" && appointmentId) {
      const { data: apt } = await supabase
        .from("appointments")
        .select("id, status, order_id")
        .eq("id", appointmentId)
        .maybeSingle();

      if (apt?.status === "hold" || !apt?.order_id) {
        console.log(`[${requestId}] BLOCKED: Cannot send confirmation email for hold/unlinked appointment`);
        return new Response(JSON.stringify({ 
          success: false, blocked: true, reason: "appointment_not_confirmed_yet",
        }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const templateKeyMap: Record<string, string> = {
      confirmed: "appointment_scheduled",
      updated: "appointment_updated",
      cancelled: "appointment_cancelled",
      completed: "order_completed",
    };

    const templateKey = templateKeyMap[status];
    if (!templateKey) {
      return new Response(JSON.stringify({ success: false, error: "Unknown appointment status" }), { 
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    const eventKey = `appointment_${status}_${appointmentId || appointmentDate}_${email}`;
    const parsedDate = new Date(appointmentDate);
    const fullAddress = serviceAddressLine2 ? `${serviceAddress}, ${serviceAddressLine2}` : serviceAddress;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey,
      toEmail: email,
      templateVars: {
        client_name: name?.split(" ")[0] || "Client",
        title: appointmentTitle || appointmentType || "Rendez-vous",
        scheduled_at: parsedDate.toISOString(),
        service_address: fullAddress,
        order_number: orderNumber,
        cancellation_reason: status === "cancelled" ? notes : undefined,
        portal_path: "/portal/appointments",
      },
    });

    if (result.alreadyQueued) {
      console.log(`[${requestId}] Email already queued/sent for this event`);
    } else {
      console.log(`[${requestId}] Email queued via pgmq with template: ${templateKey}`);
    }

    return new Response(JSON.stringify({ 
      success: result.success, queued: true, template: templateKey,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(req.headers.get('origin')) } 
    });
  }
};

serve(handler);
