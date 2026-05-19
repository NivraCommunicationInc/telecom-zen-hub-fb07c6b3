/**
 * CrmAgentStatusToggle — Header chip letting an agent switch presence:
 * Available · Break · DND · Offline. When set to Break/DND/Offline, all
 * their active contact locks are released server-side.
 */
import { useEffect, useState } from "react";
import { Circle, Coffee, Moon, PowerOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Status = "available" | "break" | "dnd" | "offline";

const META: Record<Status, { label: string; icon: typeof Circle; cls: string }> = {
  available: { label: "Disponible", icon: Circle, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" },
  break:     { label: "Pause",      icon: Coffee, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  dnd:       { label: "Ne pas déranger", icon: Moon, cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40" },
  offline:   { label: "Hors ligne", icon: PowerOff, cls: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/40" },
};

export function CrmAgentStatusToggle({ userId }: { userId?: string }) {
  const [status, setStatus] = useState<Status>("available");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("crm_agent_status").select("status").eq("agent_id", userId).maybeSingle()
      .then(({ data }) => { if (data?.status) setStatus(data.status as Status); });
  }, [userId]);

  const change = async (next: Status) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("crm_set_agent_status", { p_status: next, p_reason: null });
    setBusy(false);
    const res = data as any;
    if (error || !res?.ok) {
      toast.error(`Erreur : ${res?.error ?? error?.message ?? "inconnue"}`);
      return;
    }
    setStatus(next);
    if (next !== "available") toast.info("🔓 Tes verrous d'appel ont été libérés");
  };

  const cur = META[status];
  const Icon = cur.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Statut agent"
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border min-h-[36px] transition-colors",
            cur.cls
          )}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3 fill-current" />}
          {cur.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-background w-48">
        {(Object.keys(META) as Status[]).map((s) => {
          const m = META[s];
          const SIcon = m.icon;
          return (
            <DropdownMenuItem key={s} onClick={() => change(s)}>
              <SIcon className="h-4 w-4 mr-2" />{m.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
