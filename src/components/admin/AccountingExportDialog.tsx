/**
 * Accounting Export Dialog
 * Allows exporting billing data with date filters
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileDown, Loader2, DollarSign, Receipt, Calculator } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { 
  exportInvoicesToCSV, 
  generateAccountingSummary,
  type ExportableInvoice 
} from "@/lib/accountingExport";

interface AccountingExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingData?: any[]; // Optional pre-loaded data
}

type DatePreset = "this_month" | "last_month" | "last_3_months" | "custom";

export function AccountingExportDialog({ open, onOpenChange, billingData }: AccountingExportDialogProps) {
  const { toast } = useToast();
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState<string[]>(["paid"]);
  const [isExporting, setIsExporting] = useState(false);

  // Update dates based on preset
  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    
    switch (preset) {
      case "this_month":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
      case "last_3_months":
        setStartDate(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case "custom":
        // Keep current dates
        break;
    }
  };

  // Fetch invoices for preview
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["accounting-export-preview", startDate, endDate, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("billing")
        .select("id, invoice_number, client_email, amount, subtotal, tps_amount, tvq_amount, status, created_at, paid_at, payment_method_type, payment_reference, due_date, notes")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`)
        .order("created_at", { ascending: false });
      
      if (statusFilter.length > 0) {
        query = query.in("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ExportableInvoice[];
    },
    enabled: open,
  });

  const summary = invoices ? generateAccountingSummary(invoices) : null;

  const handleExport = async () => {
    if (!invoices || invoices.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Il n'y a aucune facture à exporter avec ces filtres.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const filename = `comptabilite-nivra-${startDate}-${endDate}.csv`;
      exportInvoicesToCSV(invoices, { filename });
      
      toast({
        title: "Export réussi",
        description: `${invoices.length} factures exportées vers ${filename}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter les données. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Export Comptable
          </DialogTitle>
          <DialogDescription>
            Exportez les factures au format CSV pour votre comptabilité
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date Presets */}
          <div className="space-y-2">
            <Label>Période</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "this_month" as const, label: "Ce mois" },
                { value: "last_month" as const, label: "Mois dernier" },
                { value: "last_3_months" as const, label: "3 derniers mois" },
                { value: "custom" as const, label: "Personnalisé" },
              ].map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {datePreset === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Date début</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Date fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>Statuts à inclure</Label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "paid", label: "Payé" },
                { value: "pending", label: "En attente" },
                { value: "overdue", label: "Renouvellement requis" },
                { value: "void", label: "Annulé (non-renouvellement)" },
                { value: "refunded", label: "Remboursé" },
              ].map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={statusFilter.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <label
                    htmlFor={`status-${status.value}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Preview */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : summary && invoices ? (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Factures:</span>
                    <span className="font-medium">{invoices.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{summary.totalRevenue.toFixed(2)} $</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">TPS:</span>
                    <span className="font-medium">{summary.totalTPS.toFixed(2)} $</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">TVQ:</span>
                    <span className="font-medium">{summary.totalTVQ.toFixed(2)} $</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || isLoading || !invoices?.length}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Export...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Exporter CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
