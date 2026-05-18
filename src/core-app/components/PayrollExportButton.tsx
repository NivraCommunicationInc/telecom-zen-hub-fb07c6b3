/**
 * PayrollExportButton — standalone CSV export for HR payroll entries.
 * Mounted in HR pages without touching HrPayrollPage2 core logic.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/core-app/lib/exportUtils";
import { toast } from "sonner";

interface Props {
  periodId?: string;
  label?: string;
}

export default function PayrollExportButton({ periodId, label = "Exporter paie CSV" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      let q = supabase.from("payroll_entries" as any).select("*");
      if (periodId) q = q.eq("period_id", periodId);
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) {
        toast.info("Aucune entrée à exporter");
        return;
      }

      const rows = (data as any[]).map((e) => ({
        agent_name: e.employee_name || e.agent_name || "",
        agent_number: e.employee_number || e.agent_number || "",
        period_name: e.period_name || "",
        gross_pay: Number(e.gross_pay || 0).toFixed(2),
        federal_tax: Number(e.federal_tax || 0).toFixed(2),
        quebec_tax: Number(e.quebec_tax || 0).toFixed(2),
        rrq: Number(e.rrq || 0).toFixed(2),
        ei: Number(e.ei || e.employment_insurance || 0).toFixed(2),
        rqap: Number(e.rqap || 0).toFixed(2),
        disability_insurance: Number(e.disability_insurance || 0).toFixed(2),
        deductions_total: Number(e.deductions_total || 0).toFixed(2),
        net_pay: Number(e.net_pay || 0).toFixed(2),
        payment_method: e.payment_method || "",
        paid_at: e.paid_at ? new Date(e.paid_at).toLocaleDateString("fr-CA") : "",
      }));

      exportToCSV(rows, "paie_export", [
        { key: "agent_name", label: "Agent" },
        { key: "agent_number", label: "Numéro agent" },
        { key: "period_name", label: "Période" },
        { key: "gross_pay", label: "Brut ($)" },
        { key: "federal_tax", label: "Impôt fédéral ($)" },
        { key: "quebec_tax", label: "Impôt QC ($)" },
        { key: "rrq", label: "RRQ ($)" },
        { key: "ei", label: "AE ($)" },
        { key: "rqap", label: "RQAP ($)" },
        { key: "disability_insurance", label: "Assurance invalidité ($)" },
        { key: "deductions_total", label: "Total déductions ($)" },
        { key: "net_pay", label: "Net à payer ($)" },
        { key: "payment_method", label: "Méthode paiement" },
        { key: "paid_at", label: "Date paiement" },
      ]);
      toast.success("Export CSV téléchargé");
    } catch (e: any) {
      toast.error(`Erreur export: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1" onClick={handleExport} disabled={loading}>
      <Download className="h-3.5 w-3.5" />
      {loading ? "Export…" : label}
    </Button>
  );
}
