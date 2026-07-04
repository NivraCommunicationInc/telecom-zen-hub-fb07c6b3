/**
 * ClientAddressWorkspace — Portail Client, style opérateur télécom pro.
 * Deux blocs séparés: (1) mes adresses + ajouter, (2) dossier de l'adresse sélectionnée.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { useAccountAddresses, type ServiceAddress, type CreateAddressInput } from "@/hooks/useAccountAddresses";
import { useToast } from "@/hooks/use-toast";
import { Home, MapPin, Plus, Wifi, Package, Calendar, LifeBuoy, ShoppingBag, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  accountId: string | null | undefined;
  subscriptions?: any[];
  equipment?: any[];
  appointments?: any[];
  tickets?: any[];
}

const getAddressId = (item: any) =>
  item?.service_address_id || item?.address_id || item?.service_address?.id || null;

const secondary = (a: ServiceAddress) =>
  [a.city, a.province, a.postal_code].filter(Boolean).join(", ");

export function ClientAddressWorkspace({ accountId, subscriptions = [], equipment = [], appointments = [], tickets = [] }: Props) {
  const { addresses, isLoading, create, creating, softDelete } = useAccountAddresses(accountId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedId && addresses[0]?.id) setSelectedId(addresses[0].id);
  }, [addresses, selectedId]);

  const buckets = useMemo(() => {
    const map = new Map<string, { subs: any[]; eq: any[]; appts: any[]; tks: any[] }>();
    for (const a of addresses) map.set(a.id, { subs: [], eq: [], appts: [], tks: [] });
    const push = (k: "subs" | "eq" | "appts" | "tks", item: any) => {
      const id = getAddressId(item);
      if (id && map.has(id)) map.get(id)![k].push(item);
    };
    subscriptions.forEach((x) => push("subs", x));
    equipment.forEach((x) => push("eq", x));
    appointments.forEach((x) => push("appts", x));
    tickets.forEach((x) => push("tks", x));
    return map;
  }, [addresses, subscriptions, equipment, appointments, tickets]);

  const selected = addresses.find((a) => a.id === selectedId) || null;
  const b = selected ? buckets.get(selected.id) : null;

  const handleCreate = async (input: CreateAddressInput) => {
    try {
      const id = await create(input);
      setSelectedId(id);
      setAddOpen(false);
      toast({ title: "Adresse ajoutée" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async (a: ServiceAddress) => {
    const hasServices = (buckets.get(a.id)?.subs.length || 0) > 0;
    if (hasServices) {
      toast({ title: "Impossible", description: "Cette adresse a encore des services actifs.", variant: "destructive" });
      return;
    }
    if (!confirm(`Retirer l'adresse « ${a.address_line} » ?`)) return;
    await softDelete(a.id);
    if (selectedId === a.id) setSelectedId(null);
    toast({ title: "Adresse retirée" });
  };

  const q = selected ? `service_address_id=${selected.id}` : "";

  if (!accountId) {
    return <p className="text-sm text-muted-foreground">Compte introuvable.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Bloc 1 — Liste */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-primary" /> Mes adresses ({addresses.length})
          </CardTitle>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter une adresse
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Aucune adresse. Ajoutez-en une pour commander un service.
            </div>
          ) : (
            <div className="grid gap-2">
              {addresses.map((a) => {
                const bk = buckets.get(a.id) || { subs: [], eq: [], appts: [], tks: [] };
                const active = selectedId === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{a.address_line}</p>
                        <p className="truncate text-xs text-muted-foreground">{secondary(a) || "Québec"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{bk.subs.length} svc</Badge>
                      <Badge variant="outline" className="text-[10px]">{bk.eq.length} équip</Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground", active && "text-primary")} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bloc 2 — Dossier */}
      {selected && b && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" /> {selected.address_line}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{secondary(selected) || "Québec"}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to={`/portal/new-order?${q}`}><ShoppingBag className="mr-1 h-4 w-4" /> Commander un service ici</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/portal/appointments?${q}`}><Calendar className="mr-1 h-4 w-4" /> Prendre RDV</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/portal/support?${q}`}><LifeBuoy className="mr-1 h-4 w-4" /> Ouvrir un ticket</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/portal/services?${q}`}><Wifi className="mr-1 h-4 w-4" /> Mes services</Link>
              </Button>
            </div>

            {/* Sub-blocs */}
            <SubList title="Services" icon={Wifi} count={b.subs.length} empty="Aucun service à cette adresse.">
              {b.subs.map((s: any) => (
                <ItemRow key={s.id} title={s.plan_name || s.service_name || "Service"} meta={`${Number(s.plan_price || 0).toFixed(2)} $/mois`} badge={String(s.status || "").replace(/_/g, " ")} />
              ))}
            </SubList>
            <SubList title="Équipement" icon={Package} count={b.eq.length} empty="Aucun équipement à cette adresse.">
              {b.eq.map((e: any, i: number) => (
                <ItemRow key={e.id || i} title={e.catalog_name || e.item_name || "Équipement"} meta={`S/N: ${e.serial_number || "—"}`} badge={String(e.status || "").replace(/_/g, " ")} />
              ))}
            </SubList>
            <SubList title="Rendez-vous" icon={Calendar} count={b.appts.length} empty="Aucun rendez-vous à cette adresse.">
              {b.appts.map((a: any) => (
                <ItemRow key={a.id} title={a.title || a.appointment_type || "Rendez-vous"} meta={a.scheduled_at ? new Date(a.scheduled_at).toLocaleString("fr-CA") : "—"} badge={String(a.status || "").replace(/_/g, " ")} />
              ))}
            </SubList>
            <SubList title="Support" icon={LifeBuoy} count={b.tks.length} empty="Aucun ticket à cette adresse.">
              {b.tks.map((t: any) => (
                <ItemRow key={t.id} title={t.subject || t.title || "Ticket"} meta={t.ticket_number || ""} badge={String(t.status || "").replace(/_/g, " ")} />
              ))}
            </SubList>
          </CardContent>
        </Card>
      )}

      <AddDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleCreate} submitting={creating} />
    </div>
  );
}

function SubList({ title, icon: Icon, count, empty, children }: { title: string; icon: any; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {count > 0 ? <div className="space-y-2">{children}</div> : <p className="text-xs text-muted-foreground italic">{empty}</p>}
    </section>
  );
}

function ItemRow({ title, meta, badge }: { title: string; meta?: string; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      {badge && <Badge variant="outline" className="capitalize text-xs">{badge}</Badge>}
    </div>
  );
}

function AddDialog({ open, onOpenChange, onSubmit, submitting }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateAddressInput) => Promise<void>;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CreateAddressInput>({ address_line: "", city: "", province: "QC", postal_code: "", country: "CA" });
  const set = (k: keyof CreateAddressInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.address_line.trim() && form.city.trim() && form.postal_code.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle adresse de service</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Adresse</Label>
            <AddressAutocomplete
              value={form.address_line}
              onValueChange={(v) => set("address_line", v)}
              onSelect={(d: AddressValue) => setForm((f) => ({
                ...f,
                address_line: d.formatted || d.line1 || f.address_line,
                city: d.city || f.city,
                postal_code: d.postalCode || f.postal_code,
                province: d.region || f.province,
              }))}
              placeholder="Rechercher une adresse au Québec…"
              restrictToQuebec
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ville</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div><Label>Code postal</Label><Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></div>
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
