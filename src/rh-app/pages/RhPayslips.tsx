/**
 * RhPayslips — Employee's payslip list (read-only).
 * Queries payroll_entries filtered by auth.uid().
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Download, Eye } from "lucide-react";
import { Loader2 } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  approved: { label: "Approuvé", variant: "default" },
  paid: { label: "Payé", variant: "default" },
  processing: { label: "En traitement", variant: "outline" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

export default function RhPayslips() {
  const { data: payslips, isLoading } = useQuery({
    queryKey: ["rh-payslips"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("payroll_entries")
        .select("*, pay_periods(period_name, start_date, end_date)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleDownload = async (pdfUrl: string, payrollNumber: string) => {
    if (!pdfUrl) return;
    const { data } = await supabase.storage.from("payslips").createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-6 w-6 text-violet-600" />
          Mes fiches de paie
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique complet de vos fiches de paie
        </p>
      </div>

      {!payslips?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune fiche de paie disponible.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {payslips.map((p: any) => {
            const status = STATUS_MAP[p.status] || { label: p.status, variant: "secondary" as const };
            return (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">
                        {p.payroll_number || "—"}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.pay_periods?.period_name || "Période inconnue"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{fmt(Number(p.net_pay))}</p>
                      <p className="text-xs text-muted-foreground">Net</p>
                    </div>
                    {p.pdf_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(p.pdf_url, p.payroll_number)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
