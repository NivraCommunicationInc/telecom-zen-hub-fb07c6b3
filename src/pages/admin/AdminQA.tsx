/**
 * AdminQA - Page d'audit READ-ONLY
 * 
 * Affiche l'état actuel du système sans aucune action de modification.
 * - Templates PDF actifs et legacy
 * - Sources de données par document
 * - Jobs automatiques
 * 
 * AUCUN bouton d'action, AUCUNE modification.
 */

import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileSearch, 
  FileText, 
  CheckCircle2,
  XCircle,
  Database,
  Clock,
  Folder,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

// ============================================
// SECTION 1: Templates PDF en production
// ============================================

interface PDFTemplateInfo {
  type: string;
  fileName: string;
  filePath: string;
  lastUsedAt: string | null;
  active: boolean;
  version: string;
  description: string;
}

const PDF_TEMPLATES_ACTIVE: PDFTemplateInfo[] = [
  {
    type: "Facture mensuelle",
    fileName: "invoiceMonthlyTemplateV2.ts",
    filePath: "src/lib/pdf/invoiceMonthlyTemplateV2.ts",
    lastUsedAt: null, // Will be fetched from DB
    active: true,
    version: "V2.4",
    description: "Renouvellement abonnement - Template principal",
  },
  {
    type: "Facture unique",
    fileName: "invoiceOneTimeTemplateV2.ts",
    filePath: "src/lib/pdf/invoiceOneTimeTemplateV2.ts",
    lastUsedAt: null,
    active: true,
    version: "V2.4",
    description: "Équipements + frais activation",
  },
  {
    type: "Contrat de service",
    fileName: "contractTemplate.ts",
    filePath: "src/lib/pdf/contractTemplate.ts",
    lastUsedAt: null,
    active: true,
    version: "V2.5",
    description: "Contrat légal avec annexes A-E et signature électronique",
  },
  {
    type: "Résumé de commande",
    fileName: "orderSummaryTemplate.ts",
    filePath: "src/lib/pdf/orderSummaryTemplate.ts",
    lastUsedAt: null,
    active: true,
    version: "V2.4",
    description: "Confirmation post-paiement checkout",
  },
  {
    type: "Modalités de service",
    fileName: "termsModalitesPdfGenerator.ts",
    filePath: "src/lib/pdfEngine/termsModalitesPdfGenerator.ts",
    lastUsedAt: null,
    active: true,
    version: "V2.5",
    description: "8 pages, watermark PRÉPAYÉ, clauses CRTC",
  },
];

const PDF_TEMPLATES_LEGACY: PDFTemplateInfo[] = [
  {
    type: "Facture (legacy V1)",
    fileName: "invoicePdfGenerator.ts",
    filePath: "src/lib/pdf/invoicePdfGenerator.ts",
    lastUsedAt: null,
    active: false,
    version: "V1.0",
    description: "DÉSACTIVÉ - Ancien générateur",
  },
  {
    type: "Contrat télécom (legacy)",
    fileName: "telecomContractGenerator.ts",
    filePath: "src/lib/pdf/telecomContractGenerator.ts",
    lastUsedAt: null,
    active: false,
    version: "V1.0",
    description: "DÉSACTIVÉ - Ancien format",
  },
  {
    type: "Invoice Monthly V1",
    fileName: "invoiceMonthlyTemplate.ts",
    filePath: "src/lib/pdf/invoiceMonthlyTemplate.ts",
    lastUsedAt: null,
    active: false,
    version: "V1.0",
    description: "DÉSACTIVÉ - Remplacé par V2.4",
  },
  {
    type: "Invoice OneTime V1",
    fileName: "invoiceOneTimeTemplate.ts",
    filePath: "src/lib/pdf/invoiceOneTimeTemplate.ts",
    lastUsedAt: null,
    active: false,
    version: "V1.0",
    description: "DÉSACTIVÉ - Remplacé par V2.4",
  },
];

// ============================================
// SECTION 3: Sources par document
// ============================================

interface DocumentSourceInfo {
  documentType: string;
  primarySource: string;
  primaryTable: string;
  secondarySource?: string;
  secondaryTable?: string;
  notes: string;
}

const DOCUMENT_SOURCES: DocumentSourceInfo[] = [
  {
    documentType: "Factures client (portail)",
    primarySource: "billing_invoices",
    primaryTable: "billing_invoices",
    secondarySource: "billing (legacy)",
    secondaryTable: "billing",
    notes: "V2 active, legacy en lecture seule pour historique",
  },
  {
    documentType: "Factures mensuelles",
    primarySource: "billing_invoices (type=recurring)",
    primaryTable: "billing_invoices",
    notes: "Générées automatiquement J-5 via pg_cron",
  },
  {
    documentType: "Factures uniques",
    primarySource: "billing_invoices (type=one_time)",
    primaryTable: "billing_invoices",
    notes: "Créées au checkout avec equipment_details.line_items",
  },
  {
    documentType: "Contrats",
    primarySource: "contracts",
    primaryTable: "contracts",
    notes: "Génération via trg_auto_generate_contract_on_payment",
  },
  {
    documentType: "Résumés de commande",
    primarySource: "orders + equipment_details",
    primaryTable: "orders",
    notes: "Généré immédiatement après paiement confirmé",
  },
];

// ============================================
// SECTION 4: Jobs automatiques
// ============================================

interface AutomationJobInfo {
  jobName: string;
  description: string;
  schedule: string;
  sourceTable: string;
  lastRun: string | null;
  status: "running" | "idle" | "error" | "unknown";
}

const AUTOMATION_JOBS: AutomationJobInfo[] = [
  {
    jobName: "billing-generate-renewals-hourly",
    description: "Génération factures renouvellement J-5",
    schedule: "Toutes les heures (pg_cron)",
    sourceTable: "billing_invoices",
    lastRun: null,
    status: "unknown",
  },
  {
    jobName: "process-email-queue",
    description: "Envoi des emails en file d'attente",
    schedule: "Toutes les minutes (pg_cron)",
    sourceTable: "email_queue",
    lastRun: null,
    status: "unknown",
  },
  {
    jobName: "billing-payment-reminders",
    description: "Rappels paiement J-7, J-3, J-1, J0, J+1",
    schedule: "Toutes les heures (pg_cron)",
    sourceTable: "email_queue",
    lastRun: null,
    status: "unknown",
  },
  {
    jobName: "billing-expiration-check",
    description: "Vérification expiration abonnements",
    schedule: "Quotidien 00:05 (pg_cron)",
    sourceTable: "billing_subscriptions",
    lastRun: null,
    status: "unknown",
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

const AdminQA = () => {
  // Fetch last invoice created (READ-ONLY) to estimate template usage
  const { data: lastInvoice } = useQuery({
    queryKey: ["qa-last-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("created_at, type")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch last contract created (READ-ONLY)
  const { data: lastContract } = useQuery({
    queryKey: ["qa-last-contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch email queue stats (READ-ONLY)
  const { data: emailQueueStats } = useQuery({
    queryKey: ["qa-email-queue-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_queue")
        .select("status, sent_at")
        .order("sent_at", { ascending: false })
        .limit(50);
      
      const lastSent = data?.find(e => e.sent_at)?.sent_at;
      const pending = data?.filter(e => e.status === "pending").length || 0;
      const sent = data?.filter(e => e.status === "sent").length || 0;
      
      return { lastSent, pending, sent };
    },
  });

  // Compute template last used dates based on DB
  const getTemplateLastUsed = (type: string): string | null => {
    if (type.includes("mensuelle") && lastInvoice?.type === "recurring") {
      return lastInvoice.created_at;
    }
    if (type.includes("unique") && lastInvoice?.type === "one_time") {
      return lastInvoice.created_at;
    }
    if (type.includes("Contrat") && lastContract) {
      return lastContract.created_at;
    }
    return null;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("fr-CA", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileSearch className="w-8 h-8 text-primary" />
            QA — Audit Système
          </h1>
          <p className="text-muted-foreground">
            Lecture seule — Aucune action disponible
          </p>
        </div>

        {/* SECTION 1: Templates PDF actifs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Templates PDF en production (ACTIFS)
            </CardTitle>
            <CardDescription>
              Fichiers réellement utilisés pour générer les documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {PDF_TEMPLATES_ACTIVE.map((template, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{template.type}</span>
                          <Badge className="bg-emerald-500 text-white">
                            {template.version}
                          </Badge>
                          <Badge variant="outline" className="text-emerald-600 border-emerald-500">
                            ACTIF
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Folder className="w-3 h-3" />
                            <code className="text-xs bg-muted px-1 rounded">{template.filePath}</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>Dernière utilisation: {formatDate(getTemplateLastUsed(template.type))}</span>
                          </div>
                          <p className="text-xs">{template.description}</p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* SECTION 2: Templates PDF legacy (désactivés) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              Templates PDF legacy (DÉSACTIVÉS)
            </CardTitle>
            <CardDescription>
              Fichiers obsolètes — NE SONT PLUS UTILISÉS
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {PDF_TEMPLATES_LEGACY.map((template, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-muted-foreground">{template.type}</span>
                          <Badge variant="secondary">{template.version}</Badge>
                          <Badge variant="outline" className="text-destructive border-destructive">
                            DÉSACTIVÉ
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Folder className="w-3 h-3" />
                            <code className="text-xs bg-muted px-1 rounded">{template.filePath}</code>
                          </div>
                          <p className="text-xs">{template.description}</p>
                        </div>
                      </div>
                      <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* SECTION 3: Sources par document */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Sources de données par document
            </CardTitle>
            <CardDescription>
              Tables utilisées pour générer chaque type de document
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DOCUMENT_SOURCES.map((source, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className="font-medium">{source.documentType}</span>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Source principale
                          </Badge>
                          <code className="text-xs bg-muted px-1 rounded">{source.primaryTable}</code>
                        </div>
                        {source.secondaryTable && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              Source secondaire
                            </Badge>
                            <code className="text-xs bg-muted px-1 rounded">{source.secondaryTable}</code>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{source.notes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* SECTION 4: Jobs automatiques */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Jobs automatiques
            </CardTitle>
            <CardDescription>
              Tâches planifiées via pg_cron
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {AUTOMATION_JOBS.map((job, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{job.jobName}</span>
                        <Badge variant="outline" className="text-xs">
                          {job.schedule}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{job.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">Table:</span>
                          <code className="text-xs bg-muted px-1 rounded">{job.sourceTable}</code>
                        </div>
                        {job.jobName === "process-email-queue" && emailQueueStats?.lastSent && (
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>Dernier envoi: {formatDate(emailQueueStats.lastSent)}</span>
                            <span className="text-muted-foreground">
                              ({emailQueueStats.pending} en attente, {emailQueueStats.sent} envoyés)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          Page en lecture seule — Aucune action disponible — Données en temps réel
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQA;
