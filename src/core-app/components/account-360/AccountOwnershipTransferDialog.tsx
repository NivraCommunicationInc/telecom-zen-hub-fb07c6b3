/**
 * AccountOwnershipTransferDialog — Module 48
 * Admin/supervisor-only wizard to transfer account ownership between two clients.
 * All writes go through `account-transfer-actions` Edge Function (canonical gateway).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  oldClientId: string;
  oldClientName?: string;
  canonicalData?: any;
}

type Step = 1 | 2 | 3 | 4;

interface NewClient {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth?: string;
  address?: string;
}

export function AccountOwnershipTransferDialog({
  open, onClose, accountId, oldClientId, oldClientName, canonicalData,
}: Props) {
  const { isAdmin } = useIsCoreAdmin();
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedNewClient, setSelectedNewClient] = useState<any | null>(null);
  const [newClient, setNewClient] = useState<NewClient>({
    email: "", first_name: "", last_name: "", phone: "",
  });
  const [transferType, setTransferType] = useState<"personal_transfer" | "business_transfer">("personal_transfer");
  const [services, setServices] = useState<Record<string, boolean>>({
    internet: true, tv: true, mobile: true, equipment: true,
  });
  const [billingOption, setBillingOption] = useState<"new_owner_all" | "old_keeps_debt" | "full_transfer">("new_owner_all");
  const [addressOption, setAddressOption] = useState<"keep" | "new">("keep");
  const [reason, setReason] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isAdmin) return null;

  const doSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase.rpc("search_clients_unified", {
        search_email: searchTerm.includes("@") ? searchTerm.trim().toLowerCase() : null,
        search_name: !searchTerm.includes("@") && !/^\d/.test(searchTerm) ? searchTerm.trim().toLowerCase() : null,
        search_phone: /^\d/.test(searchTerm) ? searchTerm.replace(/\D/g, "") : null,
      });
      setSearchResults((data as any[]) ?? []);
    } catch (e: any) {
      toast.error("Recherche impossible: " + e.message);
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    const selectedServices = Object.entries(services).filter(([, v]) => v).map(([k]) => k);
    if (mode === "existing" && !selectedNewClient) {
      toast.error("Sélectionne un client destinataire");
      return;
    }
    if (mode === "new" && (!newClient.email || !newClient.first_name || !newClient.last_name || !newClient.phone)) {
      toast.error("Remplis toutes les infos du nouveau client");
      return;
    }
    setSubmitting(true);
    try {
      const idempotencyKey = `account_transfer:${accountId}:${Date.now()}`;
      const { data, error } = await supabase.functions.invoke("account-transfer-actions", {
        body: {
          action: "create_transfer",
          account_id: accountId,
          old_client_id: oldClientId,
          new_client_id: mode === "existing" ? selectedNewClient?.source_id : null,
          new_client_payload: mode === "new" ? newClient : null,
          transfer_type: transferType,
          services_transferred: selectedServices,
          billing_transfer_option: billingOption,
          equipment_transfer_option: services.equipment ? "transfer_all" : "none",
          service_address_option: addressOption,
          reason: reason || undefined,
          admin_override: adminOverride,
          admin_override_reason: adminOverride ? reason : undefined,
          idempotency_key: idempotencyKey,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("✅ Transfert créé — emails envoyés aux deux parties");
      onClose();
      setStep(1);
    } catch (e: any) {
      toast.error("Échec: " + (e.message ?? String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const invoices = canonicalData?.invoices ?? [];
  const balance = invoices.reduce((s: number, i: any) => s + Number(i.balance_due || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfert de propriété du compte — Étape {step}/4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Chercher ou créer le nouveau propriétaire</p>
            <div className="flex gap-2">
              <Button variant={mode === "existing" ? "default" : "outline"} size="sm" onClick={() => setMode("existing")}>
                <Search className="h-3 w-3 mr-1" /> Client existant
              </Button>
              <Button variant={mode === "new" ? "default" : "outline"} size="sm" onClick={() => setMode("new")}>
                <UserPlus className="h-3 w-3 mr-1" /> Nouveau client
              </Button>
            </div>

            {mode === "existing" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Email, téléphone, nom…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <Button onClick={doSearch} disabled={searching}>
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Chercher"}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {searchResults.map((r) => (
                    <button
                      key={r.source_id + r.source}
                      onClick={() => setSelectedNewClient(r)}
                      className={`w-full text-left p-2 rounded border text-xs ${
                        selectedNewClient?.source_id === r.source_id ? "border-emerald-500 bg-emerald-500/10" : "border-border"
                      }`}
                    >
                      <div className="font-medium">{r.full_name || r.email}</div>
                      <div className="text-muted-foreground">{r.email} · {r.phone} · {r.source}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "new" && (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Prénom" value={newClient.first_name} onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })} />
                <Input placeholder="Nom" value={newClient.last_name} onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })} />
                <Input placeholder="Email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                <Input placeholder="Téléphone" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                <Input placeholder="Date de naissance (YYYY-MM-DD)" value={newClient.date_of_birth ?? ""} onChange={(e) => setNewClient({ ...newClient, date_of_birth: e.target.value })} />
                <Input placeholder="Adresse" value={newClient.address ?? ""} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} className="col-span-2" />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded border border-border">
              <div className="font-semibold mb-1">Compte actuel</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Propriétaire : {oldClientName ?? oldClientId}</div>
                <div>Services actifs : {(canonicalData?.subscriptions ?? []).length}</div>
                <div>Équipements : {(canonicalData?.equipment ?? []).length}</div>
                <div>Factures : {invoices.length} — Balance : {balance.toFixed(2)} $</div>
              </div>
            </div>
            <div className="p-3 rounded border border-border">
              <div className="font-semibold mb-1">Nouveau propriétaire</div>
              <div className="text-xs text-muted-foreground">
                {mode === "existing"
                  ? (selectedNewClient ? `${selectedNewClient.full_name ?? ""} · ${selectedNewClient.email}` : "—")
                  : `${newClient.first_name} ${newClient.last_name} · ${newClient.email}`}
              </div>
            </div>
            {balance > 0 && (
              <div className="p-3 rounded border border-amber-500/40 bg-amber-500/10 text-xs">
                ⚠️ Balance impayée de {balance.toFixed(2)} $. Coche l'override admin à l'étape 4 pour continuer.
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm">
            <div>
              <Label>Type de transfert</Label>
              <RadioGroup value={transferType} onValueChange={(v: any) => setTransferType(v)} className="mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="personal_transfer" id="t1" /><Label htmlFor="t1">Personnel</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="business_transfer" id="t2" /><Label htmlFor="t2">Entreprise</Label></div>
              </RadioGroup>
            </div>

            <div>
              <Label>Services à transférer</Label>
              <div className="mt-1 space-y-1">
                {(["internet", "tv", "mobile", "equipment"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Checkbox checked={services[s]} onCheckedChange={(v) => setServices({ ...services, [s]: Boolean(v) })} id={"s-" + s} />
                    <Label htmlFor={"s-" + s} className="capitalize">{s}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Facturation</Label>
              <RadioGroup value={billingOption} onValueChange={(v: any) => setBillingOption(v)} className="mt-1 space-y-1">
                <div className="flex items-start gap-2"><RadioGroupItem value="new_owner_all" id="b1" /><Label htmlFor="b1">Nouveau propriétaire reprend tout (futur seulement)</Label></div>
                <div className="flex items-start gap-2"><RadioGroupItem value="old_keeps_debt" id="b2" /><Label htmlFor="b2">Ancien garde ses dettes, nouveau commence à zéro</Label></div>
                <div className="flex items-start gap-2"><RadioGroupItem value="full_transfer" id="b3" /><Label htmlFor="b3">Transfert complet (factures + paiements historiques)</Label></div>
              </RadioGroup>
            </div>

            <div>
              <Label>Adresse de service</Label>
              <RadioGroup value={addressOption} onValueChange={(v: any) => setAddressOption(v)} className="mt-1">
                <div className="flex items-center gap-2"><RadioGroupItem value="keep" id="a1" /><Label htmlFor="a1">Garder la même adresse</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="new" id="a2" /><Label htmlFor="a2">Nouvelle adresse (validation ultérieure)</Label></div>
              </RadioGroup>
            </div>

            <div className="text-xs text-muted-foreground p-2 border rounded bg-muted/20">
              ⚠️ Les méthodes de paiement (cartes) ne sont jamais transférées. Le nouveau propriétaire devra en ajouter.
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <Label>Raison / notes (obligatoire si balance impayée)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} />
            {balance > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox checked={adminOverride} onCheckedChange={(v) => setAdminOverride(Boolean(v))} id="ov" />
                <Label htmlFor="ov" className="text-xs">Override admin : accepter le transfert malgré la balance impayée</Label>
              </div>
            )}
            <div className="p-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-xs">
              Un email de consentement sera envoyé à l'ancien et au nouveau propriétaire. Le transfert ne sera exécuté qu'après leurs deux confirmations et une action admin finale.
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)}><ArrowLeft className="h-4 w-4" /></Button>}
          {step < 4 && <Button onClick={() => setStep((s) => (s + 1) as Step)}>Suivant <ArrowRight className="h-4 w-4" /></Button>}
          {step === 4 && (
            <Button onClick={submit} disabled={submitting || (balance > 0 && !adminOverride)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer le transfert"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
