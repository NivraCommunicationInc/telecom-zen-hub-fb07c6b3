/**
 * HrNotificationBell — Shows unread employee notification count in HR header.
 */
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export default function HrNotificationBell() {
  const { data: count } = useQuery({
    queryKey: ["rh-notification-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase
        .from("employee_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <Link
      to="/hr/notifications"
      className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      <Bell className="h-4 w-4" />
      {(count ?? 0) > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center px-1">
          {count! > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
