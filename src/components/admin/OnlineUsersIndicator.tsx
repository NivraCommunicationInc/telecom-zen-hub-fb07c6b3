import { useState } from "react";
import { usePresence, PresenceUser } from "@/hooks/usePresence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Wifi, WifiOff, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  employee: "Employé",
  technician: "Technicien",
  client: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500",
  employee: "bg-blue-500",
  technician: "bg-orange-500",
  client: "bg-green-500",
};

const getInitials = (name: string, email: string): string => {
  if (name && name !== email) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
};

const getPageLabel = (path?: string): string => {
  if (!path) return "—";
  
  const pageMap: Record<string, string> = {
    "/admin": "Dashboard",
    "/admin/clients": "Clients",
    "/admin/orders": "Commandes",
    "/admin/billing": "Facturation",
    "/admin/appointments": "Rendez-vous",
    "/admin/support": "Support",
    "/admin/telephony": "Téléphonie",
    "/admin/mobile": "Mobile",
    "/admin/tv": "Télévision",
    "/admin/streaming": "Streaming",
    "/admin/internet": "Internet",
    "/admin/security": "Sécurité",
    "/admin/partners": "Partenaires",
    "/admin/marketing": "Marketing",
    "/admin/settings": "Paramètres",
    "/admin/account": "Mon compte",
  };

  // Check for exact match first
  if (pageMap[path]) return pageMap[path];
  
  // Check for partial match
  for (const [route, label] of Object.entries(pageMap)) {
    if (path.startsWith(route)) return label;
  }
  
  return path.replace("/admin/", "").replace("/", " › ");
};

interface OnlineUserItemProps {
  user: PresenceUser;
  isCurrentUser: boolean;
}

const OnlineUserItem = ({ user, isCurrentUser }: OnlineUserItemProps) => {
  const roleColor = ROLE_COLORS[user.role || "client"] || "bg-gray-500";
  const roleLabel = ROLE_LABELS[user.role || "client"] || user.role;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg transition-colors",
        isCurrentUser ? "bg-primary/10" : "hover:bg-muted/50"
      )}
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs bg-muted">
            {getInitials(user.name || "", user.email)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            "bg-green-500 animate-pulse"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {user.name || user.email.split("@")[0]}
          </span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              vous
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant="secondary"
            className={cn("text-[10px] px-1.5 py-0 text-white", roleColor)}
          >
            {roleLabel}
          </Badge>
          <span className="truncate">{getPageLabel(user.current_page)}</span>
        </div>
      </div>
    </div>
  );
};

export const OnlineUsersIndicator = () => {
  const { onlineUsers, isConnected, currentUserId, onlineCount } = usePresence();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
            "hover:bg-muted/80 border border-border/50",
            isConnected
              ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isConnected ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <Users className="h-3.5 w-3.5" />
          <span>{onlineCount}</span>
          {isConnected && (
            <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        <div className="p-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Utilisateurs en ligne</h4>
            <Badge variant="secondary" className="text-xs">
              {onlineCount} actif{onlineCount > 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isConnected ? "Connecté en temps réel" : "Connexion en cours..."}
          </p>
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-1">
            {onlineUsers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun utilisateur en ligne</p>
              </div>
            ) : (
              onlineUsers.map((user) => (
                <OnlineUserItem
                  key={user.id}
                  user={user}
                  isCurrentUser={user.id === currentUserId}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t border-border/50 bg-muted/20">
          <p className="text-[10px] text-muted-foreground text-center">
            Mise à jour en temps réel • Présence Supabase
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default OnlineUsersIndicator;
