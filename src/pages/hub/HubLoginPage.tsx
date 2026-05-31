/**
 * HubLoginPage — Login + MFA for a specific portal selected from /hub.
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle, ArrowLeft, Terminal, Briefcase, MapPin, Wrench, Megaphone, UserCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { createHubSession, clearHubSession } from "@/lib/security/hubSession";
import { clearStaffAssistance } from "@/lib/staffAssistance";
import { auditAccess } from "@/lib/security/internalAuditLogger";
import { resolveStaffLandingPath } from "@/lib/security/portalRedirect";

const PORTAL_CONFIG: Record<string, { label: string; icon: typeof Terminal; accessKey: string; href: string }> = {
  core: { label: "Nivra Core", icon: Terminal, accessKey: "can_access_core", href: "/core" },
  employee: { label: "Nivra Employee", icon: Briefcase, accessKey: "can_access_employee", href: "/employee" },
  field: { label: "Nivra Field", icon: MapPin, accessKey: "can_access_field", href: "/field" },
  technician: { label: "Nivra Technician", icon: Wrench, accessKey: "can_access_technician", href: "/tech" },
  rh: { label: "Nivra HR", icon: UserCheck, accessKey: "can_access_rh", href: "/hr" },
  marketing: { label: "Marketing Hub", icon: Megaphone, accessKey: "can_access_core", href: "/marketing" },
};

const INTERNAL_ROLES = [
  "admin", "employee", "technician", "supervisor",
  "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"
];

const getSafePortalRedirect = (redirect: string | null, fallback: string) => {
  if (!redirect) return fallback;
  if (!redirect.startsWith("/") || redirect.startsWith("//")) return fallback;
  if (redirect.startsWith("/core") || redirect.startsWith("/hr") || redirect.startsWith("/employee") || redirect.startsWith("/field") || redirect.startsWith("/staff") || redirect.startsWith("/marketing") || redirect.startsWith("/tech")) {
    return redirect;
  }
  return fallback;
};

type Stage = "login" | "mfa_enroll" | "mfa_verify" | "redirecting";

const FAIL_THRESHOLD = 3;
const failKey = (email: string) => `hub_login_fails::${email.toLowerCase()}`;
const getFailCount = (email: string) => {
  try { return parseInt(localStorage.getItem(failKey(email)) || "0", 10) || 0; }
  catch { return 0; }
};
const setFailCount = (email: string, n: number) => {
  try { localStorage.setItem(failKey(email), String(n)); } catch { /* noop */ }
};
const clearFailCount = (email: string) => {
  try { localStorage.removeItem(failKey(email)); } catch { /* noop */ }
};

export default function HubLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  const portalId = searchParams.get("portal");
  const portal = portalId ? PORTAL_CONFIG[portalId] : null;
  const portalRedirect = getSafePortalRedirect(searchParams.get("redirect"), portal?.href ?? "/nivra-secure-hub-2617-internal");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("login");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Enforces MFA enrollment/verification for staff arriving without a specific
  // portal selection (auto-landing flow). Mirrors verifyAndProceed but without
  // the per-portal access key check.
  const enforceMfaThenLand = async (userId: string, landing: string) => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, status, is_active")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", INTERNAL_ROLES)
      .maybeSingle();

    const isAdminRole = roleData?.role === "admin";
    const mfa = await checkMfaStatus();

    if (isAdminRole && !mfa.isEnrolled) {
      setStage("mfa_enroll");
      setCheckingSession(false);
      setLoading(false);
      try { sessionStorage.setItem("hub_pending_landing", landing); } catch { /* noop */ }
      return;
    }
    if (mfa.isEnrolled && !mfa.isVerified) {
      setMfaFactorId(mfa.factorId ?? null);
      setStage("mfa_verify");
      setCheckingSession(false);
      setLoading(false);
      try { sessionStorage.setItem("hub_pending_landing", landing); } catch { /* noop */ }
      return;
    }

    createHubSession(userId);
    await auditAccess("hub_access", "auto");
    setStage("redirecting");
    navigate(landing, { replace: true });
  };

  useEffect(() => {
    const checkExisting = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // No portal selected: if user is already signed in, enforce MFA first,
        // then route them to their default portal based on role.
        if (!portal) {
          if (session?.user) {
            const landing = await resolveStaffLandingPath(session.user.id);
            await enforceMfaThenLand(session.user.id, landing);
            return;
          }
          setCheckingSession(false);
          return;
        }

        if (!session?.user) {
          setCheckingSession(false);
          return;
        }
        await verifyAndProceed(session.user.id);
      } catch {
        setCheckingSession(false);
      }
    };

    checkExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portal]);

  const verifyAndProceed = async (userId: string) => {
    if (!portal || !portalId) return;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, status, is_active, can_access_core, can_access_employee, can_access_field, can_access_technician, can_access_rh")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", INTERNAL_ROLES)
      .maybeSingle();

    if (roleError || !roleData || !roleData.is_active) {
      await supabase.auth.signOut();
      setError("Accès refusé. Vous n'avez aucun rôle interne actif.");
      setCheckingSession(false);
      setLoading(false);
      return;
    }

    const hasPortalAccess = roleData[portal.accessKey as keyof typeof roleData];
    if (!hasPortalAccess) {
      await supabase.auth.signOut();
      setError(`Accès refusé à ${portal.label}. Contactez votre administrateur.`);
      setCheckingSession(false);
      setLoading(false);
      return;
    }

    const isAdminRole = roleData.role === "admin";
    const mfa = await checkMfaStatus();

    if (isAdminRole) {
      if (!mfa.isEnrolled) {
        setStage("mfa_enroll");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
      if (!mfa.isVerified) {
        setMfaFactorId(mfa.factorId ?? null);
        setStage("mfa_verify");
        setCheckingSession(false);
        setLoading(false);
        return;
      }
    } else if (mfa.isEnrolled && !mfa.isVerified) {
      setMfaFactorId(mfa.factorId ?? null);
      setStage("mfa_verify");
      setCheckingSession(false);
      setLoading(false);
      return;
    }

    createHubSession(userId);
    await auditAccess("hub_access", portalId);
    await auditAccess("portal_entry", portalId);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email) {
      await supabase.from("hub_login_audit").insert({
        user_id: userId,
        email: session.user.email,
        event: "login_success",
        portal_accessed: portalId,
      });
    }

    setStage("redirecting");
    navigate(portalRedirect, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.session) {
        const emailKey = email.trim();
        // Fire-and-forget brute-force tracker (alerts ops on 3+ failures/5min)
        supabase.functions.invoke("track-login-attempt", {
          body: {
            email_attempted: emailKey,
            success: false,
            failure_reason: authError?.message ?? "no_session",
            portal: portal ?? "hub",
          },
        }).catch(() => { /* never block UX */ });

        // Per-email failure counter. After FAIL_THRESHOLD failures, silently
        // trigger a password-reset email if the address matches an active
        // Nivra Core staff account.
        const newCount = getFailCount(emailKey) + 1;
        setFailCount(emailKey, newCount);

        if (newCount >= FAIL_THRESHOLD) {
          supabase.functions.invoke("hub-password-reset-send", {
            body: { email: emailKey, redirect_origin: window.location.origin },
          }).catch(() => { /* silent */ });
          clearFailCount(emailKey);
          setError(
            "Trop de tentatives. Si cette adresse correspond à un compte Nivra Core, un courriel de réinitialisation vient d'être envoyé.",
          );
        } else {
          setError(`Identifiants invalides. (${newCount}/${FAIL_THRESHOLD})`);
        }
        setLoading(false);
        return;
      }

      // Successful auth → reset failure counter for this email.
      clearFailCount(email.trim());

      // Log successful login (no alert, just history)
      supabase.functions.invoke("track-login-attempt", {
        body: {
          email_attempted: email.trim(),
          success: true,
          portal: portal ?? "hub",
        },
      }).catch(() => { /* ignore */ });

      // Normal login → wipe any stale staff-assistance flag from a previous
      // admin session on this device. The banner must never appear when the
      // employee is signing in with their own credentials.
      clearStaffAssistance();

      // No specific portal selected → enforce MFA then route to landing.
      if (!portal) {
        const landing = await resolveStaffLandingPath(data.session.user.id);
        await enforceMfaThenLand(data.session.user.id, landing);
        return;
      }

      await verifyAndProceed(data.session.user.id);
    } catch {
      setError("Erreur de connexion. Veuillez réessayer.");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    clearHubSession();
    await supabase.auth.signOut();
    navigate("/nivra-secure-hub-2617-internal", { replace: true });
  };

  if (!portal) {
    if (checkingSession) {
      return (
        <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background", themeClass)}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Vérification de la session…</p>
          </div>
        </div>
      );
    }

    if (stage === "redirecting") {
      return (
        <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background", themeClass)}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Redirection vers votre portail…</p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background px-4", themeClass)}>
        <div className="fixed right-3 top-3 z-40">
          <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-border bg-card shadow-sm p-8">
            <div className="text-center mb-8">
              <div className="h-12 w-12 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Nivra Internal</h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Connectez-vous pour accéder à votre portail.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Courriel professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connexion"}
              </Button>

              <div className="pt-2">
                <p className="text-center text-xs text-muted-foreground">
                  <Link to="/nivra-secure-hub-2617-internal" className="text-primary hover:underline">
                    Choisir un portail spécifique
                  </Link>
                </p>
                <p className="text-center text-[11px] text-muted-foreground/80 mt-2 leading-relaxed">
                  Après {FAIL_THRESHOLD} tentatives échouées, un lien de réinitialisation sera automatiquement envoyé à votre courriel s'il correspond à un compte Nivra Core.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background", themeClass)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (stage === "mfa_enroll") {
    return (
      <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)}>
        <div className="fixed right-3 top-3 z-40">
          <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <MfaEnrollmentDialog onComplete={() => window.location.reload()} onCancel={handleLogout} />
      </div>
    );
  }

  if (stage === "mfa_verify" && mfaFactorId) {
    return (
      <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)}>
        <div className="fixed right-3 top-3 z-40">
          <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <MfaVerificationGate
          factorId={mfaFactorId}
          onVerified={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              createHubSession(session.user.id);
              await auditAccess("hub_access", portalId!);
              await auditAccess("portal_entry", portalId!);
              navigate(portalRedirect, { replace: true });
            }
          }}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  if (stage === "redirecting") {
    return (
      <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background", themeClass)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirection vers {portal.label}…</p>
        </div>
      </div>
    );
  }

  const PortalIcon = portal.icon;

  return (
    <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background px-4", themeClass)}>
      <div className="fixed right-3 top-3 z-40">
        <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link to="/nivra-secure-hub-2617-internal" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à la sélection
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="h-12 w-12 mx-auto rounded-xl bg-primary flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Nivra Internal</h1>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
              <PortalIcon className="h-4 w-4 text-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{portal.label}</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="Courriel professionnel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
            />

            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="h-11"
            />

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connexion"}
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-2">
              <Link to="/nivra-secure-hub-2617-internal/forgot-password" className="text-primary hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
