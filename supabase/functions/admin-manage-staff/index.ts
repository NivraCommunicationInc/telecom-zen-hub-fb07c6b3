import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

type StaffRole =
  | "admin"
  | "employee"
  | "technician"
  | "field_sales"
  | "supervisor"
  | "sales"
  | "support"
  | "billing_admin"
  | "techops"
  | "kyc_agent";

const INTERNAL_STAFF_ROLES: StaffRole[] = [
  "admin",
  "employee",
  "technician",
  "field_sales",
  "supervisor",
  "sales",
  "support",
  "billing_admin",
  "techops",
  "kyc_agent",
];

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
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: StaffRole;
  require_password_change?: boolean;
  permissions?: PermissionSet;
  phone?: string;
  badge_number?: string;
  job_title?: string;
  pin?: string;
  require_pin_change?: boolean;
  is_active?: boolean;
  send_invitation?: boolean;
  internal_note?: string;
  mfa_required?: boolean;
  can_access_core?: boolean;
  can_access_employee?: boolean;
  can_access_field?: boolean;
  can_access_technician?: boolean;
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
  target_user_id?: string;
  target_email?: string;
  target_role?: StaffRole;
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

interface UpdateStatusRequest {
  action: "update_status";
  user_id: string;
  status: "active" | "disabled" | "hold";
}

interface HardDeleteUserRequest {
  action: "hard_delete_user";
  email: string;
  confirm_email: string;
}

interface InviteSetPinRequest {
  action: "invite_set_pin";
  email: string;
}

interface VerifyAdminPinRequest {
  action: "verify_admin_pin";
  email: string;
  pin: string;
}

interface UpdateAuthCheckRequest {
  action: "update_auth_check";
  email: string;
}

interface AdminRecoverRequest {
  action: "admin_recover";
  email: string;
  password: string;
  pin: string;
  bootstrap_token: string;
}

interface SetStaffPasswordRequest {
  action: "set_staff_password";
  user_id: string;
  password: string;
  force_change?: boolean;
}

interface SendPasswordResetRequest {
  action: "send_password_reset";
  email: string;
}

interface LinkAuthRequest {
  action: "link_auth";
  employee_id: string;
  password?: string;
  send_invitation?: boolean;
}

interface CreateFieldSalesRequest {
  action: "create_field_sales";
  email: string;
  full_name: string;
  phone?: string;
  territory?: string;
  address?: string;
  emergency_contact?: string;
  notes?: string;
  commission_rate?: number;
}

interface UpdatePortalAccessRequest {
  action: "update_portal_access";
  user_id: string;
  can_access_core?: boolean;
  can_access_employee?: boolean;
  can_access_field?: boolean;
  can_access_technician?: boolean;
}

interface UpdateMfaRequirementRequest {
  action: "update_mfa_requirement";
  user_id: string;
  mfa_required: boolean;
}

interface GenerateInvitationRequest {
  action: "generate_invitation";
  user_id: string;
}

interface SendInvitationRequest {
  action: "send_invitation";
  user_id: string;
}

interface ResendInvitationRequest {
  action: "resend_invitation";
  user_id: string;
}

interface RevokeInvitationRequest {
  action: "revoke_invitation";
  user_id: string;
}

interface ListInvitationStatusesRequest {
  action: "list_invitation_statuses";
  user_ids?: string[];
}

type RequestBody =
  | CreateStaffRequest
  | DisableEnableRequest
  | ChangeRoleRequest
  | SendResetRequest
  | UpdatePermissionsRequest
  | ApplyRolePackRequest
  | SetPinRequest
  | UpdateProfileRequest
  | ForcePasswordChangeRequest
  | UpdateStatusRequest
  | HardDeleteUserRequest
  | InviteSetPinRequest
  | VerifyAdminPinRequest
  | UpdateAuthCheckRequest
  | AdminRecoverRequest
  | SetStaffPasswordRequest
  | SendPasswordResetRequest
  | LinkAuthRequest
  | CreateFieldSalesRequest
  | UpdatePortalAccessRequest
  | UpdateMfaRequirementRequest
  | GenerateInvitationRequest
  | SendInvitationRequest
  | ResendInvitationRequest
  | RevokeInvitationRequest
  | ListInvitationStatusesRequest;

// Generate cryptographically secure salt
function generateSalt(): string {
  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// PIN hashing with PBKDF2 (must match employee-operations)
const PBKDF2_ITERATIONS = 100000;
async function hashPinPBKDF2(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  const saltData = encoder.encode(salt);
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    pinData,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltData,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Legacy PIN hash for admin operations (backward compatible)
const LEGACY_SALT = 'nivra_pin_salt_2026';
async function hashPinLegacy(pin: string): Promise<string> {
  const data = new TextEncoder().encode(LEGACY_SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Token hash function
async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
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

  if (req.method === "OPTIONS") {
    return json(200, { ok: true, request_id: requestId, preflight: true });
  }

  try {
    // Rate limit: 20 admin actions per minute per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `admin_staff:${clientIp}`, ...RATE_LIMITS.ADMIN_ACTION });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

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

    // Helper to get APP_BASE_URL
    const getAppBaseUrl = (): string => {
      const rawAppBaseUrl = Deno.env.get("APP_BASE_URL");
      let appBaseUrl = "https://nivra-telecom.ca";
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
      return appBaseUrl;
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

        const array = new Uint8Array(20);
        crypto.getRandomValues(array);
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let tempPassword = "";
        for (let i = 0; i < 20; i++) {
          tempPassword += chars[array[i] % chars.length];
        }

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
            console.log(`[admin-manage-staff] ${stepAuthCreate} email_exists - switching to promote mode`);
            mode = "existing_user_promoted";

            const stepLookup = `${createStep}.auth_lookup_existing_user`;
            console.log(`[admin-manage-staff] ${stepLookup} searching for email=${email}`);

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
              });
            }

            const existingUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email.toLowerCase()
            );

            if (!existingUser) {
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
              });
            }

            userId = existingUser.id;
            console.log(`[admin-manage-staff] ${stepLookup} found existing user_id=${userId}`);
          } else {
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

        const stepRoles = `${createStep}.db_upsert_role`;
        console.log(`[admin-manage-staff] ${stepRoles} user_id=${userId} role=${role}`);

        await adminClient.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await adminClient.from("user_roles").insert({
          user_id: userId,
          role: role,
          permissions: body.permissions || {},
          is_active: is_active,
          require_password_change: require_password_change || send_invitation,
          can_access_core: body.can_access_core ?? (role === "admin"),
          can_access_employee: body.can_access_employee ?? (role === "employee" || role === "admin"),
          can_access_field: body.can_access_field ?? (role === "field_sales"),
          can_access_technician: body.can_access_technician ?? (role === "technician"),
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
          }
        }

        if (role === "employee" || role === "technician") {
          const stepEmp = `${createStep}.db_upsert_employee`;
          // Generate per-user salt and hash PIN with PBKDF2
          const pinSalt = generateSalt();
          const effectivePin = pin || "312026"; // Default 6-digit PIN
          const pinHash = await hashPinPBKDF2(effectivePin, pinSalt);
          
          const { error: empError } = await adminClient.from("employees").upsert({
            user_id: userId, // CRITICAL: Store user_id for server-side validation
            email,
            full_name,
            phone: phone || null,
            role,
            is_active,
            pin_hash: pinHash,
            pin_salt: pinSalt, // Store per-user salt
            pin_set_at: pin ? new Date().toISOString() : null,
            require_pin_change: require_pin_change || !pin,
            badge_number: badge_number || null,
            job_title: job_title || null,
            internal_note: internal_note || null,
            created_by_admin_id: callingUser.id,
          }, { onConflict: "email" });

          if (empError) {
            console.error(`[admin-manage-staff] ${stepEmp} error:`, empError);
          }
        }

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

        // CHANGED: Only send password reset for admins, send PIN invite for employee/technician
        if (send_invitation && mode === "new_user_created") {
          const appBaseUrl = getAppBaseUrl();
          
          if (role === "admin") {
            // Admin gets password reset link
            const resetUrl = `${appBaseUrl}/admin/reset-password`;
            console.log(`[admin-manage-staff] Sending password reset email to admin ${email} with redirect: ${resetUrl}`);
            await adminClient.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
          } else {
            // Employee/Technician: send profile setup invite (password + PIN + terms)
            console.log(`[admin-manage-staff] Sending profile setup invite to ${role} ${email}`);
            
            // Generate one-time token for onboarding
            const tokenBytes = new Uint8Array(32);
            crypto.getRandomValues(tokenBytes);
            const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            const tokenHash = await hashToken(token);
            
            // Store token in staff_onboarding_tokens table
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours to complete setup
            
            await adminClient.from("staff_onboarding_tokens").insert({
              user_id: userId,
              email,
              role,
              token_hash: tokenHash,
              expires_at: expiresAt.toISOString(),
              created_by_admin_id: callingUser.id,
            });
            
            // Build setup link to the new onboarding page
            const setupLink = `${appBaseUrl}/staff/setup?token=${token}`;
            const staffLoginLink = `${appBaseUrl}/staff`;
            
            // Send professional onboarding email
            const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
            await resend.emails.send({
              from: "Nivra Telecom <support@nivra-telecom.ca>",
              reply_to: "support@nivra-telecom.ca",
              to: [email],
              subject: `Bienvenue chez Nivra - Configurez votre profil ${role === "employee" ? "employé" : "technicien"}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0;">Bienvenue dans l'équipe!</p>
                  </div>
                  <div style="padding: 30px; background: #f8fafc;">
                    <h2 style="color: #1e293b; margin-bottom: 16px;">Bonjour ${full_name},</h2>
                    <p style="color: #374151; line-height: 1.6;">Votre compte <strong>${role === "employee" ? "employé" : "technicien"}</strong> a été créé avec succès.</p>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                      <p style="color: #92400e; margin: 0; font-weight: 600;">Configuration requise</p>
                      <p style="color: #78350f; margin: 8px 0 0; font-size: 14px;">
                        Avant d'accéder au portail, vous devez configurer votre profil: mot de passe, NIP de sécurité et accepter les conditions d'utilisation.
                      </p>
                    </div>
                    
                    <p style="margin: 25px 0; text-align: center;">
                      <a href="${setupLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 16px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        Configurer mon profil
                      </a>
                    </p>
                    <p style="font-size: 13px; color: #64748b; text-align: center;">Ce lien expire dans 48 heures.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                    
                    <p style="color: #374151; font-weight: 600; margin-bottom: 12px;">Étapes de configuration:</p>
                    <ol style="color: #374151; line-height: 2; padding-left: 20px;">
                      <li>Créez votre mot de passe sécurisé</li>
                      <li>Choisissez un NIP à 4 chiffres (requis pour accéder aux profils clients)</li>
                      <li>Acceptez les conditions de confidentialité</li>
                    </ol>
                    
                    <p style="margin-top: 24px; color: #64748b; font-size: 13px;">
                      Une fois configuré, connectez-vous à <a href="${staffLoginLink}" style="color: #0d9488;">${staffLoginLink}</a>
                    </p>
                  </div>
                  <div style="padding: 24px 30px; background: #f1f5f9; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #18181b;">Nivra Telecom</p>
                    <p style="margin: 0 0 6px; font-size: 12px; color: #71717a;">1799 Av. Pierre-Péladeau, Laval, QC</p>
                    <p style="margin: 0 0 12px; font-size: 13px; color: #52525b;">
                      <a href="mailto:support@nivra-telecom.ca" style="color: #0d9488; text-decoration: none;">support@nivra-telecom.ca</a> | 
                      <a href="tel:4385442233" style="color: #0d9488; text-decoration: none; white-space: nowrap;">438-544-2233</a>
                    </p>
                  </div>
                </div>
              `,
            });
            
            await logAction("staff_onboarding_invite_sent", { request_id: requestId, role }, { type: "user", id: userId, email });
          }
        }

        const successMessage = mode === "existing_user_promoted"
          ? "Compte existant trouvé — rôle mis à jour avec succès."
          : send_invitation 
            ? role === "admin" 
              ? "Utilisateur créé. Un email de configuration du mot de passe a été envoyé."
              : "Utilisateur créé. Un email de configuration du profil a été envoyé."
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

      case "update_portal_access": {
        const { user_id, can_access_core, can_access_employee, can_access_field, can_access_technician } = body;
        if (!user_id) {
          return json(400, { ok: false, request_id: requestId, message: "user_id requis" });
        }

        const updates: Record<string, boolean> = {};
        if (can_access_core !== undefined) updates.can_access_core = can_access_core;
        if (can_access_employee !== undefined) updates.can_access_employee = can_access_employee;
        if (can_access_field !== undefined) updates.can_access_field = can_access_field;
        if (can_access_technician !== undefined) updates.can_access_technician = can_access_technician;

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update(updates)
          .eq("user_id", user_id);

        if (updateError) {
          console.error("[admin-manage-staff] update_portal_access error:", updateError);
          return json(500, { ok: false, request_id: requestId, message: updateError.message });
        }

        await logAction("portal_access_updated", {
          request_id: requestId,
          updates,
        }, { type: "user", id: user_id });

        return json(200, { ok: true, request_id: requestId, message: "Accès portail mis à jour" });
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

        await adminClient.from("user_roles").update({ is_active: false }).eq("user_id", user_id);
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

        await adminClient.from("user_roles").update({ is_active: true }).eq("user_id", user_id);
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

        const appBaseUrl = getAppBaseUrl();

        // Determine target user's role
        const normalizedTargetEmail = email.trim().toLowerCase();
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedTargetEmail)
          .maybeSingle();

        let targetRole: StaffRole = "admin";
        if (targetProfile?.user_id) {
          const { data: roleData } = await adminClient
            .from("user_roles")
            .select("role")
            .eq("user_id", targetProfile.user_id)
            .in("role", ["admin", "employee", "technician"])
            .maybeSingle();
          if (roleData?.role) {
            targetRole = roleData.role as StaffRole;
          }
        }

        // SECURITY: Only admin gets password reset. Employee/Technician get PIN invite - NEVER admin links.
        if (targetRole !== "admin") {
          // Send PIN invite instead - NEVER send /admin links to non-admins
          console.log(`[admin-manage-staff] send_reset for ${targetRole} - sending PIN invite instead (no /admin links)`);
          
          if (!targetProfile?.user_id) {
            return json(404, {
              ok: false,
              request_id: requestId,
              error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
            });
          }

          // Generate one-time token
          const tokenBytes = new Uint8Array(32);
          crypto.getRandomValues(tokenBytes);
          const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          const tokenHash = await hashToken(token);
          
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 24);
          
          // Invalidate previous tokens
          await adminClient
            .from("pin_invite_tokens")
            .update({ used_at: new Date().toISOString() })
            .eq("user_id", targetProfile.user_id)
            .is("used_at", null);
          
          await adminClient.from("pin_invite_tokens").insert({
            user_id: targetProfile.user_id,
            email: normalizedTargetEmail,
            role: targetRole,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            created_by_admin_id: callingUser.id,
          });
          
          // Build links - NEVER use /admin paths for non-admins
          const portalPath = targetRole === "employee" ? "/employee/set-pin" : "/technician/set-pin";
          const setPinLink = `${appBaseUrl}${portalPath}?token=${token}`;
          const loginPath = targetRole === "employee" ? "/employee/login" : "/technician/auth";
          const loginLink = `${appBaseUrl}${loginPath}`;
          
          const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
          await resend.emails.send({
            from: "Nivra Telecom <support@nivra-telecom.ca>",
            reply_to: "support@nivra-telecom.ca",
            to: [normalizedTargetEmail],
            subject: "Configuration de votre PIN - Nivra",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2>Bonjour,</h2>
                  <p>Cliquez sur le bouton ci-dessous pour configurer votre PIN de connexion :</p>
                  <p style="margin: 25px 0;">
                    <a href="${setPinLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      Configurer mon PIN
                    </a>
                  </p>
                  <p style="font-size: 13px; color: #64748b;">Ce lien expire dans 24 heures.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                  <p>Une fois configuré, connectez-vous ici : <a href="${loginLink}" style="color: #0d9488;">${loginLink}</a></p>
                  <p style="margin-top: 15px; color: #64748b; font-size: 13px;"><em>Note: Vous n'avez pas de mot de passe. Votre connexion se fait uniquement avec email + PIN.</em></p>
                </div>
                <div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #71717a;">Request ID: ${requestId}</p>
                </div>
              </div>
            `,
          });
          
          await logAction("staff_pin_invite_sent", { request_id: requestId, role: targetRole }, { type: "user", id: targetProfile.user_id, email: normalizedTargetEmail });

          return json(200, {
            ok: true,
            request_id: requestId,
            success: true,
            message: "Email de configuration du PIN envoyé",
          });
        }

        // ADMIN ONLY: Password reset with /admin/reset-password link
        const redirectTo = joinUrl(appBaseUrl, "/admin/reset-password");
        console.log(`[admin-manage-staff] send_reset ADMIN ONLY target_role=${targetRole} redirect=${redirectTo}`);

        try {
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
                provider_response: { linkData, linkError: linkError ? { name: linkError.name, message: linkError.message } : null },
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
              provider_response: { linkData, linkError: linkError ? { name: linkError.name, message: linkError.message } : null },
            });
          }

          const resetLink = linkData.properties.action_link;

          const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
          const resendResult = await resend.emails.send({
            from: "Nivra Telecom <support@nivra-telecom.ca>",
            reply_to: "support@nivra-telecom.ca",
            to: [email],
            subject: "Réinitialisation de votre mot de passe - Nivra",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2>Bonjour,</h2>
                  <p>Voici votre lien de réinitialisation de mot de passe :</p>
                  <p><a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px;">Réinitialiser mon mot de passe</a></p>
                  <p style="margin-top: 20px; color: #64748b;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
                </div>
                <div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #71717a;">Request ID: ${requestId}</p>
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
                link: { verification_type: linkData.properties.verification_type, redirect_to: linkData.properties.redirect_to },
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

      case "invite_set_pin": {
        const { email } = body as InviteSetPinRequest;
        const stepBase = "invite_set_pin";

        if (!email) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Email requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(`[admin-manage-staff] ${stepBase} email=${normalizedEmail} request_id=${requestId}`);

        // Find user
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (!profile?.user_id) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
          });
        }

        // Get role
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .in("role", ["employee", "technician"])
          .maybeSingle();

        if (!roleData) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Cette action est réservée aux employés/techniciens", step: `${stepBase}.check_role` } satisfies ApiError,
          });
        }

        const targetRole = roleData.role as "employee" | "technician";

        // Generate one-time token
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const tokenHash = await hashToken(token);
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        // Invalidate previous tokens
        await adminClient
          .from("pin_invite_tokens")
          .update({ used_at: new Date().toISOString() })
          .eq("user_id", profile.user_id)
          .is("used_at", null);
        
        await adminClient.from("pin_invite_tokens").insert({
          user_id: profile.user_id,
          email: normalizedEmail,
          role: targetRole,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
          created_by_admin_id: callingUser.id,
        });
        
        const appBaseUrl = getAppBaseUrl();
        const portalPath = targetRole === "employee" ? "/employee/set-pin" : "/technician/set-pin";
        const setPinLink = `${appBaseUrl}${portalPath}?token=${token}`;
        const loginPath = targetRole === "employee" ? "/employee/login" : "/technician/auth";
        const loginLink = `${appBaseUrl}${loginPath}`;
        
        const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
        await resend.emails.send({
          from: "Nivra Telecom <support@nivra-telecom.ca>",
          reply_to: "support@nivra-telecom.ca",
          to: [normalizedEmail],
          subject: "Configuration de votre PIN - Nivra",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
              </div>
              <div style="padding: 30px; background: #f8fafc;">
                <h2>Bonjour,</h2>
                <p>Cliquez sur le bouton ci-dessous pour configurer votre PIN de connexion :</p>
                <p style="margin: 25px 0;">
                  <a href="${setPinLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Configurer mon PIN
                  </a>
                </p>
                <p style="font-size: 13px; color: #64748b;">Ce lien expire dans 24 heures.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                <p>Une fois configuré, connectez-vous ici : <a href="${loginLink}" style="color: #0d9488;">${loginLink}</a></p>
              </div>
              <div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #71717a;">Request ID: ${requestId}</p>
              </div>
            </div>
          `,
        });
        
        await logAction("staff_pin_invite_sent", { request_id: requestId, role: targetRole }, { type: "user", id: profile.user_id, email: normalizedEmail });

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Email de configuration du PIN envoyé",
        });
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
        const { target_user_id, target_email, target_role } = body as ApplyRolePackRequest;
        const stepBase = "apply_role_pack";

        // Validate: need at least one identifier
        if (!target_user_id && !target_email) {
          await logAction("staff_permissions_pack_failed", {
            request_id: requestId,
            step: `${stepBase}.validate`,
            message: "target_user_id ou target_email requis",
          }, { type: "user" });
          return json(400, {
            ok: false,
            request_id: requestId,
            step: `${stepBase}.validate`,
            message: "target_user_id ou target_email requis",
            http_status: 400,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} target_user_id=${target_user_id} target_email=${target_email} target_role=${target_role} request_id=${requestId}`);

        // Resolve user_id: prefer target_user_id, fallback to lookup via email
        let resolvedUserId: string | null = target_user_id || null;
        let resolvedEmail: string | null = target_email?.trim().toLowerCase() || null;
        let resolvedRole: StaffRole | null = target_role || null;

        // If no user_id, lookup by email via profiles
        if (!resolvedUserId && resolvedEmail) {
          const { data: profileData } = await adminClient
            .from("profiles")
            .select("user_id, email")
            .ilike("email", resolvedEmail)
            .maybeSingle();

          if (profileData?.user_id) {
            resolvedUserId = profileData.user_id;
            console.log(`[admin-manage-staff] ${stepBase} resolved user_id=${resolvedUserId} from email=${resolvedEmail}`);
          }
        }

        // Still no user_id? Check if the target_user_id might be employees.id or technicians.id
        if (!resolvedUserId && target_user_id) {
          // Try employees table
          const { data: empData } = await adminClient
            .from("employees")
            .select("email")
            .eq("id", target_user_id)
            .maybeSingle();
          
          if (empData?.email) {
            resolvedEmail = empData.email.toLowerCase();
            const { data: profileData } = await adminClient
              .from("profiles")
              .select("user_id")
              .ilike("email", resolvedEmail!)
              .maybeSingle();
            if (profileData?.user_id) {
              resolvedUserId = profileData.user_id;
              resolvedRole = resolvedRole || "employee";
              console.log(`[admin-manage-staff] ${stepBase} resolved from employees table user_id=${resolvedUserId}`);
            }
          }

          // Try technicians table if still not found
          if (!resolvedUserId) {
            const { data: techData } = await adminClient
              .from("technicians")
              .select("user_id, email")
              .eq("id", target_user_id)
              .maybeSingle();
            
            if (techData) {
              if (techData.user_id) {
                resolvedUserId = techData.user_id;
                resolvedEmail = techData.email?.toLowerCase() || null;
                resolvedRole = resolvedRole || "technician";
                console.log(`[admin-manage-staff] ${stepBase} resolved from technicians.user_id=${resolvedUserId}`);
              } else if (techData.email) {
                resolvedEmail = techData.email.toLowerCase();
                const { data: profileData } = await adminClient
                  .from("profiles")
                  .select("user_id")
                  .ilike("email", resolvedEmail!)
                  .maybeSingle();
                if (profileData?.user_id) {
                  resolvedUserId = profileData.user_id;
                  resolvedRole = resolvedRole || "technician";
                  console.log(`[admin-manage-staff] ${stepBase} resolved from technicians email user_id=${resolvedUserId}`);
                }
              }
            }
          }
        }

        // Final check: still no user_id?
        if (!resolvedUserId) {
          await logAction("staff_permissions_pack_failed", {
            request_id: requestId,
            step: `${stepBase}.resolve_user`,
            message: "Utilisateur Auth introuvable",
            target_user_id,
            target_email,
          }, { type: "user", email: resolvedEmail || target_email });
          return json(404, {
            ok: false,
            request_id: requestId,
            step: `${stepBase}.auth_user_missing`,
            message: "Utilisateur Auth introuvable. Vérifiez que le compte existe.",
            http_status: 404,
            target: { user_id: target_user_id, email: target_email, role: target_role },
          });
        }

        // Get or determine role from user_roles
        let { data: roleData } = await adminClient
          .from("user_roles")
          .select("role, permissions, status")
          .eq("user_id", resolvedUserId)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        // If user_roles row missing, try to upsert it
        if (!roleData) {
          // Determine role from employees/technicians tables or use provided
          if (!resolvedRole) {
            if (resolvedEmail) {
              const { data: empCheck } = await adminClient
                .from("employees")
                .select("id")
                .ilike("email", resolvedEmail)
                .maybeSingle();
              if (empCheck) resolvedRole = "employee";
              
              if (!resolvedRole) {
                const { data: techCheck } = await adminClient
                  .from("technicians")
                  .select("id")
                  .ilike("email", resolvedEmail)
                  .maybeSingle();
                if (techCheck) resolvedRole = "technician";
              }
            }
          }

          // Default to employee if still unknown
          const roleToInsert: StaffRole = resolvedRole || "employee";

          console.log(`[admin-manage-staff] ${stepBase} user_roles missing, upserting role=${roleToInsert} for user_id=${resolvedUserId}`);

          const { error: upsertError } = await adminClient
            .from("user_roles")
            .upsert({
              user_id: resolvedUserId,
              role: roleToInsert,
              status: "active",
              is_active: true,
            }, { onConflict: "user_id", ignoreDuplicates: false });

          if (upsertError) {
            console.error(`[admin-manage-staff] ${stepBase} upsert error:`, upsertError);
            await logAction("staff_permissions_pack_failed", {
              request_id: requestId,
              step: `${stepBase}.upsert_role`,
              message: upsertError.message,
            }, { type: "user", id: resolvedUserId, email: resolvedEmail || undefined });
            return json(500, {
              ok: false,
              request_id: requestId,
              step: `${stepBase}.upsert_role`,
              message: `Erreur création user_roles: ${upsertError.message}`,
              http_status: 500,
            });
          }

          // Re-fetch after upsert
          const { data: newRoleData } = await adminClient
            .from("user_roles")
            .select("role, permissions, status")
            .eq("user_id", resolvedUserId)
            .maybeSingle();
          
          roleData = newRoleData;
        }

        if (!roleData) {
          await logAction("staff_permissions_pack_failed", {
            request_id: requestId,
            step: `${stepBase}.get_role_final`,
            message: "Rôle utilisateur introuvable après upsert",
          }, { type: "user", id: resolvedUserId, email: resolvedEmail || undefined });
          return json(500, {
            ok: false,
            request_id: requestId,
            step: `${stepBase}.get_role_final`,
            message: "Rôle utilisateur introuvable après upsert",
            http_status: 500,
          });
        }

        const currentRole = roleData.role as StaffRole;
        const oldPermissions = roleData.permissions || {};

        const DEFAULT_PERMISSIONS: Record<StaffRole, PermissionSet> = {
          admin: {
            view_clients: true, manage_clients: true, view_orders: true, manage_orders: true,
            view_billing: true, manage_billing: true, view_appointments: true, manage_appointments: true,
            view_tickets: true, manage_tickets: true, view_logs: true, view_internal_notes: true,
            export_data: true, manage_staff: true, manage_streaming: true, manage_channels: true,
          },
          employee: {
            view_clients: true, manage_clients: false, view_orders: true, manage_orders: true,
            view_billing: true, manage_billing: false, view_appointments: true, manage_appointments: true,
            view_tickets: true, manage_tickets: true, view_logs: false, view_internal_notes: false,
            export_data: false, manage_staff: false, manage_streaming: true, manage_channels: false,
          },
          technician: {
            view_clients: false, manage_clients: false, view_orders: false, manage_orders: false,
            view_billing: false, manage_billing: false, view_appointments: true, manage_appointments: false,
            view_tickets: true, manage_tickets: false, view_logs: false, view_internal_notes: false,
            export_data: false, manage_staff: false, manage_streaming: false, manage_channels: false,
          },
        };

        const newPermissions = DEFAULT_PERMISSIONS[currentRole];

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update({ permissions: newPermissions })
          .eq("user_id", resolvedUserId);

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} update error:`, updateError);
          await logAction("staff_permissions_pack_failed", {
            request_id: requestId,
            step: `${stepBase}.update`,
            message: updateError.message,
          }, { type: "user", id: resolvedUserId, email: resolvedEmail || undefined });
          return json(500, {
            ok: false,
            request_id: requestId,
            step: `${stepBase}.update`,
            message: updateError.message,
            http_status: 500,
          });
        }

        // Get email for logging
        let targetEmail = resolvedEmail;
        if (!targetEmail) {
          const { data: targetUser } = await adminClient.auth.admin.getUserById(resolvedUserId);
          targetEmail = targetUser?.user?.email || null;
        }

        await logAction(
          "staff_permissions_pack_applied",
          { request_id: requestId, role: currentRole, old_permissions: oldPermissions, new_permissions: newPermissions, applied_pack: currentRole },
          { type: "user", id: resolvedUserId, email: targetEmail || undefined }
        );

        return json(200, {
          ok: true,
          request_id: requestId,
          step: `${stepBase}.success`,
          message: `Pack de permissions "${currentRole}" appliqué`,
          role: currentRole,
          target: { user_id: resolvedUserId, email: targetEmail, role: currentRole },
          applied_pack: newPermissions,
          http_status: 200,
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

        const pinHash = await hashPinLegacy(pin);

        const { error: updateError } = await adminClient
          .from("employees")
          .update({
            pin_hash: pinHash,
            pin_set_at: new Date().toISOString(),
            require_pin_change,
          })
          .or(`id.eq.${user_id},email.in.(select email from profiles where user_id = '${user_id}')`);

        const { data: profile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", user_id)
          .maybeSingle();

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
          { request_id: requestId, require_pin_change },
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

        if (full_name !== undefined) {
          await adminClient
            .from("profiles")
            .update({ full_name })
            .eq("user_id", user_id);
        }

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
          { request_id: requestId, updated_fields: Object.keys(updateData) },
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

      case "update_status": {
        const { user_id, status } = body as UpdateStatusRequest;
        const stepBase = "update_status";

        if (!user_id || !status) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id et status requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        if (!["active", "disabled", "hold"].includes(status)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Status invalide (active, disabled, hold)", step: `${stepBase}.validate_status` } satisfies ApiError,
          });
        }

        if (user_id === callingUser.id && status !== "active") {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Vous ne pouvez pas désactiver votre propre compte", step: `${stepBase}.self` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} status=${status} request_id=${requestId}`);

        const { data: currentData } = await adminClient
          .from("user_roles")
          .select("status")
          .eq("user_id", user_id)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        const { error: updateError } = await adminClient
          .from("user_roles")
          .update({ status })
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
        const targetEmail = targetUser?.user?.email;
        
        if (targetEmail) {
          const isActive = status === "active";
          await adminClient.from("employees").update({ is_active: isActive }).ilike("email", targetEmail);
          await adminClient.from("technicians").update({ status: isActive ? "active" : "inactive" }).ilike("email", targetEmail);
        }

        await logAction(
          "staff_status_changed",
          { request_id: requestId, old_status: currentData?.status || "active", new_status: status },
          { type: "user", id: user_id, email: targetEmail }
        );

        const statusLabels: Record<string, string> = { active: "Actif", disabled: "Désactivé", hold: "En attente" };

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: `Statut changé en "${statusLabels[status]}"`,
          status,
        });
      }

      case "hard_delete_user": {
        const { email, confirm_email } = body as HardDeleteUserRequest;
        const stepBase = "hard_delete_user";

        if (!email || !confirm_email) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "email et confirm_email requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedConfirm = confirm_email.trim().toLowerCase();

        if (normalizedEmail !== normalizedConfirm) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "L'email de confirmation ne correspond pas", step: `${stepBase}.validate_confirm` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} email=${normalizedEmail} request_id=${requestId}`);

        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .select("user_id, email, full_name")
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (profileError || !profile) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
          });
        }

        const userId = profile.user_id;

        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        if (userId === callingUser.id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Vous ne pouvez pas supprimer votre propre compte", step: `${stepBase}.self_delete` } satisfies ApiError,
          });
        }

        if (roleData?.role === "admin") {
          const { count } = await adminClient
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");

          if (count && count <= 1) {
            return json(400, {
              ok: false,
              request_id: requestId,
              error: { code: "VALIDATION", message: "Impossible de supprimer le dernier administrateur", step: `${stepBase}.last_admin` } satisfies ApiError,
            });
          }
        }

        const { error: auditDeleteError } = await adminClient
          .from("admin_audit_log")
          .delete()
          .or(`target_id.eq.${userId},target_email.ilike.${normalizedEmail}`);

        if (auditDeleteError) {
          console.error(`[admin-manage-staff] ${stepBase} audit_log delete error:`, auditDeleteError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: `Erreur suppression audit_log: ${auditDeleteError.message}`, step: `${stepBase}.delete_audit_log` } satisfies ApiError,
          });
        }

        // Delete pin_invite_tokens
        await adminClient.from("pin_invite_tokens").delete().eq("user_id", userId);

        const { error: rolesDeleteError } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        if (rolesDeleteError) {
          console.error(`[admin-manage-staff] ${stepBase} user_roles delete error:`, rolesDeleteError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: `Erreur suppression user_roles: ${rolesDeleteError.message}`, step: `${stepBase}.delete_user_roles` } satisfies ApiError,
          });
        }

        await adminClient.from("employees").delete().ilike("email", normalizedEmail);
        await adminClient.from("technicians").delete().or(`email.ilike.${normalizedEmail},user_id.eq.${userId}`);

        const { error: profilesDeleteError } = await adminClient
          .from("profiles")
          .delete()
          .eq("user_id", userId);

        if (profilesDeleteError) {
          console.error(`[admin-manage-staff] ${stepBase} profiles delete error:`, profilesDeleteError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: `Erreur suppression profiles: ${profilesDeleteError.message}`, step: `${stepBase}.delete_profiles` } satisfies ApiError,
          });
        }

        const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          console.error(`[admin-manage-staff] ${stepBase} auth delete error:`, authDeleteError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "AUTH_ERROR", message: `Erreur suppression auth: ${authDeleteError.message}`, step: `${stepBase}.delete_auth` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} SUCCESS user deleted: ${normalizedEmail} (${userId})`);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: `Utilisateur "${profile.full_name || normalizedEmail}" supprimé définitivement`,
          deleted_user: { user_id: userId, email: normalizedEmail, role: roleData?.role || "unknown" },
        });
      }

      case "verify_admin_pin": {
        // This action can be called without being fully authenticated - only need email+password to have worked
        const { email, pin } = body as VerifyAdminPinRequest;
        const stepBase = "verify_admin_pin";

        if (!email || !pin) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "email et pin requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        if (!/^\d{8}$/.test(pin)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Le PIN admin doit être exactement 8 chiffres", step: `${stepBase}.validate_format` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(`[admin-manage-staff] ${stepBase} email=${normalizedEmail} request_id=${requestId}`);

        // Find user
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (!profile?.user_id) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
          });
        }

        // Verify admin role
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role, admin_pin_hash, require_password_change, require_pin_change, status")
          .eq("user_id", profile.user_id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          return json(403, {
            ok: false,
            request_id: requestId,
            error: { code: "FORBIDDEN", message: "Ce compte n'est pas un compte administrateur", step: `${stepBase}.verify_role` } satisfies ApiError,
          });
        }

        // Check status
        if (roleData.status && roleData.status !== "active") {
          return json(403, {
            ok: false,
            request_id: requestId,
            error: { code: "FORBIDDEN", message: "Compte administrateur désactivé", step: `${stepBase}.check_status` } satisfies ApiError,
          });
        }

        // Verify PIN
        const inputPinHash = await hashPinLegacy(pin);
        
        if (!roleData.admin_pin_hash || roleData.admin_pin_hash !== inputPinHash) {
          await logAction("admin_pin_invalid", { request_id: requestId }, { type: "user", id: profile.user_id, email: normalizedEmail });
          return json(401, {
            ok: false,
            request_id: requestId,
            error: { code: "UNAUTHORIZED", message: "PIN invalide", step: `${stepBase}.verify_pin` } satisfies ApiError,
          });
        }

        await logAction("admin_pin_verified", { request_id: requestId }, { type: "user", id: profile.user_id, email: normalizedEmail });

        return json(200, {
          ok: true,
          request_id: requestId,
          valid: true,
          require_password_change: roleData.require_password_change || false,
          require_pin_change: roleData.require_pin_change || false,
        });
      }

      case "update_auth_check": {
        const { email } = body as UpdateAuthCheckRequest;
        const stepBase = "update_auth_check";

        if (!email) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "email requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(`[admin-manage-staff] ${stepBase} email=${normalizedEmail} request_id=${requestId}`);

        // Update last_auth_check_at in user_roles
        await adminClient
          .from("user_roles")
          .update({ last_auth_check_at: new Date().toISOString() })
          .eq("user_id", callingUser.id);

        // Also update profiles
        await adminClient
          .from("profiles")
          .update({ last_auth_check_at: new Date().toISOString() })
          .eq("user_id", callingUser.id);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
        });
      }

      case "admin_recover": {
        const { email, password, pin, bootstrap_token } = body as AdminRecoverRequest;
        const stepBase = "admin_recover";

        // This is a special recovery action that bypasses normal auth
        // Verify bootstrap token
        const expectedToken = Deno.env.get("BOOTSTRAP_TOKEN");
        if (!expectedToken || bootstrap_token !== expectedToken) {
          console.error(`[admin-manage-staff] ${stepBase} invalid bootstrap token`);
          return json(403, {
            ok: false,
            request_id: requestId,
            error: { code: "FORBIDDEN", message: "Token de récupération invalide", step: `${stepBase}.verify_token` } satisfies ApiError,
          });
        }

        if (!email || !password || !pin) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "email, password et pin requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        if (!/^\d{8}$/.test(pin)) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Le PIN admin doit être exactement 8 chiffres", step: `${stepBase}.validate_pin` } satisfies ApiError,
          });
        }

        if (password.length < 12) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Le mot de passe doit contenir au moins 12 caractères", step: `${stepBase}.validate_password` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(`[admin-manage-staff] ${stepBase} RECOVERY for admin email=${normalizedEmail} request_id=${requestId}`);

        // Find user
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (!profile?.user_id) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur admin non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
          });
        }

        // Verify admin role exists
        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleData) {
          return json(403, {
            ok: false,
            request_id: requestId,
            error: { code: "FORBIDDEN", message: "Ce compte n'est pas un compte administrateur", step: `${stepBase}.verify_role` } satisfies ApiError,
          });
        }

        // Update password via auth admin
        const { error: passwordError } = await adminClient.auth.admin.updateUserById(profile.user_id, {
          password,
        });

        if (passwordError) {
          console.error(`[admin-manage-staff] ${stepBase} password update error:`, passwordError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "AUTH_ERROR", message: passwordError.message, step: `${stepBase}.update_password` } satisfies ApiError,
          });
        }

        // Update PIN hash and clear change requirements
        const pinHash = await hashPinLegacy(pin);
        const { error: roleUpdateError } = await adminClient
          .from("user_roles")
          .update({
            admin_pin_hash: pinHash,
            require_password_change: false,
            require_pin_change: false,
            status: "active",
          })
          .eq("user_id", profile.user_id)
          .eq("role", "admin");

        if (roleUpdateError) {
          console.error(`[admin-manage-staff] ${stepBase} role update error:`, roleUpdateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "DB_ERROR", message: roleUpdateError.message, step: `${stepBase}.update_role` } satisfies ApiError,
          });
        }

        await logAction("admin_recovered", { request_id: requestId }, { type: "user", id: profile.user_id, email: normalizedEmail });

        console.log(`[admin-manage-staff] ${stepBase} SUCCESS admin recovered: ${normalizedEmail}`);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Compte admin récupéré avec succès",
        });
      }

      case "set_staff_password": {
        const { user_id, password, force_change = true } = body as SetStaffPasswordRequest;
        const stepBase = "set_staff_password";

        if (!user_id || !password) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "user_id et password requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        if (password.length < 8) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Le mot de passe doit contenir au moins 8 caractères", step: `${stepBase}.validate_password` } satisfies ApiError,
          });
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${user_id} force_change=${force_change} request_id=${requestId}`);

        // Get target user info
        const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(user_id);
        if (getUserError || !targetUser?.user) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.get_user` } satisfies ApiError,
          });
        }

        // Update password in auth provider
        const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
          password,
        });

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} update password error:`, updateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "AUTH_ERROR", message: updateError.message, step: `${stepBase}.update_password` } satisfies ApiError,
          });
        }

        // Update require_password_change flag in user_roles
        await adminClient
          .from("user_roles")
          .update({ require_password_change: force_change })
          .eq("user_id", user_id);

        // Also update employees table if applicable
        await adminClient
          .from("employees")
          .update({ require_password_change: force_change })
          .eq("email", targetUser.user.email);

        await logAction("staff_password_set", { 
          request_id: requestId, 
          force_change,
          target_role: "staff",
        }, { type: "user", id: user_id, email: targetUser.user.email });

        console.log(`[admin-manage-staff] ${stepBase} SUCCESS password set for: ${targetUser.user.email}`);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Mot de passe défini avec succès",
        });
      }

      case "send_password_reset": {
        const { email } = body as SendPasswordResetRequest;
        const stepBase = "send_password_reset";

        if (!email) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "VALIDATION", message: "Email requis", step: `${stepBase}.validate` } satisfies ApiError,
          });
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(`[admin-manage-staff] ${stepBase} email=${normalizedEmail} request_id=${requestId}`);

        const missingSecrets = [
          ...(isMissingSecret("SUPABASE_URL") ? ["SUPABASE_URL"] : []),
          ...(isMissingSecret("SUPABASE_SERVICE_ROLE_KEY") ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
          ...(isMissingSecret("RESEND_API_KEY") ? ["RESEND_API_KEY"] : []),
        ];

        if (missingSecrets.length > 0) {
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "MISSING_SECRETS", message: "Secrets requis manquants", step: `${stepBase}.validate_secrets` } satisfies ApiError,
            missing_secrets: missingSecrets,
          });
        }

        // Find user and determine role
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_id")
          .ilike("email", normalizedEmail)
          .maybeSingle();

        if (!profile?.user_id) {
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "NOT_FOUND", message: "Utilisateur non trouvé", step: `${stepBase}.find_user` } satisfies ApiError,
          });
        }

        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.user_id)
          .in("role", ["admin", "employee", "technician"])
          .maybeSingle();

        const targetRole = (roleData?.role as StaffRole) || "employee";
        const appBaseUrl = getAppBaseUrl();

        // Determine redirect URL based on role - NEVER send admin links to non-admins
        let redirectPath: string;
        if (targetRole === "admin") {
          redirectPath = "/admin/reset-password";
        } else if (targetRole === "employee") {
          redirectPath = "/employee/reset-password";
        } else {
          redirectPath = "/technician/reset-password";
        }

        const redirectTo = joinUrl(appBaseUrl, redirectPath);
        console.log(`[admin-manage-staff] ${stepBase} target_role=${targetRole} redirect=${redirectTo}`);

        try {
          const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: "recovery",
            email: normalizedEmail,
            options: { redirectTo },
          });

          if (linkError || !linkData?.properties?.action_link) {
            console.error(`[admin-manage-staff] ${stepBase} generate link error:`, linkError);
            return json(500, {
              ok: false,
              request_id: requestId,
              error: { code: "LINK_GENERATION_FAILED", message: linkError?.message || "Impossible de générer le lien", step: `${stepBase}.generate_link` } satisfies ApiError,
            });
          }

          const resetLink = linkData.properties.action_link;
          const loginPath = targetRole === "admin" ? "/admin/login" : targetRole === "employee" ? "/employee/login" : "/technician/auth";
          const loginLink = joinUrl(appBaseUrl, loginPath);
          const portalName = targetRole === "admin" ? "Administrateur" : targetRole === "employee" ? "Employé" : "Technicien";

          const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
          await resend.emails.send({
            from: "Nivra Telecom <support@nivra-telecom.ca>",
            reply_to: "support@nivra-telecom.ca",
            to: [normalizedEmail],
            subject: "Réinitialisation de votre mot de passe - Nivra",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 30px; text-align: center;">
                  <h1 style="color: white; margin: 0;">Nivra Telecom</h1>
                </div>
                <div style="padding: 30px; background: #f8fafc;">
                  <h2>Bonjour,</h2>
                  <p>Vous avez demandé à réinitialiser votre mot de passe pour le portail <strong>${portalName}</strong>.</p>
                  <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
                  <p style="margin: 25px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #0891b2, #06b6d4); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                      Réinitialiser mon mot de passe
                    </a>
                  </p>
                  <p style="font-size: 13px; color: #64748b;">Ce lien expire dans 1 heure.</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
                  <p>Une fois votre mot de passe défini, connectez-vous ici :</p>
                  <p><a href="${loginLink}" style="color: #0d9488;">${loginLink}</a></p>
                  <p style="margin-top: 20px; color: #64748b; font-size: 13px;"><em>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</em></p>
                </div>
                <div style="padding: 24px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #18181b;">Nivra Telecom</p>
                  <p style="margin: 0; font-size: 11px; color: #71717a;">Request ID: ${requestId}</p>
                </div>
              </div>
            `,
          });

          await logAction("staff_password_reset_sent", { 
            request_id: requestId, 
            target_role: targetRole,
            redirect_to: redirectTo,
          }, { type: "user", id: profile.user_id, email: normalizedEmail });

          console.log(`[admin-manage-staff] ${stepBase} SUCCESS email sent to: ${normalizedEmail}`);

          return json(200, {
            ok: true,
            request_id: requestId,
            success: true,
            message: "Email de réinitialisation du mot de passe envoyé",
          });
        } catch (e: unknown) {
          const err = e as Error;
          console.error(`[admin-manage-staff] ${stepBase} error:`, err);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "SEND_FAILED", message: err.message, step: `${stepBase}.send_email` } satisfies ApiError,
          });
        }
      }

      case "link_auth": {
        const { employee_id, password, send_invitation = true } = body as LinkAuthRequest;
        const stepBase = "link_auth";
        console.log(`[admin-manage-staff] ${stepBase}.start employee_id=${employee_id} request_id=${requestId}`);

        if (!employee_id) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "MISSING_EMPLOYEE_ID", message: "ID de l'employé requis", step: stepBase } satisfies ApiError,
          });
        }

        // Fetch the employee record
        const { data: employee, error: empError } = await adminClient
          .from("employees")
          .select("id, email, full_name, role, user_id, phone")
          .eq("id", employee_id)
          .maybeSingle();

        if (empError || !employee) {
          console.error(`[admin-manage-staff] ${stepBase} employee not found:`, empError);
          return json(404, {
            ok: false,
            request_id: requestId,
            error: { code: "EMPLOYEE_NOT_FOUND", message: "Employé non trouvé", step: stepBase } satisfies ApiError,
          });
        }

        if (employee.user_id) {
          console.log(`[admin-manage-staff] ${stepBase} already linked user_id=${employee.user_id}`);
          return json(200, {
            ok: true,
            request_id: requestId,
            message: "L'employé a déjà un compte de connexion lié",
            already_linked: true,
            user_id: employee.user_id,
          });
        }

        const email = employee.email;
        const full_name = employee.full_name;
        const role = employee.role as StaffRole;

        // Generate a secure temporary password if not provided
        const tempPassword = password || (() => {
          const array = new Uint8Array(20);
          crypto.getRandomValues(array);
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
          return Array.from(array).map(b => chars[b % chars.length]).join('');
        })();

        console.log(`[admin-manage-staff] ${stepBase} creating auth user for ${email}`);

        // Create auth user
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name,
            require_password_change: !password, // Require change if using temp password
          },
        });

        let userId: string;

        if (authError) {
          // Check if user already exists
          const isEmailExists = 
            authError.message?.toLowerCase().includes("already registered") ||
            authError.message?.toLowerCase().includes("email_exists") ||
            (authError as any).code === "email_exists";

          if (isEmailExists) {
            console.log(`[admin-manage-staff] ${stepBase} auth user already exists, finding...`);
            
            const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
              perPage: 1000,
            });

            if (listError) {
              return json(500, {
                ok: false,
                request_id: requestId,
                error: { code: "LIST_USERS_FAILED", message: listError.message, step: stepBase } satisfies ApiError,
              });
            }

            const existingUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email.toLowerCase()
            );

            if (!existingUser) {
              return json(500, {
                ok: false,
                request_id: requestId,
                error: { code: "USER_NOT_FOUND", message: "Utilisateur auth introuvable", step: stepBase } satisfies ApiError,
              });
            }

            userId = existingUser.id;
          } else {
            console.error(`[admin-manage-staff] ${stepBase} auth creation failed:`, authError);
            return json(400, {
              ok: false,
              request_id: requestId,
              error: { code: "AUTH_CREATE_FAILED", message: authError.message, step: stepBase } satisfies ApiError,
            });
          }
        } else {
          if (!authData.user) {
            return json(500, {
              ok: false,
              request_id: requestId,
              error: { code: "NO_USER_RETURNED", message: "Aucun utilisateur créé", step: stepBase } satisfies ApiError,
            });
          }
          userId = authData.user.id;
        }

        console.log(`[admin-manage-staff] ${stepBase} linking user_id=${userId} to employee_id=${employee_id}`);

        // Update employee record with user_id
        const { error: updateError } = await adminClient
          .from("employees")
          .update({ user_id: userId })
          .eq("id", employee_id);

        if (updateError) {
          console.error(`[admin-manage-staff] ${stepBase} update employee failed:`, updateError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "UPDATE_EMPLOYEE_FAILED", message: updateError.message, step: stepBase } satisfies ApiError,
          });
        }

        // Also update technician if role is technician
        if (role === "technician") {
          await adminClient
            .from("technicians")
            .update({ user_id: userId })
            .eq("email", email);
        }

        // Create/update profile
        await adminClient
          .from("profiles")
          .upsert({
            user_id: userId,
            email,
            full_name,
          }, { onConflict: "user_id" });

        // Create/update user_roles
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("user_roles").insert({
          user_id: userId,
          role: role || "employee",
          is_active: true,
          require_password_change: !password,
        });

        // Send password reset if requested
        if (send_invitation && !password) {
          const appBaseUrl = getAppBaseUrl();
          const resetUrl = `${appBaseUrl}/staff`;
          console.log(`[admin-manage-staff] ${stepBase} sending reset email to ${email}`);
          await adminClient.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
        }

        await logAction("staff_auth_linked", {
          request_id: requestId,
          employee_id,
          user_id: userId,
          role,
          sent_invitation: send_invitation && !password,
        }, { type: "user", id: userId, email });

        console.log(`[admin-manage-staff] ${stepBase} SUCCESS employee_id=${employee_id} user_id=${userId}`);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Compte de connexion créé et lié avec succès",
          user_id: userId,
          sent_invitation: send_invitation && !password,
        });
      }

      case "create_field_sales": {
        const { 
          email, 
          full_name, 
          phone,
          territory,
          address,
          emergency_contact,
          notes,
          commission_rate = 0.10,
        } = body as CreateFieldSalesRequest;

        const stepBase = "create_field_sales";
        console.log(`[admin-manage-staff] ${stepBase}.start email=${email} request_id=${requestId}`);

        if (!email || !full_name) {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: { code: "BAD_REQUEST", message: "Email et nom complet requis", step: stepBase } satisfies ApiError,
          });
        }

        // Generate temporary password
        const array = new Uint8Array(20);
        crypto.getRandomValues(array);
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        let tempPassword = "";
        for (let i = 0; i < 20; i++) {
          tempPassword += chars[array[i] % chars.length];
        }

        // Create or find user
        let userId: string;
        let mode: "new_user_created" | "existing_user_promoted" = "new_user_created";

        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name,
            require_password_change: true,
          },
        });

        if (authError) {
          const isEmailExists = 
            authError.message?.toLowerCase().includes("already registered") ||
            authError.message?.toLowerCase().includes("email_exists") ||
            (authError as any).code === "email_exists";

          if (isEmailExists) {
            console.log(`[admin-manage-staff] ${stepBase} email_exists - looking up existing user`);
            mode = "existing_user_promoted";

            const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({
              perPage: 1000,
            });

            if (listError) {
              return json(500, {
                ok: false,
                request_id: requestId,
                error: { code: "LIST_USERS_FAILED", message: listError.message, step: stepBase } satisfies ApiError,
              });
            }

            const existingUser = listData?.users?.find(
              (u) => u.email?.toLowerCase() === email.toLowerCase()
            );

            if (!existingUser) {
              return json(500, {
                ok: false,
                request_id: requestId,
                error: { code: "USER_NOT_FOUND", message: "Utilisateur auth introuvable", step: stepBase } satisfies ApiError,
              });
            }

            userId = existingUser.id;
          } else {
            console.error(`[admin-manage-staff] ${stepBase} auth creation failed:`, authError);
            return json(400, {
              ok: false,
              request_id: requestId,
              error: { code: "AUTH_CREATE_FAILED", message: authError.message, step: stepBase } satisfies ApiError,
            });
          }
        } else {
          if (!authData.user) {
            return json(500, {
              ok: false,
              request_id: requestId,
              error: { code: "NO_USER_RETURNED", message: "Aucun utilisateur créé", step: stepBase } satisfies ApiError,
            });
          }
          userId = authData.user.id;
        }

        console.log(`[admin-manage-staff] ${stepBase} user_id=${userId} mode=${mode}`);

        // Create/update profile
        const { error: profileError } = await adminClient
          .from("profiles")
          .upsert({
            user_id: userId,
            email: email.toLowerCase(),
            full_name,
            phone: phone || null,
          }, { onConflict: "user_id" });

        if (profileError) {
          console.error(`[admin-manage-staff] ${stepBase} profile upsert error:`, profileError);
        }

        // user_roles has a UNIQUE(user_id) constraint in this project.
        // So for existing users we must UPDATE the existing role row instead of inserting a new one.
        const { data: existingRoleRow, error: existingRoleErr } = await adminClient
          .from("user_roles")
          .select("id, role")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingRoleErr) {
          console.error(`[admin-manage-staff] ${stepBase} existing role lookup error:`, existingRoleErr);
        }

        // Safety: never auto-convert an admin account into a field sales rep.
        if (existingRoleRow?.role === "admin") {
          return json(400, {
            ok: false,
            request_id: requestId,
            error: {
              code: "ROLE_CONFLICT",
              message: "Ce courriel appartient déjà à un administrateur. Utilise un autre courriel pour le vendeur terrain.",
              step: stepBase,
            } satisfies ApiError,
          });
        }

        const nextRolePayload = {
          role: "field_sales",
          is_active: true,
          // NOTE: user_roles_status_check only allows: active | disabled | hold
          // We use "hold" as the pre-onboarding state (was previously "pending").
          status: "hold",
          require_password_change: true,
        };

        const { error: roleError } = existingRoleRow
          ? await adminClient
              .from("user_roles")
              .update(nextRolePayload)
              .eq("user_id", userId)
          : await adminClient
              .from("user_roles")
              .insert({ user_id: userId, ...nextRolePayload });

        if (roleError) {
          console.error(`[admin-manage-staff] ${stepBase} role insert error:`, roleError);
          return json(500, {
            ok: false,
            request_id: requestId,
            error: { code: "ROLE_INSERT_FAILED", message: roleError.message, step: stepBase } satisfies ApiError,
          });
        }

        // Store additional field sales data in user_roles metadata or a separate note
        // For now, we'll store territory in internal notes if provided
        if (notes || territory || address || emergency_contact) {
          try {
            const noteContent = [
              territory ? `Territoire: ${territory}` : null,
              address ? `Adresse: ${address}` : null,
              emergency_contact ? `Contact d'urgence: ${emergency_contact}` : null,
              notes ? `Notes: ${notes}` : null,
            ].filter(Boolean).join("\n");

            if (noteContent) {
              await adminClient.from("client_internal_notes").insert({
                client_id: userId,
                body: noteContent,
                note_type: "field_sales_info",
                created_by_user_id: callingUser.id,
                created_by_role: "admin",
                created_by_name: callingUser.email,
              });
            }
          } catch (e) {
            console.warn(`[admin-manage-staff] ${stepBase} failed to save notes:`, e);
          }
        }

        // If commission rate is set, create a commission rule for this user
        if (commission_rate && commission_rate !== 0.10) {
          try {
            await adminClient.from("field_sales_commission_rules").insert({
              salesperson_id: userId,
              rule_type: "base_percentage",
              value: commission_rate,
              is_active: true,
            });
          } catch (e) {
            console.warn(`[admin-manage-staff] ${stepBase} failed to create commission rule:`, e);
          }
        }

        // Send password reset email so rep can set their password
        const appBaseUrl = getAppBaseUrl();
        const setupUrl = `${appBaseUrl}/field-sales/setup`;
        console.log(`[admin-manage-staff] ${stepBase} sending setup email to ${email}`);
        
        try {
          await adminClient.auth.resetPasswordForEmail(email, { 
            redirectTo: setupUrl 
          });
        } catch (resetErr) {
          console.error(`[admin-manage-staff] ${stepBase} reset email error:`, resetErr);
        }

        await logAction("field_sales_created", {
          request_id: requestId,
          user_id: userId,
          email,
          territory,
          commission_rate,
          mode,
        }, { type: "user", id: userId, email });

        console.log(`[admin-manage-staff] ${stepBase} SUCCESS user_id=${userId}`);

        return json(200, {
          ok: true,
          request_id: requestId,
          success: true,
          message: "Représentant terrain créé avec succès",
          user_id: userId,
          mode,
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