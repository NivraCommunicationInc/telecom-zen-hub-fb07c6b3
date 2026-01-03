import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const PIN_SALT = "nivra_employee_salt_2025";

// Simple hash function for PIN
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + PIN_SALT);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate random 4-digit PIN
function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify admin auth via Supabase JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create client with user's JWT to verify they're an admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create service role client for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Accès administrateur requis" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get admin profile for logging
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const { action, params } = await req.json();
    console.log(`[admin-employee-management] Action: ${action} by admin: ${user.id}`);

    let result: any = null;

    switch (action) {
      case "list_employees":
        const { data: employees } = await supabase
          .from("employees")
          .select("id, email, full_name, phone, role, is_active, permissions_json, created_at, updated_at")
          .order("created_at", { ascending: false });
        result = { employees };
        break;

      case "create_employee":
        const normalizedEmail = params.email.trim().toLowerCase();
        
        // Check if email already exists
        const { data: existing } = await supabase
          .from("employees")
          .select("id")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        
        if (existing) {
          return new Response(JSON.stringify({ error: "Un employé avec ce courriel existe déjà" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const tempPin = params.pin || generatePin();
        const pinHash = await hashPin(tempPin);

        const { data: newEmployee, error: createError } = await supabase
          .from("employees")
          .insert({
            email: normalizedEmail,
            full_name: params.full_name,
            phone: params.phone || null,
            pin_hash: pinHash,
            permissions_json: params.permissions || {
              can_view_orders: true,
              can_edit_orders_status: false,
              can_view_appointments: true,
              can_manage_appointments: false,
              can_view_tickets: true,
              can_manage_tickets: true,
              can_view_clients: true,
              can_edit_clients: false,
              can_generate_invoices: false,
              can_edit_invoices: false,
              can_confirm_payments: false,
              can_ship_orders: false,
            },
            created_by_admin_id: user.id,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Log the creation
        await supabase.from("employee_audit_logs").insert({
          actor_role: "admin",
          actor_id: user.id,
          actor_email: adminProfile?.email,
          actor_name: adminProfile?.full_name,
          action: "CREATE_EMPLOYEE",
          target_employee_id: newEmployee.id,
          target_employee_email: normalizedEmail,
          details_json: { full_name: params.full_name },
        });

        result = { 
          employee: newEmployee, 
          tempPin,
          message: "Employé créé avec succès"
        };
        break;

      case "update_employee":
        const updates: any = {};
        if (params.full_name) updates.full_name = params.full_name;
        if (params.phone !== undefined) updates.phone = params.phone;
        if (params.is_active !== undefined) updates.is_active = params.is_active;
        if (params.permissions) updates.permissions_json = params.permissions;

        const { error: updateError } = await supabase
          .from("employees")
          .update(updates)
          .eq("id", params.employeeId);

        if (updateError) throw updateError;

        // Log the update
        await supabase.from("employee_audit_logs").insert({
          actor_role: "admin",
          actor_id: user.id,
          actor_email: adminProfile?.email,
          actor_name: adminProfile?.full_name,
          action: params.is_active === false ? "DISABLE_EMPLOYEE" : "UPDATE_EMPLOYEE",
          target_employee_id: params.employeeId,
          details_json: { updates },
        });

        result = { success: true };
        break;

      case "reset_pin":
        const newPin = generatePin();
        const newPinHash = await hashPin(newPin);

        const { error: resetError } = await supabase
          .from("employees")
          .update({ 
            pin_hash: newPinHash,
            failed_login_attempts: 0,
            lockout_until: null,
          })
          .eq("id", params.employeeId);

        if (resetError) throw resetError;

        // Log the reset
        await supabase.from("employee_audit_logs").insert({
          actor_role: "admin",
          actor_id: user.id,
          actor_email: adminProfile?.email,
          actor_name: adminProfile?.full_name,
          action: "RESET_PIN",
          target_employee_id: params.employeeId,
          details_json: {},
        });

        result = { newPin, message: "Code PIN réinitialisé" };
        break;

      case "delete_employee":
        const { error: deleteError } = await supabase
          .from("employees")
          .delete()
          .eq("id", params.employeeId);

        if (deleteError) throw deleteError;

        await supabase.from("employee_audit_logs").insert({
          actor_role: "admin",
          actor_id: user.id,
          actor_email: adminProfile?.email,
          actor_name: adminProfile?.full_name,
          action: "DELETE_EMPLOYEE",
          target_employee_id: params.employeeId,
          details_json: {},
        });

        result = { success: true };
        break;

      case "get_audit_logs":
        const { data: logs } = await supabase
          .from("employee_audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params?.limit || 50);
        result = { logs };
        break;

      default:
        return new Response(JSON.stringify({ error: "Action non reconnue" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("[admin-employee-management] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inattendue";
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
    );
  }
});
