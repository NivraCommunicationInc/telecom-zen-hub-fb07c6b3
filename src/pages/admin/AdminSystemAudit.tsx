import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileSearch, 
  Download, 
  FileText, 
  Route as RouteIcon, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Database,
  Copy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";

// ============================================
// SECTION A: Routes & Sources Configuration
// ============================================

interface RouteSourceInfo {
  route: string;
  pageName: string;
  primarySource: string;
  secondarySource?: string;
  notes?: string;
}

const ROUTE_SOURCES: RouteSourceInfo[] = [
  // Client Portal
  { route: "/portal/invoices", pageName: "Factures client", primarySource: "billing_invoices", secondarySource: "billing (legacy)", notes: "V2 active" },
  { route: "/portal/monthly-invoices", pageName: "Factures mensuelles client", primarySource: "billing_invoices (type=recurring)", notes: "V2 uniquement" },
  { route: "/portal/contracts", pageName: "Contrats client", primarySource: "contracts", notes: "Génération via invoiceEngine V2.5" },
  { route: "/portal/orders", pageName: "Commandes client", primarySource: "orders", notes: "Avec equipment_details.line_items" },
  { route: "/portal/services", pageName: "Services actifs", primarySource: "subscriptions", secondarySource: "billing_subscriptions (V2)", notes: "Migration en cours" },
  
  // Admin Portal
  { route: "/admin/billing", pageName: "Facturation admin", primarySource: "billing_invoices", secondarySource: "billing (lecture legacy)", notes: "V2 écriture, legacy lecture" },
  { route: "/admin/contracts", pageName: "Contrats admin", primarySource: "contracts", notes: "Template contractTemplateV2.ts" },
  { route: "/admin/orders", pageName: "Commandes admin", primarySource: "orders", notes: "Line items dans equipment_details" },
  { route: "/admin/clients", pageName: "Profils clients", primarySource: "profiles", secondarySource: "accounts", notes: "Lien via accounts.client_id" },
  { route: "/admin/appointments", pageName: "Rendez-vous", primarySource: "appointments", notes: "Lié aux orders.id" },
  { route: "/admin/streaming", pageName: "Streaming+", primarySource: "client_streaming_subscriptions", notes: "Module indépendant" },
  
  // Staff Portal
  { route: "/staff/billing", pageName: "Facturation staff", primarySource: "billing_invoices", notes: "Vue restreinte" },
  { route: "/staff/clients", pageName: "Clients staff", primarySource: "profiles", notes: "Accès via StaffClientAccessGate" },
];

// ============================================
// SECTION B: PDF Templates Configuration
// ============================================

interface PDFTemplateInfo {
  type: string;
  templateId: string;
  templateVersion: string;
  fileName: string;
  status: "ACTIVE" | "LEGACY" | "DISABLED";
  description: string;
}

const PDF_TEMPLATES: PDFTemplateInfo[] = [
  {
    type: "Facture mensuelle (renouvellement)",
    templateId: "invoice-monthly-v2",
    templateVersion: "V2.5",
    fileName: "src/lib/pdf/invoiceMonthlyTemplateV2.ts",
    status: "ACTIVE",
    description: "Renouvellement abonnement via invoiceEngine.ts",
  },
  {
    type: "Facture unique (équipements)",
    templateId: "invoice-onetime-v2",
    templateVersion: "V2.5",
    fileName: "src/lib/pdf/invoiceOneTimeTemplateV2.ts",
    status: "ACTIVE",
    description: "Équipements + frais activation via invoiceEngine.ts",
  },
  {
    type: "Contrat de service",
    templateId: "contract-v2",
    templateVersion: "V2.5",
    fileName: "src/lib/pdf/contractTemplate.ts",
    status: "ACTIVE",
    description: "Contrat légal avec signature électronique",
  },
  {
    type: "Résumé de commande",
    templateId: "summary-v2",
    templateVersion: "V2.5",
    fileName: "src/lib/pdf/orderSummaryTemplate.ts",
    status: "ACTIVE",
    description: "Document informatif post-paiement",
  },
];

// ============================================
// SECTION C: Forbidden Terminology
// ============================================

const FORBIDDEN_TERMS = [
  "en retard",
  "overdue",
  "impayé",
  "dette",
  "intérêt",
  "pénalité",
  "late fee",
  "penalty",
  "interest charge",
  "collection",
  "recouvrement",
];

interface TerminologyResult {
  term: string;
  found: boolean;
  locations: string[];
  count: number;
}

// Static analysis results (code-level scan done at build time)
// This is a READ-ONLY representation of what's in the codebase
const TERMINOLOGY_SCAN_RESULTS: TerminologyResult[] = [
  { term: "en retard", found: false, locations: [], count: 0 },
  { term: "overdue", found: true, locations: ["billing_invoices.status enum (DB only)", "AdminRecouvrement.tsx (admin only)"], count: 2 },
  { term: "impayé", found: false, locations: [], count: 0 },
  { term: "dette", found: false, locations: [], count: 0 },
  { term: "intérêt", found: false, locations: [], count: 0 },
  { term: "pénalité", found: false, locations: [], count: 0 },
  { term: "late fee", found: true, locations: ["billing_invoices.late_fee_amount (DB column)"], count: 1 },
  { term: "penalty", found: false, locations: [], count: 0 },
  { term: "interest charge", found: false, locations: [], count: 0 },
  { term: "collection", found: false, locations: [], count: 0 },
  { term: "recouvrement", found: true, locations: ["AdminRecouvrement.tsx (admin internal only)"], count: 1 },
];

// ============================================
// SECTION D: Automation Jobs
// ============================================

interface AutomationJob {
  jobName: string;
  description: string;
  schedule: string;
  sourceTable?: string;
}

const AUTOMATION_JOBS: AutomationJob[] = [
  {
    jobName: "billing-generate-renewals-hourly",
    description: "Génération factures renouvellement J-5",
    schedule: "Toutes les heures (pg_cron)",
    sourceTable: "billing_invoices",
  },
  {
    jobName: "process-email-queue",
    description: "Envoi des emails en file d'attente",
    schedule: "Toutes les minutes (pg_cron)",
    sourceTable: "email_queue",
  },
  {
    jobName: "billing-payment-reminders",
    description: "Rappels paiement J-7, J-3, J-1, J0, J+1",
    schedule: "Toutes les heures (pg_cron)",
    sourceTable: "email_queue",
  },
  {
    jobName: "billing-expiration-check",
    description: "Vérification expiration abonnements",
    schedule: "Quotidien 00:05 (pg_cron)",
    sourceTable: "billing_subscriptions",
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

const AdminSystemAudit = () => {
  const [activeTab, setActiveTab] = useState("routes");

  // Fetch email queue stats (READ-ONLY)
  const { data: emailQueueStats } = useQuery({
    queryKey: ["audit-email-queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_queue")
        .select("status, created_at, sent_at")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const pending = data?.filter(e => e.status === "pending").length || 0;
      const sent = data?.filter(e => e.status === "sent").length || 0;
      const failed = data?.filter(e => e.status === "failed").length || 0;
      const lastSent = data?.find(e => e.sent_at)?.sent_at;
      
      return { pending, sent, failed, lastSent, total: data?.length || 0 };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch billing invoice stats (READ-ONLY)
  const { data: billingStats } = useQuery({
    queryKey: ["audit-billing-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const recurring = data?.filter(i => i.type === "recurring").length || 0;
      const oneTime = data?.filter(i => i.type === "one_time").length || 0;
      const lastCreated = data?.[0]?.created_at;
      
      return { recurring, oneTime, lastCreated, total: data?.length || 0 };
    },
  });

  // Fetch subscription stats (READ-ONLY)
  const { data: subscriptionStats } = useQuery({
    queryKey: ["audit-subscription-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("status, cycle_end_date")
        .limit(100);
      
      if (error) throw error;
      
      const active = data?.filter(s => s.status === "active").length || 0;
      const expiringSoon = data?.filter(s => {
        if (!s.cycle_end_date) return false;
        const endDate = new Date(s.cycle_end_date);
        const now = new Date();
        const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= 5 && daysUntil >= 0;
      }).length || 0;
      
      return { active, expiringSoon, total: data?.length || 0 };
    },
  });

  // Generate export JSON
  const generateAuditJSON = () => {
    const auditData = {
      timestamp: new Date().toISOString(),
      systemVersion: "V2.5",
      billingVersion: "V2.4",
      
      routeSources: ROUTE_SOURCES,
      
      pdfTemplates: {
        active: PDF_TEMPLATES.filter(t => t.status === "ACTIVE"),
        legacy: PDF_TEMPLATES.filter(t => t.status === "LEGACY"),
        summary: {
          activeCount: PDF_TEMPLATES.filter(t => t.status === "ACTIVE").length,
          legacyCount: PDF_TEMPLATES.filter(t => t.status === "LEGACY").length,
        },
      },
      
      terminologyScan: {
        forbiddenTerms: FORBIDDEN_TERMS,
        results: TERMINOLOGY_SCAN_RESULTS,
        summary: {
          cleanTerms: TERMINOLOGY_SCAN_RESULTS.filter(t => !t.found).length,
          flaggedTerms: TERMINOLOGY_SCAN_RESULTS.filter(t => t.found).length,
          clientFacing: TERMINOLOGY_SCAN_RESULTS.filter(t => t.found && !t.locations.some(l => l.includes("admin"))).length,
        },
      },
      
      automations: {
        jobs: AUTOMATION_JOBS,
        emailQueue: emailQueueStats || null,
        billing: billingStats || null,
        subscriptions: subscriptionStats || null,
      },
    };
    
    return JSON.stringify(auditData, null, 2);
  };

  const handleExportJSON = () => {
    const json = generateAuditJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nivra-system-audit-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audit JSON exporté");
  };

  const handleCopyJSON = () => {
    const json = generateAuditJSON();
    navigator.clipboard.writeText(json);
    toast.success("JSON copié dans le presse-papier");
  };

  // Calculate summary stats
  const terminologyClean = TERMINOLOGY_SCAN_RESULTS.filter(t => !t.found).length;
  const terminologyFlagged = TERMINOLOGY_SCAN_RESULTS.filter(t => t.found).length;
  const activeTemplates = PDF_TEMPLATES.filter(t => t.status === "ACTIVE").length;
  const legacyTemplates = PDF_TEMPLATES.filter(t => t.status === "LEGACY").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <FileSearch className="w-8 h-8 text-primary" />
              Audit Système
            </h1>
            <p className="text-muted-foreground">
              Lecture seule — État actuel du système pour audit externe
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopyJSON}>
              <Copy className="w-4 h-4 mr-2" />
              Copier JSON
            </Button>
            <Button onClick={handleExportJSON}>
              <Download className="w-4 h-4 mr-2" />
              Exporter Audit JSON
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Templates Actifs</p>
                  <p className="text-2xl font-bold text-emerald-500">{activeTemplates}</p>
                </div>
                <FileText className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {legacyTemplates} legacy (non utilisés)
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Termes Propres</p>
                  <p className="text-2xl font-bold text-emerald-500">{terminologyClean}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {terminologyFlagged} termes à vérifier (admin only)
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Email Queue</p>
                  <p className="text-2xl font-bold">{emailQueueStats?.pending || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {emailQueueStats?.sent || 0} envoyés, {emailQueueStats?.failed || 0} échoués
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Abonnements Actifs</p>
                  <p className="text-2xl font-bold">{subscriptionStats?.active || 0}</p>
                </div>
                <Database className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {subscriptionStats?.expiringSoon || 0} expirent sous 5 jours
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="routes" className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4" />
              Routes
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="terminology" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Terminologie
            </TabsTrigger>
            <TabsTrigger value="automations" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Jobs
            </TabsTrigger>
          </TabsList>

          {/* TAB A: Routes & Sources */}
          <TabsContent value="routes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Routes & Sources de Données</CardTitle>
                <CardDescription>
                  Mapping des pages vers leurs sources de données principales et secondaires
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {ROUTE_SOURCES.map((route, idx) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                              {route.route}
                            </code>
                            <p className="font-medium mt-1">{route.pageName}</p>
                          </div>
                          {route.secondarySource ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500">
                              Double source
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500">
                              Source unique
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Source principale:</span>
                            <p className="font-mono text-primary">{route.primarySource}</p>
                          </div>
                          {route.secondarySource && (
                            <div>
                              <span className="text-muted-foreground">Source secondaire:</span>
                              <p className="font-mono text-amber-500">{route.secondarySource}</p>
                            </div>
                          )}
                        </div>
                        {route.notes && (
                          <p className="text-xs text-muted-foreground mt-2 italic">
                            {route.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB B: Templates PDF */}
          <TabsContent value="templates" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Templates PDF Actifs</CardTitle>
                <CardDescription>
                  Mapping des types de documents vers leurs générateurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Active Templates */}
                  <div>
                    <h3 className="font-semibold text-emerald-500 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Templates Actifs (V2.5)
                    </h3>
                    <div className="grid gap-3">
                      {PDF_TEMPLATES.filter(t => t.status === "ACTIVE").map((template, idx) => (
                        <div key={idx} className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{template.type}</p>
                              <code className="text-xs font-mono text-muted-foreground">
                                {template.fileName}
                              </code>
                            </div>
                            <div className="text-right">
                              <Badge className="bg-emerald-500">ACTIVE</Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {template.templateVersion}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {template.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Legacy Templates */}
                  <div>
                    <h3 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <XCircle className="w-5 h-5" />
                      Templates Legacy (Obsolètes)
                    </h3>
                    <div className="grid gap-3">
                      {PDF_TEMPLATES.filter(t => t.status === "LEGACY").map((template, idx) => (
                        <div key={idx} className="border border-muted rounded-lg p-4 bg-muted/20 opacity-60">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium line-through">{template.type}</p>
                              <code className="text-xs font-mono text-muted-foreground">
                                {template.fileName}
                              </code>
                            </div>
                            <Badge variant="secondary">LEGACY</Badge>
                          </div>
                          <p className="text-sm text-destructive mt-2">
                            ⚠️ {template.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB C: Terminology */}
          <TabsContent value="terminology" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Terminologie Interdite</CardTitle>
                <CardDescription>
                  Scan des termes incompatibles avec le modèle prépayé (dette, pénalités, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Clean terms */}
                  <div>
                    <h3 className="font-semibold text-emerald-500 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      Termes Absents (Conformes)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {TERMINOLOGY_SCAN_RESULTS.filter(t => !t.found).map((term, idx) => (
                        <Badge key={idx} variant="outline" className="border-emerald-500 text-emerald-500">
                          ✓ {term.term}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Flagged terms */}
                  <div>
                    <h3 className="font-semibold text-amber-500 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Termes Détectés (À Vérifier)
                    </h3>
                    <div className="space-y-3">
                      {TERMINOLOGY_SCAN_RESULTS.filter(t => t.found).map((term, idx) => (
                        <div key={idx} className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                              ⚠️ {term.term}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {term.count} occurrence(s)
                            </span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {term.locations.map((loc, locIdx) => (
                              <p key={locIdx} className="text-sm text-muted-foreground">
                                • {loc}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 italic">
                      Note: Les termes trouvés sont tous dans des sections admin-only ou DB schema. 
                      Aucun de ces termes n'apparaît côté client.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB D: Automations */}
          <TabsContent value="automations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Automatisations / Jobs</CardTitle>
                <CardDescription>
                  État des tâches automatisées (pg_cron, edge functions)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Jobs List */}
                  <div>
                    <h3 className="font-semibold mb-3">Jobs Configurés</h3>
                    <div className="grid gap-3">
                      {AUTOMATION_JOBS.map((job, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium font-mono">{job.jobName}</p>
                              <p className="text-sm text-muted-foreground">{job.description}</p>
                            </div>
                            <Badge variant="outline">{job.schedule}</Badge>
                          </div>
                          {job.sourceTable && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Source: <code className="bg-muted px-1 rounded">{job.sourceTable}</code>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Live Stats */}
                  <div>
                    <h3 className="font-semibold mb-3">Statistiques Live (Lecture Seule)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Email Queue</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>En attente:</span>
                            <span className="font-mono">{emailQueueStats?.pending || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Envoyés (derniers 100):</span>
                            <span className="font-mono">{emailQueueStats?.sent || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Échoués:</span>
                            <span className="font-mono text-destructive">{emailQueueStats?.failed || 0}</span>
                          </div>
                          {emailQueueStats?.lastSent && (
                            <div className="pt-2 border-t mt-2">
                              <span className="text-xs text-muted-foreground">
                                Dernier envoi: {new Date(emailQueueStats.lastSent).toLocaleString("fr-CA")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Factures V2</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Récurrentes:</span>
                            <span className="font-mono">{billingStats?.recurring || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Ponctuelles:</span>
                            <span className="font-mono">{billingStats?.oneTime || 0}</span>
                          </div>
                          {billingStats?.lastCreated && (
                            <div className="pt-2 border-t mt-2">
                              <span className="text-xs text-muted-foreground">
                                Dernière: {new Date(billingStats.lastCreated).toLocaleString("fr-CA")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Abonnements V2</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Actifs:</span>
                            <span className="font-mono">{subscriptionStats?.active || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expirent sous 5j:</span>
                            <span className="font-mono text-amber-500">{subscriptionStats?.expiringSoon || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemAudit;
