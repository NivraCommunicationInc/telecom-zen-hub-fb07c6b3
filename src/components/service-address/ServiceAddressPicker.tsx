/**
 * ServiceAddressPicker — composant réutilisable multi-portails (Pass 3A).
 *
 * Aucune limite : affiche 0, 1, 5, 10, 100 adresses de la même manière.
 * Aucune notion "principale/secondaire" — toutes les adresses sont égales.
 * Utilisé par : Guest Checkout, Portail Client, Core, Employee, Field.
 */
import { useState } from "react";
import { useAccountAddresses, type ServiceAddress, type CreateAddressInput } from "@/hooks/useAccountAddresses";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

export interface ServiceAddressPickerProps {
  accountId: string | null | undefined;
  value?: string | null;
  onChange: (id: string, address: ServiceAddress) => void;
  allowCreate?: boolean;
  filter?: (a: ServiceAddress) => boolean;
  disabledIds?: string[];
  mode?: "select" | "cards";
  label?: string;
  emptyLabel?: string;
  className?: string;
}

const formatLine = (a: ServiceAddress) =>
  [a.address_line, a.city, a.province, a.postal_code].filter(Boolean).join(", ");

export function ServiceAddressPicker({
  accountId,
  value,
  onChange,
  allowCreate = true,
  filter,
  disabledIds = [],
  mode = "select",
  label,
  emptyLabel = "Aucune adresse enregistrée",
  className,
}: ServiceAddressPickerProps) {
  const { addresses, isLoading, create, creating } = useAccountAddresses(accountId);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  const list = filter ? addresses.filter(filter) : addresses;

  const handleCreate = async (input: CreateAddressInput) => {
    try {
      const id = await create(input);
      const created = { ...input, id } as unknown as ServiceAddress;
      onChange(id, created);
      setCreateOpen(false);
      toast({ title: "Adresse ajoutée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && <Label>{label}</Label>}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des adresses…
        </div>
      ) : mode === "cards" ? (
        <div className="grid gap-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyLabel}</p>
          )}
          {list.map((a) => {
            const selected = a.id === value;
            const disabled = disabledIds.includes(a.id);
            return (
              <button
                type="button"
                key={a.id}
                disabled={disabled}
                onClick={() => onChange(a.id, a)}
                className={cn(
                  "text-left rounded-lg border p-3 min-h-[44px] transition-colors",
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{a.address_line}</div>
                    <div className="text-xs text-muted-foreground">
                      {[a.city, a.province, a.postal_code].filter(Boolean).join(", ")}
                    </div>
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <Select
          value={value ?? undefined}
          onValueChange={(id) => {
            const a = list.find((x) => x.id === id);
            if (a) onChange(id, a);
          }}
        >
          <SelectTrigger className="min-h-[44px]">
            <SelectValue placeholder={list.length === 0 ? emptyLabel : "Choisir une adresse"} />
          </SelectTrigger>
          <SelectContent>
            {list.map((a) => (
              <SelectItem key={a.id} value={a.id} disabled={disabledIds.includes(a.id)}>
                {formatLine(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {allowCreate && accountId && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" /> Ajouter une nouvelle adresse
        </Button>
      )}

      <AddressCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        submitting={creating}
      />
    </div>
  );
}

function AddressCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateAddressInput) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateAddressInput>({
    address_line: "",
    city: "",
    province: "QC",
    postal_code: "",
    country: "CA",
  });
  const set = (k: keyof CreateAddressInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.address_line.trim() && form.city.trim() && form.postal_code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle adresse de service</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Adresse</Label>
            <Input value={form.address_line} onChange={(e) => set("address_line", e.target.value)} placeholder="123 rue Principale" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ville</Label>
              <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Montréal" />
            </div>
            <div>
              <Label>Code postal</Label>
              <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="H1A 1A1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact (optionnel)</Label>
              <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
            </div>
            <div>
              <Label>Téléphone (optionnel)</Label>
              <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button disabled={!valid || submitting} onClick={() => onSubmit(form)}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
