/**
 * HubPage — Secure Internal Access Hub for Nivra staff.
 * core2617.nivra-telecom.ca — Staff-only gateway to internal portals.
 * 
 * NO client portal links. NO public marketing. Staff-only.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Terminal, Briefcase, MapPin, Wrench, Shield, LogOut,
  Lock, ChevronRight, AlertTriangle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkMfaStatus, type MfaStatus } from "@/lib/security/mfaUtils";
import MfaEnrollmentDialog from "@/components/security/MfaEnrollmentDialog";
import MfaVerificationGate from "@/components/security/MfaVerificationGate";
import { auditAccess } from "@/lib/security/internalAuditLogger";

interface PortalCard {
  id: string;
  portalKey: string;
  label: string;
  description: string;
  icon: typeof Terminal;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PORTALS: PortalCard[] = [
  {
    id: "core",
    portalKey: "can_access_core",
    label: "Nivra Core",
    description: "Operations console — Full administrative control, billing, orders, clients, system management.",
    icon: Terminal,
    href: "/core",
    color: "text-emerald-400",
    bgColor: "bg-emerald-600/10",
    borderColor: "border-emerald-600/20 hover:border-emerald-500/40",
  },
  {
    id: "employee",
    portalKey: "can_access_employee",
    label: "Nivra Employee",
    description: "Staff workspace — Client management, orders, tickets, appointments, POS.",
    icon: Briefcase,
    href: "/staff/employee",
    color: "text-blue-400",
    bgColor: "bg-blue-600/10",
    borderColor: "border-blue-600/20 hover:border-blue-500/40",
  },
  {
    id: "field",
    portalKey: "can_access_field",
    label: "Nivra Field",
    description: "Field operations — Mobile POS, on-site sales, field activations.",
    icon: MapPin,
    href: "/staff/pos",
    color: "text-amber-400",
    bgColor: "bg-amber-600/10",
    borderColor: "border-amber-600/20 hover:border-amber-500/40",
  },
  {
    id: "technician",
    portalKey: "can_access_technician",
    label: "Nivra Technician",
    description: "Technician workspace — Installation schedules, equipment, field service. (Coming soon)",
    icon: Wrench,
    href: "/staff/technician",
    color: "text-purple-400",
    bgColor: "bg-purple-600/10",
    borderColor: "border-purple-600/20 hover:border-purple-500/40",
  },
];

export default function HubPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [accessFlags, setAccessFlags] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [showMfaEnroll, setShowMfaEnroll] = useState(false);
  const [showMfaVerify, setShowMfaVerify] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/hub/login", { replace: true });
          return;
        }

        setUserEmail(session.user.email ?? null);

        // Get user role and portal access flags
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role, status, is_active, can_access_core, can_access_employee, can_access_field, can_access_technician")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .in("role", ["admin", "employee", "technician", "supervisor", "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"])
          .maybeSingle();

        if (roleError || !roleData) {
          if (mounted) {
            setError("Accès refusé. Vous n'avez aucun rôle interne actif.");
            setLoading(false);
          }
          return;
        }

        if (!roleData.is_active) {
          if (mounted) {
            setError("Votre compte interne est désactivé.");
            setLoading(false);
          }
          return;
        }

        // Check MFA status
        const mfa = await checkMfaStatus();
        
        if (mounted) {
          setUserRole(roleData.role);
          setAccessFlags({
            can_access_core: roleData.can_access_core ?? false,
            can_access_employee: roleData.can_access_employee ?? false,
            can_access_field: roleData.can_access_field ?? false,
            can_access_technician: roleData.can_access_technician ?? false,
          });
          setMfaStatus(mfa);

          if (!mfa.isEnrolled) {
            // Force MFA enrollment
            setShowMfaEnroll(true);
            setLoading(false);
          } else if (!mfa.isVerified) {
            // Enrolled but not verified in this session
            setShowMfaVerify(true);
            setLoading(false);
          } else {
            // Fully authenticated + MFA verified
            await auditAccess("hub_access", "hub");
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("[Hub] Access check failed:", err);
        if (mounted) {
          setError("Erreur de vérification d'accès.");
          setLoading(false);
        }
      }
    };

    checkAccess();
    return () => { mounted = false; };
  }, [navigate]);

  const handlePortalAccess = async (portal: PortalCard) => {
    const hasAccess = accessFlags[portal.portalKey];
    if (!hasAccess) return;

    // Log portal access via audit trail
    await auditAccess("portal_entry", portal.id);

    navigate(portal.href);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-[hsl(220,10%,45%)]">Vérification de l'accès…</p>
        </div>
      </div>
    );
  }

  // MFA enrollment gate — user has no TOTP factor
  if (showMfaEnroll) {
    return (
      <MfaEnrollmentDialog
        onComplete={() => {
          setShowMfaEnroll(false);
          // Re-check MFA status after enrollment
          window.location.reload();
        }}
        onCancel={handleLogout}
      />
    );
  }

  // MFA verification gate — user is enrolled but hasn't verified this session
  if (showMfaVerify && mfaStatus?.factorId) {
    return (
      <MfaVerificationGate
        factorId={mfaStatus.factorId}
        onVerified={() => {
          setShowMfaVerify(false);
          auditAccess("hub_access", "hub");
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Accès refusé</h2>
          <p className="text-sm text-[hsl(220,10%,50%)] mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  const accessiblePortals = PORTALS.filter((p) => accessFlags[p.portalKey]);
  const lockedPortals = PORTALS.filter((p) => !accessFlags[p.portalKey]);

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white">
      {/* Header */}
      <header className="border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">Nivra Internal</span>
              <span className="ml-2 text-[10px] font-mono text-[hsl(220,10%,40%)] uppercase tracking-widest">
                Secure Hub
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-[hsl(220,10%,50%)]">{userEmail}</p>
              <p className="text-[10px] text-[hsl(220,10%,35%)] uppercase tracking-wider">{userRole}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-2 rounded-lg text-[hsl(220,10%,40%)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Espaces internes</h1>
          <p className="text-sm text-[hsl(220,10%,45%)]">
            Sélectionnez l'espace de travail auquel vous souhaitez accéder.
          </p>
        </div>

        {/* Accessible portals */}
        {accessiblePortals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {accessiblePortals.map((portal) => (
              <button
                key={portal.id}
                onClick={() => handlePortalAccess(portal)}
                className={cn(
                  "group relative text-left p-5 rounded-xl border transition-all duration-200",
                  portal.borderColor,
                  "bg-[hsl(220,20%,8%)] hover:bg-[hsl(220,20%,10%)]"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", portal.bgColor)}>
                    <portal.icon className={cn("h-5 w-5", portal.color)} />
                  </div>
                  <ChevronRight className={cn(
                    "h-5 w-5 text-[hsl(220,10%,30%)] group-hover:translate-x-1 transition-transform",
                    `group-hover:${portal.color}`
                  )} />
                </div>
                <h3 className="text-base font-semibold mt-4 mb-1">{portal.label}</h3>
                <p className="text-xs text-[hsl(220,10%,45%)] leading-relaxed">{portal.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Locked portals */}
        {lockedPortals.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4 mt-8">
              <Lock className="h-3.5 w-3.5 text-[hsl(220,10%,30%)]" />
              <span className="text-xs text-[hsl(220,10%,30%)] uppercase tracking-wider font-medium">
                Accès non autorisé
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lockedPortals.map((portal) => (
                <div
                  key={portal.id}
                  className="relative p-5 rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)] opacity-40 cursor-not-allowed"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(220,15%,12%)] flex items-center justify-center">
                      <Lock className="h-4 w-4 text-[hsl(220,10%,30%)]" />
                    </div>
                  </div>
                  <h3 className="text-base font-semibold mt-4 mb-1 text-[hsl(220,10%,35%)]">{portal.label}</h3>
                  <p className="text-xs text-[hsl(220,10%,25%)] leading-relaxed">{portal.description}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Security info */}
        <div className="mt-12 pt-8 border-t border-[hsl(220,15%,10%)]">
          <div className="flex items-center gap-2 text-[hsl(220,10%,30%)]">
            <Shield className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-widest font-medium">
              Session sécurisée · Accès audité · Rôle: {userRole}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
