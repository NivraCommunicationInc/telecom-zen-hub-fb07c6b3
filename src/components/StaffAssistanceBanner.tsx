import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearStaffAssistance,
  endRealStaffImpersonation,
  resolveStaffAssistance,
  type StaffAssistanceSession,
} from "@/lib/staffAssistance";

export default function StaffAssistanceBanner() {
  const [session, setSession] = useState<StaffAssistanceSession | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const s = await resolveStaffAssistance();
      if (alive) setSession(s);
    };
    refresh();
    const onStorage = () => { refresh(); };
    window.addEventListener("storage", onStorage);
    return () => { alive = false; window.removeEventListener("storage", onStorage); };
  }, []);

  if (!session) return null;

  const exit = async () => {
    if (session.real_impersonation) {
      await endRealStaffImpersonation(session.imp_token);
      try { await supabase.auth.signOut(); } catch { /* noop */ }
      window.location.href = "/nivra-secure-hub-2617-internal/login?from=impersonation";
      return;
    }
    clearStaffAssistance();
    setSession(null);
    window.location.href = "/core";
  };

  return (
    <div className="w-full bg-purple-700 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-md sticky top-0 z-50">
      <div className="flex items-center gap-2 min-w-0">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong>👁 Mode administrateur</strong> — Vous consultez le portail de{" "}
          <strong>{session.staff_name}</strong>
          {session.staff_email ? <> ({session.staff_email})</> : null}
          {session.real_impersonation ? <> · <em>session réelle</em></> : null}
        </span>
      </div>
      <button
        onClick={exit}
        className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-3 py-1 rounded-md font-medium transition-colors shrink-0"
      >
        <X className="h-3 w-3" /> Quitter
      </button>
    </div>
  );
}
