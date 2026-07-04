/**
 * AddressServiceWorkspace — dossier cliquable par adresse de service.
 * Affiche l'adresse, ses services, équipements, rendez-vous, tickets et actions.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceAddressPicker } from "@/components/service-address/ServiceAddressPicker";
import { useAccountAddresses, type ServiceAddress } from "@/hooks/useAccountAddresses";
import { corePath } from "@/core-app/lib/corePaths";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ChevronRight,
  ClipboardList,
  Home,
  Loader2,
  MapPin,
  Package,
  Plus,
  Router,
  Ticket,
  Trash2,
  Wifi,
} from "lucide-react";

type WorkspaceMode = "portal" | "core";

type AddressCollections = {
  subscriptions: any[];
  equipment: any[];
  appointments: any[];
  tickets: any[];
  incidents: any[];
};

interface AddressServiceWorkspaceProps {
  accountId: string | null | undefined;
  account?: any;
  subscriptions?: any[];
  equipment?: any[];
  appointments?: any[];
  tickets?: any[];
  incidents?: any[];
  mode?: WorkspaceMode;
  allowCreate?: boolean;
  allowDelete?: boolean;
  compact?: boolean;
  className?: string;
  onChanged?: () => void;
  onAddressCreated?: (id: string, address: ServiceAddress) => void;
}

const emptyCollections = (): AddressCollections => ({
  subscriptions: [],
  equipment: [],
  appointments: [],
  tickets: [],
  incidents: [],
});

const getAddressId = (item: any) =>
  item?.service_address_id || item?.address_id || item?.serviceAddressId || item?.service_address?.id || null;

const formatAddress = (address: ServiceAddress) =>
  [address.city, address.province, address.postal_code].filter(Boolean).join(", ");

const money = (amount: any) =>
  Number(amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const dateLabel = (value: any) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" });
};

const statusLabel = (status: any) => String(status || "non défini").replaceAll("_", " ");

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex min-h-[44px] items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <Icon className="h-4 w-4 text-primary" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Row({ title, meta, badge, action }: { title: string; meta?: string; badge?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {meta && <p className="truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && <Badge variant="outline" className="capitalize">{badge}</Badge>}
        {action}
      </div>
    </div>
  );
}

function DataSection({ title, icon: Icon, count, children, empty }: { title: string; icon: any; count: number; children: React.ReactNode; empty: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {count > 0 ? <div className="space-y-2">{children}</div> : <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

export function AddressServiceWorkspace({
  accountId,
  account,
  subscriptions = [],
  equipment = [],
  appointments = [],
  tickets = [],
  incidents = [],
  mode = "portal",
  allowCreate = true,
  allowDelete = true,
  compact = false,
  className,
  onChanged,
  onAddressCreated,
}: AddressServiceWorkspaceProps) {
  const { addresses, isLoading, softDelete, deleting } = useAccountAddresses(accountId);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("address") || params.get("service_address_id");
  });

  useEffect(() => {
    if (!selectedId && addresses[0]?.id) setSelectedId(addresses[0].id);
  }, [addresses, selectedId]);

  const { byAddress, unassigned } = useMemo(() => {
    const map = new Map<string, AddressCollections>();
    for (const address of addresses) map.set(address.id, emptyCollections());
    const loose = emptyCollections();

    const push = (type: keyof AddressCollections, item: any) => {
      const id = getAddressId(item);
      if (id && map.has(id)) map.get(id)![type].push(item);
      else loose[type].push(item);
    };

    subscriptions.forEach((item) => push("subscriptions", item));
    equipment.forEach((item) => push("equipment", item));
    appointments.forEach((item) => push("appointments", item));
    tickets.forEach((item) => push("tickets", item));
    incidents.forEach((item) => push("incidents", item));

    return { byAddress: map, unassigned: loose };
  }, [addresses, subscriptions, equipment, appointments, tickets, incidents]);

  const selectedAddress = addresses.find((a) => a.id === selectedId) || addresses[0] || null;
  const selectedData = selectedAddress ? byAddress.get(selectedAddress.id) || emptyCollections() : emptyCollections();
  const existingIds = useMemo(() => new Set(addresses.map((a) => a.id)), [addresses]);
  const unassignedCount = Object.values(unassigned).reduce((sum, list) => sum + list.length, 0);

  const openAddress = (address: ServiceAddress) => {
    setSelectedId(address.id);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("address", address.id);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
  };

  const deleteAddress = async (address: ServiceAddress) => {
    if (!confirm("Supprimer cette adresse ? Elle sera masquée du compte.")) return;
    await softDelete(address.id);
    if (selectedId === address.id) setSelectedId(null);
    onChanged?.();
  };

  const portalAddressQuery = selectedAddress ? `address=${selectedAddress.id}&service_address_id=${selectedAddress.id}` : "";
  const coreAddressQuery = selectedAddress ? `account=${accountId}&service_address_id=${selectedAddress.id}` : `account=${accountId || ""}`;

  if (!accountId) {
    return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun compte lié.</p>;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Dossier multi-adresses</h3>
          <p className="text-sm text-muted-foreground">
            Chaque adresse ouvre son propre dossier: services, équipement, rendez-vous et support.
          </p>
        </div>
        {allowCreate && (
          <div className="sm:min-w-[280px]">
            <ServiceAddressPicker
              accountId={accountId}
              value={selectedId ?? undefined}
              mode="select"
              allowCreate
              emptyLabel={isLoading ? "Chargement…" : "Aucune adresse"}
              onChange={(id, address) => {
                setSelectedId(id);
                if (!existingIds.has(id)) onAddressCreated?.(id, address);
                onChanged?.();
              }}
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-border p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des adresses…
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <Home className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Aucune adresse de service</p>
          <p className="mt-1 text-sm text-muted-foreground">Ajoutez une adresse pour commander ou rattacher un service.</p>
        </div>
      ) : (
        <div className={cn("grid gap-4", compact ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(260px,360px)_1fr]") }>
          <div className="space-y-2">
            {addresses.map((address) => {
              const data = byAddress.get(address.id) || emptyCollections();
              const serviceCount = data.subscriptions.length;
              const active = selectedAddress?.id === address.id;
              return (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => openAddress(address)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors min-h-[92px]",
                    active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{address.address_line}</p>
                          <p className="truncate text-xs text-muted-foreground">{formatAddress(address) || "Québec"}</p>
                        </div>
                        <ChevronRight className={cn("mt-1 h-4 w-4 text-muted-foreground transition-transform", active && "rotate-90 text-primary")} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{serviceCount} service(s)</Badge>
                        <Badge variant="outline" className="text-[10px]">{data.equipment.length} équipement(s)</Badge>
                        {(data.appointments.length + data.tickets.length + data.incidents.length) > 0 && (
                          <Badge variant="secondary" className="text-[10px]">Suivi actif</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            {selectedAddress ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Adresse sélectionnée</Badge>
                      {account?.account_number && <Badge variant="outline">Compte #{account.account_number}</Badge>}
                    </div>
                    <h3 className="truncate text-lg font-bold text-foreground">{selectedAddress.address_line}</h3>
                    <p className="text-sm text-muted-foreground">{formatAddress(selectedAddress) || "Québec"}</p>
                  </div>
                  {allowDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deleting}
                      onClick={() => deleteAddress(selectedAddress)}
                      aria-label="Supprimer cette adresse"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <Metric icon={Wifi} label="Services" value={selectedData.subscriptions.length} />
                  <Metric icon={Package} label="Équip." value={selectedData.equipment.length} />
                  <Metric icon={Calendar} label="RDV" value={selectedData.appointments.length} />
                  <Metric icon={Ticket} label="Tickets" value={selectedData.tickets.length + selectedData.incidents.length} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {mode === "core" ? (
                    <>
                      <Button size="sm" asChild><Link to={corePath(`/pos?${coreAddressQuery}`)}><Plus className="mr-2 h-4 w-4" />Ajouter service</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={corePath(`/appointments?${coreAddressQuery}`)}><Calendar className="mr-2 h-4 w-4" />RDV</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={corePath(`/support?${coreAddressQuery}`)}><Ticket className="mr-2 h-4 w-4" />Ticket</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={corePath(`/equipment?${coreAddressQuery}`)}><Router className="mr-2 h-4 w-4" />Équipement</Link></Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" asChild><Link to={`/portal/new-order?${portalAddressQuery}`}><Plus className="mr-2 h-4 w-4" />Commander ici</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={`/portal/services?${portalAddressQuery}`}><Wifi className="mr-2 h-4 w-4" />Services</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={`/portal/equipment?${portalAddressQuery}`}><Package className="mr-2 h-4 w-4" />Équipement</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to={`/portal/tickets?${portalAddressQuery}`}><Ticket className="mr-2 h-4 w-4" />Support</Link></Button>
                    </>
                  )}
                </div>

                <DataSection title="Services sur cette adresse" icon={Wifi} count={selectedData.subscriptions.length} empty="Aucun service rattaché à cette adresse.">
                  {selectedData.subscriptions.map((sub) => (
                    <Row
                      key={sub.id || `${sub.plan_name}-${sub.created_at}`}
                      title={sub.plan_name || sub.service_name || sub.name || "Service"}
                      meta={`${sub.service_category || sub.category || "Service"} · ${money(sub.plan_price ?? sub.price ?? sub.monthly_amount)}/mois · renouvellement ${dateLabel(sub.next_renewal_at || sub.cycle_end_date)}`}
                      badge={statusLabel(sub.status)}
                      action={mode === "core" && sub.id ? <Button size="sm" variant="ghost" asChild><Link to={corePath(`/subscriptions/${sub.id}`)}>Ouvrir</Link></Button> : undefined}
                    />
                  ))}
                </DataSection>

                <DataSection title="Équipement installé / attribué" icon={Package} count={selectedData.equipment.length} empty="Aucun équipement rattaché à cette adresse.">
                  {selectedData.equipment.map((item, index) => (
                    <Row
                      key={item.id || `${item.order_id}-${index}`}
                      title={item.catalog_name || item.item_name || item.name || item.category || "Équipement"}
                      meta={`S/N: ${item.serial_number || item.mac_address || (Array.isArray(item.serial_numbers) ? item.serial_numbers.join(", ") : item.serial_numbers) || "—"}`}
                      badge={statusLabel(item.status)}
                    />
                  ))}
                </DataSection>

                <DataSection title="Rendez-vous et techniciens" icon={Calendar} count={selectedData.appointments.length} empty="Aucun rendez-vous relié à cette adresse.">
                  {selectedData.appointments.map((appt) => (
                    <Row
                      key={appt.id}
                      title={appt.appointment_type || appt.type || "Rendez-vous"}
                      meta={dateLabel(appt.scheduled_at || appt.appointment_date || appt.start_time)}
                      badge={statusLabel(appt.status)}
                    />
                  ))}
                </DataSection>

                <DataSection title="Support, tickets et incidents" icon={ClipboardList} count={selectedData.tickets.length + selectedData.incidents.length} empty="Aucun ticket ou incident relié à cette adresse.">
                  {selectedData.tickets.map((ticket) => (
                    <Row
                      key={ticket.id}
                      title={ticket.subject || ticket.title || ticket.category || "Ticket support"}
                      meta={ticket.ticket_number || ticket.case_number || dateLabel(ticket.created_at)}
                      badge={statusLabel(ticket.status)}
                    />
                  ))}
                  {selectedData.incidents.map((incident) => (
                    <Row
                      key={incident.id}
                      title={incident.title || incident.name || incident.incident_number || "Incident service"}
                      meta={dateLabel(incident.created_at || incident.started_at)}
                      badge={statusLabel(incident.status || incident.severity)}
                    />
                  ))}
                </DataSection>
              </div>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Sélectionnez une adresse.</p>
            )}
          </div>
        </div>
      )}

      {unassignedCount > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          {unassignedCount} élément(s) existent sur le compte mais ne sont pas encore rattachés à une adresse de service.
        </div>
      )}
    </div>
  );
}
