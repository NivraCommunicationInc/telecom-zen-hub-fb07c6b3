const fs = require('fs');
const content = fs.readFileSync('src/core-app/CoreAppLayout.tsx', 'utf8');
const start = content.indexOf('const NAV_GROUPS: NavGroup[] = [');
const end = content.indexOf('\nconst STORAGE_KEY');

const before = content.slice(0, start);
const after = content.slice(end);

const newNavGroups = `const NAV_GROUPS: NavGroup[] = [
  // ── 1. TABLEAU DE BORD ─────────────────────────────────────────
  {
    id: "dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    items: [
      { icon: Brain, label: "\u{1F9E0} NOVA — Digital Brain", href: "/brain", adminOnly: true },
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Brain, label: "Nivra AI Console", href: "/ai-console" },
      { icon: Activity, label: "Analytics", href: "/analytics" },
      { icon: DollarSign, label: "Finance", href: "/finance" },
    ],
  },
  // ── 2. ACTIVITÉ & MONITORING ────────────────────────────────────
  {
    id: "monitoring",
    label: "Activité & Monitoring",
    icon: Radio,
    items: [
      { icon: Radio, label: "Live Activity", href: "/live-activity" },
      { icon: Activity, label: "Activité", href: "/activity" },
      { icon: HardDrive, label: "Statut système", href: "/system-status" },
      { icon: Activity, label: "Support Metrics", href: "/support-metrics" },
    ],
  },
  // ── 3. OPÉRATIONS ───────────────────────────────────────────────
  {
    id: "operations",
    label: "Opérations",
    icon: ListTodo,
    items: [
      { icon: ListTodo, label: "Work Queue", href: "/work-queue" },
      { icon: AlertTriangle, label: "Suivi SLA", href: "/sla" },
      { icon: Package, label: "Commandes", href: "/orders" },
      { icon: Receipt, label: "POS", href: "/pos" },
      { icon: Shield, label: "KYC", href: "/kyc" },
      { icon: Wifi, label: "Demandes WiFi", href: "/wifi-requests" },
      { icon: Calendar, label: "Rendez-vous", href: "/appointments" },
      { icon: MessageSquare, label: "Demandes clients", href: "/requests" },
      { icon: RefreshCcw, label: "Changements forfait", href: "/plan-changes" },
      { icon: Lock, label: "Suspensions", href: "/pause-requests" },
      { icon: FileX, label: "Résiliations", href: "/cancellations" },
      { icon: RefreshCcw, label: "RMA", href: "/rma" },
      { icon: Wrench, label: "Techniciens", href: "/technician" },
      { icon: MapPin, label: "Carte techniciens", href: "/technicians/map" },
      { icon: Star, label: "Avis clients", href: "/reviews", adminOnly: true },
      { icon: RotateCcw, label: "Retours (legacy)", href: "/returns", adminOnly: true },
      { icon: Lock, label: "Comptes Fournisseur", href: "/supplier-accounts", adminOnly: true },
    ],
  },
  // ── 4. CLIENTS & COMPTES ────────────────────────────────────────
  {
    id: "clients",
    label: "Clients & Comptes",
    icon: Users,
    items: [
      { icon: Users, label: "Clients", href: "/clients" },
      { icon: UserCircle, label: "Comptes", href: "/accounts" },
      { icon: Upload, label: "Documents", href: "/documents" },
    ],
  },
  // ── 5. FACTURATION ──────────────────────────────────────────────
  {
    id: "billing",
    label: "Facturation",
    icon: CreditCard,
    items: [
      { icon: CreditCard, label: "Vue d'ensemble", href: "/billing" },
      { icon: FileText, label: "Factures", href: "/invoices" },
      { icon: DollarSign, label: "Paiements", href: "/payments" },
      { icon: Activity, label: "Transactions", href: "/transactions" },
      { icon: RefreshCcw, label: "Abonnements", href: "/subscriptions" },
      { icon: FileText, label: "Modèles PDF", href: "/pdf-templates" },
      { icon: AlertTriangle, label: "Collections", href: "/recouvrement" },
      { icon: Gavel, label: "Litiges", href: "/contested-payments" },
    ],
  },
  // ── 6. VENTES & CRM ─────────────────────────────────────────────
  {
    id: "sales",
    label: "Ventes & CRM",
    icon: PhoneCall,
    items: [
      { icon: PhoneCall, label: "CRM Call Center", href: "/crm" },
      { icon: FileText, label: "Soumissions", href: "/quotes" },
      { icon: Tag, label: "Rabais agents", href: "/agent-discounts" },
      { icon: Users, label: "Agents terrain", href: "/field-agents" },
      { icon: Send, label: "Soumissions terrain", href: "/field-submissions" },
      { icon: DollarSign, label: "Grille de commission", href: "/commissions/grille" },
    ],
  },
  // ── 7. CATALOGUE & INVENTAIRE ───────────────────────────────────
  {
    id: "catalog",
    label: "Catalogue & Inventaire",
    icon: Boxes,
    items: [
      { icon: Settings, label: "Services", href: "/services" },
      { icon: Boxes, label: "Catalogue", href: "/catalog" },
      { icon: FileText, label: "Contrats", href: "/contracts" },
      { icon: Package, label: "Équipements", href: "/equipment" },
      { icon: Boxes, label: "Inventaire", href: "/stock" },
      { icon: Smartphone, label: "Commandes téléphones", href: "/phones" },
      { icon: HardDrive, label: "Inventaire téléphones", href: "/phones/inventory" },
      { icon: MonitorPlay, label: "TV sur mesure", href: "/tv-sur-mesure" },
      { icon: Tv, label: "Chaînes TV", href: "/channels" },
      { icon: Tv, label: "Grille canaux", href: "/grille-canaux" },
      { icon: Film, label: "Streaming+", href: "/streaming" },
    ],
  },
  // ── 8. RÉSEAU & PROVISIONNEMENT ─────────────────────────────────
  {
    id: "network",
    label: "Réseau & Provisionnement",
    icon: Globe,
    items: [
      { icon: Activity, label: "Monitoring réseau", href: "/network" },
      { icon: PhoneCall, label: "Inventaire DID", href: "/did" },
      { icon: Cpu, label: "Provisionnement carrier", href: "/provisioning" },
      { icon: MapPin, label: "Couverture réseau", href: "/coverage" },
    ],
  },
  // ── 9. SUPPORT ──────────────────────────────────────────────────
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    items: [
      { icon: Ticket, label: "Tickets clients", href: "/support" },
      { icon: AlertCircle, label: "Plaintes", href: "/complaints" },
      { icon: MessageCircle, label: "Live Chat", href: "/support/live-chat" },
      { icon: MessageSquare, label: "Tickets internes", href: "/internal-tickets" },
      { icon: Mail, label: "Formulaires web", href: "/web-forms" },
      { icon: Headphones, label: "Téléphonie", href: "/telephony" },
    ],
  },
  // ── 10. MARKETING ───────────────────────────────────────────────
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { icon: LayoutDashboard, label: "Marketing Hub", href: "/marketing" },
      { icon: MessageSquare, label: "Conversations IA", href: "/marketing/conversations" },
      { icon: Zap, label: "Agent IA Config", href: "/marketing/ai-config" },
      { icon: Send, label: "Campagnes SMS", href: "/marketing/sms-campaigns" },
      { icon: Mail, label: "Campagnes Email", href: "/marketing/email-campaigns" },
      { icon: Settings, label: "Paramètres Marketing", href: "/marketing/settings" },
      { icon: Megaphone, label: "Email Marketing", href: "/email-marketing" },
      { icon: Send, label: "Email Comm.", href: "/communication-email" },
      { icon: MessageSquare, label: "SMS Comm.", href: "/communication-sms" },
      { icon: Tag, label: "Promotions", href: "/promotions" },
      { icon: Trophy, label: "Concours", href: "/contests" },
    ],
  },
  // ── 11. RH & PAIE ───────────────────────────────────────────────
  {
    id: "hr",
    label: "RH & Paie",
    icon: Briefcase,
    items: [
      { icon: LayoutDashboard, label: "Tableau de bord HR", href: "/hr" },
      { icon: Users, label: "Employés", href: "/hr/employees" },
      { icon: UserPlus, label: "Onboarding", href: "/hr/onboarding" },
      { icon: DollarSign, label: "Paie & Salaires", href: "/hr/payroll-runs" },
      { icon: Banknote, label: "Paiements émis", href: "/hr/paiements" },
      { icon: Tag, label: "Commissions", href: "/hr/commissions" },
      { icon: Activity, label: "Temps & Punch", href: "/hr/time" },
      { icon: Calendar, label: "Horaires", href: "/hr/schedules" },
      { icon: FileText, label: "Documents HR", href: "/hr/documents" },
      { icon: FileText, label: "Docs fiscaux", href: "/hr/tax-documents" },
      { icon: MessageSquare, label: "Demandes HR", href: "/hr/requests" },
      { icon: Briefcase, label: "Recrutement (postes)", href: "/hr/careers", badgeKey: "careers" },
      { icon: UserPlus, label: "Applications / Candidatures", href: "/hr/applications", badgeKey: "careers" },
      { icon: Brain, label: "Entrevues IA", href: "/hr/interviews" },
      { icon: Mail, label: "Templates emails", href: "/hr/email-templates" },
      { icon: History, label: "Audit HR", href: "/hr/audit" },
      { icon: GraduationCap, label: "Nivra Academy", href: "/academy" },
    ],
  },
  // ── 12. SYSTÈME & ADMIN ─────────────────────────────────────────
  {
    id: "system",
    label: "Système & Admin",
    icon: Settings,
    items: [
      { icon: FileText, label: "SOPs", href: "/sops" },
      { icon: Shield, label: "Surveillance IA", href: "/monitor", adminOnly: true },
      { icon: BarChart3, label: "Analytics IA", href: "/analytics-ai", adminOnly: true },
      { icon: Heart, label: "Rétention IA", href: "/retention", adminOnly: true },
      { icon: Bot, label: "Support IA", href: "/support-ai", adminOnly: true },
      { icon: RefreshCw, label: "Sync Monitor", href: "/sync-monitor", adminOnly: true },
      { icon: Globe, label: "SEO & Visibilité", href: "/seo", adminOnly: true },
      { icon: Megaphone, label: "Agent Marketing", href: "/marketing-agent", adminOnly: true },
      { icon: Share2, label: "Réseaux Sociaux", href: "/social-media", adminOnly: true },
      { icon: Settings, label: "Paramètres", href: "/settings" },
      { icon: ExternalLink, label: "Paramètres site", href: "/site-settings" },
      { icon: Users, label: "Utilisateurs & accès", href: "/users-access" },
      { icon: Bell, label: "Notifications", href: "/notifications" },
      { icon: Wrench, label: "Maintenance", href: "/maintenance" },
      { icon: Shield, label: "Sécurité", href: "/security-events" },
      { icon: Shield, label: "Guardian", href: "/security-guardian" },
      { icon: History, label: "Journal d'audit", href: "/audit-log" },
      { icon: Activity, label: "Audit système", href: "/system-audit" },
      { icon: Mail, label: "Activité email", href: "/email-activity" },
      { icon: UserCircle, label: "Mon compte", href: "/my-account" },
    ],
  },
  // ── 13. NIVRA SOURCE ────────────────────────────────────────────
  {
    id: "hub",
    label: "Nivra Source",
    icon: Megaphone,
    items: [
      { icon: LayoutDashboard, label: "Gestion du Hub", href: "/nivra-secure-hub-2617-internal" },
      { icon: Mail, label: "Envoyer un courriel", href: "/email/compose" },
    ],
  },
];`;

const newContent = before + newNavGroups + after;
fs.writeFileSync('src/core-app/CoreAppLayout.tsx', newContent, 'utf8');
console.log('Done. Lines:', newContent.split('\n').length);
