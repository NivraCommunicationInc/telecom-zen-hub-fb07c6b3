/**
 * CorePhoneInventoryPage — Catalog of physical phones in stock.
 * Add, edit, mark defective. Reads/writes `phone_inventory`.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, AlertTriangle, Smartphone } from "lucide-react";

interface PhoneRow {
  id: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  condition: "new" | "refurbished" | "used";
  status: "available" | "reserved" | "sold" | "returned" | "defective";
  imei: string;
  price_cad: number;
  purchase_price_cad: number | null;
  warranty_days: number;
  description: string | null;
  order_id: string | null;
}

const CONDITION_LABEL = { new: "Neuf", refurbished: "Remis à neuf", used: "Usagé" };
const STATUS_LABEL: Record<PhoneRow["status"], string> = {
  available: "Disponible",
  reserved: "Réservé",
  sold: "Vendu",
  returned: "Retourné",
  defective: "Défectueux",
};
const STATUS_COLOR: Record<PhoneRow["status"], string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reserved: "bg-amber-100 text-amber-800 border-amber-200",
  sold: "bg-blue-100 text-blue-800 border-blue-200",
  returned: "bg-slate-100 text-slate-800 border-slate-200",
  defective: "bg-rose-100 text-rose-800 border-rose-200",
};

const EMPTY: Partial<PhoneRow> = {
  brand: "",
  model: "",
  storage: "128GB",
  color: "",
  condition: "new",
  imei: "",
  price_cad: 0,
  purchase_price_cad: null,
  warranty_days: 30,
  description: "",
};

export default function CorePhoneInventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ status: "all", condition: "all" });
  const [editing, setEditing] = useState<Partial<PhoneRow> | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["core-phone-inventory", filter],
    queryFn: async () => {
      let q = supabase.from("phone_inventory").select("*").order("created_at", { ascending: false }).limit(500);
      if (filter.status !== "all") q = q.eq("status", filter.status);
      if (filter.condition !== "all") q = q.eq("condition", filter.condition);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PhoneRow[];
    },
  });

  function startCreate() {
    setEditing({ ...EMPTY });
    setOpen(true);
  }
  function startEdit(row: PhoneRow) {
    setEditing(row);
    setOpen(true);
  }

  async function save() {
    if (!editing) return;
    const required = ["brand", "model", "storage", "color", "imei"] as const;
    for (const k of required) {
      if (!String(editing[k] ?? "").trim()) {
        toast.error(`Champ requis: ${k}`);
        return;
      }
    }
    const payload = {
      brand: editing.brand!.trim(),
      model: editing.model!.trim(),
      storage: editing.storage!.trim(),
      color: editing.color!.trim(),
      condition: editing.condition ?? "new",
      imei: editing.imei!.trim(),
      price_cad: Number(editing.price_cad ?? 0),
      purchase_price_cad: editing.purchase_price_cad === null || editing.purchase_price_cad === undefined ? null : Number(editing.purchase_price_cad),
      warranty_days: Number(editing.warranty_days ?? 30),
      description: editing.description ?? null,
    };
    try {
      if (editing.id) {
        const { error } = await supabase.from("phone_inventory").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Téléphone modifié");
      } else {
        const { error } = await supabase.from("phone_inventory").insert(payload);
        if (error) throw error;
        toast.success("Téléphone ajouté");
      }
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["core-phone-inventory"] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      toast.error(msg);
    }
  }

  async function markDefective(row: PhoneRow) {
    if (!confirm(`Marquer ${row.brand} ${row.model} comme défectueux ?`)) return;
    const { error } = await supabase.from("phone_inventory").update({ status: "defective" }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marqué défectueux");
    qc.invalidateQueries({ queryKey: ["core-phone-inventory"] });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Inventaire téléphones</h1>
            <p className="text-sm text-muted-foreground">Gérez le stock physique disponible à la vente.</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Modifier" : "Ajouter un téléphone"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Marque"><Input value={editing.brand ?? ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></Field>
                <Field label="Modèle"><Input value={editing.model ?? ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></Field>
                <Field label="Stockage"><Input value={editing.storage ?? ""} onChange={(e) => setEditing({ ...editing, storage: e.target.value })} placeholder="128GB" /></Field>
                <Field label="Couleur"><Input value={editing.color ?? ""} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></Field>
                <Field label="État">
                  <Select value={editing.condition ?? "new"} onValueChange={(v) => setEditing({ ...editing, condition: v as PhoneRow["condition"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Neuf</SelectItem>
                      <SelectItem value="refurbished">Remis à neuf</SelectItem>
                      <SelectItem value="used">Usagé</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="IMEI"><Input value={editing.imei ?? ""} onChange={(e) => setEditing({ ...editing, imei: e.target.value })} /></Field>
                <Field label="Prix de vente (CAD)"><Input type="number" step="0.01" value={editing.price_cad ?? 0} onChange={(e) => setEditing({ ...editing, price_cad: Number(e.target.value) })} /></Field>
                <Field label="Prix d'achat (CAD)"><Input type="number" step="0.01" value={editing.purchase_price_cad ?? ""} onChange={(e) => setEditing({ ...editing, purchase_price_cad: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
                <Field label="Garantie (jours)"><Input type="number" value={editing.warranty_days ?? 30} onChange={(e) => setEditing({ ...editing, warranty_days: Number(e.target.value) })} /></Field>
                <div className="col-span-2">
                  <Field label="Description">
                    <Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={save}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Catalogue physique</CardTitle>
          <div className="flex gap-2">
            <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filter.condition} onValueChange={(v) => setFilter({ ...filter, condition: v })}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous états</SelectItem>
                {Object.entries(CONDITION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Chargement…</div>
          ) : (data ?? []).length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucun appareil</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IMEI</TableHead>
                  <TableHead>Appareil</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Achat</TableHead>
                  <TableHead className="text-right">Vente</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.imei}</TableCell>
                    <TableCell>{row.brand} {row.model} <span className="text-muted-foreground text-xs">{row.storage} · {row.color}</span></TableCell>
                    <TableCell><Badge variant="secondary">{CONDITION_LABEL[row.condition]}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_COLOR[row.status]}>{STATUS_LABEL[row.status]}</Badge></TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{row.purchase_price_cad?.toFixed(2) ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{row.price_cad.toFixed(2)} $</TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {row.status !== "defective" && (
                        <Button size="sm" variant="ghost" onClick={() => markDefective(row)} className="text-rose-600 hover:text-rose-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
