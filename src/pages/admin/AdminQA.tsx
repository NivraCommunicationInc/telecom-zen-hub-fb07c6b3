/**
 * AdminQA - Page d'audit READ-ONLY (Données réelles uniquement)
 * 
 * Affiche l'état actuel du système basé sur des données runtime.
 * AUCUN test, AUCUNE assertion, AUCUN bouton.
 */

import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Database,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";

// ============================================
// SECTION 1: Templates PDF (Runtime Config)
// ============================================

interface TemplateConfig {
  type: string;
  path: string;
  version: string;
  active: boolean;
  last_used_at: string | null;
}

// ============================================
// SECTION 3: Sources DB par document
// ============================================

interface DocumentSource {
  document_type: string;
  primary_table: string;
  secondary_table: string | null;
}

const DOCUMENT_SOURCES: DocumentSource[] = [
  { document_type: "invoice_monthly", primary_table: "billing_invoices", secondary_table: null },
  { document_type: "invoice_one_time", primary_table: "billing_invoices", secondary_table: null },
  { document_type: "contract", primary_table: "contracts", secondary_table: null },
  { document_type: "order_summary", primary_table: "orders", secondary_table: "equipment_details" },
  { document_type: "terms", primary_table: "site_settings", secondary_table: null },
];

// ============================================
// MAIN COMPONENT
// ============================================

const AdminQA = () => {
  // Query: Last invoice by type (recurring)
  const { data: lastRecurringInvoice } = useQuery({
    queryKey: ["qa-last-recurring-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("created_at")
        .eq("type", "recurring")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at || null;
    },
  });

  // Query: Last invoice by type (one_time)
  const { data: lastOneTimeInvoice } = useQuery({
    queryKey: ["qa-last-onetime-invoice"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_invoices")
        .select("created_at")
        .eq("type", "one_time")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at || null;
    },
  });

  // Query: Last contract
  const { data: lastContract } = useQuery({
    queryKey: ["qa-last-contract"],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at || null;
    },
  });

  // Query: Last order
  const { data: lastOrder } = useQuery({
    queryKey: ["qa-last-order"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.created_at || null;
    },
  });

  // Query: Email queue stats (last 100)
  const { data: emailQueueData } = useQuery({
    queryKey: ["qa-email-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_queue")
        .select("status, sent_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      
      const lastSent = data?.find(e => e.sent_at)?.sent_at || null;
      const pending = data?.filter(e => e.status === "pending").length || 0;
      const sent = data?.filter(e => e.status === "sent").length || 0;
      const failed = data?.filter(e => e.status === "failed").length || 0;
      
      return { last_sent_at: lastSent, pending, sent, failed };
    },
  });

  // Query: Last billing subscription check
  const { data: lastSubscriptionUpdate } = useQuery({
    queryKey: ["qa-last-subscription"],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_subscriptions")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.updated_at || null;
    },
  });

  // Build runtime template data
  const activeTemplates: TemplateConfig[] = [
    {
      type: "invoice_monthly",
      path: "src/lib/pdf/invoiceMonthlyTemplateV2.ts",
      version: "V2.4",
      active: true,
      last_used_at: lastRecurringInvoice || null,
    },
    {
      type: "invoice_one_time",
      path: "src/lib/pdf/invoiceOneTimeTemplateV2.ts",
      version: "V2.4",
      active: true,
      last_used_at: lastOneTimeInvoice || null,
    },
    {
      type: "contract",
      path: "src/lib/pdf/contractTemplate.ts",
      version: "V2.5",
      active: true,
      last_used_at: lastContract || null,
    },
    {
      type: "order_summary",
      path: "src/lib/pdf/orderSummaryTemplate.ts",
      version: "V2.4",
      active: true,
      last_used_at: lastOrder || null,
    },
    {
      type: "terms",
      path: "src/lib/pdfEngine/termsModalitesPdfGenerator.ts",
      version: "V2.5",
      active: true,
      last_used_at: null,
    },
  ];

  const legacyTemplates: TemplateConfig[] = [
    {
      type: "invoice_legacy",
      path: "src/lib/pdf/invoicePdfGenerator.ts",
      version: "V1.0",
      active: false,
      last_used_at: null,
    },
    {
      type: "contract_legacy",
      path: "src/lib/pdf/telecomContractGenerator.ts",
      version: "V1.0",
      active: false,
      last_used_at: null,
    },
    {
      type: "invoice_monthly_v1",
      path: "src/lib/pdf/invoiceMonthlyTemplate.ts",
      version: "V1.0",
      active: false,
      last_used_at: null,
    },
    {
      type: "invoice_one_time_v1",
      path: "src/lib/pdf/invoiceOneTimeTemplate.ts",
      version: "V1.0",
      active: false,
      last_used_at: null,
    },
  ];

  // Build jobs data
  const jobsData = [
    {
      job_name: "process-email-queue",
      last_run_at: emailQueueData?.last_sent_at || null,
      status: emailQueueData ? `pending:${emailQueueData.pending} sent:${emailQueueData.sent} failed:${emailQueueData.failed}` : null,
    },
    {
      job_name: "billing-generate-renewals-hourly",
      last_run_at: lastRecurringInvoice || null,
      status: lastRecurringInvoice ? "active" : null,
    },
    {
      job_name: "billing-expiration-check",
      last_run_at: lastSubscriptionUpdate || null,
      status: lastSubscriptionUpdate ? "active" : null,
    },
  ];

  const formatTimestamp = (ts: string | null): string => {
    if (!ts) return "NULL";
    return ts;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            QA — Données Runtime
          </h1>
          <p className="text-muted-foreground text-sm">
            Lecture seule — Données brutes uniquement
          </p>
        </div>

        {/* SECTION 1: Templates PDF actifs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              SECTION 1 — Templates PDF (Runtime)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
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
                  {activeTemplates.map((t, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{t.type}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.path}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{t.version}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge className="bg-emerald-500 text-white text-xs">true</Badge>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {formatTimestamp(t.last_used_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* SECTION 2: Templates Legacy */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-muted-foreground" />
              SECTION 2 — Templates Legacy
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  {legacyTemplates.map((t, idx) => (
                    <tr key={idx} className="border-b border-border/50 opacity-60">
                      <td className="py-2 pr-4 font-mono text-xs">{t.type}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.path}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary" className="text-xs">{t.version}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-destructive border-destructive text-xs">false</Badge>
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">NULL</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">document_type</th>
                  <th className="pb-2 pr-4">primary_table</th>
                  <th className="pb-2">secondary_table</th>
                </tr>
              </thead>
              <tbody>
                {DOCUMENT_SOURCES.map((s, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{s.document_type}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{s.primary_table}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {s.secondary_table || "NULL"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">job_name</th>
                  <th className="pb-2 pr-4">last_run_at</th>
                  <th className="pb-2">status</th>
                </tr>
              </thead>
              <tbody>
                {jobsData.map((j, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-xs">{j.job_name}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {formatTimestamp(j.last_run_at)}
                    </td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {j.status || "NULL"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
