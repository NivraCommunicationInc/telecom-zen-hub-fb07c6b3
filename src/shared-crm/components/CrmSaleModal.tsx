/**
 * CrmSaleModal — Integrated sale flow opened when CRM agent picks "Vendu".
 * 5 tabs : Client · Forfait · Équipement · Installation · Récap+Confirmation.
 * Calls edge function `crm-create-sale` which generates the order + commission.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, User, Package, Wrench, Calendar, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { CrmContact } from "../lib/crmTypes";

interface Service { id: string; name: string; price: number; category: string }
interface EquipLine { key: string; name: string; price: number; selected: boolean; quantity: number }

const DEFAULT_EQUIPMENT: EquipLine[] = [
  { key: "router",   name: "Borne WiFi",      price: 60, selected: false, quantity: 1 },
  { key: "terminal", name: "Terminal TV",     price: 50, selected: false, quantity: 1 },
  { key: "sim",      name: "Carte SIM",       price: 30, selected: false, quantity: 1 },
];

const SLOTS = [
  { key: "morning",   label: "Matin (8h - 12h)" },
  { key: "afternoon", label: "Après-midi (12h - 17h)" },
  { key: "evening",   label: "Soir (17h - 20h)" },
] as const;

function minInstallDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CrmSaleModal({ contact, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState("client");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ order: string; commission: number } | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [dob, setDob]             = useState("");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [postal, setPostal]       = useState("");

  const [selectedPlan, setSelectedPlan] = useState<Service | null>(null);
  const [equipment, setEquipment]       = useState<EquipLine[]>(DEFAULT_EQUIPMENT);
  const [installDate, setInstallDate]   = useState<string>(minInstallDate());
  const [installSlot, setInstallSlot]   = useState<typeof SLOTS[number]["key"]>("morning");
  const [notes, setNotes]               = useState("");

  // Prefill on contact change
  useEffect(() => {
    if (!contact) return;
    setTab("client");
    setSuccess(null);
    setFirstName(contact.first_name ?? "");
    setLastName(contact.last_name ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setDob(contact.date_of_birth ?? "");
    setAddress(contact.service_address ?? contact.address ?? "");
    setCity(contact.service_city ?? contact.city ?? "");
    setPostal(contact.service_postal_code ?? contact.postal_code ?? "");
    setSelectedPlan(null);
    setEquipment(DEFAULT_EQUIPMENT.map(e => ({ ...e })));
    setInstallDate(minInstallDate());
    setInstallSlot("morning");
    setNotes("");
  }, [contact?.id]);

  // Load services (plans)
  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["crm-sale-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, category")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("price", { ascending: true });
      return (data ?? []) as Service[];
    },
  });

  const selectedEquipment = useMemo(() => equipment.filter(e => e.selected), [equipment]);
  const equipmentTotal    = selectedEquipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const monthly           = selectedPlan?.price ?? 0;
  const subtotal          = monthly + equipmentTotal;
  const tps               = +(subtotal * 0.05).toFixed(2);
  const tvq               = +(subtotal * 0.09975).toFixed(2);
  const total             = +(subtotal + tps + tvq).toFixed(2);
  const commissionEst     = +(monthly * 0.30 + equipmentTotal * 0.05).toFixed(2);

  const canSubmit = !!selectedPlan && !!firstName && !!lastName && !!email && !!installDate;

  const handleSubmit = async () => {
    if (!contact || !selectedPlan) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-create-sale", {
        body: {
          contact_id: contact.id,
          client: {
            first_name: firstName, last_name: lastName, email, phone,
            date_of_birth: dob || undefined,
            service_address: address, service_city: city, service_postal_code: postal,
          },
          plan: { service_id: selectedPlan.id, name: selectedPlan.name, monthly_price: selectedPlan.price, category: selectedPlan.category },
          equipment: selectedEquipment.map(e => ({ name: e.name, price: e.price, quantity: e.quantity })),
          install: { date: installDate, slot: installSlot },
          notes,
        },
      });
      if (error || (data as any)?.error) {
        toast.error(`Erreur: ${(data as any)?.error ?? error?.message}`);
        return;
      }
      const r = data as { order_number: string; commission_estimate: number };
      setSuccess({ order: r.order_number, commission: r.commission_estimate });
      toast.success(`Vente complétée! Commission: ${r.commission_estimate.toFixed(2)}$`);
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la création de la vente");
    } finally {
      setSubmitting(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!w-[min(96vw,52rem)] max-w-none p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Vente CRM — {contact.first_name} {contact.last_name}</DialogTitle>
          <DialogDescription>Complétez les étapes pour finaliser la vente OneView CS.</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h3 className="text-xl font-bold">Vente complétée!</h3>
            <p className="text-sm text-muted-foreground">Commande <span className="font-mono font-semibold">{success.order}</span></p>
            <p className="text-sm">Commission estimée : <span className="font-bold text-emerald-500">{success.commission.toFixed(2)} $</span></p>
            <Button onClick={onClose} className="mt-3">Fermer</Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-5 mx-4 mt-3">
              <TabsTrigger value="client"><User className="h-3.5 w-3.5 mr-1" />Client</TabsTrigger>
              <TabsTrigger value="plan" disabled={!firstName || !lastName || !email}><Package className="h-3.5 w-3.5 mr-1" />Forfait</TabsTrigger>
              <TabsTrigger value="equipment" disabled={!selectedPlan}><Wrench className="h-3.5 w-3.5 mr-1" />Équip.</TabsTrigger>
              <TabsTrigger value="install" disabled={!selectedPlan}><Calendar className="h-3.5 w-3.5 mr-1" />Install</TabsTrigger>
              <TabsTrigger value="recap" disabled={!canSubmit}><Receipt className="h-3.5 w-3.5 mr-1" />Récap</TabsTrigger>
            </TabsList>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <TabsContent value="client" className="space-y-3 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prénom *</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                  <div><Label>Nom *</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                  <div><Label>Courriel *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div><Label>Téléphone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  <div><Label>Date de naissance</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
                  <div><Label>Code postal</Label><Input value={postal} onChange={e => setPostal(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Adresse de service</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Ville</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setTab("plan")} disabled={!firstName || !lastName || !email}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-2 mt-0">
                {loadingServices ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : services.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucun forfait disponible.</p>
                ) : services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedPlan(s)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPlan?.id === s.id
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border hover:border-violet-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.category}</div>
                      </div>
                      <div className="text-violet-500 font-bold">{Number(s.price).toFixed(2)} $/mois</div>
                    </div>
                  </button>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("client")}>Retour</Button>
                  <Button onClick={() => setTab("equipment")} disabled={!selectedPlan}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-2 mt-0">
                <p className="text-xs text-muted-foreground">Équipement requis (sélectionnez ce que le client commande).</p>
                {equipment.map((e, idx) => (
                  <div key={e.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.selected}
                        onChange={(ev) => setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, selected: ev.target.checked } : x))}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-sm">{e.name}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {e.selected && (
                        <Input
                          type="number" min={1} max={4}
                          value={e.quantity}
                          onChange={(ev) => setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, +ev.target.value) } : x))}
                          className="w-16 h-8"
                        />
                      )}
                      <span className="text-sm font-semibold w-20 text-right">{(e.price * e.quantity).toFixed(2)} $</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("plan")}>Retour</Button>
                  <Button onClick={() => setTab("install")}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="install" className="space-y-3 mt-0">
                <div>
                  <Label>Date d'installation (minimum 2 jours)</Label>
                  <Input type="date" min={minInstallDate()} value={installDate} onChange={e => setInstallDate(e.target.value)} />
                </div>
                <div>
                  <Label>Plage horaire</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {SLOTS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setInstallSlot(s.key)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                          installSlot === s.key ? "border-violet-500 bg-violet-500/10 text-violet-500" : "border-border hover:border-violet-500/50"
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Notes (optionnel)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions spéciales, codes d'accès, etc." rows={2} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("equipment")}>Retour</Button>
                  <Button onClick={() => setTab("recap")} disabled={!canSubmit}>Voir récapitulatif</Button>
                </div>
              </TabsContent>

              <TabsContent value="recap" className="space-y-3 mt-0">
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  <div className="font-semibold">Client</div>
                  <div className="text-xs text-muted-foreground">{firstName} {lastName} · {email} · {phone}</div>
                  <div className="text-xs text-muted-foreground">{address}, {city} {postal}</div>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Forfait : {selectedPlan?.name}</span><span className="font-semibold">{monthly.toFixed(2)} $/mois</span></div>
                  {selectedEquipment.map(e => (
                    <div key={e.key} className="flex justify-between text-xs text-muted-foreground">
                      <span>{e.name} × {e.quantity}</span><span>{(e.price * e.quantity).toFixed(2)} $</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-border"><span>Sous-total</span><span>{subtotal.toFixed(2)} $</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>TPS (5%)</span><span>{tps.toFixed(2)} $</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>TVQ (9.975%)</span><span>{tvq.toFixed(2)} $</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>Total</span><span className="text-violet-500">{total.toFixed(2)} $</span></div>
                </div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-500 font-medium">💰 Votre commission estimée</span>
                    <span className="text-emerald-500 font-bold">{commissionEst.toFixed(2)} $</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">30% du forfait mensuel + 5% de l'équipement</p>
                </div>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  📋 La commande sera créée avec statut <strong>pending payment</strong>.
                  Le lien de paiement PayPal sera envoyé au client par courriel pour finaliser.
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("install")} disabled={submitting}>Retour</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="bg-emerald-600 hover:bg-emerald-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Confirmer la vente
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
