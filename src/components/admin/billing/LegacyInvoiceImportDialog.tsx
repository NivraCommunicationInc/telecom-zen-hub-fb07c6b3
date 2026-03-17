/**
 * Import factures legacy (table billing) vers billing_invoices (V2)
 * 
 * ⚠️ MIGRATION-ONLY TOOL — This dialog reads from the legacy `billing` table
 * exclusively for one-time data migration purposes. It has ZERO impact on
 * live business operations. It writes ONLY to canonical billing_invoices.
 * Once all legacy data is migrated, this component should be deleted.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { estimateTaxes } from "@/lib/pricing/serverTaxEngine";

interface LegacyInvoice {
  id: string;
  invoice_number: string;
  user_id: string;
  amount: number;
  subtotal: number | null;
  tps_amount: number | null;
  tvq_amount: number | null;
  status: string;
  created_at: string;
  due_date: string | null;
  notes: string | null;
  payment_method_type: string | null;
  profile?: {
    email: string;
    full_name: string;
    phone: string | null;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegacyInvoiceImportDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number } | null>(null);

  // Fetch legacy invoices not yet imported
  const { data: legacyInvoices, isLoading, refetch } = useQuery({
    queryKey: ["legacy-invoices-for-import"],
    queryFn: async () => {
      // Get existing V2 invoice numbers to exclude
      const { data: existingV2 } = await supabase
        .from("billing_invoices")
        .select("invoice_number");
      
      const existingNumbers = new Set(existingV2?.map(i => i.invoice_number) || []);

      // Get legacy invoices with profile info
      const { data, error } = await supabase
        .from("billing")
        .select(`
          id,
          invoice_number,
          user_id,
          amount,
          subtotal,
          tps_amount,
          tvq_amount,
          status,
          created_at,
          due_date,
          notes,
          payment_method_type
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Filter out already imported
      const notImported = (data || []).filter(
        inv => !existingNumbers.has(inv.invoice_number)
      );

      // Fetch profiles for these users
      const userIds = [...new Set(notImported.map(i => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return notImported.map(inv => ({
        ...inv,
        profile: profileMap.get(inv.user_id)
      })) as LegacyInvoice[];
    },
    enabled: open,
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === legacyInvoices?.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(legacyInvoices?.map(i => i.id) || []));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;

    setImporting(true);
    setImportResults(null);
    let success = 0;
    let failed = 0;

    const selected = legacyInvoices?.filter(i => selectedIds.has(i.id)) || [];

    for (const inv of selected) {
      try {
        const profile = inv.profile;
        if (!profile?.email) {
          failed++;
          continue;
        }

        // 1. Upsert billing_customer
        const nameParts = (profile.full_name || "Client").split(" ");
        const firstName = nameParts[0] || "Client";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: existingCustomer } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("email", profile.email)
          .maybeSingle();

        let customerId: string;

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: custError } = await supabase
            .from("billing_customers")
            .insert({
              user_id: inv.user_id,
              first_name: firstName,
              last_name: lastName,
              email: profile.email,
              phone: profile.phone || "N/A",
              status: "active",
            })
            .select("id")
            .single();

          if (custError) throw custError;
          customerId = newCustomer.id;
        }

        // 2. Calculate amounts (preview only — canonical totals come from RPC)
        const subtotal = inv.subtotal || inv.amount / 1.14975;
        const tps = Math.round(subtotal * BILLING_TAX_RATES.TPS * 100) / 100;
        const tvq = Math.round(subtotal * BILLING_TAX_RATES.TVQ * 100) / 100;
        const totals = { subtotal, tps, tvq, total: Math.round((subtotal + tps + tvq) * 100) / 100 };

        // 3. Map status
        let v2Status: "draft" | "pending" | "paid" | "failed" | "cancelled" | "refunded" = "pending";
        if (inv.status === "paid" || inv.status === "captured") v2Status = "paid";
        else if (inv.status === "cancelled") v2Status = "cancelled";
        else if (inv.status === "failed") v2Status = "failed";

        // 4. Create invoice
        const cycleStart = new Date(inv.created_at);
        const cycleEnd = new Date(cycleStart);
        cycleEnd.setDate(cycleEnd.getDate() + 30);
        const dueDate = inv.due_date ? new Date(inv.due_date) : cycleEnd;

        const { data: newInvoice, error: invError } = await supabase
          .from("billing_invoices")
          .insert({
            customer_id: customerId,
            invoice_number: inv.invoice_number,
            type: "initial",
            subtotal: totals.subtotal,
            tps_amount: totals.tps,
            tvq_amount: totals.tvq,
            total: totals.total,
            currency: "CAD",
            payment_method: "interac",
            status: v2Status,
            cycle_start_date: cycleStart.toISOString().split("T")[0],
            cycle_end_date: cycleEnd.toISOString().split("T")[0],
            due_date: dueDate.toISOString().split("T")[0],
            notes: inv.notes,
            paid_at: v2Status === "paid" ? new Date().toISOString() : null,
          })
          .select("id")
          .single();

        if (invError) throw invError;

        // 5. Create invoice line
        await supabase.from("billing_invoice_lines").insert({
          invoice_id: newInvoice.id,
          description: `Importé depuis facturation legacy - ${inv.invoice_number}`,
          unit_price: totals.subtotal,
          quantity: 1,
          line_total: totals.subtotal,
        });

        success++;
      } catch (err) {
        console.error("Import error for", inv.invoice_number, err);
        failed++;
      }
    }

    setImportResults({ success, failed });
    setImporting(false);
    setSelectedIds(new Set());

    if (success > 0) {
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-customers"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      refetch();
    }

    toast({
      title: "Import terminé",
      description: `${success} facture(s) importée(s), ${failed} échec(s)`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Importer depuis Facturation Legacy
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les factures à téléporter vers Facturation V2
          </DialogDescription>
        </DialogHeader>

        {importResults && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            {importResults.failed === 0 ? (
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <span>
              {importResults.success} importée(s), {importResults.failed} échec(s)
            </span>
          </div>
        )}

        <ScrollArea className="h-[400px] border rounded-lg">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : !legacyInvoices?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-4 text-emerald-500" />
              <p>Toutes les factures ont déjà été importées!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">
                    <Checkbox
                      checked={selectedIds.size === legacyInvoices.length}
                      onCheckedChange={selectAll}
                    />
                  </th>
                  <th className="p-2 text-left">Facture</th>
                  <th className="p-2 text-left">Client</th>
                  <th className="p-2 text-left">Montant</th>
                  <th className="p-2 text-left">Statut</th>
                  <th className="p-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {legacyInvoices.map((inv) => {
                  const isPaid = inv.status === "paid" || inv.status === "captured";
                  const isPending = inv.status === "pending";
                  return (
                    <tr
                      key={inv.id}
                      className={`border-b hover:bg-muted/30 cursor-pointer ${
                        selectedIds.has(inv.id) ? "bg-accent/30" : ""
                      }`}
                      onClick={() => toggleSelect(inv.id)}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={selectedIds.has(inv.id)}
                          onCheckedChange={() => toggleSelect(inv.id)}
                        />
                      </td>
                      <td className="p-2 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="p-2">
                        <div className="font-medium">{inv.profile?.full_name || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">{inv.profile?.email}</div>
                      </td>
                      <td className="p-2 font-semibold">{formatCurrency(inv.amount)}</td>
                      <td className="p-2">
                        <Badge
                          variant={
                            isPaid
                              ? "default"
                              : isPending
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">
                        {format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} sélectionnée(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importing}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importer {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
