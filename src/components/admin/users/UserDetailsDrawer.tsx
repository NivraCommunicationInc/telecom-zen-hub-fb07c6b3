import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Shield,
  UserCog,
  Wrench,
  Mail,
  Phone,
  BadgeCheck,
  Briefcase,
  Calendar,
  Clock,
  KeyRound,
  History,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  DEFAULT_PERMISSIONS,
  type PermissionSet,
} from "@/hooks/useUserPermissions";

type StaffRole = "admin" | "employee" | "technician";

interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  permissions: Partial<PermissionSet>;
  phone?: string | null;
  badge_number?: string | null;
  job_title?: string | null;
  pin_set_at?: string | null;
}

interface UserDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUser | null;
}

const roleConfig: Record<StaffRole, { label: string; icon: typeof Shield; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "Administrateur", icon: Shield, variant: "default" },
  employee: { label: "Employé", icon: UserCog, variant: "secondary" },
  technician: { label: "Technicien", icon: Wrench, variant: "outline" },
};

export function UserDetailsDrawer({ open, onOpenChange, user }: UserDetailsDrawerProps) {
  // Fetch audit history for this user
  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["user-audit-history", user?.id, user?.email],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .or(`target_id.eq.${user.id},target_email.ilike.${user.email}`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && open,
  });

  if (!user) return null;

  const config = roleConfig[user.role];
  const Icon = config.icon;
  const roleDefaults = DEFAULT_PERMISSIONS[user.role] || {};

  const getEffectivePermissions = () => {
    const effective: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach((perm) => {
      effective[perm] = user.permissions[perm] ?? roleDefaults[perm] ?? false;
    });
    return effective;
  };

  const effectivePerms = getEffectivePermissions();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {user.full_name || user.email}
          </SheetTitle>
          <SheetDescription>Détails et historique de l'utilisateur</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Profil</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{user.phone}</span>
                  </div>
                )}
                {user.badge_number && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BadgeCheck className="h-4 w-4" />
                    <span>{user.badge_number}</span>
                  </div>
                )}
                {user.job_title && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{user.job_title}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={config.variant} className="gap-1">
                  <Icon className="h-3 w-3" />
                  {config.label}
                </Badge>
                <Badge variant={user.is_active ? "default" : "secondary"}>
                  {user.is_active ? "Actif" : "Désactivé"}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Dates</h3>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Créé le: {format(new Date(user.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                </div>
                {user.last_sign_in_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Dernière connexion: {format(new Date(user.last_sign_in_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  <span>
                    PIN: {user.pin_set_at 
                      ? `Défini le ${format(new Date(user.pin_set_at), "d MMM yyyy", { locale: fr })}` 
                      : "Non défini"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Permissions</h3>
              <div className="grid grid-cols-2 gap-1 text-sm">
                {ALL_PERMISSIONS.map((perm) => (
                  <div
                    key={perm}
                    className={`flex items-center gap-1 ${
                      effectivePerms[perm] ? "text-green-600" : "text-muted-foreground/50"
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full ${effectivePerms[perm] ? "bg-green-500" : "bg-muted"}`} />
                    <span className="text-xs">{PERMISSION_LABELS[perm]}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Audit History */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique
              </h3>
              {logsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun historique</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-2 bg-muted/50 rounded text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                        <span className="text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-muted-foreground">Par: {log.admin_email}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
