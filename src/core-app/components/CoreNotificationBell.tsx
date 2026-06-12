import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Package, CreditCard, FileText, RefreshCcw, UserX, DollarSign, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface StaffNotif {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, any> = {
  new_order: Package,
  payment_received: CreditCard,
  invoice_created: FileText,
  service_suspended: UserX,
  service_cancelled: UserX,
  commission_approved: DollarSign,
  payroll_paid: DollarSign,
  payroll_ready: DollarSign,
  withdrawal_update: DollarSign,
  tax_document: FileText,
};

const TYPE_COLOR: Record<string, string> = {
  new_order: "text-blue-400",
  payment_received: "text-emerald-400",
  invoice_created: "text-amber-400",
  service_suspended: "text-orange-400",
  service_cancelled: "text-rose-400",
  commission_approved: "text-purple-400",
  payroll_paid: "text-purple-400",
  payroll_ready: "text-purple-400",
  withdrawal_update: "text-purple-400",
};

export function CoreNotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifs = [] } = useQuery<StaffNotif[]>({
    queryKey: ["staff-notifs-bell"],
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_notifications" as any)
        .select("id, notification_type, title, message, link_path, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []) as unknown as StaffNotif[];
    },
  });

  const unread = notifs.filter((n) => !n.is_read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("staff_notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-notifs-bell"] });
      qc.invalidateQueries({ queryKey: ["core-section-badges"] });
    },
  });

  const markOneRead = async (notif: StaffNotif) => {
    if (!notif.is_read) {
      await supabase
        .from("staff_notifications" as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notif.id);
      qc.invalidateQueries({ queryKey: ["staff-notifs-bell"] });
      qc.invalidateQueries({ queryKey: ["core-section-badges"] });
    }
    if (notif.link_path) navigate(corePath(notif.link_path));
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-1.5 rounded-md transition-colors",
          open
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary"
        )}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] flex flex-col rounded-xl border border-border bg-background shadow-xl z-[9999]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {unread} nouveau{unread > 1 ? "x" : ""}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCircle className="h-3 w-3" />
                Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 core-scrollbar">
            {notifs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Aucune notification
              </div>
            ) : (
              notifs.map((n) => {
                const Icon = TYPE_ICON[n.notification_type] ?? RefreshCcw;
                const color = TYPE_COLOR[n.notification_type] ?? "text-muted-foreground";
                return (
                  <button
                    key={n.id}
                    onClick={() => markOneRead(n)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors hover:bg-secondary/50",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <div className={cn("mt-0.5 shrink-0 p-1.5 rounded-md bg-secondary", color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-[12px] font-medium leading-tight truncate", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border shrink-0">
            <button
              onClick={() => { navigate(corePath("/notifications")); setOpen(false); }}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              Voir tous les paramètres de notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
