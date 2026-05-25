/**
 * InternalPortalGate — Wraps internal portals (Field, Employee/RH) and blocks
 * access until the user has accepted the current Terms of Use version AND
 * configured MFA (when mfa_required = true on their user_roles row).
 *
 * Order: Terms → MFA → Portal.
 *
 * Mount once at the top of each internal portal layout. Does NOT mount on
 * the client portal or public site.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import TermsOfUseModal, { TERMS_VERSION } from "./TermsOfUseModal";
import MFASetupModal from "./MFASetupModal";
import { isActiveStaffImpersonationForPortal } from "@/lib/staffAssistance";

interface GateState {
  loading: boolean;
  userId: string | null;
  needsTerms: boolean;
  needsMfa: boolean;
}

function currentPortal(): "field" | "employee" | null {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.startsWith("/field")) return "field";
  if (window.location.pathname.startsWith("/employee")) return "employee";
  return null;
}

export default function InternalPortalGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>({
    loading: true,
    userId: null,
    needsTerms: false,
    needsMfa: false,
  });

  const refresh = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) {
      setState({ loading: false, userId: null, needsTerms: false, needsMfa: false });
      return;
    }

    const [{ data: profile }, { data: role }] = await Promise.all([
      supabase
        .from("profiles")
        .select("terms_accepted_at, terms_accepted_version, mfa_method, mfa_configured_at")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("mfa_required, role")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);

    const portal = currentPortal();
    const assistanceBypass = portal
      ? await isActiveStaffImpersonationForPortal(uid, portal)
      : false;

    const needsTerms =
      !profile?.terms_accepted_at || profile.terms_accepted_version !== TERMS_VERSION;
    const mfaRequired = role?.mfa_required ?? true;
    const mfaConfigured = !!profile?.mfa_configured_at && !!profile?.mfa_method;
    const needsMfa = !assistanceBypass && mfaRequired && !mfaConfigured;

    setState({ loading: false, userId: uid, needsTerms, needsMfa });
  };

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While loading or unauthenticated, render children (auth guards elsewhere
  // handle redirects). The gate only activates for authenticated staff.
  if (state.loading || !state.userId) return <>{children}</>;

  if (state.needsTerms) {
    return (
      <>
        {children}
        <TermsOfUseModal userId={state.userId} onAccepted={refresh} />
      </>
    );
  }

  if (state.needsMfa) {
    return (
      <>
        {children}
        <MFASetupModal userId={state.userId} onConfigured={refresh} />
      </>
    );
  }

  return <>{children}</>;
}
