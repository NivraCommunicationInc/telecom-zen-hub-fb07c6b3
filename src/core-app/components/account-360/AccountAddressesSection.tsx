/**
 * AccountAddressesSection — Section "Adresses & Services" du 360 Core.
 * Style aligné avec Équipements/Factures: Panel + PanelHeader + MiniTable.
 * Deux blocs séparés: (1) liste des adresses (2) dossier de l'adresse sélectionnée.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";
import { Panel, PanelHeader, InfoLine, MiniTable, trClass, fmtCAD, fmtDate, fmtDateTime, label } from "./Account360Helpers";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { useAccountAddresses, type ServiceAddress, type CreateAddressInput } from "@/hooks/useAccountAddresses";
import { Home, MapPin, Plus, Wifi, Package, Calendar, Ticket, AlertTriangle, Trash2, ShoppingCart, StickyNote, Loader2, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  account: any;
  subscriptions: any[];
  equipment: any[];
  appointments: any[];
  tickets: any[];
  incidents: any[];
  onRefresh?: () => void;
}

const getAddressId = (item: any) =>
  item?.service_address_id || item?.address_id || item?.service_address?.id || null;

const formatSecondary = (a: ServiceAddress) =>
  [a.city, a.province, a.postal_code].filter(Boolean).join(", ");

export function AccountAddressesSection({ account, subscriptions, equipment, appointments, tickets, incidents, onRefresh }: Props) {
  const accountId: string | undefined = account?.id;
  const { addresses, isLoading, create, creating, softDelete, deleting } = useAccountAddresses(accountId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedId && addresses[0]?.id) setSelectedId(addresses[0].id);
  }, [addresses, selectedId]);

  const byAddress = useMemo(() => {
    const map = new Map<string, { subs: any[]; eq: any[]; appts: any[]; tks: any[]; inc: any[] }>();
    for (const a of addresses) map.set(a.id, { subs: [], eq: [], appts: [], tks: [], inc: [] });
    const push = (key: "subs" | "eq" | "appts" | "tks" | "inc", item: any) => {
      const id = getAddressId(item);
      if (id && map.has(id)) map.get(id)![key].push(item);
    };
    subscriptions.forEach((x) => push("subs", x));
    equipment.forEach((x) => push("eq", x));
    appointments.forEach((x) => push("appts", x));
    tickets.forEach((x) => push("tks", x));
    incidents.forEach((x) => push("inc", x));
    return map;
  }, [addresses, subscriptions, equipment, appointments, tickets, incidents]);

  const selected = addresses.find((a) => a.id === selectedId) || null;
  const bucket = selected ? byAddress.get(selected.id) : null;

  // NOTE: Ajout d'adresse = multi-adresses (compte avec 2 adresses actives),
  // PAS un déménagement. On NE déclenche PAS l'email/PDF "changement d'adresse"
  // ici. Le flow déménagement reste dédié (AdminDocumentsPanel → AddressChangeDialog).

  const handleCreate = async (input: CreateAddressInput) => {
    try {
      const id = await create(input);
      setSelectedId(id);
      setAddOpen(false);
      toast({ title: "Adresse ajoutée" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async (a: ServiceAddress) => {
    const hasServices = (byAddress.get(a.id)?.subs.length || 0) > 0;
    if (hasServices) {
      toast({ title: "Impossible", description: "Retirez d'abord les services actifs de cette adresse.", variant: "destructive" });
      return;
    }
    // Double confirmation pour éviter les suppressions accidentelles.
    const first = prompt(`Pour retirer l'adresse « ${a.address_line} », tapez RETIRER (majuscules) :`);
    if (first !== "RETIRER") {
      if (first !== null) toast({ title: "Suppression annulée" });
      return;
    }
    await softDelete(a.id);
    if (selectedId === a.id) setSelectedId(null);
    toast({ title: "Adresse retirée" });
    onRefresh?.();
  };

  const q = selected ? `account=${accountId}&service_address_id=${selected.id}` : `account=${accountId || ""}`;

  return (
    <div className="space-y-3">
      {/* Bloc 1 — Liste des adresses (séparée) */}
      <Panel>
        <PanelHeader
          icon={Home}
          title="Adresses de service"
          count={addresses.length}
          actions={
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Nouvelle adresse
            </button>
          }
        />
        {isLoading ? (
          <div className="px-3 py-6 text-center text-core-text-disabled text-[11px]">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Chargement…
          </div>
        ) : addresses.length === 0 ? (
          <div className="px-3 py-6 text-center text-core-text-disabled text-[11px]">Aucune adresse enregistrée</div>
        ) : (
          <MiniTable headers={["Adresse", "Ville", "Services", "Équip.", "RDV", "Tickets", ""]}>
            {addresses.map((a) => {
              const b = byAddress.get(a.id) || { subs: [], eq: [], appts: [], tks: [], inc: [] };
              const active = selectedId === a.id;
              return (
                <tr
                  key={a.id}
                  className={`${trClass} cursor-pointer ${active ? "bg-emerald-500/5" : ""}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <td className="px-3 py-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={`h-3 w-3 ${active ? "text-emerald-400" : "text-core-text-label"}`} />
                      <span className={active ? "text-emerald-300 font-medium" : "text-core-text-primary"}>{a.address_line}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{formatSecondary(a) || "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums text-[11px]">{b.subs.length}</td>
                  <td className="px-3 py-1.5 tabular-nums text-[11px]">{b.eq.length}</td>
                  <td className="px-3 py-1.5 tabular-nums text-[11px]">{b.appts.length}</td>
                  <td className="px-3 py-1.5 tabular-nums text-[11px]">{b.tks.length + b.inc.length}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(a); }}
                      disabled={deleting}
                      className="text-core-text-label hover:text-red-400 transition-colors"
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </MiniTable>
        )}
      </Panel>

      {/* Bloc 2 — Dossier de l'adresse sélectionnée (séparé, style opérationnel) */}
      {selected && bucket && (
        <>
          <Panel>
            <PanelHeader
              icon={MapPin}
              title={`Dossier — ${selected.address_line}`}
            />
            <div className="py-1 divide-y divide-[hsl(220,15%,14%)]">
              <InfoLine label="Ville" value={formatSecondary(selected) || "—"} />
              <InfoLine label="Contact" value={selected.contact_name || "—"} />
              <InfoLine label="Téléphone" value={selected.contact_phone || "—"} mono />
              <InfoLine label="Ajoutée le" value={fmtDate(selected.created_at)} />
            </div>
            {/* Barre d'actions unifiée */}
            <div className="flex flex-wrap gap-1.5 border-t border-[hsl(220,15%,14%)] px-3 py-2">
              <ActionBtn icon={ShoppingCart} label="Commander ici" onClick={() => navigate(corePath(`/nouvelle-commande?client=${accountId}${selected ? `&adresse=${selected.id}` : ""}`))} />
              <ActionBtn icon={Wifi} label="Ajouter service" onClick={() => navigate(corePath(`/nouvelle-commande?client=${accountId}${selected ? `&adresse=${selected.id}` : ""}`))} />
              <ActionBtn icon={Calendar} label="Nouveau RDV" onClick={() => navigate(corePath(`/appointments?${q}`))} />
              <ActionBtn icon={Ticket} label="Ouvrir ticket" onClick={() => navigate(corePath(`/support?${q}`))} />
              <ActionBtn icon={Package} label="Équipement" onClick={() => navigate(corePath(`/equipment?${q}`))} />
              <ActionBtn icon={StickyNote} label="Note interne" onClick={() => navigate(corePath(`/accounts/${accountId}?tab=notes&service_address_id=${selected.id}`))} />
            </div>
          </Panel>

          {/* Services */}
          <Panel>
            <PanelHeader icon={Wifi} title="Services à cette adresse" count={bucket.subs.length} />
            <MiniTable headers={["Plan", "Prix/mois", "Statut", "Renouvellement", ""]} empty={bucket.subs.length === 0}>
              {bucket.subs.map((s: any) => (
                <tr key={s.id} className={`${trClass} cursor-pointer`} onClick={() => navigate(corePath(`/subscriptions/${s.id}`))}>
                  <td className="px-3 py-1.5 text-core-text-primary text-[11px]">{s.plan_name || s.service_name || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">{fmtCAD(s.plan_price ?? s.price ?? 0)}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(s.status)} variant={statusToVariant(s.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(s.next_renewal_at || s.cycle_end_date)}</td>
                  <td className="px-3 py-1.5 text-emerald-400 text-[10px]">Ouvrir →</td>
                </tr>
              ))}
            </MiniTable>
          </Panel>

          {/* Équipement */}
          <Panel>
            <PanelHeader icon={Package} title="Équipement à cette adresse" count={bucket.eq.length} />
            <MiniTable headers={["Article", "S/N", "MAC", "Statut", "Assigné le"]} empty={bucket.eq.length === 0}>
              {bucket.eq.map((e: any, i: number) => (
                <tr key={e.id || i} className={trClass}>
                  <td className="px-3 py-1.5 text-core-text-primary text-[11px]">{e.catalog_name || e.item_name || "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px]">{e.serial_number || (Array.isArray(e.serial_numbers) ? e.serial_numbers.join(", ") : "—")}</td>
                  <td className="px-3 py-1.5 font-mono text-core-text-label text-[10px]">{e.mac_address || "—"}</td>
                  <td className="px-3 py-1.5">{e.status ? <StatusBadge label={label(e.status)} variant={statusToVariant(e.status)} size="sm" /> : "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(e.assigned_at || e.created_at)}</td>
                </tr>
              ))}
            </MiniTable>
          </Panel>

          {/* RDV */}
          <Panel>
            <PanelHeader icon={Calendar} title="Rendez-vous à cette adresse" count={bucket.appts.length} />
            <MiniTable headers={["#", "Type", "Statut", "Date"]} empty={bucket.appts.length === 0}>
              {bucket.appts.map((a: any) => (
                <tr key={a.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-core-text-secondary text-[10px]">{a.appointment_number || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-primary text-[11px]">{a.title || a.appointment_type || a.service_type || "—"}</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(a.status)} variant={statusToVariant(a.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDateTime(a.scheduled_at)}</td>
                </tr>
              ))}
            </MiniTable>
          </Panel>

          {/* Tickets + Incidents */}
          <Panel>
            <PanelHeader icon={Ticket} title="Support à cette adresse" count={bucket.tks.length + bucket.inc.length} />
            <MiniTable headers={["#", "Sujet", "Type", "Statut", "Créé le"]} empty={(bucket.tks.length + bucket.inc.length) === 0}>
              {bucket.tks.map((t: any) => (
                <tr key={t.id} className={`${trClass} cursor-pointer`} onClick={() => navigate(corePath(`/support?ticket=${t.id}`))}>
                  <td className="px-3 py-1.5 font-mono text-emerald-400 text-[11px]">{t.ticket_number || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-primary text-[11px] max-w-[220px] truncate">{t.subject || t.title || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">Ticket</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(t.status)} variant={statusToVariant(t.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(t.created_at)}</td>
                </tr>
              ))}
              {bucket.inc.map((i: any) => (
                <tr key={i.id} className={trClass}>
                  <td className="px-3 py-1.5 font-mono text-amber-400 text-[11px]">{i.incident_number || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-primary text-[11px] max-w-[220px] truncate">{i.title || i.description || "—"}</td>
                  <td className="px-3 py-1.5 text-core-text-secondary text-[11px]">Incident</td>
                  <td className="px-3 py-1.5"><StatusBadge label={label(i.status)} variant={statusToVariant(i.status || "")} size="sm" /></td>
                  <td className="px-3 py-1.5 text-core-text-label text-[11px]">{fmtDate(i.created_at)}</td>
                </tr>
              ))}
            </MiniTable>
          </Panel>
        </>
      )}

      <AddAddressDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleCreate} submitting={creating} />
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-core-text-secondary hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/30 transition-colors"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function AddAddressDialog({ open, onOpenChange, onSubmit, submitting }: {
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact (optionnel)</Label><Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></div>
            <div><Label>Téléphone (optionnel)</Label><Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="text-[11px] px-3 py-1.5 rounded-md text-core-text-label hover:text-core-text-primary">Annuler</button>
          <button
            disabled={!valid || submitting}
            onClick={() => onSubmit(form)}
            className="text-[11px] px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin" />} Ajouter
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
