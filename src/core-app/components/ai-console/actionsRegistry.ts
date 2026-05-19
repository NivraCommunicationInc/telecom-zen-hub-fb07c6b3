/**
 * Nivra AI Console — Action Registry
 * Catalogue exhaustif des actions Core. Chaque action propose un lien direct
 * vers la page existante, préfiltrée par client quand possible.
 *
 * Mode : "Suggérer + lien". Aucune mutation ici.
 */
import type { LucideIcon } from "lucide-react";
import {
  User, FileText, History, UserCog, Receipt, CreditCard, AlertTriangle,
  Banknote, Wifi, PlayCircle, PauseCircle, RefreshCw, XCircle, Calendar,
  Map, MapPin, Truck, Ticket, Activity, Shield, BookOpen, Package, Undo2,
  Wrench, Smartphone, Mail, MessageSquare, Megaphone, FileSignature,
  FolderArchive, ScrollText, Gift, BadgePercent, Users, Eye, Lock,
} from "lucide-react";

export type ActionCategory =
  | "account"
  | "billing"
  | "services"
  | "field"
  | "support"
  | "equipment"
  | "communication"
  | "compliance"
  | "commercial"
  | "security";

export const CATEGORY_LABEL: Record<ActionCategory, string> = {
  account: "Compte",
  billing: "Facturation & Recouvrement",
  services: "Services & Lifecycle",
  field: "Terrain & Techniciens",
  support: "Support & SLA",
  equipment: "Équipement & Stock",
  communication: "Communication",
  compliance: "Conformité & Documents",
  commercial: "Commercial",
  security: "Sécurité & Audit",
};

export const CATEGORY_ORDER: ActionCategory[] = [
  "account", "billing", "services", "field", "support",
  "equipment", "communication", "compliance", "commercial", "security",
];

export interface ConsoleAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: ActionCategory;
  /** Builds the href. customerId may be empty when no client is selected. */
  hrefBuilder: (ctx: { customerId?: string | null; userId?: string | null; email?: string | null }) => string;
  /** Optional: shown as a warning chip when relevant (e.g. "Requires client"). */
  requiresClient?: boolean;
  /** Keywords for fuzzy search inside the catalog. */
  keywords?: string[];
}

const withQuery = (path: string, params: Record<string, string | null | undefined>) => {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
};

export const ACTIONS: ConsoleAction[] = [
  // ─── Compte ───────────────────────────────────────────────────────
  { id: "account-360", label: "Vue 360", description: "Profil complet, historique, services", icon: User, category: "account",
    hrefBuilder: ({ customerId }) => customerId ? `/core/accounts/${customerId}` : "/core/accounts", requiresClient: true,
    keywords: ["profil", "360", "client", "voir"] },
  { id: "account-clients", label: "Tous les clients", description: "Liste & recherche clients", icon: Users, category: "account",
    hrefBuilder: () => "/core/clients" },
  { id: "account-notes", label: "Notes admin", description: "Notes internes sur le compte", icon: FileText, category: "account",
    hrefBuilder: ({ customerId }) => customerId ? `/core/accounts/${customerId}?tab=notes` : "/core/accounts", requiresClient: true },
  { id: "account-history", label: "Historique d'activité", description: "Audit log du client", icon: History, category: "account",
    hrefBuilder: ({ customerId }) => customerId ? `/core/accounts/${customerId}?tab=history` : "/core/audit-log", requiresClient: true },
  { id: "account-impersonate", label: "Impersonate (lecture)", description: "Voir le portail comme le client", icon: Eye, category: "account",
    hrefBuilder: ({ customerId }) => customerId ? `/core/accounts/${customerId}?action=impersonate` : "/core/accounts", requiresClient: true },

  // ─── Facturation & Recouvrement ───────────────────────────────────
  { id: "billing-overview", label: "Facturation du client", description: "Balance, abonnements, prochains prélèvements", icon: Banknote, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/billing", { customer: customerId }) },
  { id: "billing-invoices", label: "Factures", description: "Toutes les factures du client", icon: Receipt, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/invoices", { customer: customerId }) },
  { id: "billing-payments", label: "Paiements", description: "Historique paiements", icon: CreditCard, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/payments", { customer: customerId }) },
  { id: "billing-recouvrement", label: "Recouvrement", description: "File de collections + actions", icon: AlertTriangle, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/recouvrement", { customer: customerId }),
    keywords: ["collection", "retard", "impayé", "relance"] },
  { id: "billing-contested-payments", label: "Contestations paiements", description: "Chargebacks & disputes", icon: AlertTriangle, category: "billing",
    hrefBuilder: () => "/core/contested-payments" },
  { id: "billing-contested-invoices", label: "Factures contestées", description: "Litiges sur factures", icon: AlertTriangle, category: "billing",
    hrefBuilder: () => "/core/contested-invoices" },
  { id: "billing-transactions", label: "Transactions", description: "Journal complet des transactions", icon: Activity, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/transactions", { customer: customerId }) },
  { id: "billing-subscriptions", label: "Abonnements", description: "Abonnements PayPal & cycles", icon: RefreshCw, category: "billing",
    hrefBuilder: ({ customerId }) => withQuery("/core/subscriptions", { customer: customerId }) },

  // ─── Services & Lifecycle ─────────────────────────────────────────
  { id: "services-list", label: "Services actifs", description: "Internet / TV / Mobile du client", icon: Wifi, category: "services",
    hrefBuilder: ({ customerId }) => withQuery("/core/services", { customer: customerId }) },
  { id: "services-activations", label: "Activations WiFi", description: "File des activations en attente", icon: PlayCircle, category: "services",
    hrefBuilder: () => "/core/wifi-requests" },
  { id: "services-pause", label: "Suspension / Pause", description: "Demandes de suspension service", icon: PauseCircle, category: "services",
    hrefBuilder: ({ customerId }) => withQuery("/core/pause-requests", { customer: customerId }),
    keywords: ["suspendre", "pause", "geler"] },
  { id: "services-plan-changes", label: "Changement de forfait", description: "Demandes de changement de plan", icon: RefreshCw, category: "services",
    hrefBuilder: ({ customerId }) => withQuery("/core/plan-changes", { customer: customerId }),
    keywords: ["upgrade", "downgrade", "switch", "forfait"] },
  { id: "services-cancellations", label: "Résiliations", description: "Annulations en cours", icon: XCircle, category: "services",
    hrefBuilder: ({ customerId }) => withQuery("/core/cancellations", { customer: customerId }),
    keywords: ["annuler", "cancel", "fermer", "résilier"] },
  { id: "services-orders", label: "Commandes", description: "Commandes du client", icon: Package, category: "services",
    hrefBuilder: ({ customerId }) => withQuery("/core/orders", { customer: customerId }) },

  // ─── Terrain & Techniciens ────────────────────────────────────────
  { id: "field-installations", label: "Installations", description: "File des installations", icon: Wrench, category: "field",
    hrefBuilder: ({ customerId }) => withQuery("/core/installations", { customer: customerId }) },
  { id: "field-appointments", label: "Rendez-vous", description: "Calendrier des RDV", icon: Calendar, category: "field",
    hrefBuilder: ({ customerId }) => withQuery("/core/appointments", { customer: customerId }) },
  { id: "field-slots", label: "Créneaux disponibles", description: "Gérer les disponibilités", icon: Calendar, category: "field",
    hrefBuilder: () => "/core/appointments/slots" },
  { id: "field-tech-map", label: "Carte techniciens", description: "Position temps réel des techs", icon: Map, category: "field",
    hrefBuilder: () => "/core/technicians/map", keywords: ["map", "carte", "localisation", "tech"] },
  { id: "field-coverage", label: "Couverture / Adresses", description: "Validation d'adresse & couverture", icon: MapPin, category: "field",
    hrefBuilder: () => "/core/technician", keywords: ["couverture", "address", "zone"] },
  { id: "field-dispatch", label: "Dispatch technicien", description: "Assigner un technicien", icon: Truck, category: "field",
    hrefBuilder: ({ customerId }) => withQuery("/core/installations", { customer: customerId, action: "dispatch" }) },

  // ─── Support & SLA ────────────────────────────────────────────────
  { id: "support-tickets", label: "Tickets internes", description: "Tickets liés au client", icon: Ticket, category: "support",
    hrefBuilder: ({ customerId }) => withQuery("/core/internal-tickets", { customer: customerId }) },
  { id: "support-metrics", label: "Métriques support", description: "KPI temps réponse / résolution", icon: Activity, category: "support",
    hrefBuilder: () => "/core/support-metrics" },
  { id: "support-sla", label: "SLA monitoring", description: "Engagements & breaches", icon: Shield, category: "support",
    hrefBuilder: () => "/core/sla", keywords: ["sla", "engagement", "deadline"] },
  { id: "support-sops", label: "SOPs / Procédures", description: "Procédures opérationnelles", icon: BookOpen, category: "support",
    hrefBuilder: () => "/core/sops" },
  { id: "support-main", label: "Centre support", description: "Vue support complète", icon: Ticket, category: "support",
    hrefBuilder: () => "/core/support" },

  // ─── Équipement & Stock ───────────────────────────────────────────
  { id: "equip-stock", label: "Stock équipement", description: "Inventaire Internet/TV/Mobile", icon: Package, category: "equipment",
    hrefBuilder: () => "/core/stock" },
  { id: "equip-returns", label: "Retours", description: "Retours équipement client", icon: Undo2, category: "equipment",
    hrefBuilder: ({ customerId }) => withQuery("/core/returns", { customer: customerId }) },
  { id: "equip-phones", label: "Commandes mobile", description: "Téléphones commandés", icon: Smartphone, category: "equipment",
    hrefBuilder: ({ customerId }) => withQuery("/core/phones", { customer: customerId }) },
  { id: "equip-phone-inv", label: "Inventaire mobile", description: "Stock SIM & appareils", icon: Smartphone, category: "equipment",
    hrefBuilder: () => "/core/phones/inventory" },
  { id: "equip-inv", label: "Inventaire global", description: "Vue inventaire matériel", icon: Package, category: "equipment",
    hrefBuilder: () => "/core/equipment" },

  // ─── Communication ────────────────────────────────────────────────
  { id: "comm-email", label: "Envoyer un courriel", description: "Composer un email au client", icon: Mail, category: "communication",
    hrefBuilder: ({ email }) => withQuery("/core/communication-email", { to: email }) },
  { id: "comm-sms", label: "Envoyer un SMS", description: "Composer un SMS au client", icon: MessageSquare, category: "communication",
    hrefBuilder: ({ customerId }) => withQuery("/core/communication-sms", { customer: customerId }) },
  { id: "comm-email-activity", label: "Activité email", description: "Historique d'envois & ouvertures", icon: Activity, category: "communication",
    hrefBuilder: ({ email }) => withQuery("/core/email-activity", { email }) },
  { id: "comm-marketing", label: "Email marketing", description: "Campagnes & segments", icon: Megaphone, category: "communication",
    hrefBuilder: () => "/core/email-marketing" },

  // ─── Conformité & Documents ───────────────────────────────────────
  { id: "comp-kyc", label: "Vérification KYC", description: "Identité & validation", icon: Shield, category: "compliance",
    hrefBuilder: ({ customerId }) => withQuery("/core/kyc", { customer: customerId }) },
  { id: "comp-contracts", label: "Contrats", description: "Contrats signés du client", icon: FileSignature, category: "compliance",
    hrefBuilder: ({ customerId }) => withQuery("/core/contracts", { customer: customerId }) },
  { id: "comp-documents", label: "Documents", description: "Documents internes & client", icon: FolderArchive, category: "compliance",
    hrefBuilder: ({ customerId }) => withQuery("/core/documents", { customer: customerId }) },
  { id: "comp-pdf-templates", label: "Templates PDF", description: "Gabarits invoice/contract", icon: ScrollText, category: "compliance",
    hrefBuilder: () => "/core/pdf-templates" },
  { id: "comp-audit", label: "Audit log", description: "Journal d'audit complet", icon: History, category: "compliance",
    hrefBuilder: ({ customerId }) => withQuery("/core/audit-log", { customer: customerId }) },

  // ─── Commercial ───────────────────────────────────────────────────
  { id: "com-quotes", label: "Devis", description: "Devis liés au client", icon: ScrollText, category: "commercial",
    hrefBuilder: ({ customerId }) => withQuery("/core/quotes", { customer: customerId }) },
  { id: "com-promotions", label: "Promotions actives", description: "Codes promo & remises", icon: BadgePercent, category: "commercial",
    hrefBuilder: () => "/core/promotions" },
  { id: "com-referrals", label: "Parrainages", description: "Programme de référencement", icon: Gift, category: "commercial",
    hrefBuilder: ({ customerId }) => withQuery("/core/referrals", { customer: customerId }) },
  { id: "com-contests", label: "Concours", description: "Concours actifs", icon: Gift, category: "commercial",
    hrefBuilder: () => "/core/contests" },
  { id: "com-pos", label: "POS — vente directe", description: "Créer une commande / vente comptoir", icon: CreditCard, category: "commercial",
    hrefBuilder: ({ customerId }) => withQuery("/core/pos", { customer: customerId }) },

  // ─── Sécurité & Audit ─────────────────────────────────────────────
  { id: "sec-events", label: "Events sécurité", description: "Connexions suspectes, anomalies", icon: Lock, category: "security",
    hrefBuilder: ({ userId }) => withQuery("/core/security-events", { user: userId }) },
  { id: "sec-guardian", label: "Guardian anti-fraude", description: "Système de détection fraude", icon: Shield, category: "security",
    hrefBuilder: () => "/core/security-guardian" },
  { id: "sec-users-access", label: "Accès & permissions", description: "Gestion des accès staff", icon: UserCog, category: "security",
    hrefBuilder: () => "/core/users-access" },
  { id: "sec-system-audit", label: "Audit système", description: "État santé & checks", icon: Activity, category: "security",
    hrefBuilder: () => "/core/system-audit" },
];

export const filterActions = (q: string, category?: ActionCategory | "all"): ConsoleAction[] => {
  const needle = q.trim().toLowerCase();
  return ACTIONS.filter((a) => {
    if (category && category !== "all" && a.category !== category) return false;
    if (!needle) return true;
    const hay = [a.label, a.description, a.id, ...(a.keywords ?? [])].join(" ").toLowerCase();
    return hay.includes(needle);
  });
};
