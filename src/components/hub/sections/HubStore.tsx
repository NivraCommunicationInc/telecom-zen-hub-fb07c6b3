import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingBag, Loader2, Check, X, Package, Truck, ClipboardList, Store,
  CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  images: string[] | null;
  sizes: string[] | null;
  price: number | null;
  requires_custom_info: boolean | null;
  custom_info_label: string | null;
  is_available: boolean | null;
  order_index: number | null;
};

type Order = {
  id: string;
  order_number: string;
  item_id: string;
  quantity: number;
  size: string | null;
  status: string;
  created_at: string;
  tracking_number: string | null;
  tracking_url: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  hub_store_items?: { name: string } | null;
};

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:    { label: "En attente",    cls: "bg-amber-100 text-amber-800 border-amber-200",   icon: Clock },
  approved:   { label: "Approuvée",     cls: "bg-blue-100 text-blue-800 border-blue-200",      icon: CheckCircle2 },
  processing: { label: "En traitement", cls: "bg-purple-100 text-purple-800 border-purple-200",icon: Package },
  shipped:    { label: "Expédiée",      cls: "bg-indigo-100 text-indigo-800 border-indigo-200",icon: Truck },
  delivered:  { label: "Livrée",        cls: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  cancelled:  { label: "Annulée",       cls: "bg-rose-100 text-rose-800 border-rose-200",      icon: XCircle },
};

const CATEGORY: Record<string, string> = {
  uniform: "Vêtement",
  badge: "Identification",
  card: "Cartes",
  accessory: "Accessoire",
  apparel: "Vêtement",
};

const POSTAL_RE = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;

export default function HubStore() {
  const [tab, setTab] = useState<"shop" | "orders">("shop");

  return (
    <div className="max-w-6xl">
      <div className="inline-flex rounded-full border border-border bg-card p-1 mb-4">
        <button
          onClick={() => setTab("shop")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${tab === "shop" ? "bg-violet-600 text-white" : "text-foreground"}`}
        >
          <Store className="h-4 w-4" /> Boutique
        </button>
        <button
          onClick={() => setTab("orders")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold min-h-[40px] ${tab === "orders" ? "bg-violet-600 text-white" : "text-foreground"}`}
        >
          <ClipboardList className="h-4 w-4" /> Mes commandes
        </button>
      </div>
      {tab === "shop" ? <Shop /> : <MyOrders />}
    </div>
  );
}

// ─────────────────────────────────────────────
// SHOP
// ─────────────────────────────────────────────
function Shop() {
  const [selected, setSelected] = useState<Item | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["hub-store-items-public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_store_items")
        .select("*")
        .eq("is_available", true)
        .order("order_index", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Item[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucun article disponible pour le moment.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <ProductCard key={it.id} item={it} onOrder={() => setSelected(it)} />
        ))}
      </div>
      {selected && <OrderSheet item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ProductCard({ item, onOrder }: { item: Item; onOrder: () => void }) {
  const img = item.image_url || (item.images && item.images[0]) || null;
  const priceLabel = !item.price || Number(item.price) === 0 ? "Gratuit" : `${Number(item.price).toFixed(2)} $`;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-violet-400 transition-colors">
      <div className="aspect-square bg-violet-50 flex items-center justify-center">
        {img ? (
          <img src={img} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <ShoppingBag className="h-14 w-14 text-violet-300" />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-base font-bold text-foreground leading-tight">{item.name}</h3>
          {item.category && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">
              {CATEGORY[item.category] || item.category}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{item.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-sm font-bold text-violet-700">{priceLabel}</span>
          <button
            onClick={onOrder}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold min-h-[40px]"
          >
            Commander
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ORDER FORM
// ─────────────────────────────────────────────
function OrderSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const qc = useQueryClient();
  const [size, setSize] = useState<string>(item.sizes?.[0] || "");
  const [qty, setQty] = useState<number>(1);
  const [customInfo, setCustomInfo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("QC");
  const [postal, setPostal] = useState("");
  const [notes, setNotes] = useState("");

  // pre-fill from profile
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name, email, phone, address_street, address_city, address_province, address_postal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setName(data.full_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "");
        setEmail(data.email || user.email || "");
        setPhone((data as any).phone || "");
        if ((data as any).address_street) setAddress((data as any).address_street);
        if ((data as any).address_city) setCity((data as any).address_city);
        if ((data as any).address_province) setProvince((data as any).address_province);
        if ((data as any).address_postal) setPostal((data as any).address_postal);
      } else {
        setEmail(user.email || "");
      }
    })();
  }, []);

  const sizesRequired = !!item.sizes && item.sizes.length > 0;
  const customInfoRequired = !!item.requires_custom_info;

  const valid = useMemo(() => {
    if (sizesRequired && !size) return false;
    if (customInfoRequired && !customInfo.trim()) return false;
    if (!name.trim() || !email.trim() || !phone.trim()) return false;
    if (!address.trim() || !city.trim() || !province.trim()) return false;
    if (!POSTAL_RE.test(postal.trim())) return false;
    return true;
  }, [sizesRequired, size, customInfoRequired, customInfo, name, email, phone, address, city, province, postal]);

  const submit = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { data, error } = await supabase
        .from("hub_orders")
        .insert({
          user_id: user.id,
          item_id: item.id,
          quantity: qty,
          size: size || null,
          custom_info_text: customInfoRequired ? customInfo : null,
          delivery_name: name.trim(),
          delivery_email: email.trim(),
          delivery_phone: phone.trim(),
          delivery_address: address.trim(),
          delivery_city: city.trim(),
          delivery_province: province.trim(),
          delivery_postal_code: postal.trim().toUpperCase(),
          notes: notes.trim() || null,
          status: "pending",
        })
        .select("order_number")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Votre demande a été envoyée ✅ Numéro de commande: ${d?.order_number || ""}`);
      qc.invalidateQueries({ queryKey: ["hub-orders-mine"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'envoi"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Commander</p>
            <h2 className="text-base font-bold text-foreground">{item.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted min-w-[40px] min-h-[40px]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Order section */}
          <Section title="Votre commande">
            {sizesRequired && (
              <Field label="Taille" required>
                <div className="flex flex-wrap gap-1.5">
                  {item.sizes!.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={`min-w-[44px] min-h-[40px] px-3 rounded-lg text-xs font-bold border ${size === s ? "bg-violet-600 text-white border-violet-600" : "bg-background border-border"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label="Quantité" required>
              <input
                type="number" min={1} max={10}
                value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            {customInfoRequired && (
              <Field label={item.custom_info_label || "Information personnalisée"} required>
                <input
                  value={customInfo} onChange={(e) => setCustomInfo(e.target.value)}
                  placeholder={item.custom_info_label || ""}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            )}
          </Section>

          {/* Delivery */}
          <Section title="Informations de livraison">
            <Field label="Nom complet" required>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Courriel" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Téléphone" required>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514 555 1234" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Adresse de livraison" required>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 rue Principale, app. 4" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ville" required>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </Field>
              <Field label="Province" required>
                <select value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {["QC","ON","NB","NS","PE","NL","MB","SK","AB","BC","YT","NT","NU"].map(p => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Code postal" required hint={postal && !POSTAL_RE.test(postal) ? "Format A1A 1A1" : undefined}>
                <input value={postal} onChange={(e) => setPostal(e.target.value.toUpperCase())} placeholder="H1A 1A1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
              </Field>
            </div>
          </Section>

          <Section title="Note pour l'équipe (optionnel)">
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Instructions spéciales, préférences de livraison, etc."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </Section>

          <button
            onClick={() => submit.mutate()}
            disabled={!valid || submit.isPending}
            className="w-full min-h-[48px] rounded-full bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-rose-500 mt-1">{hint}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// MY ORDERS
// ─────────────────────────────────────────────
function MyOrders() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["hub-orders-mine"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("hub_orders")
        .select("*, hub_store_items(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Order[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hub_orders").update({ status: "cancelled", cancelled_reason: "Annulée par l'agent" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commande annulée"); qc.invalidateQueries({ queryKey: ["hub-orders-mine"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Aucune commande pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const meta = STATUS[o.status] || STATUS.pending;
        const Icon = meta.icon;
        return (
          <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold text-muted-foreground">{o.order_number}</p>
                <h3 className="text-sm font-bold text-foreground mt-0.5">
                  {o.hub_store_items?.name || "Article"}
                  {o.size && <span className="text-muted-foreground font-normal"> — {o.size}</span>}
                  <span className="text-muted-foreground font-normal"> × {o.quantity}</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(o.created_at).toLocaleDateString("fr-CA", { dateStyle: "long" })}
                </p>
                {o.tracking_number && (
                  <div className="mt-2 text-[11px]">
                    <span className="text-muted-foreground">Suivi: </span>
                    {o.tracking_url ? (
                      <a href={o.tracking_url} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 underline">{o.tracking_number}</a>
                    ) : (
                      <span className="font-semibold text-foreground">{o.tracking_number}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${meta.cls}`}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
                {o.status === "pending" && (
                  <button
                    onClick={() => cancel.mutate(o.id)}
                    className="text-[11px] font-semibold text-rose-600 hover:underline min-h-[32px] px-2"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
