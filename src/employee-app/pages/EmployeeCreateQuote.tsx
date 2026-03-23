/**
 * Employee Create Quote — Multi-step quote builder.
 * Steps: 1. Select Client  2. Add Services  3. Adjustments & Notes  4. Review & Submit
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { createQuoteDraft, addQuoteLine, addQuoteAdjustment, updateQuoteStatus } from "@/shared-ops/quoteOperations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Search, User, ShoppingCart, MessageSquare, Eye } from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export default function EmployeeCreateQuote() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Client
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Step 2: Lines
  const [lines, setLines] = useState<Array<{
    service_id?: string;
    line_type: string;
    label: string;
    quantity: number;
    unit_price: number;
    billing_frequency: string;
  }>>([]);

  // Step 3: Notes & adjustments
  const [clientNote, setClientNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [validDays, setValidDays] = useState("30");
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [adjustments, setAdjustments] = useState<Array<{ label: string; amount: number; type: "discount" | "credit" }>>([]);

  // Client search
  const { data: clients } = useQuery({
    queryKey: ["employee-quote-client-search", clientSearch],
    enabled: clientSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .or(`full_name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%,phone.ilike.%${clientSearch}%`)
        .limit(10);
      return data || [];
    },
  });

  // Service catalog
  const { data: services } = useQuery({
    queryKey: ["quote-service-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, category, is_active")
        .eq("is_active", true)
        .order("category");
      return data || [];
    },
  });

  // Add catalog service
  const addCatalogService = (service: any) => {
    setLines(prev => [...prev, {
      service_id: service.id,
      line_type: "catalog_service",
      label: service.name,
      quantity: 1,
      unit_price: service.price || 0,
      billing_frequency: ["Équipement", "Frais"].some(c => service.category?.includes(c)) ? "one_time" : "monthly",
    }]);
  };

  // Add manual fee
  const addManualFee = () => {
    setLines(prev => [...prev, {
      line_type: "manual_fee",
      label: "",
      quantity: 1,
      unit_price: 0,
      billing_frequency: "one_time",
    }]);
  };

  const removeLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: string, value: any) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  // Totals preview
  const oneTimeTotal = lines.filter(l => l.billing_frequency === "one_time").reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const monthlyTotal = lines.filter(l => l.billing_frequency === "monthly").reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const adjTotal = adjustments.reduce((s, a) => s + a.amount, 0);

  const addAdjustment = () => {
    if (!discountLabel || !discountAmount) return;
    setAdjustments(prev => [...prev, { label: discountLabel, amount: parseFloat(discountAmount), type: "discount" }]);
    setDiscountLabel("");
    setDiscountAmount("");
  };

  // Submit
  const handleSubmit = async (asDraft: boolean) => {
    if (!selectedClient) return;
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const validUntil = validDays ? new Date(Date.now() + parseInt(validDays) * 86400000).toISOString() : undefined;

      // 1. Create draft
      const quote = await createQuoteDraft({
        customerUserId: selectedClient.user_id,
        sourcePortal: "employee",
        createdByUserId: session.user.id,
        clientNote: clientNote || undefined,
        internalNote: internalNote || undefined,
        validUntil,
      });

      // 2. Add lines
      for (const line of lines) {
        await addQuoteLine(quote.id, {
          service_id: line.service_id || null,
          line_type: line.line_type as any,
          label: line.label,
          quantity: line.quantity,
          unit_price: line.unit_price,
          billing_frequency: line.billing_frequency as any,
        });
      }

      // 3. Add adjustments
      for (const adj of adjustments) {
        await addQuoteAdjustment(quote.id, {
          adjustment_type: adj.type,
          label: adj.label,
          amount: adj.amount,
          source: "employee_proposed",
          requires_approval: true,
        }, session.user.id);
      }

      // 4. If not draft, submit for review
      if (!asDraft) {
        await updateQuoteStatus(quote.id, "pending_review", session.user.id, "employee", "Soumise pour approbation");
      }

      queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
      toast.success(asDraft ? "Brouillon sauvegardé" : "Soumission envoyée pour approbation");
      navigate(employeePath(`/quotes/${quote.id}`));
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(employeePath("/quotes"))}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h1 className="text-xl font-bold text-foreground">Nouvelle soumission</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, icon: User, label: "Client" },
          { n: 2, icon: ShoppingCart, label: "Services" },
          { n: 3, icon: MessageSquare, label: "Détails" },
          { n: 4, icon: Eye, label: "Révision" },
        ].map(({ n, icon: Icon, label }) => (
          <div key={n} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            step === n ? "bg-primary text-primary-foreground" :
            step > n ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </div>
        ))}
      </div>

      {/* STEP 1: Client */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Sélectionner un client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nom, courriel ou téléphone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {selectedClient ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div>
                  <p className="font-medium">{selectedClient.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedClient.email} · {selectedClient.phone}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>Changer</Button>
              </div>
            ) : (
              <div className="space-y-1">
                {(clients || []).map((c: any) => (
                  <button
                    key={c.user_id}
                    onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-sm">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button disabled={!selectedClient} onClick={() => setStep(2)}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Services */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Services & frais
              <Button variant="outline" size="sm" onClick={addManualFee}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Frais manuel
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Catalog picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Catalogue de services</p>
              <div className="flex flex-wrap gap-1.5">
                {(services || []).map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => addCatalogService(s)}
                    className="px-2.5 py-1 rounded-md border border-border text-xs hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  >
                    {s.name} — {s.price?.toFixed(2)} $
                  </button>
                ))}
              </div>
            </div>

            {/* Selected lines */}
            {lines.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-muted-foreground">Lignes de la soumission</p>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                    {line.line_type === "manual_fee" ? (
                      <Input
                        value={line.label}
                        onChange={(e) => updateLine(idx, "label", e.target.value)}
                        placeholder="Description du frais"
                        className="flex-1 h-8 text-sm"
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium">{line.label}</span>
                    )}
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-16 h-8 text-sm text-center"
                    />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-24 h-8 text-sm text-right"
                    />
                    <span className="text-xs text-muted-foreground">$</span>
                    <Select value={line.billing_frequency} onValueChange={(v) => updateLine(idx, "billing_frequency", v)}>
                      <SelectTrigger className="w-28 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="one_time">Unique</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}

                <div className="flex justify-end gap-4 pt-2 text-sm">
                  <span className="text-muted-foreground">Mensuel: <strong>{monthlyTotal.toFixed(2)} $</strong></span>
                  <span className="text-muted-foreground">Unique: <strong>{oneTimeTotal.toFixed(2)} $</strong></span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button disabled={lines.length === 0} onClick={() => setStep(3)}>
                Suivant <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Adjustments & Notes */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Détails & ajustements</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Note au client</label>
                <Textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)} rows={3} placeholder="Visible par le client..." />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Note interne</label>
                <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={3} placeholder="Visible uniquement en interne..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Validité (jours)</label>
              <Input type="number" value={validDays} onChange={(e) => setValidDays(e.target.value)} className="w-32" />
            </div>

            {/* Adjustments */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Proposer un rabais</p>
              <div className="flex gap-2">
                <Input value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="Label du rabais" className="flex-1" />
                <Input type="number" step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="Montant" className="w-32" />
                <Button variant="outline" onClick={addAdjustment} disabled={!discountLabel || !discountAmount}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {adjustments.map((a, i) => (
                <div key={i} className="flex items-center justify-between mt-2 p-2 rounded border border-border">
                  <span className="text-sm">{a.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">-{a.amount.toFixed(2)} $</Badge>
                    <Badge variant="secondary">Approbation requise</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setAdjustments(prev => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <Button onClick={() => setStep(4)}>
                Réviser <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader><CardTitle>Révision de la soumission</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Client */}
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Client</p>
              <p className="font-medium">{selectedClient?.full_name}</p>
              <p className="text-xs text-muted-foreground">{selectedClient?.email}</p>
            </div>

            {/* Lines summary */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Services</p>
              {lines.map((l, i) => (
                <div key={i} className="flex justify-between py-1 text-sm border-b border-border last:border-0">
                  <span>{l.label} × {l.quantity}</span>
                  <span className="font-medium">
                    {(l.unit_price * l.quantity).toFixed(2)} $ / {l.billing_frequency === "monthly" ? "mois" : "unique"}
                  </span>
                </div>
              ))}
            </div>

            {/* Adjustments */}
            {adjustments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Ajustements proposés</p>
                {adjustments.map((a, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm text-destructive">
                    <span>{a.label}</span>
                    <span>-{a.amount.toFixed(2)} $</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Mensuel</span>
                <span className="font-medium">{monthlyTotal.toFixed(2)} $ /mois</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frais uniques</span>
                <span className="font-medium">{oneTimeTotal.toFixed(2)} $</span>
              </div>
              {adjTotal > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Rabais proposés</span>
                  <span>-{adjTotal.toFixed(2)} $</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                <span>Estimation totale</span>
                <span>{(oneTimeTotal + monthlyTotal - adjTotal).toFixed(2)} $ *</span>
              </div>
              <p className="text-[10px] text-muted-foreground">* Le total final sera recalculé côté serveur avec taxes</p>
            </div>

            {clientNote && (
              <div className="p-2 rounded border border-border">
                <p className="text-[10px] text-muted-foreground">Note au client</p>
                <p className="text-sm">{clientNote}</p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Retour
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleSubmit(true)} disabled={isSubmitting}>
                  Sauvegarder brouillon
                </Button>
                <Button onClick={() => handleSubmit(false)} disabled={isSubmitting}>
                  <Check className="h-4 w-4 mr-1" /> Soumettre pour approbation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
