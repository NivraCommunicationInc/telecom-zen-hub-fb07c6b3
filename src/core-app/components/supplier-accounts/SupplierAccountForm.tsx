/**
 * SupplierAccountForm — Shared create/edit form for a supplier account.
 * Uses admin-only RPCs server-side. Password field is masked with show/hide.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Save, ArrowLeft, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import {
  useCreateSupplierAccount,
  useUpdateSupplierAccount,
  useDeleteSupplierAccount,
  revealSupplierPassword,
  type SupplierAccountInput,
  type SupplierAccountStatus,
  type SupplierAccountWithClient,
} from "@/core-app/hooks/useSupplierAccounts";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Client search dropdown ──────────────────────────────────────
type ClientOption = { user_id: string; full_name: string | null; email: string | null; client_number: string | null };

function ClientPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<ClientOption | null>(null);

  // Load currently selected client when value changes
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?.user_id === value) return;
    supabase
      .from("profiles")
      .select("user_id, full_name, email, client_number")
      .eq("user_id", value)
      .maybeSingle()
      .then(({ data }) => setSelected(data as ClientOption | null));
  }, [value]);

  // Search
  useEffect(() => {
    if (!open) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      supabase
        .from("profiles")
        .select("user_id, full_name, email, client_number")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,client_number.ilike.%${q}%`)
        .limit(10)
        .then(({ data }) => setResults((data ?? []) as ClientOption[]));
    }, 200);
    return () => clearTimeout(t);
  }, [search, open]);

  return (
    <div className="relative">
      <Input
        placeholder="Rechercher un client (nom, courriel, #)"
        value={open ? search : selected ? `${selected.full_name ?? "—"} · ${selected.email ?? ""}` : ""}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.user_id}
              type="button"
              className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onClick={() => {
                onChange(r.user_id);
                setSelected(r);
                setOpen(false);
                setSearch("");
              }}
            >
              <div className="font-medium">{r.full_name ?? "(sans nom)"}</div>
              <div className="text-xs text-muted-foreground">
                {r.email} {r.client_number && `· #${r.client_number}`}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          tabIndex={-1}
        />
      )}
    </div>
  );
}

// ── Form ────────────────────────────────────────────────────────
interface Props {
  initial?: SupplierAccountWithClient | null;
  id?: string;
}

const SupplierAccountForm = ({ initial, id }: Props) => {
  const navigate = useNavigate();
  const create = useCreateSupplierAccount();
  const update = useUpdateSupplierAccount();
  const del = useDeleteSupplierAccount();

  const [form, setForm] = useState<SupplierAccountInput>({
    client_id: initial?.client_id ?? "",
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    date_of_birth: initial?.date_of_birth ?? "",
    mothers_maiden_name: initial?.mothers_maiden_name ?? "",
    account_email: initial?.account_email ?? "",
    account_password: "",
    service_name: initial?.service_name ?? "",
    monthly_price: initial?.monthly_price ?? 0,
    activation_date: initial?.activation_date ?? new Date().toISOString().slice(0, 10),
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const isEdit = !!id;
  const set = <K extends keyof SupplierAccountInput>(k: K, v: SupplierAccountInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleRevealPassword = async () => {
    if (!id) return;
    if (!confirm("Confirmer la révélation du mot de passe ? Cette action sera enregistrée dans le journal de sécurité.")) return;
    setRevealing(true);
    try {
      const pwd = await revealSupplierPassword(id);
      set("account_password", pwd);
      setShowPassword(true);
      toast.success("Mot de passe révélé — révélation enregistrée");
    } catch (e: any) {
      toast.error(e?.message ?? "Révélation impossible");
    } finally {
      setRevealing(false);
    }
  };

  const validate = (): string | null => {
    if (!form.client_id) return "Sélectionnez un client Nivra";
    if (!form.first_name.trim()) return "Prénom requis";
    if (!form.last_name.trim()) return "Nom requis";
    if (!form.date_of_birth) return "Date de naissance requise";
    if (!form.mothers_maiden_name.trim()) return "Nom de jeune fille requis";
    if (!form.account_email.trim()) return "Courriel requis";
    if (!isEdit && !form.account_password) return "Mot de passe requis";
    if (!form.service_name.trim()) return "Service requis";
    if (form.monthly_price < 0) return "Prix invalide";
    if (!form.activation_date) return "Date d'activation requise";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    if (isEdit && id) {
      await update.mutateAsync({ id, input: form });
      navigate(corePath(`/supplier-accounts/${id}`));
    } else {
      const newId = await create.mutateAsync(form);
      navigate(corePath(`/supplier-accounts/${newId}`));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await del.mutateAsync(id);
    navigate(corePath("/supplier-accounts"));
  };

  const saving = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate(corePath("/supplier-accounts"))} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {isEdit ? "Modifier le compte fournisseur" : "Nouveau compte fournisseur"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="text-destructive gap-1">
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce compte fournisseur ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est définitive. Les informations seront supprimées de la base.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {/* INFORMATIONS PERSONNELLES */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Informations personnelles
        </h2>

        <div>
          <Label>Compte client Nivra *</Label>
          <ClientPicker value={form.client_id} onChange={(v) => set("client_id", v)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Prénom *</Label>
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div>
            <Label>Nom *</Label>
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date de naissance *</Label>
            <Input type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </div>
          <div>
            <Label>Nom de jeune fille de la mère *</Label>
            <Input value={form.mothers_maiden_name} onChange={(e) => set("mothers_maiden_name", e.target.value)} />
          </div>
        </div>
      </section>

      {/* ACCÈS AU COMPTE */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Accès au compte
        </h2>

        <div>
          <Label>Courriel du compte *</Label>
          <Input type="email" value={form.account_email} onChange={(e) => set("account_email", e.target.value)} />
        </div>

        <div>
          <Label>Mot de passe {isEdit ? "(laisser vide pour conserver)" : "*"}</Label>
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.account_password}
                onChange={(e) => set("account_password", e.target.value)}
                placeholder={isEdit ? "••••••••" : ""}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {isEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevealPassword}
                disabled={revealing}
                className="shrink-0"
              >
                {revealing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Afficher actuel"}
              </Button>
            )}
          </div>
          {isEdit && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Toute révélation est enregistrée dans le journal de sécurité.
            </p>
          )}
        </div>
      </section>

      {/* INFORMATIONS DU SERVICE */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Informations du service
        </h2>

        <div>
          <Label>Service / Forfait *</Label>
          <Input value={form.service_name} onChange={(e) => set("service_name", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Prix mensuel * ($ CAD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.monthly_price}
              onChange={(e) => set("monthly_price", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Date d'activation *</Label>
            <Input type="date" value={form.activation_date} onChange={(e) => set("activation_date", e.target.value)} />
          </div>
        </div>
      </section>

      {/* NOTES INTERNES */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notes internes
        </h2>

        <div>
          <Label>Notes</Label>
          <Textarea
            rows={4}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optionnel"
          />
        </div>

        <div>
          <Label>Statut</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as SupplierAccountStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="suspended">Suspendu</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </form>
  );
};

export default SupplierAccountForm;
