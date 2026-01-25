/**
 * FieldSalesLayout - Layout for field sales (door-to-door) portal
 * Mobile-first design optimized for phone/tablet use in the field
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import StaffBackground from "@/components/staff/StaffBackground";

interface FieldSalesLayoutProps {
  children: React.ReactNode;
}

export default function FieldSalesLayout({ children }: FieldSalesLayoutProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (mounted) navigate("/field-sales", { replace: true });
          return;
        }

        // Check if user has field_sales role
        const { data: hasRole } = await supabase.rpc("is_field_sales", {
          _user_id: session.user.id,
        });

        if (!hasRole) {
          if (mounted) navigate("/field-sales", { replace: true });
          return;
        }

        // Check onboarding status
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("onboarding_completed_at, terms_accepted_at, staff_pin_hash, is_active, status")
          .eq("user_id", session.user.id)
          .eq("role", "field_sales")
          .maybeSingle();

        if (error || !roleData) {
          console.error("[FieldSalesLayout] Error checking role data:", error);
          if (mounted) navigate("/field-sales", { replace: true });
          return;
        }

        // Check if account is active
        if (!roleData.is_active || roleData.status !== "active") {
          console.warn("[FieldSalesLayout] Account not active");
          if (mounted) navigate("/field-sales", { replace: true });
          return;
        }

        // Check if onboarding is required
        if (!roleData.onboarding_completed_at || !roleData.terms_accepted_at || !roleData.staff_pin_hash) {
          console.log("[FieldSalesLayout] Onboarding not complete, redirecting to setup");
          if (mounted) navigate("/field-sales/setup", { replace: true });
          return;
        }

        if (mounted) {
          setIsAuthorized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[FieldSalesLayout] Access check failed:", error);
        if (mounted) navigate("/field-sales", { replace: true });
      }
    };

    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT" || !session) {
          navigate("/field-sales", { replace: true });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-slate-400">Vérification de l'accès...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
