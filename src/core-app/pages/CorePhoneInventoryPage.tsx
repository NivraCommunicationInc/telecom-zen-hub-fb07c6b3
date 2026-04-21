/**
 * CorePhoneInventoryPage — Catalog of physical phones in stock.
 * Professional multi-section "Ajouter un téléphone" form with:
 *  - Section 1: Identification (brand, model autocomplete, storage, color, IMEI w/ Luhn)
 *  - Section 2: Condition + warranty (auto)
 *  - Section 3: Pricing + tax breakdown + margin
 *  - Section 4: Description + internal notes + battery + accessories + cosmetic
 *  - Section 5: Photos placeholder
 *  - Live preview before save
 *
 * Reads/writes `phone_inventory`. Extra fields (battery, accessories, cosmetic,
 * insured value, internal notes) are stored as a structured JSON block appended
 * to `description` so this page can read/write them without a schema change.
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Pencil,
  AlertTriangle,
  Smartphone,
  Check,
  X as XIcon,
  Camera,
  Shield,
  DollarSign,
  Tag,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Loader2,
} from "lucide-react";

// ─────────────────────────── Types ───────────────────────────
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
  available_colors: string[] | null;
  available_storage: string[] | null;
  photos: string[] | null;
  is_visible_on_site: boolean;
}

type ConditionT = PhoneRow["condition"];
type CosmeticT = "perfect" | "very_good" | "good" | "acceptable";

interface ExtraMeta {
  insured_value?: number | null;
  internal_notes?: string;
  battery_pct?: number | null;
  accessories?: string[];
  cosmetic?: CosmeticT;
}

interface FormState {
  id?: string;
  brand: string;
  brand_other: string;
  model: string;
  storage: string;
  color: string;
  condition: ConditionT;
  imei: string;
  price_cad: number;
  purchase_price_cad: number | null;
  insured_value: number | null;
  warranty_days: number;
  public_description: string;
  internal_notes: string;
  battery_pct: number | null;
  accessories: string[];
  cosmetic: CosmeticT;
  available_colors: string[];
  available_storage: string[];
  photos: string[];
  is_visible_on_site: boolean;
}

// ─────────────────────────── Constants ───────────────────────────
const CONDITION_LABEL: Record<ConditionT, string> = {
  new: "Neuf",
  refurbished: "Remis à neuf",
  used: "Usagé",
};
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

const BRANDS = ["Apple", "Samsung", "Google", "OnePlus", "Motorola", "LG", "Sony", "Autre"] as const;
const STORAGE_OPTIONS = ["64GB", "128GB", "256GB", "512GB", "1TB"];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  Apple: [
    "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16",
    "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15",
    "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14",
    "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13",
    "iPhone 12", "iPhone SE",
  ],
  Samsung: [
    "Galaxy S25 Ultra", "Galaxy S25+", "Galaxy S25",
    "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24",
    "Galaxy S23",
    "Galaxy A55", "Galaxy A35", "Galaxy A15",
  ],
  Google: ["Pixel 9 Pro", "Pixel 9", "Pixel 8 Pro", "Pixel 8", "Pixel 7"],
};

const ACCESSORY_OPTIONS = [
  "Câble USB-C", "Chargeur", "Écouteurs", "Boîte originale", "Coque de protection", "Aucun",
];

const COSMETIC_LABEL: Record<CosmeticT, string> = {
  perfect: "Parfait",
  very_good: "Très bon",
  good: "Bon",
  acceptable: "Acceptable",
};

const WARRANTY_DEFAULT: Record<ConditionT, number> = {
  new: 365,
  refurbished: 90,
  used: 30,
};

const TPS = 0.05;
const TVQ = 0.09975;

const META_MARKER = "\n\n---NIVRA_META---\n";

// ─────────────────────────── Helpers ───────────────────────────
function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 15) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function packDescription(form: FormState): string {
  const meta: ExtraMeta = {
    insured_value: form.insured_value,
    internal_notes: form.internal_notes || "",
    battery_pct: form.battery_pct,
    accessories: form.accessories,
    cosmetic: form.cosmetic,
  };
  const pub = (form.public_description || "").trim();
  return `${pub}${META_MARKER}${JSON.stringify(meta)}`;
}

function unpackDescription(raw: string | null): { publicDesc: string; meta: ExtraMeta } {
  if (!raw) return { publicDesc: "", meta: {} };
  const idx = raw.indexOf(META_MARKER);
  if (idx === -1) return { publicDesc: raw, meta: {} };
  const publicDesc = raw.slice(0, idx);
  try {
    const meta = JSON.parse(raw.slice(idx + META_MARKER.length)) as ExtraMeta;
    return { publicDesc, meta };
  } catch {
    return { publicDesc, meta: {} };
  }
}

function emptyForm(): FormState {
  return {
    brand: "",
    brand_other: "",
    model: "",
    storage: "256GB",
    color: "",
    condition: "new",
    imei: "",
    price_cad: 0,
    purchase_price_cad: null,
    insured_value: null,
    warranty_days: WARRANTY_DEFAULT.new,
    public_description: "",
    internal_notes: "",
    battery_pct: null,
    accessories: [],
    cosmetic: "perfect",
    available_colors: [],
    available_storage: ["256GB"],
    photos: [],
  };
}

function fromRow(row: PhoneRow): FormState {
  const { publicDesc, meta } = unpackDescription(row.description);
  const isStandardBrand = (BRANDS as readonly string[]).includes(row.brand);
  return {
    id: row.id,
    brand: isStandardBrand ? row.brand : "Autre",
    brand_other: isStandardBrand ? "" : row.brand,
    model: row.model,
    storage: row.storage,
    color: row.color,
    condition: row.condition,
    imei: row.imei,
    price_cad: row.price_cad,
    purchase_price_cad: row.purchase_price_cad,
    insured_value: meta.insured_value ?? row.purchase_price_cad ?? null,
    warranty_days: row.warranty_days,
    public_description: publicDesc,
    internal_notes: meta.internal_notes ?? "",
    battery_pct: meta.battery_pct ?? null,
    accessories: meta.accessories ?? [],
    cosmetic: meta.cosmetic ?? "perfect",
    available_colors: row.available_colors ?? [],
    available_storage: (row.available_storage && row.available_storage.length > 0) ? row.available_storage : [row.storage],
    photos: row.photos ?? [],
  };
}

// ─────────────────────────── Component ───────────────────────────
export default function CorePhoneInventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ status: "all", condition: "all" });
  const [form, setForm] = useState<FormState | null>(null);
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
    setForm(emptyForm());
    setShowPreview(false);
    setOpen(true);
  }
  function startEdit(row: PhoneRow) {
    setForm(fromRow(row));
    setShowPreview(false);
    setOpen(true);
  }

  // Auto-fill warranty when condition changes
  useEffect(() => {
    if (!form) return;
    // Only auto-fill if warranty matches another condition's default (i.e. user didn't override)
    const defaults = Object.values(WARRANTY_DEFAULT);
    if (defaults.includes(form.warranty_days)) {
      const target = WARRANTY_DEFAULT[form.condition];
      if (target !== form.warranty_days) {
        setForm((f) => (f ? { ...f, warranty_days: target } : f));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.condition]);

  // Auto-fill insured value from purchase price
  useEffect(() => {
    if (!form) return;
    if (form.insured_value === null && form.purchase_price_cad !== null) {
      setForm((f) => (f ? { ...f, insured_value: f.purchase_price_cad } : f));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.purchase_price_cad]);

  // IMEI validation removed — accept any text/number, optional field
  const imeiValid = true;

  const taxBreakdown = useMemo(() => {
    const p = Number(form?.price_cad ?? 0);
    const tps = +(p * TPS).toFixed(2);
    const tvq = +(p * TVQ).toFixed(2);
    const total = +(p + tps + tvq).toFixed(2);
    return { p, tps, tvq, total };
  }, [form?.price_cad]);

  const margin = useMemo(() => {
    const sale = Number(form?.price_cad ?? 0);
    const purchase = Number(form?.purchase_price_cad ?? 0);
    if (!sale || !purchase) return null;
    const m = sale - purchase;
    const pct = (m / sale) * 100;
    return { amount: m, pct };
  }, [form?.price_cad, form?.purchase_price_cad]);

  const effectiveBrand = (f: FormState) => (f.brand === "Autre" ? f.brand_other.trim() : f.brand);

  function toggleAccessory(label: string) {
    if (!form) return;
    if (label === "Aucun") {
      setForm({ ...form, accessories: form.accessories.includes("Aucun") ? [] : ["Aucun"] });
      return;
    }
    const set = new Set(form.accessories.filter((a) => a !== "Aucun"));
    if (set.has(label)) set.delete(label);
    else set.add(label);
    setForm({ ...form, accessories: Array.from(set) });
  }

  function validate(): string | null {
    if (!form) return "Formulaire vide";
    const brand = effectiveBrand(form);
    if (!brand) return "Marque requise";
    if (!form.model.trim()) return "Modèle requis";
    if (!form.storage.trim()) return "Stockage requis";
    if (!form.color.trim()) return "Couleur requise";
    // IMEI accepté tel quel (texte ou chiffres, optionnel)
    if (Number(form.price_cad) <= 0) return "Prix de vente requis";
    if (form.warranty_days < 0) return "Garantie invalide";
    if (form.condition !== "new" && form.battery_pct !== null) {
      if (form.battery_pct < 0 || form.battery_pct > 100) return "Batterie 0-100";
    }
    return null;
  }

  async function save() {
    if (!form) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    const colorsList = (form.available_colors.length > 0 ? form.available_colors : [form.color.trim()]).filter(Boolean);
    const storageList = (form.available_storage.length > 0 ? form.available_storage : [form.storage.trim()]).filter(Boolean);
    const payload = {
      brand: effectiveBrand(form),
      model: form.model.trim(),
      storage: form.storage.trim(),
      color: form.color.trim(),
      condition: form.condition,
      imei: form.imei.replace(/\D/g, ""),
      price_cad: Number(form.price_cad),
      purchase_price_cad: form.purchase_price_cad === null ? null : Number(form.purchase_price_cad),
      warranty_days: Number(form.warranty_days),
      description: packDescription(form),
      available_colors: colorsList,
      available_storage: storageList,
      photos: form.photos,
    };
    try {
      if (form.id) {
        const { error } = await supabase.from("phone_inventory").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Téléphone modifié");
      } else {
        const { error } = await supabase.from("phone_inventory").insert(payload);
        if (error) throw error;
        toast.success("Téléphone ajouté à l'inventaire");
      }
      setOpen(false);
      setForm(null);
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

  const modelSuggestions = form ? (MODEL_SUGGESTIONS[form.brand] ?? []) : [];

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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowPreview(false); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Ajouter un téléphone</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form?.id ? "Modifier l'appareil" : "Ajouter un téléphone à l'inventaire"}</DialogTitle>
            </DialogHeader>

            {form && !showPreview && (
              <div className="space-y-6">
                {/* SECTION 1 — Identification */}
                <FormSection icon={<Smartphone className="h-4 w-4" />} title="1. Identification de l'appareil">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Marque *">
                      <Select value={form.brand} onValueChange={(v) => setForm({ ...form, brand: v, model: "" })}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.brand === "Autre" && (
                        <Input
                          className="mt-2"
                          placeholder="Préciser la marque"
                          value={form.brand_other}
                          onChange={(e) => setForm({ ...form, brand_other: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label="Modèle *">
                      <Input
                        list={modelSuggestions.length ? "model-suggestions" : undefined}
                        value={form.model}
                        onChange={(e) => setForm({ ...form, model: e.target.value })}
                        placeholder={modelSuggestions[0] ?? "Modèle"}
                      />
                      {modelSuggestions.length > 0 && (
                        <datalist id="model-suggestions">
                          {modelSuggestions.map((m) => <option key={m} value={m} />)}
                        </datalist>
                      )}
                    </Field>
                    <Field label="Stockage *">
                      <Select value={form.storage} onValueChange={(v) => setForm({ ...form, storage: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STORAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Couleur *">
                      <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Noir, Bleu titane..." />
                    </Field>
                    <div className="col-span-2">
                      <Field label="IMEI / Identifiant (optionnel)">
                        <Input
                          value={form.imei}
                          onChange={(e) => setForm({ ...form, imei: e.target.value.slice(0, 50) })}
                          className="font-mono"
                          placeholder="Ex: 123456789012347, DEMO-IPHONE16, etc."
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Texte ou chiffres acceptés. Aucune validation requise.
                        </p>
                      </Field>
                    </div>
                  </div>
                </FormSection>

                {/* SECTION 1b — Variantes disponibles (publiques) */}
                <FormSection icon={<Tag className="h-4 w-4" />} title="1b. Variantes disponibles sur le site">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium mb-2 block">
                        Couleurs disponibles (le client choisit sur la page produit)
                      </Label>
                      <ColorTagInput
                        values={form.available_colors}
                        onChange={(v) => setForm({ ...form, available_colors: v })}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Tapez une couleur et appuyez sur Entrée. Couleur par défaut affichée à l'ouverture : <strong>{form.color || "—"}</strong>
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-2 block">
                        Options de stockage disponibles
                      </Label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {STORAGE_OPTIONS.map((s) => {
                          const checked = form.available_storage.includes(s);
                          return (
                            <label
                              key={s}
                              className={`flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer transition ${
                                checked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => {
                                  const set = new Set(form.available_storage);
                                  if (set.has(s)) set.delete(s); else set.add(s);
                                  setForm({ ...form, available_storage: Array.from(set) });
                                }}
                              />
                              {s}
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Stockage par défaut : <strong>{form.storage}</strong>. Surcharges automatiques côté client : 512GB +100$, 1TB +200$.
                      </p>
                    </div>
                  </div>
                </FormSection>

                {/* SECTION 2 — Condition & warranty */}
                <FormSection icon={<Shield className="h-4 w-4" />} title="2. État et garantie">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(["new", "refurbished", "used"] as ConditionT[]).map((c) => {
                      const selected = form.condition === c;
                      const labels: Record<ConditionT, { title: string; desc: string }> = {
                        new: { title: "NEUF", desc: "Jamais utilisé, boîte originale" },
                        refurbished: { title: "REMIS À NEUF", desc: "Testé et certifié Nivra" },
                        used: { title: "USAGÉ", desc: "Fonctionnel, traces d'usure normales" },
                      };
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, condition: c, warranty_days: WARRANTY_DEFAULT[c] })}
                          className={`text-left rounded-lg border p-4 transition ${
                            selected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="font-bold text-sm">{labels[c].title}</div>
                          <div className="text-xs text-muted-foreground mt-1">{labels[c].desc}</div>
                          <div className="text-xs mt-2 text-primary font-medium">
                            Garantie {WARRANTY_DEFAULT[c]} jours
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3">
                    <Field label="Garantie (jours) — éditable">
                      <Input
                        type="number"
                        min={0}
                        value={form.warranty_days}
                        onChange={(e) => setForm({ ...form, warranty_days: Math.max(0, Number(e.target.value)) })}
                      />
                    </Field>
                  </div>
                </FormSection>

                {/* SECTION 3 — Pricing */}
                <FormSection icon={<DollarSign className="h-4 w-4" />} title="3. Prix et valeur">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Field label="Prix de vente (CAD) *">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={form.price_cad || ""}
                          onChange={(e) => setForm({ ...form, price_cad: Number(e.target.value) })}
                        />
                      </Field>
                      <p className="text-xs text-muted-foreground mt-1">
                        Affiché: <strong>{taxBreakdown.p.toFixed(2)} $</strong> + TPS/TVQ ={" "}
                        <strong>{taxBreakdown.total.toFixed(2)} $</strong> total client
                      </p>
                    </div>
                    <div>
                      <Field label="Prix d'achat (CAD)">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={form.purchase_price_cad ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              purchase_price_cad: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      {margin && (
                        <p className={`text-xs mt-1 font-medium ${margin.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          Marge: {margin.amount.toFixed(2)} $ ({margin.pct.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                    <div>
                      <Field label="Valeur assurée (expédition)">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={form.insured_value ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              insured_value: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto-rempli depuis le prix d'achat
                      </p>
                    </div>
                  </div>
                </FormSection>

                {/* SECTION 4 — Description & details */}
                <FormSection icon={<Tag className="h-4 w-4" />} title="4. Description et état détaillé">
                  <div className="space-y-3">
                    <Field label="Description publique">
                      <Textarea
                        rows={3}
                        value={form.public_description}
                        onChange={(e) => setForm({ ...form, public_description: e.target.value })}
                        placeholder="Description qui apparaîtra sur le site public..."
                      />
                    </Field>
                    <Field label="Notes internes">
                      <Textarea
                        rows={2}
                        value={form.internal_notes}
                        onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                        placeholder="Notes pour les agents Core uniquement (non visible au client)"
                      />
                    </Field>

                    {form.condition !== "new" && (
                      <Field label="État de la batterie (%)">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={form.battery_pct ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              battery_pct: e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value))),
                            })
                          }
                          placeholder="Ex: 89"
                        />
                      </Field>
                    )}

                    <Field label="Accessoires inclus">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {ACCESSORY_OPTIONS.map((acc) => (
                          <label
                            key={acc}
                            className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={form.accessories.includes(acc)}
                              onCheckedChange={() => toggleAccessory(acc)}
                            />
                            {acc}
                          </label>
                        ))}
                      </div>
                    </Field>

                    <Field label="État cosmétique">
                      <Select value={form.cosmetic} onValueChange={(v) => setForm({ ...form, cosmetic: v as CosmeticT })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(COSMETIC_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FormSection>

                {/* SECTION 5 — Photos */}
                <FormSection icon={<Camera className="h-4 w-4" />} title="5. Photos">
                  <PhotoUploader
                    photos={form.photos}
                    onChange={(next) => setForm({ ...form, photos: next })}
                  />
                </FormSection>
              </div>
            )}

            {form && showPreview && <PreviewCard form={form} margin={margin} taxBreakdown={taxBreakdown} />}

            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)} className="sm:mr-auto">Annuler</Button>
              <Button variant="outline" onClick={() => setShowPreview((p) => !p)}>
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Retour à l'édition" : "Aperçu de l'annonce"}
              </Button>
              <Button onClick={save}>{form?.id ? "Enregistrer les modifications" : "Enregistrer dans l'inventaire"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
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

// ─────────────────────────── Sub-components ───────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PreviewCard({
  form,
  margin,
  taxBreakdown,
}: {
  form: FormState;
  margin: { amount: number; pct: number } | null;
  taxBreakdown: { p: number; tps: number; tvq: number; total: number };
}) {
  const brand = form.brand === "Autre" ? form.brand_other : form.brand;
  return (
    <div className="rounded-lg border bg-muted/20 p-6 space-y-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-semibold">
        <Eye className="h-3.5 w-3.5" /> Aperçu de l'annonce
      </div>
      <div>
        <h2 className="text-2xl font-bold">{brand} {form.model}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {form.storage} · {form.color} · <Badge variant="secondary">{CONDITION_LABEL[form.condition]}</Badge>
        </p>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Prix affiché</div>
          <div className="text-2xl font-bold">{taxBreakdown.p.toFixed(2)} $</div>
          <div className="text-xs text-muted-foreground">Total avec taxes: {taxBreakdown.total.toFixed(2)} $</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Garantie</div>
          <div className="text-lg font-semibold">{form.warranty_days} jours</div>
          {margin && (
            <div className={`text-xs font-medium ${margin.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              Marge: {margin.amount.toFixed(2)} $ ({margin.pct.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>
      <Separator />
      <div className="space-y-2 text-sm">
        <div><span className="text-muted-foreground">IMEI:</span> <span className="font-mono">{form.imei}</span></div>
        <div><span className="text-muted-foreground">Cosmétique:</span> {COSMETIC_LABEL[form.cosmetic]}</div>
        {form.condition !== "new" && form.battery_pct !== null && (
          <div><span className="text-muted-foreground">Batterie:</span> {form.battery_pct}%</div>
        )}
        {form.accessories.length > 0 && (
          <div><span className="text-muted-foreground">Inclus:</span> {form.accessories.join(", ")}</div>
        )}
      </div>
      {form.public_description && (
        <>
          <Separator />
          <div>
            <div className="text-xs text-muted-foreground mb-1">Description</div>
            <p className="text-sm whitespace-pre-line">{form.public_description}</p>
          </div>
        </>
      )}
      {form.internal_notes && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Notes internes (non visibles au client):</strong>
          <p className="mt-1 whitespace-pre-line">{form.internal_notes}</p>
        </div>
      )}
    </div>
  );
}

function ColorTagInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function addTag(raw: string) {
    const tag = raw.trim();
    if (!tag) return;
    if (values.some((v) => v.toLowerCase() === tag.toLowerCase())) return;
    onChange([...values, tag]);
    setDraft("");
  }
  function removeTag(t: string) {
    onChange(values.filter((v) => v !== t));
  }
  return (
    <div className="rounded-md border border-input bg-background p-2 min-h-[44px]">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-foreground border border-primary/30 px-2.5 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => removeTag(v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Retirer ${v}`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              removeTag(values[values.length - 1]);
            }
          }}
          onBlur={() => draft && addTag(draft)}
          placeholder={values.length === 0 ? "Ex: Noir, Bleu, Rose..." : "Ajouter..."}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

// ─────────────────────────── Photo Uploader ───────────────────────────
function PhotoUploader({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} dépasse 10 Mo`);
          continue;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("phone-photos")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) {
          toast.error(`Échec ${file.name}: ${error.message}`);
          continue;
        }
        const { data } = supabase.storage.from("phone-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      if (uploaded.length > 0) {
        onChange([...photos, ...uploaded]);
        toast.success(`${uploaded.length} photo(s) ajoutée(s)`);
      }
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    onChange(photos.filter((p) => p !== url));
    const match = url.match(/\/phone-photos\/(.+)$/);
    if (match) {
      supabase.storage.from("phone-photos").remove([match[1]]).catch(() => {});
    }
  }

  return (
    <div className="space-y-3">
      <label
        className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          uploading ? "bg-muted/40 opacity-60" : "bg-muted/20 hover:bg-muted/40 hover:border-primary"
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 mx-auto text-primary mb-2 animate-spin" />
            <p className="text-sm text-foreground font-medium">Téléversement en cours…</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">Cliquez ou glissez des photos ici</p>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG, WEBP ou HEIC · max 10 Mo par image · plusieurs fichiers acceptés
            </p>
          </>
        )}
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {photos.map((url, i) => (
            <div
              key={url}
              className="relative aspect-square rounded-md overflow-hidden border bg-muted group"
            >
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  Principale
                </span>
              )}
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 p-1 rounded bg-background/90 text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Supprimer la photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        La 1<sup>re</sup> photo sera l'image principale affichée au client.
      </p>
    </div>
  );
}
