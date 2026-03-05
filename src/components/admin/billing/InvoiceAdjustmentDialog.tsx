/**
 * Invoice Adjustment Dialog - Admin tool to add charge/credit lines to an existing invoice
 * Recalculates totals and optionally regenerates PDF + notifies client
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Loader2, FileText, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdjustmentLine {
  type: "charge" | "credit";
  description: string;
  amount: number;
}

interface InvoiceAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any; // BillingInvoice
}

export function InvoiceAdjustmentDialog({ open, onOpenChange, invoice }: InvoiceAdjustmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<AdjustmentLine[]>([{ type: "charge", description: "", amount: 0 }]);
  const [reason, setReason] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addLine = () => setLines([...lines, { type: "charge", description: "", amount: 0 }]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof AdjustmentLine, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const netAdjustment = lines.reduce((sum, l) => {
    return sum + (l.type === "charge" ? l.amount : -l.amount);
  }, 0);

  const newSubtotal = Number(invoice?.subtotal || 0) + netAdjustment;
  const taxRate = 0.14975; // TPS 5% + TVQ 9.975%
  const newTps = newSubtotal * 0.05;
  const newTvq = newSubtotal * 0.09975;
  const newTotal = newSubtotal + newTps + newTvq;
  const newBalanceDue = Math.max(0, newTotal - Number(invoice?.amount_paid || 0));

  const handleSubmit = async () => {
    if (!invoice?.id) return;
    const validLines = lines.filter(l => l.description.trim() && l.amount > 0);
    if (validLines.length === 0) {
      toast({ title: "Erreur", description: "Ajoutez au moins une ligne valide.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert adjustment lines into billing_invoice_lines
      const lineInserts = validLines.map(l => ({
        invoice_id: invoice.id,
        description: `${l.type === "credit" ? "[CRÉDIT] " : ""}${l.description}`,
        quantity: 1,
        unit_price: l.type === "credit" ? -l.amount : l.amount,
        line_total: l.type === "credit" ? -l.amount : l.amount,
      }));

      const { error: linesError } = await supabase
        .from("billing_invoice_lines")
        .insert(lineInserts);
      if (linesError) throw linesError;

      // 2. Update invoice totals
      const { error: updateError } = await supabase
        .from("billing_invoices")
        .update({
          subtotal: newSubtotal,
          tps_amount: newTps,
          tvq_amount: newTvq,
          total: newTotal,
          balance_due: newBalanceDue,
          notes: [invoice.notes, `Ajustement: ${reason || "Correction administrative"}`].filter(Boolean).join(" | "),
        })
        .eq("id", invoice.id);
      if (updateError) throw updateError;

      // 3. Notify client via email queue (if enabled)
      if (notifyClient && invoice.customer?.email) {
        await supabase.from("email_queue").insert({
          to_email: invoice.customer.email,
          to_name: `${invoice.customer.first_name || ""} ${invoice.customer.last_name || ""}`.trim(),
          subject: `Ajustement de facture ${invoice.invoice_number}`,
          template_key: "invoice_adjustment",
          template_data: {
            invoice_number: invoice.invoice_number,
            adjustment_lines: validLines,
            net_adjustment: netAdjustment,
            new_total: newTotal,
            new_balance_due: newBalanceDue,
            reason: reason || "Correction administrative",
          },
          priority: "normal",
          event_key: `adj-${invoice.id}-${Date.now()}`,
        });
      }

      // 4. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-invoice", invoice.id] });

      toast({ title: "Ajustement appliqué", description: `${validLines.length} ligne(s) ajoutée(s) à la facture ${invoice.invoice_number}` });
      onOpenChange(false);
      setLines([{ type: "charge", description: "", amount: 0 }]);
      setReason("");
    } catch (error: any) {
      console.error("Adjustment error:", error);
      toast({ title: "Erreur", description: error.message || "Impossible d'appliquer l'ajustement", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoice) return null;

  const cad = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Ajustement — {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current state */}
          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
            <span className="text-muted-foreground">Totaux actuels</span>
            <div className="text-right">
              <div>Sous-total: <strong>{cad(Number(invoice.subtotal || 0))}</strong></div>
              <div>Total: <strong>{cad(Number(invoice.total || 0))}</strong></div>
              <div>Solde dû: <strong>{cad(Number(invoice.balance_due || 0))}</strong></div>
            </div>
          </div>

          <Separator />

          {/* Adjustment lines */}
          <div className="space-y-3">
            <Label className="font-semibold">Lignes d'ajustement</Label>
            {lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="w-28">
                  <Select value={line.type} onValueChange={(v) => updateLine(idx, "type", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="charge">
                        <span className="flex items-center gap-1"><Plus className="w-3 h-3 text-red-500" /> Charge</span>
                      </SelectItem>
                      <SelectItem value="credit">
                        <span className="flex items-center gap-1"><Minus className="w-3 h-3 text-emerald-500" /> Crédit</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={line.amount || ""}
                    onChange={(e) => updateLine(idx, "amount", parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                {lines.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => removeLine(idx)}>×</Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLine} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
            </Button>
          </div>

          {/* Net impact */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Ajustement net</span>
              <Badge className={netAdjustment >= 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                {netAdjustment >= 0 ? "+" : ""}{cad(netAdjustment)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Nouveau sous-total</span>
              <strong>{cad(newSubtotal)}</strong>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TPS (5%)</span>
              <span>{cad(newTps)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVQ (9,975%)</span>
              <span>{cad(newTvq)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Nouveau total</span>
              <span>{cad(newTotal)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Nouveau solde dû</span>
              <span className={newBalanceDue > 0 ? "text-amber-600" : "text-emerald-600"}>{cad(newBalanceDue)}</span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label>Raison de l'ajustement</Label>
            <Textarea
              placeholder="Ex: Crédit goodwill suite à interruption de service"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Notify */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={notifyClient}
              onChange={(e) => setNotifyClient(e.target.checked)}
              className="rounded"
            />
            <Mail className="w-4 h-4 text-muted-foreground" />
            Envoyer un email au client
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Appliquer l'ajustement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
