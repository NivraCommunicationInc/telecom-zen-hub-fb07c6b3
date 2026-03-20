/**
 * Création manuelle de facture V2 avec toutes les options
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, UserPlus, User } from "lucide-react";
// ⛔ LOCAL TAX MATH REMOVED — taxes computed by DB trigger trg_05_invoice_math_from_subtotal
import type { BillingCustomer, BillingInvoiceType, BillingInvoiceStatus, BillingPaymentMethod } from "@/lib/billing/types";

interface InvoiceLine {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Customer selection mode
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  // New customer fields
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // Invoice fields
  const [invoiceType, setInvoiceType] = useState<BillingInvoiceType>("initial");
  const [invoiceStatus, setInvoiceStatus] = useState<BillingInvoiceStatus>("pending");
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod>("interac");
  const [cycleStartDate, setCycleStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [cycleEndDate, setCycleEndDate] = useState(() => {
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return end.toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState(() => {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    return due.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [includeActivationFee, setIncludeActivationFee] = useState(false);
  const [activationFeeAmount, setActivationFeeAmount] = useState(25);

  // Invoice lines
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: crypto.randomUUID(), description: "", unitPrice: 0, quantity: 1 },
  ]);

  // Fetch existing customers
  const { data: customers } = useQuery({
    queryKey: ["billing-customers-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("status", "active")
        .order("last_name");
      if (error) throw error;
      return data as BillingCustomer[];
    },
    enabled: open,
  });

  // Calculate totals inline (preview only — canonical totals come from RPC after insert)
  const linesSubtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const activationFee = includeActivationFee ? activationFeeAmount : 0;
  const subtotal = linesSubtotal + activationFee;
  const { tps, tvq, total } = estimateTaxes(subtotal);
  const totals = { subtotal, tps, tvq, total };

  // Add line
  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), description: "", unitPrice: 0, quantity: 1 }]);
  };

  // Remove line
  const removeLine = (id: string) => {
    if (lines.length > 1) {
      setLines(lines.filter((l) => l.id !== id));
    }
  };

  // Update line
  const updateLine = (id: string, field: keyof InvoiceLine, value: string | number) => {
    setLines(
      lines.map((l) =>
        l.id === id ? { ...l, [field]: field === "description" ? value : Number(value) } : l
      )
    );
  };

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      let customerId = selectedCustomerId;

      // Create new customer if needed
      if (customerMode === "new") {
        if (!newCustomer.email || !newCustomer.firstName) {
          throw new Error("Email et prénom requis pour un nouveau client");
        }

        const { data: newCust, error: custError } = await supabase
          .from("billing_customers")
          .insert({
            first_name: newCustomer.firstName,
            last_name: newCustomer.lastName,
            email: newCustomer.email,
            phone: newCustomer.phone || "N/A",
            status: "active",
          })
          .select("id")
          .single();

        if (custError) throw custError;
        customerId = newCust.id;
      }

      if (!customerId) {
        throw new Error("Veuillez sélectionner ou créer un client");
      }

      // Generate invoice number
      const { data: invoiceNum } = await supabase.rpc("generate_billing_invoice_number");
      const invoiceNumber = invoiceNum || `INV-${Date.now()}`;

      // Create invoice
      const { data: invoice, error: invError } = await supabase
        .from("billing_invoices")
        .insert({
          customer_id: customerId,
          invoice_number: invoiceNumber,
          type: invoiceType,
          subtotal: totals.subtotal,
          tps_amount: totals.tps,
          tvq_amount: totals.tvq,
          total: totals.total,
          activation_fee: activationFee > 0 ? activationFee : null,
          currency: "CAD",
          payment_method: paymentMethod,
          status: invoiceStatus,
          cycle_start_date: cycleStartDate,
          cycle_end_date: cycleEndDate,
          due_date: dueDate,
          notes: notes || null,
          paid_at: invoiceStatus === "paid" ? new Date().toISOString() : null,
        })
        .select("id, invoice_number")
        .single();

      if (invError) throw invError;

      // Create invoice lines
      const lineInserts = lines
        .filter((l) => l.description && l.unitPrice > 0)
        .map((l) => ({
          invoice_id: invoice.id,
          description: l.description,
          unit_price: l.unitPrice,
          quantity: l.quantity,
          line_total: l.unitPrice * l.quantity,
          line_type: 'service',
        }));

      // Add activation fee as a line if applicable
      if (activationFee > 0) {
        lineInserts.push({
          invoice_id: invoice.id,
          description: "Frais d'activation",
          unit_price: activationFee,
          quantity: 1,
          line_total: activationFee,
          line_type: 'fee',
        });
      }

      if (lineInserts.length > 0) {
        const { error: linesError } = await supabase
          .from("billing_invoice_lines")
          .insert(lineInserts);
        if (linesError) throw linesError;
      }

      return invoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-customers"] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });

      toast({
        title: "Facture créée",
        description: `Facture ${data.invoice_number} créée avec succès`,
      });

      // Reset form
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la création",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCustomerMode("existing");
    setSelectedCustomerId("");
    setNewCustomer({ firstName: "", lastName: "", email: "", phone: "" });
    setInvoiceType("initial");
    setInvoiceStatus("pending");
    setPaymentMethod("interac");
    setCycleStartDate(new Date().toISOString().split("T")[0]);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    setCycleEndDate(end.toISOString().split("T")[0]);
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setDueDate(due.toISOString().split("T")[0]);
    setNotes("");
    setIncludeActivationFee(false);
    setActivationFeeAmount(25);
    setLines([{ id: crypto.randomUUID(), description: "", unitPrice: 0, quantity: 1 }]);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Créer une facture manuelle
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Customer Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Client
              </h3>

              <Tabs value={customerMode} onValueChange={(v) => setCustomerMode(v as "existing" | "new")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Client existant</TabsTrigger>
                  <TabsTrigger value="new">Nouveau client</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-4">
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name} — {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="new" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prénom *</Label>
                      <Input
                        value={newCustomer.firstName}
                        onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                        placeholder="Jean"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input
                        value={newCustomer.lastName}
                        onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                        placeholder="Tremblay"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={newCustomer.email}
                        onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                        placeholder="jean@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input
                        value={newCustomer.phone}
                        onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                        placeholder="514-555-1234"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <Separator />

            {/* Invoice Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">Détails de la facture</h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as BillingInvoiceType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Initiale</SelectItem>
                      <SelectItem value="renewal">Renouvellement</SelectItem>
                      <SelectItem value="adjustment">Ajustement</SelectItem>
                      <SelectItem value="credit">Crédit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={invoiceStatus} onValueChange={(v) => setInvoiceStatus(v as BillingInvoiceStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                      <SelectItem value="cancelled">Annulée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Méthode de paiement</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as BillingPaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interac">Interac</SelectItem>
                      <SelectItem value="manual">Manuel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Début du cycle</Label>
                  <Input
                    type="date"
                    value={cycleStartDate}
                    onChange={(e) => setCycleStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fin du cycle</Label>
                  <Input
                    type="date"
                    value={cycleEndDate}
                    onChange={(e) => setCycleEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="activation"
                    checked={includeActivationFee}
                    onCheckedChange={(checked) => setIncludeActivationFee(!!checked)}
                  />
                  <Label htmlFor="activation">Inclure frais d'activation</Label>
                </div>
                {includeActivationFee && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={activationFeeAmount}
                      onChange={(e) => setActivationFeeAmount(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">$</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Invoice Lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Lignes de facture</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 space-y-1">
                      {index === 0 && <Label className="text-xs">Description</Label>}
                      <Input
                        placeholder="Description du service..."
                        value={line.description}
                        onChange={(e) => updateLine(line.id, "description", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {index === 0 && <Label className="text-xs">Prix unit.</Label>}
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={line.unitPrice || ""}
                        onChange={(e) => updateLine(line.id, "unitPrice", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-1">
                      {index === 0 && <Label className="text-xs">Qté</Label>}
                      <Input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 text-right font-medium text-sm py-2">
                      {formatCurrency(line.unitPrice * line.quantity)}
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                placeholder="Notes internes ou instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Totals Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sous-total lignes</span>
                <span>{formatCurrency(linesSubtotal)}</span>
              </div>
              {activationFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Frais d'activation</span>
                  <span>{formatCurrency(activationFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Sous-total</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>TPS (5%)</span>
                <span>{formatCurrency(totals.tps)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>TVQ (9,975%)</span>
                <span>{formatCurrency(totals.tvq)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Créer la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
