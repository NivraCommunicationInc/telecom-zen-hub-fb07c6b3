/**
 * Module 52 Phase B — Billing address management.
 * Canonical model (order of precedence):
 *   1) accounts.billing_same_as_service = true     → uses primary service address
 *   2) accounts.billing_service_address_id != null → linked to a service address
 *   3) legacy billing_address / billing_city / … columns (fallback only)
 *
 * All writes go through client-account-actions:
 *   - billing_address.set_same_as_service
 *   - billing_address.link_to_service_address
 *   - billing_address.set_custom
 * The new Core UI does NOT reinforce reliance on the legacy columns:
 * it only exposes the canonical modes and treats the legacy row as read-only fallback.
 */
import { useMemo, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { useAccountAddresses } from "@/hooks/useAccountAddresses";

type Mode = "same_as_service" | "linked" | "custom";

interface Props {
  account: any;
  onSaved: () => void;
}

export function ClientBillingAddressSection({ account, onSaved }: Props) {
  const { addresses } = useAccountAddresses(account?.id);

  const initialMode: Mode = account?.billing_same_as_service
    ? "same_as_service"
    : account?.billing_service_address_id
      ? "linked"
      : "custom";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [linkedId, setLinkedId] = useState<string>(account?.billing_service_address_id ?? "");
  const [custom, setCustom] = useState({
    billing_address: account?.billing_address ?? "",
    billing_city: account?.billing_city ?? "",
    billing_province: account?.billing_province ?? "QC",
    billing_postal_code: account?.billing_postal_code ?? "",
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const legacyLine = useMemo(() => {
    return [account?.billing_address, account?.billing_city, account?.billing_province, account?.billing_postal_code]
      .filter(Boolean).join(", ");
  }, [account]);

  const save = async () => {
    if (reason.trim().length < 3) return toast.error("Raison obligatoire (min. 3 caractères)");
    setBusy(true);
    try {
      const correlationId = crypto.randomUUID();
      const baseKey = `billing:${account.id}:${new Date().toISOString().slice(0, 16)}`;

      if (mode === "same_as_service") {
        const res = await callCoreAction("client-account-actions", {
          action: "billing_address.set_same_as_service",
          account_id: account.id,
          payload: {},
          idempotency_key: `${baseKey}:same`,
          correlation_id: correlationId,
        }, { reason, successMessage: "Facturation = adresse de service", errorMessage: "Échec" });
        if (!res.ok) return;
      } else if (mode === "linked") {
        if (!linkedId) return toast.error("Sélectionnez une adresse de service");
        const res = await callCoreAction("client-account-actions", {
          action: "billing_address.link_to_service_address",
          account_id: account.id,
          payload: { service_address_id: linkedId },
          idempotency_key: `${baseKey}:link:${linkedId}`,
          correlation_id: correlationId,
        }, { reason, successMessage: "Facturation liée à une adresse de service", errorMessage: "Échec" });
        if (!res.ok) return;
      } else {
        if (!custom.billing_address.trim() || !custom.billing_city.trim() || !custom.billing_postal_code.trim()) {
          return toast.error("Adresse, ville et code postal requis");
        }
        const res = await callCoreAction("client-account-actions", {
          action: "billing_address.set_custom",
          account_id: account.id,
          payload: custom,
          idempotency_key: `${baseKey}:custom`,
          correlation_id: correlationId,
        }, { reason, successMessage: "Adresse de facturation personnalisée", errorMessage: "Échec" });
        if (!res.ok) return;
      }
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Adresse de facturation</h3>
      </header>

      <div className="rounded-md border border-dashed border-input p-2 text-[11px] text-muted-foreground">
        <div>
          Mode actuel :{" "}
          <span className="font-medium text-foreground">
            {initialMode === "same_as_service" && "Identique à l'adresse de service"}
            {initialMode === "linked" && `Liée à une adresse de service (${account?.billing_service_address_id?.slice(0, 8)}…)`}
            {initialMode === "custom" && "Adresse personnalisée"}
          </span>
        </div>
        {initialMode === "custom" && legacyLine && (
          <div className="mt-1">Valeur legacy : <span className="font-mono">{legacyLine}</span></div>
        )}
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-2">
        <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer">
          <RadioGroupItem value="same_as_service" id="mode-same" />
          <div className="text-[12px]">
            <div className="font-medium">Identique à l'adresse de service principale</div>
            <div className="text-muted-foreground text-[11px]">Recommandé. Aucune donnée dupliquée.</div>
          </div>
        </label>

        <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer">
          <RadioGroupItem value="linked" id="mode-linked" />
          <div className="text-[12px] flex-1 space-y-2">
            <div>
              <div className="font-medium">Liée à une adresse de service existante</div>
              <div className="text-muted-foreground text-[11px]">Utile si le client a plusieurs adresses de service.</div>
            </div>
            {mode === "linked" && (
              <Select value={linkedId} onValueChange={setLinkedId}>
                <SelectTrigger><SelectValue placeholder="Choisir une adresse…" /></SelectTrigger>
                <SelectContent>
                  {addresses.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.address_line}, {a.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </label>

        <label className="flex items-start gap-2 rounded-md border border-input p-2 cursor-pointer">
          <RadioGroupItem value="custom" id="mode-custom" />
          <div className="text-[12px] flex-1 space-y-2">
            <div>
              <div className="font-medium">Adresse personnalisée (case postale, tiers…)</div>
              <div className="text-muted-foreground text-[11px]">À éviter sauf cas particulier.</div>
            </div>
            {mode === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-[11px]">Adresse</Label>
                  <Input value={custom.billing_address} onChange={(e) => setCustom((c) => ({ ...c, billing_address: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Ville</Label>
                  <Input value={custom.billing_city} onChange={(e) => setCustom((c) => ({ ...c, billing_city: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Province</Label>
                  <Input value={custom.billing_province} onChange={(e) => setCustom((c) => ({ ...c, billing_province: e.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Code postal</Label>
                  <Input value={custom.billing_postal_code} onChange={(e) => setCustom((c) => ({ ...c, billing_postal_code: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            )}
          </div>
        </label>
      </RadioGroup>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Raison (obligatoire)</Label>
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: demande du client pour recevoir les factures à une autre adresse" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Sauvegarde…</> : "Enregistrer facturation"}
        </Button>
      </div>
    </section>
  );
}
