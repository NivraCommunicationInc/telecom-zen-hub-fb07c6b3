/**
 * CoreServicesPage — Transferred from AdminServices.tsx
 * Service catalog management (Internet, TV, Mobile, Equipment)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Plus, Pencil, Wifi, Tv, Smartphone, Package, Search } from "lucide-react";
import { toast } from "sonner";

const categoryIcons: Record<string, any> = { Internet: Wifi, TV: Tv, Mobile: Smartphone, "Équipement": Package };

export default function CoreServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Internet", price: "", description: "", billing_type: "monthly" });

  const { data: services = [] } = useQuery({
    queryKey: ["core-services-catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("services_public" as any).select("*").order("category").order("price");
      return (data as any[]) || [];
    },
  });

  const filtered = services.filter((s: any) => {
    if (catFilter !== "all" && s.category !== catFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(services.map((s: any) => s.category))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Services</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Catalogue des services Nivra · {services.length} services</p></div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Ajouter</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Toutes</SelectItem>{categories.map((c: any) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s: any) => {
          const Icon = categoryIcons[s.category] || Settings;
          return (
            <div key={s.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-emerald-400" />
                <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">{s.category}</Badge>
              </div>
              <h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))] mb-1">{s.name}</h3>
              <p className="text-xs text-[hsl(var(--core-text-secondary))] line-clamp-2 mb-2">{s.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-400">{Number(s.price).toFixed(2)}$</span>
                <Badge className="bg-sky-500/15 text-sky-400 border-0 text-[10px]">{s.billing_type === "yearly" ? "/an" : "/mois"}</Badge>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]">
          <DialogHeader><DialogTitle>Nouveau service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Catégorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}><SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Internet">Internet</SelectItem><SelectItem value="TV">TV</SelectItem><SelectItem value="Mobile">Mobile</SelectItem><SelectItem value="Équipement">Équipement</SelectItem></SelectContent></Select></div>
              <div><Label>Prix</Label><Input type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[hsl(220,15%,20%)] bg-transparent">Annuler</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
