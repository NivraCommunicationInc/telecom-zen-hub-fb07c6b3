/**
 * CoreCoveragePage — Couverture réseau
 * Gère les zones de service Nivra (postal, ville, services, vitesse max, statut).
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  MapPin, Plus, Search, Wifi, Tv, Smartphone, Shield, Loader2,
  Pencil, Trash2, CheckCircle2, Clock, XCircle,
} from "lucide-react";

type ZoneStatus = "active" | "coming_soon" | "unavailable";
type FilterKey = "all" | ZoneStatus;

interface CoverageZone {
  id: string;
  name: string;
  region: string;
  postal_code_prefix: string | null;
  city: string | null;
  province: string;
  internet_available: boolean;
  tv_available: boolean;
  mobile_available: boolean;
  security_available: boolean;
  max_speed_mbps: number | null;
  status: ZoneStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_META: Record<ZoneStatus, { label: string; tone: string; icon: any }> = {
  active:       { label: "Active",      tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  coming_soon:  { label: "Bientôt",     tone: "bg-amber-500/15 text-amber-500 border-amber-500/30",      icon: Clock },
  unavailable:  { label: "Indisponible", tone: "bg-destructive/15 text-destructive border-destructive/30", icon: XCircle },
};

const emptyZone = (): Partial<CoverageZone> => ({
  name: "", region: "", postal_code_prefix: "", city: "", province: "QC",
  internet_available: false, tv_available: false, mobile_available: false, security_available: false,
  max_speed_mbps: null, status: "active", notes: "",
});

export default function CoreCoveragePage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<CoverageZone> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["core-coverage-zones"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coverage_zones" as any)
        .select("*")
        .order("region", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CoverageZone[];
    },
  });

  const stats = useMemo(() => ({
    all: zones.length,
    active: zones.filter(z => z.status === "active").length,
    coming_soon: zones.filter(z => z.status === "coming_soon").length,
    unavailable: zones.filter(z => z.status === "unavailable").length,
  }), [zones]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zones.filter(z => {
      if (filter !== "all" && z.status !== filter) return false;
      if (!q) return true;
      return (
        z.name?.toLowerCase().includes(q) ||
        z.region?.toLowerCase().includes(q) ||
        z.city?.toLowerCase().includes(q) ||
        z.postal_code_prefix?.toLowerCase().includes(q)
      );
    });
  }, [zones, filter, search]);

  const saveMutation = useMutation({
    mutationFn: async (z: Partial<CoverageZone>) => {
      const payload: any = {
        name: z.name?.trim(),
        region: z.region?.trim(),
        postal_code_prefix: z.postal_code_prefix?.trim().toUpperCase().slice(0, 3) || null,
        city: z.city?.trim() || null,
        province: (z.province || "QC").toUpperCase().slice(0, 2),
        internet_available: !!z.internet_available,
        tv_available: !!z.tv_available,
        mobile_available: !!z.mobile_available,
        security_available: !!z.security_available,
        max_speed_mbps: z.max_speed_mbps ? Number(z.max_speed_mbps) : null,
        status: z.status || "active",
        notes: z.notes?.trim() || null,
      };
      if (!payload.name || !payload.region) {
        throw new Error("Nom et région obligatoires");
      }
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coverage_zones" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone supprimée");
      qc.invalidateQueries({ queryKey: ["core-coverage-zones"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Couverture réseau
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zones de service Nivra — disponibilité par région et code postal
          </p>
        </div>
        <Button onClick={() => setEditing(emptyZone())}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle zone
        </Button>
      </div>

      {/* Filter pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: "all" as FilterKey, label: "Total", value: stats.all, tone: "" },
          { key: "active" as FilterKey, label: "Actives", value: stats.active, tone: STATUS_META.active.tone },
          { key: "coming_soon" as FilterKey, label: "Bientôt", value: stats.coming_soon, tone: STATUS_META.coming_soon.tone },
          { key: "unavailable" as FilterKey, label: "Indisponibles", value: stats.unavailable, tone: STATUS_META.unavailable.tone },
        ]).map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setFilter(p.key)}
            className={`text-left rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 ${filter === p.key ? "border-primary ring-1 ring-primary/40" : "border-border"} ${p.tone}`}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.label}</div>
            <div className="text-xl font-bold mt-1">{p.value}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher : nom, région, ville, code postal…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zones ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Aucune zone {filter !== "all" ? `(${STATUS_META[filter as ZoneStatus]?.label.toLowerCase()})` : ""}.
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setEditing(emptyZone())}>
                  <Plus className="h-4 w-4 mr-2" /> Créer la première
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone</TableHead>
                  <TableHead>Région / Ville</TableHead>
                  <TableHead>Code postal</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Vitesse max</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(z => {
                  const cfg = STATUS_META[z.status];
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={z.id}>
                      <TableCell className="font-medium">{z.name}</TableCell>
                      <TableCell className="text-sm">
                        <div>{z.region}</div>
                        {z.city && <div className="text-xs text-muted-foreground">{z.city}, {z.province}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{z.postal_code_prefix ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          {z.internet_available && <Wifi className="h-3.5 w-3.5 text-emerald-500" aria-label="Internet" />}
                          {z.tv_available && <Tv className="h-3.5 w-3.5 text-blue-500" aria-label="TV" />}
                          {z.mobile_available && <Smartphone className="h-3.5 w-3.5 text-purple-500" aria-label="Mobile" />}
                          {z.security_available && <Shield className="h-3.5 w-3.5 text-amber-500" aria-label="Sécurité" />}
                          {!z.internet_available && !z.tv_available && !z.mobile_available && !z.security_available && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{z.max_speed_mbps ? `${z.max_speed_mbps} Mbps` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cfg.tone}>
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(z)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(z.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier la zone" : "Nouvelle zone de couverture"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nom *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex: Montréal Centre" />
                </div>
                <div className="space-y-1.5">
                  <Label>Région *</Label>
                  <Input value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} placeholder="Ex: Montréal" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ville</Label>
                  <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Code postal (3 lettres)</Label>
                  <Input value={editing.postal_code_prefix ?? ""} onChange={(e) => setEditing({ ...editing, postal_code_prefix: e.target.value.toUpperCase() })} maxLength={3} placeholder="H2X" />
                </div>
                <div className="space-y-1.5">
                  <Label>Province</Label>
                  <Input value={editing.province ?? "QC"} onChange={(e) => setEditing({ ...editing, province: e.target.value.toUpperCase() })} maxLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Vitesse max (Mbps)</Label>
                  <Input type="number" value={editing.max_speed_mbps ?? ""} onChange={(e) => setEditing({ ...editing, max_speed_mbps: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={editing.status ?? "active"} onValueChange={(v) => setEditing({ ...editing, status: v as ZoneStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="coming_soon">Bientôt disponible</SelectItem>
                    <SelectItem value="unavailable">Indisponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Services disponibles</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "internet_available" as const, label: "Internet", icon: Wifi },
                    { key: "tv_available" as const, label: "Télévision", icon: Tv },
                    { key: "mobile_available" as const, label: "Mobile", icon: Smartphone },
                    { key: "security_available" as const, label: "Sécurité", icon: Shield },
                  ].map(s => {
                    const Ico = s.icon;
                    const on = !!(editing as any)[s.key];
                    return (
                      <label key={s.key} className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setEditing({ ...editing, [s.key]: e.target.checked })}
                        />
                        <Ico className="h-4 w-4" />
                        <span className="text-sm">{s.label}</span>
                      </label>
                    );
                  })}
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
            <Button
              disabled={saveMutation.isPending}
              onClick={() => editing && saveMutation.mutate(editing)}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette zone ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action est irréversible. La zone ne sera plus disponible pour la vérification de couverture publique.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
