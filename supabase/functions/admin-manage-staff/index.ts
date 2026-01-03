import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StaffRole = "admin" | "employee" | "technician";

interface CreateStaffRequest {
  action: "create";
  email: string;
  full_name: string;
  role: StaffRole;
  require_password_change?: boolean;
}

interface DisableEnableRequest {
  action: "disable" | "enable";
  user_id: string;
}

interface ChangeRoleRequest {
  action: "change_role";
  user_id: string;
  new_role: StaffRole;
}

interface SendResetRequest {
  action: "send_reset";
  email: string;
}

type RequestBody = CreateStaffRequest | DisableEnableRequest | ChangeRoleRequest | SendResetRequest;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      return new Response(
        JSON.stringify({ error: "Session invalide" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Accès réservé aux administrateurs" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // Helper to log action with target info
    const logAction = async (
      action: string, 
      details: Record<string, unknown>,
      target?: { type?: string; id?: string; email?: string }
    ) => {
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: callingUser.id,
        admin_email: callingUser.email,
        action,
        details,
        ip_address: ipAddress,
        target_type: target?.type || null,
        target_id: target?.id || null,
        target_email: target?.email || null,
      });
    };

    switch (body.action) {
      case "create": {
        const { email, full_name, role, require_password_change = true } = body;

        if (!email || !full_name || !role) {
          return new Response(
            JSON.stringify({ error: "Email, nom complet et rôle requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!["admin", "employee", "technician"].includes(role)) {
          return new Response(
            JSON.stringify({ error: "Rôle invalide" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate secure temporary password
        const array = new Uint8Array(20);
        crypto.getRandomValues(array);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let tempPassword = '';
        for (let i = 0; i < 20; i++) {
          tempPassword += chars[array[i] % chars.length];
        }

        // Create auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { 
            full_name,
            require_password_change,
          },
        });

        if (authError) {
          console.error("[admin-manage-staff] Create error:", authError);
          if (authError.message?.includes("already registered")) {
            return new Response(
              JSON.stringify({ error: "Un utilisateur avec cet email existe déjà" }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!authData.user) {
          return new Response(
            JSON.stringify({ error: "Échec de création" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update profile
        await adminClient.from("profiles").update({
          full_name,
          is_staff: true,
        }).eq("user_id", authData.user.id);

        // Set role (delete existing client role, insert new role)
        await adminClient.from("user_roles").delete().eq("user_id", authData.user.id);
        await adminClient.from("user_roles").insert({
          user_id: authData.user.id,
          role: role,
        });

        // For technicians, create technician record
        if (role === "technician") {
          await adminClient.from("technicians").insert({
            user_id: authData.user.id,
            email,
            full_name,
            status: "active",
            phone: null,
          });
        }

        await logAction("staff_created", { 
          role,
          require_password_change,
        }, { type: "user", id: authData.user.id, email });

        // Send password reset email so user can set their own password
        if (require_password_change) {
          const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://nivratelecom.ca";
          const resetUrl = `${appBaseUrl}/admin/reset-password`;
          console.log(`[admin-manage-staff] Sending reset email to ${email} with redirect: ${resetUrl}`);
          await adminClient.auth.resetPasswordForEmail(email, {
            redirectTo: resetUrl,
          });
        }

        console.log(`[admin-manage-staff] Created staff user: ${email} with role ${role}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: { id: authData.user.id, email },
            message: "Utilisateur créé. Un email de configuration du mot de passe a été envoyé.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "disable": {
        const { user_id } = body;

        // Prevent self-disable
        if (user_id === callingUser.id) {
          return new Response(
            JSON.stringify({ error: "Vous ne pouvez pas vous désactiver vous-même" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get target user info for logging
        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h", // ~100 years = effectively disabled
        });

        if (error) {
          console.error("[admin-manage-staff] Disable error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAction("staff_disabled", {}, { 
          type: "user", 
          id: user_id, 
          email: targetUser?.user?.email 
        });

        return new Response(
          JSON.stringify({ success: true, message: "Utilisateur désactivé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "enable": {
        const { user_id } = body;

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });

        if (error) {
          console.error("[admin-manage-staff] Enable error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAction("staff_enabled", {}, { 
          type: "user", 
          id: user_id, 
          email: targetUser?.user?.email 
        });

        return new Response(
          JSON.stringify({ success: true, message: "Utilisateur activé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "change_role": {
        const { user_id, new_role } = body;

        if (!["admin", "employee", "technician"].includes(new_role)) {
          return new Response(
            JSON.stringify({ error: "Rôle invalide" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Prevent changing own role
        if (user_id === callingUser.id) {
          return new Response(
            JSON.stringify({ error: "Vous ne pouvez pas changer votre propre rôle" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get current role
        const { data: currentRole } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id)
          .maybeSingle();

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        // Update role
        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        await adminClient.from("user_roles").insert({
          user_id,
          role: new_role,
        });

        // Handle technician record
        if (new_role === "technician") {
          const { data: existingTech } = await adminClient
            .from("technicians")
            .select("id")
            .eq("user_id", user_id)
            .maybeSingle();

          if (!existingTech) {
            const { data: profile } = await adminClient
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", user_id)
              .maybeSingle();

            await adminClient.from("technicians").insert({
              user_id,
              email: targetUser?.user?.email || profile?.email,
              full_name: profile?.full_name || "Staff User",
              status: "active",
            });
          }
        }

        await logAction("staff_role_changed", { 
          old_role: currentRole?.role,
          new_role,
        }, { type: "user", id: user_id, email: targetUser?.user?.email });

        return new Response(
          JSON.stringify({ success: true, message: `Rôle changé en ${new_role}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "send_reset": {
        const { email } = body;

        const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://nivratelecom.ca";
        const resetUrl = `${appBaseUrl}/admin/reset-password`;
        console.log(`[admin-manage-staff] Sending reset email to ${email} with redirect: ${resetUrl}`);
        const { error } = await adminClient.auth.resetPasswordForEmail(email, {
          redirectTo: resetUrl,
        });

        if (error) {
          console.error("[admin-manage-staff] Reset error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await logAction("staff_password_reset_sent", {}, { type: "user", email });

        return new Response(
          JSON.stringify({ success: true, message: "Email de réinitialisation envoyé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Action non reconnue" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: unknown) {
    console.error("[admin-manage-staff] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
