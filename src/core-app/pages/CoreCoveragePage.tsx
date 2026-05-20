/**
 * CoreCoveragePage — Couverture réseau avec carte Leaflet.
 * Gestion CRUD des zones + visualisation sur carte + vérification de code postal.
 */
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Plus, Search, Loader2, Pencil, Trash2,
  CheckCircle2, Clock, Wrench, X,
} from "lucide-react";
import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type ZoneStatus = "active" | "planned" | "maintenance";
type CoverageType = "fiber" | "cable" | "wireless";
type FilterKey = "all" | ZoneStatus;

interface CoverageZone {
  id: string;
  name: string;
  region: string | null;
  city: string | null;
  province: string;
  postal_codes: string[] | null;
  postal_code_prefix: string | null;
  status: ZoneStatus | string;
  coverage_type: CoverageType | string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
  color: string | null;
  notes: string | null;
  client_count: number | null;
  internet_available: boolean;
  tv_available: boolean;
  mobile_available: boolean;
}

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  active:      { label: "Active",      tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40", icon: CheckCircle2 },
  planned:     { label: "Planifiée",   tone: "bg-amber-500/15 text-amber-600 border-amber-500/40",       icon: Clock },
  coming_soon: { label: "Bientôt",     tone: "bg-amber-500/15 text-amber-600 border-amber-500/40",       icon: Clock },
  maintenance: { label: "Maintenance", tone: "bg-orange-500/15 text-orange-600 border-orange-500/40",    icon: Wrench },
  unavailable: { label: "Indisponible", tone: "bg-rose-500/15 text-rose-600 border-rose-500/40",         icon: X },
};

const TYPE_LABEL: Record<string, string> = { fiber: "Fibre", cable: "Câble", wireless: "Sans-fil" };

const MTL_CENTER: [number, number] = [45.5590, -73.6552];

const emptyZone = (): Partial<CoverageZone> => ({
  name: "", region: "Montréal", city: "", province: "QC",
  postal_codes: [], status: "active", coverage_type: "fiber",
  center_lat: MTL_CENTER[0], center_lng: MTL_CENTER[1], radius_km: 2.0,
  color: "#8B5CF6", notes: "", client_count: 0,
  internet_available: true, tv_available: false, mobile_available: false,
});

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 13, { duration: 0.6 });
  }, [map, position]);
  return null;
}

export default function CoreCoveragePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<CoverageZone> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [postalInput, setPostalInput] = useState("");
  const [postalResult, setPostalResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pcTag, setPcTag] = useState("");

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["core-coverage-zones"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coverage_zones" as any)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CoverageZone[];
    },
  });

  const stats = useMemo(() => {
    const norm = (s: string) => (s === "coming_soon" ? "planned" : s);
    return {
      total: zones.length,
      active: zones.filter((z) => norm(z.status) === "active").length,
      planned: zones.filter((z) => norm(z.status) === "planned").length,
      maintenance: zones.filter((z) => norm(z.status) === "maintenance").length,
      clients: zones.reduce((s, z) => s + (z.client_count ?? 0), 0),
    };
  }, [zones]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return zones.filter((z) => {
      const eff = z.status === "coming_soon" ? "planned" : z.status;
      if (filter !== "all" && eff !== filter) return false;
      if (!q) return true;
      const codes = (z.postal_codes || []).join(" ");
      return (z.name || "").toUpperCase().includes(q) || codes.toUpperCase().includes(q);
    });
  }, [zones, filter, search]);

  const save = useMutation({
    mutationFn: async (z: Partial<CoverageZone>) => {
      if (!z.name?.trim()) throw new Error("Nom requis");
      const codes = (z.postal_codes || []).map((c) => c.trim().toUpperCase()).filter(Boolean);
      const payload: any = {
        name: z.name.trim(),
        region: z.region?.trim() || null,
        city: z.city?.trim() || null,
        province: (z.province || "QC").toUpperCase().slice(0, 2),
        postal_codes: codes,
        postal_code_prefix: codes[0] || null,
        status: z.status || "active",
        coverage_type: z.coverage_type || "fiber",
        center_lat: z.center_lat ?? null,
        center_lng: z.center_lng ?? null,
        radius_km: z.radius_km ?? 2.0,
        color: z.color || "#8B5CF6",
        notes: z.notes?.trim() || null,
        client_count: z.client_count ?? 0,
        internet_available: !!z.internet_available,
        tv_available: !!z.tv_available,
        mobile_available: !!z.mobile_available,
      };
      if (z.id) {
        const { error } = await supabase.from("coverage_zones" as any).update(payload).eq("id", z.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coverage_zones" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Zone enregistrée");
      qc.invalidateQueries({ queryKey: ["core-coverage-zones"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coverage_zones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone supprimée");
      qc.invalidateQueries({ queryKey: ["core-coverage-zones"] });
      setDeleteId(null);
      setSelectedId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const checkPostal = () => {
    const code = postalInput.trim().toUpperCase().replace(/\s+/g, "");
    if (!code) { setPostalResult(null); return; }
    const prefix = code.slice(0, 3);
    const hit = zones.find((z) => (z.postal_codes || []).some((p) => p?.toUpperCase().startsWith(prefix)));
    if (hit) {
      setPostalResult({ ok: true, msg: `${prefix} est couvert (${hit.name})` });
      setSelectedId(hit.id);
    } else {
      setPostalResult({ ok: false, msg: `${prefix} n'est pas dans nos zones de couverture` });
    }
  };

  const selectedZone = zones.find((z) => z.id === selectedId);
  const focusPos: [number, number] | null = selectedZone?.center_lat && selectedZone?.center_lng
    ? [Number(selectedZone.center_lat), Number(selectedZone.center_lng)]
    : null;

  const addPostalTag = () => {
    if (!editing || !pcTag.trim()) return;
    const v = pcTag.trim().toUpperCase().slice(0, 3);
    const existing = editing.postal_codes || [];
    if (!existing.includes(v)) setEditing({ ...editing, postal_codes: [...existing, v] });
    setPcTag("");
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Couverture réseau
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Zones de service Nivra · carte interactive · vérification de code postal</p>
        </div>
        <Button onClick={() => setEditing(emptyZone())}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle zone
        </Button>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-4">
        {/* LEFT panel */}
        <div className="space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Total</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
            <Card className="border-emerald-500/30"><CardContent className="p-3"><div className="text-[10px] uppercase text-emerald-600">Actives</div><div className="text-2xl font-bold text-emerald-600">{stats.active}</div></CardContent></Card>
            <Card className="border-amber-500/30"><CardContent className="p-3"><div className="text-[10px] uppercase text-amber-600">Planifiées</div><div className="text-2xl font-bold text-amber-600">{stats.planned}</div></CardContent></Card>
            <Card className="border-orange-500/30"><CardContent className="p-3"><div className="text-[10px] uppercase text-orange-600">Maintenance</div><div className="text-2xl font-bold text-orange-600">{stats.maintenance}</div></CardContent></Card>
            <Card className="col-span-2 border-primary/30"><CardContent className="p-3"><div className="text-[10px] uppercase text-primary">Clients couverts</div><div className="text-2xl font-bold text-primary">{stats.clients}</div></CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-1">
            {(["all", "active", "planned", "maintenance"] as FilterKey[]).map((k) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
                {k === "all" ? "Toutes" : STATUS_META[k]?.label}
              </Button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Recherche : nom ou code postal…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Zone cards */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">Aucune zone.</p>
            ) : filtered.map((z) => {
              const meta = STATUS_META[z.status] || STATUS_META.active;
              const Icon = meta.icon;
              const active = z.id === selectedId;
              return (
                <Card key={z.id} className={`cursor-pointer transition-colors ${active ? "border-primary ring-1 ring-primary/40" : "hover:border-primary/50"}`} onClick={() => setSelectedId(z.id)}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: z.color || "#8B5CF6" }} />
                          <span className="font-semibold text-sm truncate">{z.name}</span>
                        </div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="outline" className={meta.tone}><Icon className="h-3 w-3 mr-1" />{meta.label}</Badge>
                          <Badge variant="outline">{TYPE_LABEL[z.coverage_type] || z.coverage_type}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(z); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(z.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {(z.postal_codes || []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(z.postal_codes || []).map((p) => <span key={p} className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{p}</span>)}
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{(z.client_count ?? 0)} clients</span>
                      <span>Rayon {Number(z.radius_km ?? 2).toFixed(1)} km</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* RIGHT — map */}
        <div className="space-y-3">
          <div className="h-[60vh] rounded-xl overflow-hidden border border-border">
            <MapContainer center={MTL_CENTER} zoom={11} style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FlyTo position={focusPos} />
              {zones.filter((z) => z.center_lat && z.center_lng).map((z) => {
                const eff = z.status === "coming_soon" ? "planned" : z.status;
                const dashed = eff === "planned";
                const fillOp = eff === "maintenance" ? 0.5 : 0.3;
                const fillCol = eff === "maintenance" ? "#F59E0B" : (z.color || "#8B5CF6");
                return (
                  <Circle
                    key={z.id}
                    center={[Number(z.center_lat), Number(z.center_lng)]}
                    radius={(Number(z.radius_km) || 2) * 1000}
                    pathOptions={{
                      color: z.color || "#8B5CF6",
                      weight: z.id === selectedId ? 4 : 2,
                      opacity: 0.8,
                      fillColor: fillCol,
                      fillOpacity: fillOp,
                      dashArray: dashed ? "8 8" : undefined,
                    }}
                    eventHandlers={{ click: () => setSelectedId(z.id) }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <div className="font-semibold">{z.name}</div>
                        <div>{STATUS_META[z.status]?.label} · {TYPE_LABEL[z.coverage_type] || z.coverage_type}</div>
                        {(z.postal_codes || []).length > 0 && (
                          <div className="font-mono">{(z.postal_codes || []).join(", ")}</div>
                        )}
                        <div>{z.client_count ?? 0} clients</div>
                        <div className="flex gap-1 pt-1">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setEditing(z)}>Modifier</Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-destructive" onClick={() => setDeleteId(z.id)}>Supprimer</Button>
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}
            </MapContainer>
          </div>

          {/* Postal code checker */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Vérifier si un code postal est couvert</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: H1G 1A1"
                  value={postalInput}
                  onChange={(e) => setPostalInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && checkPostal()}
                  maxLength={7}
                />
                <Button onClick={checkPostal}>Vérifier</Button>
              </div>
              {postalResult && (
                <div className={`text-sm rounded-md p-2 ${postalResult.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"}`}>
                  {postalResult.ok ? "✅" : "❌"} {postalResult.msg}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la zone" : "Nouvelle zone de couverture"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Nom de la zone *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Montréal-Nord" />
                </div>
                <div className="space-y-1.5">
                  <Label>Région</Label>
                  <Input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select value={editing.status ?? "active"} onValueChange={(v) => setEditing({ ...editing, status: v as ZoneStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="planned">Planifiée</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type de couverture</Label>
                  <Select value={editing.coverage_type ?? "fiber"} onValueChange={(v) => setEditing({ ...editing, coverage_type: v as CoverageType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fiber">Fibre</SelectItem>
                      <SelectItem value="cable">Câble</SelectItem>
                      <SelectItem value="wireless">Sans-fil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Latitude centre</Label>
                  <Input type="number" step="0.0001" value={editing.center_lat ?? ""} onChange={(e) => setEditing({ ...editing, center_lat: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude centre</Label>
                  <Input type="number" step="0.0001" value={editing.center_lng ?? ""} onChange={(e) => setEditing({ ...editing, center_lng: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Rayon : {Number(editing.radius_km ?? 2).toFixed(1)} km</Label>
                  <Slider min={0.5} max={20} step={0.5} value={[Number(editing.radius_km ?? 2)]} onValueChange={(v) => setEditing({ ...editing, radius_km: v[0] })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Couleur</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={editing.color ?? "#8B5CF6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="w-16 h-10 p-1" />
                    <Input value={editing.color ?? "#8B5CF6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Clients couverts</Label>
                  <Input type="number" value={editing.client_count ?? 0} onChange={(e) => setEditing({ ...editing, client_count: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Codes postaux (3 premières lettres)</Label>
                <div className="flex gap-2">
                  <Input value={pcTag} onChange={(e) => setPcTag(e.target.value.toUpperCase())} placeholder="H1G" maxLength={3} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostalTag(); } }} />
                  <Button type="button" variant="outline" onClick={addPostalTag}>Ajouter</Button>
                </div>
                <div className="flex flex-wrap gap-1 min-h-[28px]">
                  {(editing.postal_codes || []).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-1 rounded">
                      {c}
                      <button type="button" onClick={() => setEditing({ ...editing, postal_codes: (editing.postal_codes || []).filter((x) => x !== c) })}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes internes</Label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button disabled={save.isPending} onClick={() => editing && save.mutate(editing)}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Supprimer cette zone ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" disabled={del.isPending} onClick={() => deleteId && del.mutate(deleteId)}>
              {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
