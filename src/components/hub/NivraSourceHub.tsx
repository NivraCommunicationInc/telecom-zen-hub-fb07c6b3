/**
 * NivraSourceHub — Unified internal hub for Field / Employee / HR portals.
 * Single page with 14 sections, left-side nav on desktop, bottom sheet on mobile.
 * Reuses existing HubAnnouncements / HubDocuments / HubStore / HubLeaderboard /
 * HubCalendar / HubForms components and adds Feed / Contests / Tips / Pricing /
 * MyTickets / Training / FAQ / Directory.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Megaphone, Rss, BookOpen, ShoppingBag, Trophy, Calendar, Target,
  Lightbulb, BarChart3, ClipboardList, Ticket, GraduationCap,
  HelpCircle, Phone, Search, Bell, Sparkles,
} from "lucide-react";

import HubAnnouncements from "./HubAnnouncements";
import HubDocuments from "./HubDocuments";
import HubStore from "./sections/HubStore";
import HubLeaderboard from "./sections/HubLeaderboard";
import HubCalendar from "./HubCalendar";
import HubForms from "./sections/HubForms";
import HubFeed from "./sections/HubFeed";
import HubContests from "./sections/HubContests";
import HubTips from "./sections/HubTips";
import HubPricing from "./sections/HubPricing";
import HubMyTickets from "./sections/HubMyTickets";
import HubTraining from "./sections/HubTraining";
import HubFaq from "./sections/HubFaq";
import HubDirectory from "./sections/HubDirectory";

type SectionKey =
  | "annonces" | "feed" | "documents" | "boutique" | "leaderboard"
  | "calendrier" | "concours" | "tips" | "pricing" | "formulaires"
  | "tickets" | "formation" | "faq" | "annuaire";

interface Section {
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  desc: string;
}

const SECTIONS: Section[] = [
  { key: "annonces",    label: "Annonces",            icon: Megaphone,      emoji: "📢", desc: "Communications de l'équipe" },
  { key: "feed",        label: "Feed",                icon: Rss,            emoji: "📱", desc: "Fil d'actualité" },
  { key: "documents",   label: "Documents",           icon: BookOpen,       emoji: "📚", desc: "Contrats, politiques, guides" },
  { key: "boutique",    label: "Boutique",            icon: ShoppingBag,    emoji: "🛒", desc: "Matériel et équipement" },
  { key: "leaderboard", label: "Leaderboard",         icon: Trophy,         emoji: "🏆", desc: "Classement des ventes" },
  { key: "calendrier",  label: "Calendrier",          icon: Calendar,       emoji: "📅", desc: "Événements et formations" },
  { key: "concours",    label: "Concours",            icon: Target,         emoji: "🎯", desc: "Concours et défis" },
  { key: "tips",        label: "Conseils de vente",   icon: Lightbulb,      emoji: "💡", desc: "Scripts, objections, techniques" },
  { key: "pricing",     label: "Forfaits & Prix",     icon: BarChart3,      emoji: "📊", desc: "Grille de prix et commissions" },
  { key: "formulaires", label: "Formulaires",         icon: ClipboardList,  emoji: "📝", desc: "Plaintes, incidents, demandes" },
  { key: "tickets",     label: "Mes tickets",         icon: Ticket,         emoji: "🎫", desc: "Suivi de vos demandes" },
  { key: "formation",   label: "Formation",           icon: GraduationCap,  emoji: "🎓", desc: "Vidéos, articles, quiz" },
  { key: "faq",         label: "FAQ",                 icon: HelpCircle,     emoji: "❓", desc: "Questions fréquentes" },
  { key: "annuaire",    label: "Annuaire",            icon: Phone,          emoji: "📞", desc: "Coordonnées équipe" },
];

interface Props {
  /** Portal variant — controls minor styling */
  portal: "field" | "employee" | "hr";
}

export default function NivraSourceHub({ portal }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get("section") as SectionKey) || "annonces";
  const [active, setActive] = useState<SectionKey>(initial);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (searchParams.get("section") !== active) {
      setSearchParams({ section: active }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const current = useMemo(() => SECTIONS.find(s => s.key === active) ?? SECTIONS[0], [active]);

  // Unread notifications badge
  const { data: unread = 0 } = useQuery({
    queryKey: ["hub-unread-notifications"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase
        .from("hub_notifications")
        .select("id", { count: "exact", head: true })
        .not("is_read_by", "cs", `{${user.id}}`);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  // Open ticket count for "Mes tickets" badge
  const { data: openTickets = 0 } = useQuery({
    queryKey: ["hub-open-tickets"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count } = await supabase
        .from("hub_tickets")
        .select("id", { count: "exact", head: true })
        .eq("submitted_by", user.id)
        .in("status", ["open", "in_progress", "waiting"]);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const sectionBadges: Partial<Record<SectionKey, number>> = {
    tickets: openTickets,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero header */}
      <div
        className="border-b border-border"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #6d28d9 100%)",
        }}
      >
        <div className="px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  Nivra Source
                </h1>
                <p className="text-[12px] text-white/80 mt-1">
                  Hub interne — annonces, équipe, formation, support
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="h-9 w-56 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/60 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-white/40"
                />
              </div>
              <button
                className="relative h-9 w-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 hover:bg-white/25 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4 text-white" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-yellow-400 text-violet-900 text-[9px] font-bold flex items-center justify-center px-1">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Desktop side nav */}
        <aside className="hidden md:block w-64 shrink-0 border-r border-border bg-card/50 min-h-[calc(100vh-100px)]">
          <nav className="p-3 space-y-0.5">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = active === s.key;
              const badge = sectionBadges[s.key];
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all min-h-[44px]",
                    isActive
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-white")} />
                  <span className="flex-1 text-left truncate">{s.label}</span>
                  {!!badge && badge > 0 && (
                    <span className={cn(
                      "h-5 min-w-[20px] rounded-full px-1.5 text-[10px] font-bold flex items-center justify-center",
                      isActive ? "bg-white/25 text-white" : "bg-violet-600 text-white"
                    )}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Mobile horizontal scroll selector */}
        <div className="md:hidden w-full sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar">
            {SECTIONS.map(s => {
              const isActive = active === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-semibold transition-colors min-h-[44px]",
                    isActive
                      ? "bg-violet-600 text-white"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="px-4 sm:px-6 py-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span aria-hidden>{current.emoji}</span>
                {current.label}
              </h2>
              <p className="text-xs text-muted-foreground">{current.desc}</p>
            </div>

            <div className="min-h-[300px]">
              {active === "annonces"    && <HubAnnouncements />}
              {active === "feed"        && <HubFeed search={search} />}
              {active === "documents"   && <HubDocuments />}
              {active === "boutique"    && <HubStore />}
              {active === "leaderboard" && <HubLeaderboard />}
              {active === "calendrier"  && <HubCalendar />}
              {active === "concours"    && <HubContests />}
              {active === "tips"        && <HubTips search={search} />}
              {active === "pricing"     && <HubPricing portal={portal} />}
              {active === "formulaires" && <HubForms />}
              {active === "tickets"     && <HubMyTickets />}
              {active === "formation"   && <HubTraining search={search} />}
              {active === "faq"         && <HubFaq search={search} />}
              {active === "annuaire"    && <HubDirectory search={search} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
