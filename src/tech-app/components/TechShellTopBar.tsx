/**
 * TechShellTopBar — Global topbar for Nivra Tech v2.
 * Shows: status pill (Available/Route/Pause/Offline), search command, notifications, avatar.
 * Distinct from the legacy per-page TechTopBar (kept for backwards compat).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Search, Menu, Play, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOpenPunch, usePunchIn, usePunchOut } from "../lib/usePunch";

type Status = "available" | "route" | "pause" | "offline";

export default function TechShellTopBar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { data: openPunch } = useOpenPunch();
  const punchIn = usePunchIn();
  const punchOut = usePunchOut();
  const [profile, setProfile] = useState<{ full_name?: string; first_name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? {});
    })();
  }, []);

  const status: Status = openPunch ? "available" : "offline";
  const statusLabel = { available: "Disponible", route: "En route", pause: "Pause", offline: "Hors service" }[status];
  const statusClass = { available: "is-available", route: "is-route", pause: "is-pause", offline: "is-offline" }[status];
  const firstName = profile?.first_name || profile?.full_name?.split(" ")?.[0] || "Tech";
  const initials = firstName.slice(0, 2).toUpperCase();

  return (
    <header
      className="sticky top-0 z-40 h-[60px] px-3 sm:px-5 flex items-center gap-3 pt-[env(safe-area-inset-top)]"
      style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid hsl(var(--border))" }}
    >
      {/* Mobile brand */}
      <button
        onClick={onOpenMobileNav}
        className="lg:hidden h-9 w-9 rounded-lg flex items-center justify-center"
        style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))" }}
        aria-label="Menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      <Link to="/tech" className="lg:hidden flex items-center gap-2 min-w-0">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-[13px]" style={{ background: "var(--tc-gradient-primary)" }}>N</div>
        <span className="text-[14px] font-semibold tracking-tight">Nivra Tech</span>
      </Link>

      {/* Status pill */}
      <div className="hidden sm:flex items-center">
        <span className={`tc-pill ${statusClass}`}>
          <span className="tc-pill-dot" />
          {statusLabel}
        </span>
      </div>

      {/* Search */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("tech:open-cmdk"))}
        className="hidden md:flex flex-1 max-w-md items-center gap-2 h-9 px-3 rounded-lg text-[13px]"
        style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "1px solid hsl(var(--border))" }}
      >
        <Search className="h-4 w-4" />
        <span>Rechercher un client, rendez-vous…</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--background))" }}>⌘K</kbd>
      </button>

      <div className="flex-1 md:hidden" />

      {/* Punch quick action */}
      <button
        onClick={() => (openPunch ? punchOut.mutate((openPunch as any).id) : punchIn.mutate())}
        disabled={punchIn.isPending || punchOut.isPending}
        className="h-9 px-3 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition"
        style={{
          background: openPunch ? "hsl(var(--destructive) / 0.15)" : "hsl(var(--success) / 0.15)",
          color: openPunch ? "hsl(var(--destructive))" : "hsl(var(--success))",
          border: `1px solid ${openPunch ? "hsl(var(--destructive) / 0.35)" : "hsl(var(--success) / 0.35)"}`,
        }}
      >
        {openPunch ? <><Square className="h-3.5 w-3.5" fill="currentColor" />Fin</> : <><Play className="h-3.5 w-3.5" fill="currentColor" />Punch</>}
      </button>

      {/* Notifications */}
      <button
        aria-label="Notifications"
        className="relative h-9 w-9 rounded-lg flex items-center justify-center"
        style={{ background: "hsl(var(--muted))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
      >
        <Bell className="h-4 w-4" />
        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "hsl(var(--primary))" }} />
      </button>

      {/* Avatar */}
      <Link
        to="/tech/profile"
        className="h-9 w-9 rounded-full flex items-center justify-center text-[12.5px] font-semibold shrink-0"
        style={{ background: "var(--tc-gradient-primary)", color: "hsl(var(--primary-foreground))" }}
        aria-label="Profil"
      >
        {initials}
      </Link>
    </header>
  );
}
