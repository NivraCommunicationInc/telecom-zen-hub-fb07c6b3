/**
 * HubLoginPage — Login + MFA for a specific portal selected from /hub.
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, AlertCircle, ArrowLeft, Terminal, Briefcase, MapPin, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import { checkMfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { createHubSession, clearHubSession } from "@/lib/security/hubSession";
import { auditAccess } from "@/lib/security/internalAuditLogger";

const PORTAL_CONFIG: Record<string, { label: string; icon: typeof Terminal; accessKey: string; href: string }> = {
  core: { label: "Nivra Core", icon: Terminal, accessKey: "can_access_core", href: "/core" },
  employee: { label: "Nivra Employee", icon: Briefcase, accessKey: "can_access_employee", href: "/employee" },
  field: { label: "Nivra Field", icon: MapPin, accessKey: "can_access_field", href: "/field" },
  technician: { label: "Nivra Technician", icon: Wrench, accessKey: "can_access_technician", href: "/staff/technician" },
};

const INTERNAL_ROLES = [
  "admin", "employee", "technician", "supervisor",
  "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"
];

type Stage = "login" | "mfa_enroll" | "mfa_verify" | "redirecting";

export default function HubLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeClass } = useInternalTheme();
  const portalId = searchParams.get("portal");
  const portal = portalId ? PORTAL_CONFIG[portalId] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("login");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (!portal) {
      setCheckingSession(false);
      return;
    }

    const checkExisting = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
  }, [portal]);

  const verifyAndProceed = async (userId: string) => {
    if (!portal || !portalId) return;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, status, is_active, can_access_core, can_access_employee, can_access_field, can_access_technician")
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
    navigate(portal.href, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal) return;

    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !data.session) {
        setError("Identifiants invalides.");
        setLoading(false);
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
    navigate("/hub", { replace: true });
  };

  if (!portal) {
    return (
      <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background px-4", themeClass)}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Aucun espace sélectionné.</p>
          <Button asChild variant="outline">
            <Link to="/hub">Retour au Hub</Link>
          </Button>
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
          <InternalThemeToggle />
        </div>
        <MfaEnrollmentDialog onComplete={() => window.location.reload()} onCancel={handleLogout} />
      </div>
    );
  }

  if (stage === "mfa_verify" && mfaFactorId) {
    return (
      <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)}>
        <div className="fixed right-3 top-3 z-40">
          <InternalThemeToggle />
        </div>
        <MfaVerificationGate
          factorId={mfaFactorId}
          onVerified={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              createHubSession(session.user.id);
              await auditAccess("hub_access", portalId!);
              await auditAccess("portal_entry", portalId!);
              navigate(portal.href, { replace: true });
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
        <InternalThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
          </form>
        </div>
      </div>
    </div>
  );
}
