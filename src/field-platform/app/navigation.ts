import {
  Home, CalendarDays, Map, Users, Wrench, Package, MessagesSquare,
  GraduationCap, TrendingUp, Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FieldDomain = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  mobileDock?: boolean; // shown in bottom dock on mobile
  description: string;
};

export const FIELD_DOMAINS: FieldDomain[] = [
  { id: "home",         label: "Accueil",       path: "/technicien",                icon: Home,          mobileDock: true,  description: "Mission Control — journée en temps réel" },
  { id: "day",          label: "Ma journée",    path: "/technicien/journee",        icon: CalendarDays,  mobileDock: true,  description: "Planning + optimisation trajet" },
  { id: "field",        label: "Terrain",       path: "/technicien/terrain",        icon: Map,           mobileDock: true,  description: "Carte, GPS, zones, NOC" },
  { id: "customers",    label: "Clients",       path: "/technicien/clients",        icon: Users,         mobileDock: true,  description: "Client 360, recherche instantanée" },
  { id: "intervention", label: "Intervention",  path: "/technicien/intervention",   icon: Wrench,                             description: "Workflow guidé pas-à-pas" },
  { id: "inventory",    label: "Inventaire",    path: "/technicien/inventaire",     icon: Package,                            description: "Mon camion + retours/échanges" },
  { id: "comms",        label: "Communication", path: "/technicien/communication",  icon: MessagesSquare,                     description: "Dispatch, NOC, chat, appels" },
  { id: "resources",    label: "Ressources",    path: "/technicien/ressources",     icon: GraduationCap,                      description: "Procédures, formations, docs" },
  { id: "performance",  label: "Performance",   path: "/technicien/performance",    icon: TrendingUp,                         description: "Objectifs, commissions, NPS" },
  { id: "settings",     label: "Paramètres",    path: "/technicien/parametres",     icon: Settings,                           description: "Profil, véhicule, offline" },
];
