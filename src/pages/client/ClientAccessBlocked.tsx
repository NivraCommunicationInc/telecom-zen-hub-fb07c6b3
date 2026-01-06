import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Phone, Mail, Home } from "lucide-react";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";

const ClientAccessBlocked = () => {
  const { user } = useClientAuth();

  const { data: profile } = useQuery({
    queryKey: ["blocked-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await portalSupabase
        .from("profiles")
        .select("blocked_reason, blocked_at, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-destructive/30">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="w-10 h-10 text-destructive" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Accès bloqué
            </h1>
            <p className="text-sm text-muted-foreground">
              Access blocked
            </p>
          </div>

          {/* Message */}
          <p className="text-muted-foreground">
            Votre accès au portail client a été temporairement suspendu.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Your access to the client portal has been temporarily suspended.
          </p>

          {/* Reason */}
          {profile?.blocked_reason && (
            <div className="bg-muted/50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-foreground mb-1">
                Raison / Reason:
              </p>
              <p className="text-sm text-muted-foreground">
                {profile.blocked_reason}
              </p>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Pour rétablir l'accès, veuillez contacter notre équipe:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="tel:4385442233" className="inline-flex items-center justify-center gap-2 text-primary hover:underline">
                <Phone className="w-4 h-4" />
                438-544-2233
              </a>
              <a href="mailto:support@nivratelecom.ca" className="inline-flex items-center justify-center gap-2 text-primary hover:underline">
                <Mail className="w-4 h-4" />
                support@nivratelecom.ca
              </a>
            </div>
          </div>

          {/* Back to home */}
          <div className="pt-4">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientAccessBlocked;