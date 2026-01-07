import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Eye, 
  KeyRound, 
  Mail, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Clock
} from "lucide-react";

interface ClientAccessActivityLogProps {
  clientUserId: string;
}

interface AccessLog {
  id: string;
  client_id: string;
  client_name?: string;
  staff_user_id: string;
  staff_name: string;
  staff_email?: string;
  staff_role: string;
  access_method: string;
  access_reason?: string;
  result: "success" | "fail";
  failed_attempt_count: number;
  created_at: string;
}

const methodLabels: Record<string, { label: string; icon: any; color: string }> = {
  pin: { label: "NIP", icon: KeyRound, color: "bg-blue-500/20 text-blue-600" },
  email_otp: { label: "OTP Email", icon: Mail, color: "bg-purple-500/20 text-purple-600" },
  dob_postal: { label: "DOB + Postal", icon: Calendar, color: "bg-cyan-500/20 text-cyan-600" },
  email_postal: { label: "Email + Postal", icon: Mail, color: "bg-teal-500/20 text-teal-600" },
  admin_bypass: { label: "Admin Bypass", icon: ShieldCheck, color: "bg-amber-500/20 text-amber-600" },
};

const reasonLabels: Record<string, string> = {
  billing: "Facturation",
  plan_change: "Changement de forfait",
  equipment: "Équipement",
  appointment: "Rendez-vous",
  support: "Support",
  other: "Autre",
};

export const ClientAccessActivityLog = ({ clientUserId }: ClientAccessActivityLogProps) => {
  const { data: accessLogs, isLoading } = useQuery({
    queryKey: ["client-access-logs", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_access_logs")
        .select("*")
        .eq("client_id", clientUserId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AccessLog[];
    },
    enabled: !!clientUserId,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="w-4 h-4 text-primary" />
          Historique d'accès au profil
          <Badge variant="outline" className="ml-2 text-xs">
            Admin seulement
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : accessLogs && accessLogs.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {accessLogs.map((log) => {
                const method = methodLabels[log.access_method] || { 
                  label: log.access_method, 
                  icon: Eye, 
                  color: "bg-gray-500/20 text-gray-600" 
                };
                const MethodIcon = method.icon;

                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.result === "fail" 
                        ? "bg-red-500/5 border-red-500/20" 
                        : "bg-accent/30 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {log.result === "success" ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-medium">{log.staff_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.staff_role}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge className={method.color}>
                            <MethodIcon className="w-3 h-3 mr-1" />
                            {method.label}
                          </Badge>
                          {log.access_reason && (
                            <Badge variant="outline">
                              {reasonLabels[log.access_reason] || log.access_reason}
                            </Badge>
                          )}
                          {log.result === "fail" && log.failed_attempt_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Tentative #{log.failed_attempt_count}
                            </Badge>
                          )}
                        </div>

                        {log.staff_email && (
                          <p className="text-xs text-muted-foreground">
                            {log.staff_email}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun accès enregistré
          </p>
        )}
      </CardContent>
    </Card>
  );
};
