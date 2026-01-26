import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Monitor, Smartphone, Globe, Clock, CheckCircle2 } from "lucide-react";

interface ClientSessionInfoProps {
  userId: string;
}

export const ClientSessionInfo = ({ userId }: ClientSessionInfoProps) => {
  // Get last login from profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile-session", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("last_login_at, created_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Get current session info
  const { data: session } = useQuery({
    queryKey: ["client-auth-session"],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    },
  });

  // Detect device type from user agent
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    
    let device = "Ordinateur";
    let icon = <Monitor className="w-4 h-4" />;
    
    if (isTablet) {
      device = "Tablette";
      icon = <Monitor className="w-4 h-4" />;
    } else if (isMobile) {
      device = "Mobile";
      icon = <Smartphone className="w-4 h-4" />;
    }

    // Detect browser
    let browser = "Navigateur inconnu";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    return { device, browser, icon };
  };

  const deviceInfo = getDeviceInfo();
  // Session doesn't have created_at, use access_token iat from JWT if available
  const sessionCreatedAt = session?.expires_at 
    ? new Date(Date.now() - (session.expires_in || 3600) * 1000) 
    : null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="w-4 h-4 text-cyan-400" />
          Session active
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Session */}
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {deviceInfo.icon}
              <span className="text-sm font-medium">{deviceInfo.device}</span>
            </div>
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {deviceInfo.browser}
          </p>
          {sessionCreatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Connecté {formatDistanceToNow(sessionCreatedAt, { locale: fr, addSuffix: true })}
            </p>
          )}
        </div>

        {/* Last Login Info */}
        <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Dernière connexion</span>
          </div>
          <span className="text-sm font-medium">
            {profile?.last_login_at 
              ? format(new Date(profile.last_login_at), "d MMM yyyy 'à' HH:mm", { locale: fr })
              : profile?.created_at
                ? format(new Date(profile.created_at), "d MMM yyyy", { locale: fr })
                : "—"
            }
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Pour votre sécurité, déconnectez-vous après chaque session sur un appareil partagé.
        </p>
      </CardContent>
    </Card>
  );
};

export default ClientSessionInfo;
