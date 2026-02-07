/**
 * AdminQA - Page READ-ONLY (Données brutes uniquement)
 * 
 * 5 sections en tableaux:
 * 1. Templates PDF runtime (SELECT qa_pdf_templates_runtime WHERE active = true)
 * 2. Templates PDF legacy  (SELECT qa_pdf_templates_runtime WHERE active = false)
 * 3. Logs de génération PDF (SELECT qa_pdf_generation_logs LIMIT 20)
 * 4. Sources DB par document (SELECT qa_document_sources)
 * 5. Jobs automatiques (SELECT qa_cron_jobs)
 * 
 * AUCUN bouton, AUCUNE logique de test, AUCUN texte interprétatif.
 */

import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Database, Clock, AlertTriangle, History, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Button } from "@/components/ui/button";

// ============================================
// DATA FETCHING — READ-ONLY VIEWS
// ============================================

interface PDFTemplateRow {
  template_key: string;
  template_type: string;
  template_path: string;
  version: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  generation_count: number;
}

interface PDFGenerationLogRow {
  id: string;
  doc_type: string;
  template_path: string;
  template_version: string;
  engine_version: string;
  generated_at: string;
  invoice_number: string | null;
  order_number: string | null;
  customer_email: string | null;
  payment_provider: string | null;
  success: boolean;
  error_message: string | null;
}

interface DocumentSourceRow {
  document_type: string;
  source_table: string;
  filter_condition: string | null;
  template_path: string;
}

interface CronJobRow {
  job_name: string;
  schedule: string;
  description: string;
  last_run_approx: string | null;
}

const usePDFTemplates = () =>
  useQuery<PDFTemplateRow[]>({
    queryKey: ["qa-pdf-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_pdf_templates_runtime")
        .select("*");
      if (error) throw error;
      return (data as PDFTemplateRow[]) || [];
    },
    // NO auto-refresh - manual only
  });

const usePDFGenerationLogs = () =>
  useQuery<PDFGenerationLogRow[]>({
    queryKey: ["qa-pdf-generation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_pdf_generation_logs")
        .select("*");
      if (error) throw error;
      return (data as PDFGenerationLogRow[]) || [];
    },
    // NO auto-refresh - manual only
  });

const useDocumentSources = () =>
  useQuery<DocumentSourceRow[]>({
    queryKey: ["qa-document-sources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_document_sources")
        .select("*");
      if (error) throw error;
      return (data as DocumentSourceRow[]) || [];
    },
  });

const useCronJobs = () =>
  useQuery<CronJobRow[]>({
    queryKey: ["qa-cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_cron_jobs")
        .select("*");
      if (error) throw error;
      return (data as CronJobRow[]) || [];
    },
  });

// ============================================
// MAIN COMPONENT
// ============================================

const AdminQA = () => {
  const queryClient = useQueryClient();
  const { data: templates, isLoading: templatesLoading, error: templatesError } = usePDFTemplates();
  const { data: logs, isLoading: logsLoading, error: logsError } = usePDFGenerationLogs();
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useDocumentSources();
  const { data: jobs, isLoading: jobsLoading, error: jobsError } = useCronJobs();

  const activeTemplates = templates?.filter((t) => t.is_active) || [];
  const legacyTemplates = templates?.filter((t) => !t.is_active) || [];

  const fmt = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  };

  const fmtDate = (val: string | null): string => {
    if (!val) return "NULL";
    try {
      const d = new Date(val);
      return d.toLocaleString("fr-CA", { 
        year: "numeric", 
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return val;
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["qa-pdf-templates"] });
    queryClient.invalidateQueries({ queryKey: ["qa-pdf-generation-logs"] });
    queryClient.invalidateQueries({ queryKey: ["qa-document-sources"] });
    queryClient.invalidateQueries({ queryKey: ["qa-cron-jobs"] });
  };

  // Detect mismatch between config runtime and actual logs
  const detectMismatches = (): { template: string; configPath: string; logPath: string }[] => {
    if (!templates || !logs) return [];
    const mismatches: { template: string; configPath: string; logPath: string }[] = [];
    
    for (const template of templates.filter(t => t.is_active)) {
      const recentLogs = logs.filter(l => 
        l.doc_type.includes(template.template_type.toLowerCase().replace(' ', '_'))
      );
      
      for (const log of recentLogs) {
        if (log.template_path && log.template_path !== template.template_path) {
          mismatches.push({
            template: template.template_type,
            configPath: template.template_path,
            logPath: log.template_path,
          });
        }
      }
    }
    return mismatches;
  };
  
  const mismatches = detectMismatches();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">QA — Données brutes</h1>
            <p className="text-muted-foreground text-sm">Lecture seule — SELECT uniquement — Refresh manuel</p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Rafraîchir
          </Button>
        </div>

        {/* MISMATCH ALERT - Config vs Real Logs */}
        {mismatches.length > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <AlertTriangle className="w-5 h-5" />
                MISMATCH DÉTECTÉ — Config runtime ≠ Logs réels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">template</th>
                    <th className="pb-2 pr-4">config_path (runtime)</th>
                    <th className="pb-2">log_path (réel)</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.map((m, idx) => (
                    <tr key={idx} className="border-b border-destructive/30">
                      <td className="py-2 pr-4 font-mono text-xs font-semibold text-destructive">{m.template}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{m.configPath}</td>
                      <td className="py-2 font-mono text-xs text-destructive">{m.logPath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* SECTION 1: Templates PDF actifs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              SECTION 1 — Templates PDF (runtime actifs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templatesLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
            {templatesError && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {(templatesError as Error).message}
              </p>
            )}
            {!templatesLoading && !templatesError && (
              <ScrollArea className="h-[220px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">template_type</th>
                      <th className="pb-2 pr-4">template_path</th>
                      <th className="pb-2 pr-4">version</th>
                      <th className="pb-2 pr-4">is_active</th>
                      <th className="pb-2 pr-4">last_used_at</th>
                      <th className="pb-2">generation_count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTemplates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {activeTemplates.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.template_type)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(t.template_path)}</td>
                        <td className="py-2 pr-4 font-mono text-xs font-semibold text-primary">{fmt(t.version)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-green-600">{fmt(t.is_active)}</td>
                        <td className={`py-2 pr-4 font-mono text-xs ${t.last_used_at ? 'text-green-600 font-semibold' : 'text-muted-foreground'}`}>
                          {fmtDate(t.last_used_at)}
                        </td>
                        <td className="py-2 font-mono text-xs">{fmt(t.generation_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* SECTION 2: Templates legacy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
              SECTION 2 — Templates legacy (désactivés)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templatesLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
            {templatesError && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {(templatesError as Error).message}
              </p>
            )}
            {!templatesLoading && !templatesError && (
              <ScrollArea className="h-[180px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">template_type</th>
                      <th className="pb-2 pr-4">template_path</th>
                      <th className="pb-2 pr-4">version</th>
                      <th className="pb-2 pr-4">is_active</th>
                      <th className="pb-2 pr-4">last_used_at</th>
                      <th className="pb-2">generation_count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyTemplates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {legacyTemplates.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50 opacity-60">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.template_type)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(t.template_path)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.version)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-red-500">{fmt(t.is_active)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmtDate(t.last_used_at)}</td>
                        <td className="py-2 font-mono text-xs">{fmt(t.generation_count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* SECTION 3: Logs de génération PDF */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              SECTION 3 — Logs de génération PDF (20 derniers)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logsLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
            {logsError && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {(logsError as Error).message}
              </p>
            )}
            {!logsLoading && !logsError && (
              <ScrollArea className="h-[300px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">generated_at</th>
                      <th className="pb-2 pr-4">doc_type</th>
                      <th className="pb-2 pr-4">template_version</th>
                      <th className="pb-2 pr-4">invoice_number</th>
                      <th className="pb-2 pr-4">customer_email</th>
                      <th className="pb-2 pr-4">payment_provider</th>
                      <th className="pb-2">success</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!logs || logs.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-4 text-muted-foreground text-center">
                          NULL — Aucune génération enregistrée
                        </td>
                      </tr>
                    )}
                    {logs?.map((log, idx) => (
                      <tr key={idx} className={`border-b border-border/50 ${!log.success ? 'bg-destructive/10' : ''}`}>
                        <td className="py-2 pr-4 font-mono text-xs">{fmtDate(log.generated_at)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(log.doc_type)}</td>
                        <td className="py-2 pr-4 font-mono text-xs font-semibold">{fmt(log.template_version)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(log.invoice_number)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(log.customer_email)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(log.payment_provider)}</td>
                        <td className={`py-2 font-mono text-xs ${log.success ? 'text-green-600' : 'text-red-600'}`}>
                          {log.success ? "✅" : "❌"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* SECTION 4: Sources DB */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5" />
              SECTION 4 — Sources DB par document
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourcesLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
            {sourcesError && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {(sourcesError as Error).message}
              </p>
            )}
            {!sourcesLoading && !sourcesError && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">document_type</th>
                    <th className="pb-2 pr-4">source_table</th>
                    <th className="pb-2 pr-4">filter_condition</th>
                    <th className="pb-2">template_path</th>
                  </tr>
                </thead>
                <tbody>
                  {sources?.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted-foreground text-center">
                        NULL
                      </td>
                    </tr>
                  )}
                  {sources?.map((s, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{fmt(s.document_type)}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{fmt(s.source_table)}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(s.filter_condition)}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{fmt(s.template_path)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* SECTION 5: Jobs automatiques */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              SECTION 5 — Jobs automatiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jobsLoading && <p className="text-muted-foreground text-sm">Chargement...</p>}
            {jobsError && (
              <p className="text-destructive text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {(jobsError as Error).message}
              </p>
            )}
            {!jobsLoading && !jobsError && (
              <ScrollArea className="h-[200px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">job_name</th>
                      <th className="pb-2 pr-4">schedule</th>
                      <th className="pb-2 pr-4">description</th>
                      <th className="pb-2">last_run_approx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {jobs?.map((j, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(j.job_name)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(j.schedule)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(j.description)}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{fmtDate(j.last_run_approx)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="text-center text-xs text-muted-foreground py-2">
          Données brutes — Lecture seule — last_used_at = MAX(generated_at) depuis pdf_generation_logs
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQA;