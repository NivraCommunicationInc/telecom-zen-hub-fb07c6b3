/**
 * AdminQA - Page READ-ONLY (Données brutes uniquement)
 * 
 * 4 sections en tableaux:
 * 1. Templates PDF runtime (SELECT qa_pdf_templates_runtime WHERE active = true)
 * 2. Templates PDF legacy  (SELECT qa_pdf_templates_runtime WHERE active = false)
 * 3. Sources DB par document (SELECT qa_document_sources)
 * 4. Jobs automatiques (SELECT qa_cron_jobs)
 * 
 * AUCUN bouton, AUCUNE logique de test, AUCUN texte interprétatif.
 */

import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Database, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

// ============================================
// DATA FETCHING — READ-ONLY VIEWS
// ============================================

interface PDFTemplateRow {
  type: string;
  path: string;
  version: string;
  active: boolean;
  last_used_at: string | null;
}

interface DocumentSourceRow {
  document_type: string;
  primary_table: string;
  secondary_table: string | null;
}

interface CronJobRow {
  job_id: number;
  job_name: string;
  schedule: string;
  command: string;
  active: boolean;
  last_run_id: number | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_message: string | null;
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
  const { data: templates, isLoading: templatesLoading, error: templatesError } = usePDFTemplates();
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useDocumentSources();
  const { data: jobs, isLoading: jobsLoading, error: jobsError } = useCronJobs();

  const activeTemplates = templates?.filter((t) => t.active) || [];
  const legacyTemplates = templates?.filter((t) => !t.active) || [];

  const fmt = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">QA — Données brutes</h1>
          <p className="text-muted-foreground text-sm">Lecture seule — SELECT uniquement</p>
        </div>

        {/* SECTION 1: Templates PDF actifs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              SECTION 1 — Templates PDF (runtime)
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
                      <th className="pb-2 pr-4">type</th>
                      <th className="pb-2 pr-4">path</th>
                      <th className="pb-2 pr-4">version</th>
                      <th className="pb-2 pr-4">active</th>
                      <th className="pb-2">last_used_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTemplates.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {activeTemplates.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.type)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(t.path)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.version)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.active)}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{fmt(t.last_used_at)}</td>
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
              SECTION 2 — Templates legacy
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
                      <th className="pb-2 pr-4">type</th>
                      <th className="pb-2 pr-4">path</th>
                      <th className="pb-2 pr-4">version</th>
                      <th className="pb-2 pr-4">active</th>
                      <th className="pb-2">last_used_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyTemplates.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {legacyTemplates.map((t, idx) => (
                      <tr key={idx} className="border-b border-border/50 opacity-60">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.type)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(t.path)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.version)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(t.active)}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">{fmt(t.last_used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* SECTION 3: Sources DB */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="w-5 h-5" />
              SECTION 3 — Sources DB par document
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
                    <th className="pb-2 pr-4">primary_table</th>
                    <th className="pb-2">secondary_table</th>
                  </tr>
                </thead>
                <tbody>
                  {sources?.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-muted-foreground text-center">
                        NULL
                      </td>
                    </tr>
                  )}
                  {sources?.map((s, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{fmt(s.document_type)}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{fmt(s.primary_table)}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{fmt(s.secondary_table)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* SECTION 4: Jobs automatiques */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5" />
              SECTION 4 — Jobs automatiques
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
              <ScrollArea className="h-[260px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4">job_name</th>
                      <th className="pb-2 pr-4">schedule</th>
                      <th className="pb-2 pr-4">active</th>
                      <th className="pb-2 pr-4">last_run_at</th>
                      <th className="pb-2">last_run_status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-muted-foreground text-center">
                          NULL
                        </td>
                      </tr>
                    )}
                    {jobs?.map((j, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(j.job_name)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(j.schedule)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{fmt(j.active)}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{fmt(j.last_run_at)}</td>
                        <td className="py-2 font-mono text-xs">{fmt(j.last_run_status)}</td>
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
          Données brutes — Lecture seule
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminQA;
