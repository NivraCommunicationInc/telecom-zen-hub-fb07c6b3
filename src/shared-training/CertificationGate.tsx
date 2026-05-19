/**
 * CertificationGate — Blocks access until the agent is certified for the portal.
 * Whitelisted users (table: training_certification_whitelist) bypass automatically.
 *
 * Wrap a route element:
 *   <Route path="sale/new" element={<CertificationGate portal="field"><FieldNewSale/></CertificationGate>} />
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Loader2, Lock } from "lucide-react";

type Props = {
  portal: "field" | "cs";
  children: React.ReactNode;
};

export default function CertificationGate({ portal, children }: Props) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "blocked">("loading");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (mounted) setState("blocked");
        return;
      }
      const { data, error } = await supabase.rpc("fn_check_portal_certification", {
        _user_id: session.user.id,
        _portal: portal,
      });
      if (!mounted) return;
      setState(!error && data === true ? "ok" : "blocked");
    })();
    return () => { mounted = false; };
  }, [portal]);

  if (state === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "blocked") {
    const academyPath = portal === "field" ? "/field/academy" : "/employee/academy";
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-amber-500/30">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center">
              <Lock className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-1">Certification requise</h2>
              <p className="text-sm text-muted-foreground">
                Tu dois compléter tous les modules obligatoires de la Nivra Academy
                avant d'accéder à cette section.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate(academyPath)} className="w-full">
                <GraduationCap className="h-4 w-4 mr-2" />
                Aller à la Nivra Academy
              </Button>
              <Button variant="ghost" onClick={() => navigate(-1)} className="w-full">
                Retour
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
