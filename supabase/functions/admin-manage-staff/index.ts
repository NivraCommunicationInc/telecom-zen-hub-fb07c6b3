import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";

type StaffRole = "admin" | "employee" | "technician";

interface PermissionSet {
  view_clients?: boolean;
  manage_clients?: boolean;
  view_orders?: boolean;
  manage_orders?: boolean;
  view_billing?: boolean;
  manage_billing?: boolean;
  view_appointments?: boolean;
  manage_appointments?: boolean;
  view_tickets?: boolean;
  manage_tickets?: boolean;
  view_logs?: boolean;
  view_internal_notes?: boolean;
  export_data?: boolean;
  manage_staff?: boolean;
  manage_streaming?: boolean;
  manage_channels?: boolean;
}

interface CreateStaffRequest {
  action: "create";
  email: string;
  full_name: string;
  role: StaffRole;
  require_password_change?: boolean;
  permissions?: PermissionSet;
  // Extended fields
  phone?: string;
  badge_number?: string;
  job_title?: string;
  pin?: string;
  require_pin_change?: boolean;
  is_active?: boolean;
  send_invitation?: boolean;
  internal_note?: string;
}

interface UpdatePermissionsRequest {
  action: "update_permissions";
  user_id: string;
  permissions: PermissionSet;
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

interface ApplyRolePackRequest {
  action: "apply_role_pack";
  user_id: string;
}

interface SetPinRequest {
  action: "set_pin" | "reset_pin";
  user_id: string;
  pin: string;
  require_pin_change?: boolean;
}

interface UpdateProfileRequest {
  action: "update_profile";
  user_id: string;
  full_name?: string;
  phone?: string;
  badge_number?: string;
  job_title?: string;
}

interface ForcePasswordChangeRequest {
  action: "force_password_change";
  user_id: string;
  require_change: boolean;
}

type RequestBody = CreateStaffRequest | DisableEnableRequest | ChangeRoleRequest | SendResetRequest | UpdatePermissionsRequest | ApplyRolePackRequest | SetPinRequest | UpdateProfileRequest | ForcePasswordChangeRequest;

// PIN hashing function (must match client-side)
const SALT = 'nivra_pin_salt_2026';
async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type ApiError = {
  code: string;
  message: string;
  step: string;
};

const isMissingSecret = (name: string): boolean => {
  const v = Deno.env.get(name);
  return !v || v.trim() === "" || v === name;
};

const joinUrl = (base: string, path: string) => {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
};

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  // Never return an empty body (even for preflight)
  if (req.method === "OPTIONS") {
    return json(200, { ok: true, request_id: requestId, preflight: true });
  }

  // Top-level safety net: any throw returns JSON
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, {
        ok: false,
        request_id: requestId,
        error: { code: "UNAUTHORIZED", message: "Non autorisé", step: "auth_header" } satisfies ApiError,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      const missing = [
        ...(isMissingSecret("SUPABASE_URL") ? ["SUPABASE_URL"] : []),
        ...(isMissingSecret("SUPABASE_ANON_KEY") ? ["SUPABASE_ANON_KEY"] : []),
        ...(isMissingSecret("SUPABASE_SERVICE_ROLE_KEY") ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
      ];

      return json(500, {
        ok: false,
        request_id: requestId,
        error: { code: "MISSING_SECRETS", message: "Secrets requis manquants", step: "init" } satisfies ApiError,
        missing_secrets: missing,
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callingUser },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !callingUser) {
      return json(401, {
        ok: false,
        request_id: requestId,
        error: { code: "INVALID_SESSION", message: "Session invalide", step: "get_user" } satisfies ApiError,
      });
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
      return json(403, {
        ok: false,
        request_id: requestId,
        error: {
          code: "FORBIDDEN",
          message: "Accès réservé aux administrateurs",
          step: "verify_admin",
        } satisfies ApiError,
      });
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch (e: unknown) {
      const err = e as Error;
      return json(400, {
        ok: false,
        request_id: requestId,
        error: { code: "BAD_REQUEST", message: "JSON invalide", step: "parse_body" } satisfies ApiError,
        stack: err.stack,
      });
    }

    const ipAddress =
      req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    const logAction = async (
      action: string,
      details: Record<string, unknown>,
      target?: { type?: string; id?: string; email?: string }
    ) => {
      try {
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
      } catch (e) {
        console.error("[admin-manage-staff] Failed to write admin_audit_log:", e);
      }
    };

    switch (body.action) {
      case "create": {
        const { 
          email, 
          full_name, 
          role, 
          require_password_change = true,
          phone,
          badge_number,
          job_title,
          pin,
          require_pin_change = false,
          is_active = true,
          send_invitation = true,
          internal_note,
        } = body;
        const createStep = "create";
        console.log(`[admin-manage-staff] ${createStep}.start email=${email} role=${role} request_id=${requestId}`);

        // Step: validate_input
        if (!email || !full_name || !role) {
          const step = `${createStep}.validate_input`;
          await logAction("staff_create_failed", {
            request_id: requestId,
            step,
            message: "Email, nom complet et rôle requis",
            target_email: email,
          }, { type: "user", email });

          return json(400, {
            ok: false,
            request_id: requestId,
            step,
            message: "Email, nom complet et rôle requis",
            http_status: 400,
            supabase_error: null,
            details: { email, full_name, role },
          });
        }

        // Validate badge_number uniqueness if provided
        if (badge_number) {
          const { data: existingBadge } = await adminClient
            .from("employees")
            .select("id")
            .eq("badge_number", badge_number)
            .maybeSingle();
          
          if (existingBadge) {
            return json(400, {
              ok: false,
              request_id: requestId,
              step: `${createStep}.validate_badge`,
              message: "Ce numéro de badge est déjà utilisé",
              http_status: 400,
            });
          }
        }

        // Validate PIN for non-admin roles
        if (role !== "admin" && pin && !/^\d{4}$/.test(pin)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            step: `${createStep}.validate_pin`,
            message: "Le PIN doit être exactement 4 chiffres",
            http_status: 400,
          });
        }

        if (!(["admin", "employee", "technician"] as const).includes(role)) {
          const step = `${createStep}.validate_input`;
          await logAction("staff_create_failed", {
            request_id: requestId,
            step,
            message: "Rôle invalide",
            target_email: email,
          }, { type: "user", email });

          return json(400, {
            ok: false,
            request_id: requestId,
            step,
            message: "Rôle invalide",
            http_status: 400,
            supabase_error: null,
            details: { role },
          });
        }

        // Generate secure temporary password
        const array = new Uint8Array(20);
        crypto.getRandomValues(array);
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let tempPassword = "";
        for (let i = 0; i < 20; i++) {
          tempPassword += chars[array[i] % chars.length];
        }

        // Step: auth_create_user
        const stepAuthCreate = `${createStep}.auth_create_user`;
        console.log(`[admin-manage-staff] ${stepAuthCreate} email=${email}`);

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name,
            require_password_change,
          },
        });

        let userId: string;
        let mode: "new_user_created" | "existing_user_promoted" = "new_user_created";

        if (authError) {
          const isEmailExists = 
            authError.message?.toLowerCase().includes("already registered") ||
            authError.message?.toLowerCase().includes("email_exists") ||
            (authError as any).code === "email_exists";

          if (isEmailExists) {
            // Mode: promote existing user
            console.log(`[admin-manage-staff] ${stepAuthCreate} email_exists - switching to promote mode`);
            mode = "existing_user_promoted";

            // Step: auth_lookup_existing_user
            const stepLookup = `${createStep}.auth_lookup_existing_user`;
            console.log(`[admin-manage-staff] ${stepLookup} searching for email=${email}`);

            // List users and find by exact email match
            const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
              perPage: 1000,
            });

            if (listError) {
              console.error(`[admin-manage-staff] ${stepLookup} listUsers error:`, listError);
              await logAction("staff_create_failed", {
                request_id: requestId,
                step: stepLookup,
                message: listError.message,
                target_email: email,
                supabase_error: { code: (listError as any).code, message: listError.message },
              }, { type: "user", email });

              return json(500, {
                ok: false,
                request_id: requestId,
                step: stepLookup,
                message: `Erreur recherche utilisateur: ${listError.message}`,
                http_status: 500,
                supabase_error: { code: (listError as any).code, message: listError.message },
                details: { email },
                provider_response: { supabase_url: supabaseUrl?.slice(0, 50) },
              });
            }

            const existingUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email.toLowerCase()
            );

            if (!existingUser) {
              // This is strange - email_exists but user not found
              console.error(`[admin-manage-staff] ${stepLookup} email_exists returned but user not found!`);
              await logAction("staff_create_failed", {
                request_id: requestId,
                step: stepLookup,
                message: "email_exists mais utilisateur introuvable",
                target_email: email,
                supabase_error: { original_error: authError.message },
                users_count: listData?.users?.length || 0,
              }, { type: "user", email });

              return json(409, {
                ok: false,
                request_id: requestId,
                step: stepLookup,
                message: "Email marqué comme existant mais utilisateur introuvable. Veuillez réessayer.",
                http_status: 409,
                supabase_error: { code: (authError as any).code, message: authError.message },
                details: { email, users_searched: listData?.users?.length || 0 },
                provider_response: { supabase_url: supabaseUrl?.slice(0, 50) },
              });
            }

            userId = existingUser.id;
            console.log(`[admin-manage-staff] ${stepLookup} found existing user_id=${userId}`);
          } else {
            // Other auth error - fail normally
            console.error(`[admin-manage-staff] ${stepAuthCreate} error:`, authError);
            await logAction("staff_create_failed", {
              request_id: requestId,
              step: stepAuthCreate,
              message: authError.message,
              target_email: email,
              supabase_error: { code: (authError as any).code, message: authError.message, status: (authError as any).status },
            }, { type: "user", email });

            return json(400, {
              ok: false,
              request_id: requestId,
              step: stepAuthCreate,
              message: authError.message,
              http_status: 400,
              supabase_error: { code: (authError as any).code, message: authError.message, status: (authError as any).status },
              details: { email },
              provider_response: { supabase_url: supabaseUrl?.slice(0, 50) },
            });
          }
        } else {
          if (!authData.user) {
            const step = `${createStep}.no_user`;
            await logAction("staff_create_failed", {
              request_id: requestId,
              step,
              message: "Échec de création - aucun user retourné",
              target_email: email,
            }, { type: "user", email });

            return json(500, {
              ok: false,
              request_id: requestId,
              step,
              message: "Échec de création - aucun user retourné",
              http_status: 500,
              supabase_error: null,
              details: { email },
            });
          }
          userId = authData.user.id;
        }

        // Step: db_upsert_profile
        const stepProfiles = `${createStep}.db_upsert_profile`;
        console.log(`[admin-manage-staff] ${stepProfiles} user_id=${userId}`);

        const { error: profileError } = await adminClient
          .from("profiles")
          .upsert({
            user_id: userId,
            email,
            full_name,
          }, { onConflict: "user_id" });

        if (profileError) {
          console.error(`[admin-manage-staff] ${stepProfiles} error:`, profileError);
          await logAction("staff_create_failed", {
            request_id: requestId,
            step: stepProfiles,
            message: profileError.message,
            target_email: email,
            supabase_error: { code: profileError.code, message: profileError.message, details: profileError.details },
          }, { type: "user", id: userId, email });

          return json(500, {
            ok: false,
            request_id: requestId,
            step: stepProfiles,
            message: `Erreur mise à jour profil: ${profileError.message}`,
            http_status: 500,
            supabase_error: { code: profileError.code, message: profileError.message, details: profileError.details },
            details: { user_id: userId },
          });
        }

        // Step: db_upsert_role
        const stepRoles = `${createStep}.db_upsert_role`;
        console.log(`[admin-manage-staff] ${stepRoles} user_id=${userId} role=${role}`);

        // Delete existing roles then insert new one with permissions
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await adminClient.from("user_roles").insert({
          user_id: userId,
          role: role,
          permissions: body.permissions || {},
          is_active: is_active,
          require_password_change: require_password_change || send_invitation,
        });

        if (roleError) {
          console.error(`[admin-manage-staff] ${stepRoles} error:`, roleError);
          await logAction("staff_create_failed", {
            request_id: requestId,
            step: stepRoles,
            message: roleError.message,
            target_email: email,
            supabase_error: { code: roleError.code, message: roleError.message, details: roleError.details },
          }, { type: "user", id: userId, email });

          return json(500, {
            ok: false,
            request_id: requestId,
            step: stepRoles,
            message: `Erreur assignation rôle: ${roleError.message}`,
            http_status: 500,
            supabase_error: { code: roleError.code, message: roleError.message, details: roleError.details },
            details: { user_id: userId, role },
          });
        }

        // Handle technician table entry
        if (role === "technician") {
          const stepTech = `${createStep}.db_upsert_technician`;
          const { error: techError } = await adminClient.from("technicians").upsert({
            user_id: userId,
            email,
            full_name,
            status: is_active ? "active" : "inactive",
          }, { onConflict: "user_id" });

          if (techError) {
            console.error(`[admin-manage-staff] ${stepTech} error:`, techError);
            // Non-fatal, log but continue
          }
        }

        // Handle employee table entry for employee/technician roles
        if (role === "employee" || role === "technician") {
          const stepEmp = `${createStep}.db_upsert_employee`;
          const pinHash = pin ? await hashPin(pin) : await hashPin("3112"); // Default PIN
          
          const { error: empError } = await adminClient.from("employees").upsert({
            email,
            full_name,
            phone: phone || null,
            role,
            is_active,
            pin_hash: pinHash,
            pin_set_at: pin ? new Date().toISOString() : null,
            require_pin_change: require_pin_change || !pin,
            badge_number: badge_number || null,
            job_title: job_title || null,
            internal_note: internal_note || null,
            created_by_admin_id: callingUser.id,
          }, { onConflict: "email" });

          if (empError) {
            console.error(`[admin-manage-staff] ${stepEmp} error:`, empError);
            // Non-fatal for now, log but continue
          }
        }

        // Step: audit_log_insert
        const stepAudit = `${createStep}.done`;
        const auditAction = mode === "existing_user_promoted" ? "staff_role_applied_existing_user" : "staff_created";
        await logAction(
          auditAction,
          {
            role,
            require_password_change: send_invitation,
            badge_number,
            job_title,
            has_pin: !!pin,
            request_id: requestId,
            mode,
          },
          { type: "user", id: userId, email }
        );

        // Send reset email if needed (for new users or if explicitly requested)
        if (send_invitation && mode === "new_user_created") {
          const rawAppBaseUrl = Deno.env.get("APP_BASE_URL");
          let appBaseUrl = "https://nivratelecom.ca";
          if (rawAppBaseUrl) {
            if (rawAppBaseUrl.includes(",")) {
              console.error(`[admin-manage-staff] APP_BASE_URL contains multiple URLs: "${rawAppBaseUrl}". Using fallback.`);
            } else {
              try {
                new URL(rawAppBaseUrl);
                appBaseUrl = rawAppBaseUrl.replace(/\/+$/, "");
              } catch {
                console.error(`[admin-manage-staff] APP_BASE_URL is not a valid URL: "${rawAppBaseUrl}". Using fallback.`);
              }
            }
          }
          const resetUrl = `${appBaseUrl}/admin/reset-password`;
          console.log(`[admin-manage-staff] Sending reset email to ${email} with redirect: ${resetUrl}`);
          await adminClient.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
        }

        const successMessage = mode === "existing_user_promoted"
          ? "Compte existant trouvé — rôle mis à jour avec succès."
          : send_invitation 
            ? "Utilisateur créé. Un email de configuration du mot de passe a été envoyé."
            : "Utilisateur créé avec succès.";

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          mode,
          user: { id: userId, email },
          message: successMessage,
        });
      }

      case "disable": {
        const { user_id } = body;
        if (user_id === callingUser.id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: {
              code: "VALIDATION",
              message: "Vous ne pouvez pas vous désactiver vous-même",
              step: "disable.self",
            } satisfies ApiError,
          });
        }

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876000h",
        });

        if (error) {
          console.error("[admin-manage-staff] Disable error:", error);
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "PROVIDER_ERROR", message: error.message, step: "disable.update" } satisfies ApiError,
          });
        }

        // Update user_roles.is_active
        await adminClient.from("user_roles").update({ is_active: false }).eq("user_id", user_id);

        // Update employees table if exists
        await adminClient.from("employees").update({ is_active: false }).eq("email", targetUser?.user?.email);

        await logAction("staff_disabled", { request_id: requestId }, {
          type: "user",
          id: user_id,
          email: targetUser?.user?.email,
        });

        return json(200, { ok: true, request_id: requestId, success: true, message: "Utilisateur désactivé" });
      }

      case "enable": {
        const { user_id } = body;

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);
        const { error } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "none",
        });

        if (error) {
          console.error("[admin-manage-staff] Enable error:", error);
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "PROVIDER_ERROR", message: error.message, step: "enable.update" } satisfies ApiError,
          });
        }

        // Update user_roles.is_active
        await adminClient.from("user_roles").update({ is_active: true }).eq("user_id", user_id);

        // Update employees table if exists
        await adminClient.from("employees").update({ is_active: true }).eq("email", targetUser?.user?.email);

        await logAction("staff_enabled", { request_id: requestId }, {
          type: "user",
          id: user_id,
          email: targetUser?.user?.email,
        });

        return json(200, { ok: true, request_id: requestId, success: true, message: "Utilisateur activé" });
      }

      case "change_role": {
        const { user_id, new_role } = body;

        if (!(["admin", "employee", "technician"] as const).includes(new_role)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Rôle invalide", step: "change_role.validate" } satisfies ApiError,
          });
        }

        if (user_id === callingUser.id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: {
              code: "VALIDATION",
              message: "Vous ne pouvez pas changer votre propre rôle",
              step: "change_role.self",
            } satisfies ApiError,
          });
        }

        const { data: currentRole } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id)
          .maybeSingle();

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        await adminClient.from("user_roles").delete().eq("user_id", user_id);
        await adminClient.from("user_roles").insert({ user_id, role: new_role });

        if (new_role === "technician") {
          const { data: existingTech } = await adminClient.from("technicians").select("id").eq("user_id", user_id).maybeSingle();
          if (!existingTech) {
            const { data: profile } = await adminClient.from("profiles").select("full_name, email").eq("user_id", user_id).maybeSingle();
            await adminClient.from("technicians").insert({
              user_id,
              email: targetUser?.user?.email || profile?.email,
              full_name: profile?.full_name || "Staff User",
              status: "active",
            });
          }
        }

        await logAction(
          "staff_role_changed",
          { old_role: currentRole?.role, new_role, request_id: requestId },
          { type: "user", id: user_id, email: targetUser?.user?.email }
        );

        return json(200, { ok: true, request_id: requestId, success: true, message: `Rôle changé en ${new_role}` });
      }

      case "send_reset": {
        const { email } = body;
        const stepBase = "send_reset";

        // Validate required secrets before doing anything
        const missingSecrets = [
          ...(isMissingSecret("SUPABASE_URL") ? ["SUPABASE_URL"] : []),
          ...(isMissingSecret("SUPABASE_SERVICE_ROLE_KEY") ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
          ...(isMissingSecret("RESEND_API_KEY") ? ["RESEND_API_KEY"] : []),
          ...(isMissingSecret("APP_BASE_URL") ? ["APP_BASE_URL"] : []),
        ];

        if (missingSecrets.length > 0) {
          await logAction(
            "staff_password_reset_failed",
            {
              request_id: requestId,
              step: `${stepBase}.validate_secrets`,
              http_status: 500,
              error_message: "Secrets requis manquants",
              stack: null,
              missing_secrets: missingSecrets,
              provider_response: null,
            },
            { type: "staff_user", email }
          );

          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "MISSING_SECRETS", message: "Secrets requis manquants", step: `${stepBase}.validate_secrets` } satisfies ApiError,
            missing_secrets: missingSecrets,
          });
        }

        // Validate APP_BASE_URL - must be single valid URL
        const rawAppBaseUrl = Deno.env.get("APP_BASE_URL");
        let appBaseUrl = "https://nivratelecom.ca"; // Safe default
        if (rawAppBaseUrl) {
          if (rawAppBaseUrl.includes(",")) {
            console.error(`[admin-manage-staff] send_reset: APP_BASE_URL contains multiple URLs: "${rawAppBaseUrl}". Using fallback.`);
          } else {
            try {
              new URL(rawAppBaseUrl);
              appBaseUrl = rawAppBaseUrl.replace(/\/+$/, "");
            } catch {
              console.error(`[admin-manage-staff] send_reset: APP_BASE_URL is not a valid URL: "${rawAppBaseUrl}". Using fallback.`);
            }
          }
        }
        const redirectTo = joinUrl(appBaseUrl, "/admin/reset-password");

        console.log(`[admin-manage-staff] send_reset request_id=${requestId} email=${email} redirectTo=${redirectTo}`);

        try {
          // Generate recovery link server-side (service role)
          const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });

          if (linkError || !linkData?.properties?.action_link) {
            await logAction(
              "staff_password_reset_failed",
              {
                request_id: requestId,
                step: `${stepBase}.generate_link`,
                http_status: 500,
                error_message: linkError?.message || "Impossible de générer le lien de réinitialisation",
                stack: linkError?.stack || null,
                missing_secrets: [],
                provider_response: {
                  linkData,
                  linkError: linkError
                    ? {
                        name: linkError.name,
                        message: linkError.message,
                        status: (linkError as any).status,
                        cause: (linkError as any).cause,
                      }
                    : null,
                },
              },
              { type: "staff_user", email }
            );

            return json(500, {
              ok: false,
              request_id: requestId,
              error: {
                code: "LINK_GENERATION_FAILED",
                message: linkError?.message || "Impossible de générer le lien de réinitialisation",
                step: `${stepBase}.generate_link`,
              } satisfies ApiError,
              provider_response: {
                linkData,
                linkError: linkError ? { name: linkError.name, message: linkError.message } : null,
              },
            });
          }

          const resetLink = linkData.properties.action_link;

          // Send email via Resend
          const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

          const resendResult = await resend.emails.send({
            from: "Nivra Telecom <support@nivratelecom.ca>",
            reply_to: "support@nivratelecom.ca",
            to: [email],
            subject: "Réinitialisation de votre mot de passe - Nivra",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Votre service, simplifié.</p>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2>Bonjour,</h2>
                  <p>Voici votre lien de réinitialisation de mot de passe :</p>
                  <p><a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px;">Réinitialiser mon mot de passe</a></p>
                  <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">Lien: <a href="${resetLink}" style="color: #0d9488;">${resetLink}</a></p>
                  <p style="margin-top: 20px; color: #64748b;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
                </div>
                <div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #18181b;">Nivra Telecom</p>
                  <p style="margin: 0 0 6px; font-size: 12px; color: #71717a;">Laval, QC, Canada</p>
                  <p style="margin: 0 0 12px; font-size: 13px; color: #52525b;"><a href="mailto:support@nivratelecom.ca" style="color: #0d9488; text-decoration: none;">Support@nivratelecom.ca</a> | <a href="tel:4385442233" style="color: #0d9488; text-decoration: none;">438-544-2233</a></p>
                  <p style="margin: 0; font-size: 11px; color: #71717a;">Vous recevez cet email suite à une action sur votre compte Nivra Telecom.<br><em>You are receiving this email because of an action on your Nivra Telecom account.</em></p>
                  <p style="margin-top: 10px; color: #9ca3af; font-size: 10px;">Request ID: ${requestId}</p>
                </div>
              </div>
            `,
          });

          console.log("[admin-manage-staff] send_reset resendResult:", resendResult);

          await logAction(
            "staff_password_reset_sent",
            {
              request_id: requestId,
              redirect_to: redirectTo,
              provider_response: {
                link: {
                  verification_type: linkData.properties.verification_type,
                  redirect_to: linkData.properties.redirect_to,
                },
                resend: resendResult,
              },
            },
            { type: "staff_user", email }
          );

          return json(200, {
            ok: true,
            request_id: requestId,
            success: true,
            message: "Email de réinitialisation envoyé",
          });
        } catch (e: unknown) {
          const err = e as Error;
          await logAction(
            "staff_password_reset_failed",
            {
              request_id: requestId,
              step: `${stepBase}.send_email`,
              http_status: 500,
              error_message: err.message,
              stack: err.stack,
              missing_secrets: [],
              provider_response: null,
            },
            { type: "staff_user", email }
          );

          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "SEND_FAILED", message: err.message, step: `${stepBase}.send_email` } satisfies ApiError,
            stack: err.stack,
          });
        }
      }

      case "update_permissions": {
        const { user_id, permissions } = body as UpdatePermissionsRequest;
        const stepBase = "update_permissions";

        if (!user_id || !permissions) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id et permissions requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} request_id=${requestId}`);

        // Get current permissions for audit
        const { data: currentData } = await adminClient
          .from("user_roles")
          .select("permissions")
          .eq("user_id", user_id)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update({ permissions })
          .eq("user_id", user_id);

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} error:`, updateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: updateError.message, step: `${stepBase}.update` } satisfies ApiError,
          });
        }

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        await logAction(
          "staff_permissions_updated",
          {
            request_id: requestId,
            old_permissions: currentData?.permissions || {},
            new_permissions: permissions,
          },
          { type: "user", id: user_id, email: targetUser?.user?.email }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Permissions mises à jour",
        });
      }

      case "apply_role_pack": {
        const { user_id } = body as ApplyRolePackRequest;
        const stepBase = "apply_role_pack";

        if (!user_id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} request_id=${requestId}`);

        // Get current role for this user
        const { data: roleData, error: roleError } = await adminClient
          .from("user_roles")
          .select("role, permissions")
          .eq("user_id", user_id)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        if (roleError || !roleData) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur ou rôle non trouvé", step: `${stepBase}.get_role` } satisfies ApiError,
          });
        }

        const currentRole = roleData.role as StaffRole;
        const oldPermissions = roleData.permissions || {};

        // Define default permissions per role
        const DEFAULT_PERMISSIONS: Record<StaffRole, PermissionSet> = {
          admin: {
            view_clients: true,
            manage_clients: true,
            view_orders: true,
            manage_orders: true,
            view_billing: true,
            manage_billing: true,
            view_appointments: true,
            manage_appointments: true,
            view_tickets: true,
            manage_tickets: true,
            view_logs: true,
            view_internal_notes: true,
            export_data: true,
            manage_staff: true,
            manage_streaming: true,
            manage_channels: true,
          },
          employee: {
            view_clients: true,
            manage_clients: false,
            view_orders: true,
            manage_orders: true,
            view_billing: true,
            manage_billing: false,
            view_appointments: true,
            manage_appointments: true,
            view_tickets: true,
            manage_tickets: true,
            view_logs: false,
            view_internal_notes: false,
            export_data: false,
            manage_staff: false,
            manage_streaming: true,
            manage_channels: false,
          },
          technician: {
            view_clients: false,
            manage_clients: false,
            view_orders: false,
            manage_orders: false,
            view_billing: false,
            manage_billing: false,
            view_appointments: true,
            manage_appointments: false,
            view_tickets: true,
            manage_tickets: false,
            view_logs: false,
            view_internal_notes: false,
            export_data: false,
            manage_staff: false,
            manage_streaming: false,
            manage_channels: false,
          },
        };

        const newPermissions = DEFAULT_PERMISSIONS[currentRole];

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update({ permissions: newPermissions })
          .eq("user_id", user_id);

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} error:`, updateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: updateError.message, step: `${stepBase}.update` } satisfies ApiError,
          });
        }

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        await logAction(
          "staff_permissions_pack_applied",
          {
            request_id: requestId,
            role: currentRole,
            old_permissions: oldPermissions,
            new_permissions: newPermissions,
          },
          { type: "user", id: user_id, email: targetUser?.user?.email }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: `Pack de permissions "${currentRole}" appliqué`,
          role: currentRole,
        });
      }

      case "set_pin":
      case "reset_pin": {
        const { user_id, pin, require_pin_change = false } = body as SetPinRequest;
        const isReset = body.action === "reset_pin";
        const stepBase = isReset ? "reset_pin" : "set_pin";

        if (!user_id || !pin) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id et pin requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        if (!/^\d{4}$/.test(pin)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Le PIN doit être exactement 4 chiffres", step: `${stepBase}.validate_format` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} request_id=${requestId}`);

        const pinHash = await hashPin(pin);

        // Update employees table
        const { error: updateError } = await adminClient
          .from("employees")
          .update({
            pin_hash: pinHash,
            pin_set_at: new Date().toISOString(),
            require_pin_change,
          })
          .or(`id.eq.${user_id},email.in.(select email from profiles where user_id = '${user_id}')`);

        // Also try to get email for logging
        const { data: profile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", user_id)
          .maybeSingle();

        // If no match in employees by user_id, try by email
        if (!updateError && profile?.email) {
          await adminClient
            .from("employees")
            .update({
              pin_hash: pinHash,
              pin_set_at: new Date().toISOString(),
              require_pin_change,
            })
            .eq("email", profile.email);
        }

        await logAction(
          isReset ? "staff_pin_reset" : "staff_pin_set",
          {
            request_id: requestId,
            require_pin_change,
          },
          { type: "user", id: user_id, email: profile?.email }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: isReset ? "PIN réinitialisé" : "PIN défini",
        });
      }

      case "update_profile": {
        const { user_id, full_name, phone, badge_number, job_title } = body as UpdateProfileRequest;
        const stepBase = "update_profile";

        if (!user_id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} request_id=${requestId}`);

        // Validate badge_number uniqueness if provided
        if (badge_number) {
          const { data: existingBadge } = await adminClient
            .from("employees")
            .select("id")
            .eq("badge_number", badge_number)
            .neq("id", user_id)
            .maybeSingle();
          
          if (existingBadge) {
            return json(400, {
              ok: false,
              request_id: requestId,
              error: { code: "VALIDATION", message: "Ce numéro de badge est déjà utilisé", step: `${stepBase}.validate_badge` } satisfies ApiError,
            });
          }
        }

        // Get profile email for employee lookup
        const { data: profile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", user_id)
          .maybeSingle();

        const updateData: Record<string, unknown> = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (phone !== undefined) updateData.phone = phone;
        if (badge_number !== undefined) updateData.badge_number = badge_number;
        if (job_title !== undefined) updateData.job_title = job_title;

        // Update profiles table
        if (full_name !== undefined) {
          await adminClient
            .from("profiles")
            .update({ full_name })
            .eq("user_id", user_id);
        }

        // Update employees table
        if (Object.keys(updateData).length > 0 && profile?.email) {
          const { error: empError } = await adminClient
            .from("employees")
            .update(updateData)
            .eq("email", profile.email);

          if (empError) {
            console.error(`[admin-manage-staff] ${stepBase} employees error:`, empError);
          }
        }

        await logAction(
          "staff_profile_updated",
          {
            request_id: requestId,
            updated_fields: Object.keys(updateData),
          },
          { type: "user", id: user_id, email: profile?.email }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Profil mis à jour",
        });
      }

      case "force_password_change": {
        const { user_id, require_change } = body as ForcePasswordChangeRequest;
        const stepBase = "force_password_change";

        if (!user_id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} require=${require_change} request_id=${requestId}`);

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update({ require_password_change: require_change })
          .eq("user_id", user_id);

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} error:`, updateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: updateError.message, step: `${stepBase}.update` } satisfies ApiError,
          });
        }

        const { data: targetUser } = await adminClient.auth.admin.getUserById(user_id);

        await logAction(
          require_change ? "staff_force_password_change_enabled" : "staff_force_password_change_disabled",
          { request_id: requestId },
          { type: "user", id: user_id, email: targetUser?.user?.email }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: require_change 
            ? "L'utilisateur devra changer son mot de passe à la prochaine connexion"
            : "Exigence de changement de mot de passe désactivée",
        });
      }

      default:
        return json(400, {
          ok: false,
          request_id: requestId,
          error: { code: "BAD_REQUEST", message: "Action non reconnue", step: "action" } satisfies ApiError,
        });
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.error("[admin-manage-staff] Top-level error request_id=", requestId, err);
    return json(500, {
      ok: false,
      request_id: requestId,
      error: { code: "INTERNAL", message: "Erreur inattendue", step: "top_level" } satisfies ApiError,
      stack: err.stack,
    });
  }
});
