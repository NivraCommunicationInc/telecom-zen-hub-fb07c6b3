/**
 * DEV LOGIN - Preview/Development environment ONLY
 * 
 * This page allows bypassing 2FA/email verification for audit purposes.
 * It creates test sessions for admin and client portals.
 * 
 * SECURITY: 
 *  1. BUILD GUARD: import.meta.env.PROD strips this from production bundles
 *  2. RUNTIME GUARD: hostname must contain "preview", "localhost", etc.
 *  3. ROUTE GUARD: AppRoutes only registers /dev-login when not in production
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminClient } from "@/integrations/backend/adminClient";
import { portalClient } from "@/integrations/backend/portalClient";
import { Loader2, Shield, User, AlertTriangle } from "lucide-react";

// BUILD GUARD: In production builds, this is always false (dead-code eliminated by Vite)
const IS_PRODUCTION_BUILD = import.meta.env.PROD;

const IS_PREVIEW = !IS_PRODUCTION_BUILD && typeof window !== "undefined" && (
  window.location.hostname.includes("preview") ||
  window.location.hostname.includes("localhost") ||
  window.location.hostname.includes("127.0.0.1") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app")
);

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

const TEST_PASSWORD = "AuditTest2026!Secure";

const ADMIN_EMAIL = "admin-audit@nivradev.com";
const CLIENT_EMAIL = "client-audit@nivradev.com";
// Optional preview-only audit accounts. Populate via Vite env vars in the
// preview environment only — never commit real customer PII to source.
const OLDO_EMAIL = (import.meta.env.VITE_AUDIT_USER_EMAIL_1 as string | undefined) ?? "";
const SERGE_EMAIL = (import.meta.env.VITE_AUDIT_USER_EMAIL_2 as string | undefined) ?? "";
const SERGE_LABEL = (import.meta.env.VITE_AUDIT_USER_LABEL_2 as string | undefined) ?? "Audit referrer";
const OLDO_LABEL = (import.meta.env.VITE_AUDIT_USER_LABEL_1 as string | undefined) ?? "Audit user 1";
export default function DevLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!IS_PREVIEW) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-950 text-white">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold">Accès interdit</h1>
          <p>Cette page n'est disponible qu'en environnement preview.</p>
        </div>
      </div>
    );
  }

  const loginAdmin = async () => {
    setLoading(true);
    setError("");
    setStatus("Connexion admin en cours...");

    try {
      // Try sign in first
      let { data, error: signInErr } = await adminClient.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: TEST_PASSWORD,
      });

      // If user doesn't exist, create it
      if (signInErr?.message?.includes("Invalid login")) {
        setStatus("Création du compte admin de test...");
        const { data: signUpData, error: signUpErr } = await adminClient.auth.signUp({
          email: ADMIN_EMAIL,
          password: TEST_PASSWORD,
          options: { data: { full_name: "Admin Audit" } },
        });
        if (signUpErr) throw signUpErr;

        // Sign in after creation
        const result = await adminClient.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: TEST_PASSWORD,
        });
        if (result.error) throw result.error;
        data = result.data;
      } else if (signInErr) {
        throw signInErr;
      }

      const userId = data?.user?.id;
      if (!userId) throw new Error("No user ID returned");

      setStatus("Configuration du rôle admin...");

      // Ensure user_roles entry exists
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (!existingRole) {
        await adminClient.from("user_roles").upsert({
          user_id: userId,
          role: "admin",
          status: "active",
        }, { onConflict: "user_id,role" });
      }

      // Ensure admin_users entry
      const { data: existingAdmin } = await adminClient
        .from("admin_users")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingAdmin) {
        await adminClient.from("admin_users").insert({
          user_id: userId,
          is_active: true,
          notes: "Audit test account",
        });
      }

      // Call admin-secret-verify with default code "112233" to get a real session token
      setStatus("Vérification du code secret (default 112233)...");
      const { data: secretData, error: secretErr } = await adminClient.functions.invoke("admin-secret-verify", {
        body: {
          admin_user_id: userId,
          code: "112233",
          session_id: `dev-audit-${Date.now()}`,
        },
      });

      if (secretErr || !secretData?.ok) {
        console.warn("Secret verify failed, using localStorage bypass:", secretErr, secretData);
        // Fallback: fake token with soft-fail
        const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        localStorage.setItem("nivra_admin_secret_session", "dev-audit-bypass-token");
        localStorage.setItem("nivra_admin_secret_expires", futureExpiry);
        localStorage.setItem("nivra_admin_user_id", userId);
      } else {
        // Real session token from edge function
        localStorage.setItem("nivra_admin_secret_session", secretData.session_token);
        localStorage.setItem("nivra_admin_secret_expires", secretData.session_expires_at);
        localStorage.setItem("nivra_admin_user_id", userId);
      }

      // Set session check timestamp
      sessionStorage.setItem("admin_last_auth_check", Date.now().toString());

      setStatus("✅ Admin connecté! Redirection...");
      setTimeout(() => navigate("/admin", { replace: true }), 800);
    } catch (err: any) {
      console.error("Admin login error:", err);
      setError(err.message || "Erreur de connexion admin");
    } finally {
      setLoading(false);
    }
  };

  const loginClient = async (targetEmail: string = CLIENT_EMAIL) => {
    setLoading(true);
    setError("");
    setStatus(`Connexion client (${targetEmail}) en cours...`);

    try {
      // DEV-ONLY helper: audited access to real account via one-time magic link (no password reset)
      if (targetEmail && (targetEmail === OLDO_EMAIL || targetEmail === SERGE_EMAIL)) {
        const auditLabel = targetEmail === SERGE_EMAIL ? "Audit referral portal" : "Audit RLS /portal/service-addresses";
        const auditRedirect = targetEmail === SERGE_EMAIL
          ? `${window.location.origin}/portal/referrals?audit_session=1`
          : `${window.location.origin}/portal/service-addresses?audit_session=1`;
        setStatus(`Génération d'une session audit one-shot (${targetEmail})...`);
        let { data: adminData, error: adminSignInErr } = await adminClient.auth.signInWithPassword({
          email: ADMIN_EMAIL,
          password: TEST_PASSWORD,
        });

        if (adminSignInErr?.message?.includes("Invalid login")) {
          const { error: signUpErr } = await adminClient.auth.signUp({
            email: ADMIN_EMAIL,
            password: TEST_PASSWORD,
            options: { data: { full_name: "Admin Audit" } },
          });
          if (signUpErr) throw signUpErr;

          const retry = await adminClient.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: TEST_PASSWORD,
          });
          if (retry.error) throw retry.error;
          adminData = retry.data;
        } else if (adminSignInErr) {
          throw adminSignInErr;
        }

        const adminUserId = adminData?.user?.id;
        if (!adminUserId) throw new Error("Admin session unavailable");

        await adminClient.from("user_roles").upsert({
          user_id: adminUserId,
          role: "admin",
          status: "active",
        }, { onConflict: "user_id,role" });

        const { data: auditSessionData, error: auditSessionErr } = await adminClient.functions.invoke("admin-audit-session-link", {
          body: {
            target_email: targetEmail,
            reason: auditLabel,
            redirect_to: auditRedirect,
          },
        });

        if (auditSessionErr || !auditSessionData?.success || !auditSessionData?.action_link) {
          throw new Error(auditSessionData?.error || auditSessionErr?.message || `Impossible de créer la session audit (${targetEmail})`);
        }

        // Set trusted device flags BEFORE redirect so PIN guard is bypassed
        const trustedUntil = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem("portal_trusted_until", trustedUntil.toString());
        sessionStorage.setItem("client_pin_verified", "true");
        sessionStorage.setItem("client_last_auth_check", Date.now().toString());

        setStatus("Lien audit one-shot créé. Redirection...");
        window.location.assign(auditSessionData.action_link);
        return;
      }

      // Try sign in first
      let { data, error: signInErr } = await portalClient.auth.signInWithPassword({
        email: targetEmail,
        password: TEST_PASSWORD,
      });

      // If user doesn't exist, create it (for generic audit user only)
      if (signInErr?.message?.includes("Invalid login") && targetEmail === CLIENT_EMAIL) {
        setStatus("Création du compte client de test...");
        const { error: signUpErr } = await portalClient.auth.signUp({
          email: CLIENT_EMAIL,
          password: TEST_PASSWORD,
          options: { data: { full_name: "Client Audit" } },
        });
        if (signUpErr) throw signUpErr;

        const result = await portalClient.auth.signInWithPassword({
          email: CLIENT_EMAIL,
          password: TEST_PASSWORD,
        });
        if (result.error) throw result.error;
        data = result.data;
      } else if (signInErr) {
        throw signInErr;
      }

      const userId = data?.user?.id;
      if (!userId) throw new Error("No user ID returned");

      setStatus("Configuration du profil client...");

      // Ensure user_roles entry
      const { data: existingRole } = await portalClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "client")
        .maybeSingle();

      if (!existingRole) {
        await portalClient.from("user_roles").upsert({
          user_id: userId,
          role: "client",
          status: "active",
        }, { onConflict: "user_id,role" });
      }

      // Ensure profile exists (audit user only)
      if (targetEmail === CLIENT_EMAIL) {
        const { data: existingProfile } = await portalClient
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!existingProfile) {
          await portalClient.from("profiles").insert({
            user_id: userId,
            full_name: "Client Audit",
            email: CLIENT_EMAIL,
            phone: "514-555-0199",
            online_access_status: "active",
          });
        }
      }

      // Set trusted device (24h window)
      const trustedUntil = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("portal_trusted_until", trustedUntil.toString());
      sessionStorage.setItem("client_pin_verified", "true");
      sessionStorage.setItem("client_last_auth_check", Date.now().toString());

      setStatus(`✅ Client connecté (${targetEmail})! Redirection...`);
      setTimeout(() => navigate("/portal", { replace: true }), 800);
    } catch (err: any) {
      console.error("Client login error:", err);
      setError(err.message || "Erreur de connexion client");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center space-y-2">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-bold">🔧 Dev Login — Audit</h1>
          <p className="text-zinc-400 text-sm">
            Environnement preview uniquement. Bypass 2FA pour audit technique.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={loginAdmin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            Connexion Admin Portal
          </button>

          <button
            onClick={() => loginClient(CLIENT_EMAIL)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg font-medium transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
            Connexion Client Portal
          </button>

          <button
            onClick={() => loginClient(OLDO_EMAIL)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg font-medium transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
            Connexion Client OLDO (audit)
          </button>

          <button
            onClick={() => loginClient(SERGE_EMAIL)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg font-medium transition"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
            Connexion Serge Beaulne (referrer audit)
          </button>
        </div>

        {status && (
          <div className="text-center text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3">
            {status}
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 bg-red-900/30 rounded-lg p-3">
            ❌ {error}
          </div>
        )}

        <div className="text-center text-xs text-zinc-600">
          Admin: {ADMIN_EMAIL} | Client: {CLIENT_EMAIL}
        </div>
      </div>
    </div>
  );
}
