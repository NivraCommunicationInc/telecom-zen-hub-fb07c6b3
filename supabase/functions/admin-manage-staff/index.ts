import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0?target=deno";
import { getCorsHeaders } from "../_shared/cors.ts";

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
        const { email, full_name, role, require_password_change = true } = body;
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

        // Delete existing roles then insert new one
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        const { error: roleError } = await adminClient.from("user_roles").insert({
          user_id: userId,
          role: role,
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
            status: "active",
          }, { onConflict: "user_id" });

          if (techError) {
            console.error(`[admin-manage-staff] ${stepTech} error:`, techError);
            // Non-fatal, log but continue
          }
        }

        // Step: audit_log_insert
        const stepAudit = `${createStep}.done`;
        const auditAction = mode === "existing_user_promoted" ? "staff_role_applied_existing_user" : "staff_created";
        await logAction(
          auditAction,
          {
            role,
            require_password_change,
            request_id: requestId,
            mode,
          },
          { type: "user", id: userId, email }
        );

        // Send reset email if needed (for new users or if explicitly requested)
        if (require_password_change && mode === "new_user_created") {
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
          : "Utilisateur créé. Un email de configuration du mot de passe a été envoyé.";

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
