/**
 * ServicesByAddress — Telecom-grade address-grouped services view.
 * Groups billing_subscriptions + equipment by service_address.
 * Used in both Services and Equipment tabs.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Wifi, Tv, Smartphone, Shield, Package, MapPin, Building2,
  ChevronDown, Clock, Pause, MonitorPlay, CheckCircle, AlertTriangle,
  ArrowUpCircle, History, CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";

// ----- Types -----
interface ServiceItem {
  id: string;
  plan_name: string;
  amount: number;
  status: string;
  service_type?: string;
  billing_cycle?: string;
  cycle_start_date?: string;
  cycle_end_date?: string;
  created_at?: string;
  parent_plan_name?: string;
  source?: string;
  address_id?: string | null;
  address_label?: string;
  address_line?: string;
  address_city?: string;
  [key: string]: any;
}

interface EquipmentItem {
  id: string;
  service_name: string;
  service_code: string;
  unit_price: number;
  quantity: number;
  added_at?: string;
  parent_plan_name?: string;
  subscription_status?: string;
  address_id?: string | null;
  address_label?: string;
  address_line?: string;
  address_city?: string;
  [key: string]: any;
}

interface AddressGroup {
  address_id: string | null;
  label: string;
  line: string;
  city: string;
  services: ServiceItem[];
  equipment: EquipmentItem[];
}

// ----- Helpers -----
const getServiceIcon = (type: string) => {
  const t = (type || "").toLowerCase();
  if (t.includes("streaming")) return MonitorPlay;
  if (t.includes("internet") || t.includes("fibre")) return Wifi;
  if (t.includes("tv") || t.includes("giga")) return Tv;
  if (t.includes("mobile")) return Smartphone;
  if (t.includes("security") || t.includes("sécurité")) return Shield;
  return Package;
};

const getCategory = (name: string) => {
  const n = (name || "").toLowerCase();
  if (n.includes("streaming")) return "Streaming";
  if (n.includes("mobile")) return "Mobile";
  if (n.includes("tv") || n.includes("giga")) return "TV";
  if (n.includes("internet") || n.includes("fibre")) return "Internet";
  return "Autre";
};

const statusBadge = (status: string) => {
  switch (status) {
    case "active": return <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">Actif</Badge>;
    case "pending": return <Badge className="bg-amber-500/20 text-amber-500 text-xs"><Clock className="w-3 h-3 mr-0.5" />En attente</Badge>;
    case "paused": return <Badge className="bg-amber-500/20 text-amber-500 text-xs"><Pause className="w-3 h-3 mr-0.5" />En pause</Badge>;
    case "suspended": return <Badge className="bg-red-500/20 text-red-500 text-xs"><AlertTriangle className="w-3 h-3 mr-0.5" />Suspendu</Badge>;
    case "cancelled":
    case "expired": return <Badge className="bg-red-500/20 text-red-500 text-xs">Annulé</Badge>;
    default: return <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">Actif</Badge>;
  }
};

// ----- Grouping logic -----
function groupByAddress(services: ServiceItem[], equipment: EquipmentItem[]): AddressGroup[] {
  const map = new Map<string, AddressGroup>();

  const getKey = (item: { address_id?: string | null; address_label?: string; address_line?: string; address_city?: string }) => {
    return item.address_id || item.address_line || "__no_address__";
  };

  for (const svc of services) {
    const key = getKey(svc);
    if (!map.has(key)) {
      map.set(key, {
        address_id: svc.address_id || null,
        label: svc.address_label || "",
        line: svc.address_line || "",
        city: svc.address_city || "",
        services: [],
        equipment: [],
      });
    }
    map.get(key)!.services.push(svc);
  }

  for (const eq of equipment) {
    const key = getKey(eq);
    if (!map.has(key)) {
      map.set(key, {
        address_id: eq.address_id || null,
        label: eq.address_label || "",
        line: eq.address_line || "",
        city: eq.address_city || "",
        services: [],
        equipment: [],
      });
    }
    map.get(key)!.equipment.push(eq);
  }

  // Sort: addressed groups first, then "no address"
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (!a.line && b.line) return 1;
    if (a.line && !b.line) return -1;
    return (a.label || a.line).localeCompare(b.label || b.line);
  });

  return groups;
}

// ----- Components -----

function ServiceRow({ service, onAction }: { service: ServiceItem; onAction?: (action: string, svc: ServiceItem) => void }) {
  const Icon = getServiceIcon(service.plan_name || service.service_type || "");
  const category = getCategory(service.plan_name || service.service_type || "");
  const isCancelled = service.status === "cancelled" || service.status === "expired";

  return (
    <div className={cn("flex items-start gap-3 py-3", isCancelled && "opacity-50")}>
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        service.status === "active" ? "bg-accent/15" : "bg-muted"
      )}>
        <Icon className={cn("w-4.5 h-4.5", service.status === "active" ? "text-accent" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-foreground">{service.plan_name}</span>
          {statusBadge(service.status)}
          <Badge variant="outline" className="text-xs">{category}</Badge>
        </div>
        {service.source === "billing_v2_service" && service.parent_plan_name && (
          <p className="text-xs text-muted-foreground mt-0.5">Forfait: {service.parent_plan_name}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {Number(service.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{service.billing_cycle === "monthly" ? "mois" : "an"}
          </span>
          {service.cycle_start_date && (
            <span>
              {format(new Date(service.cycle_start_date), "d MMM yyyy", { locale: fr })}
              {service.cycle_end_date && ` — ${format(new Date(service.cycle_end_date), "d MMM yyyy", { locale: fr })}`}
            </span>
          )}
        </div>
      </div>
      {onAction && (
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAction("upgrade", service)} title="Changer forfait">
            <ArrowUpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAction("schedule", service)} title="Programmer">
            <CalendarIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAction("history", service)} title="Historique">
            <History className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function EquipmentRow({ eq, onReport }: { eq: EquipmentItem; onReport?: (eq: EquipmentItem) => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{eq.service_name}</span>
          <Badge variant="outline" className="text-xs">{eq.service_code}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {Number(eq.unit_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          {eq.quantity > 1 && ` × ${eq.quantity}`}
          {eq.parent_plan_name && ` • ${eq.parent_plan_name}`}
        </p>
      </div>
      {onReport && (
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => onReport(eq)}>
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          Signaler
        </Button>
      )}
    </div>
  );
}

function AddressSection({
  group,
  defaultOpen = true,
  onServiceAction,
  onEquipmentReport,
}: {
  group: AddressGroup;
  defaultOpen?: boolean;
  onServiceAction?: (action: string, svc: ServiceItem) => void;
  onEquipmentReport?: (eq: EquipmentItem) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasAddress = !!group.line;
  const activeCount = group.services.filter(s => s.status === "active").length;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              hasAddress ? "bg-accent/15" : "bg-muted"
            )}>
              {hasAddress ? (
                <MapPin className="w-5 h-5 text-accent" />
              ) : (
                <Building2 className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground">
                  {hasAddress ? (group.label || group.line) : "Services sans adresse"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {activeCount} service{activeCount !== 1 ? "s" : ""}
                </Badge>
                {group.equipment.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {group.equipment.length} équipement{group.equipment.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {hasAddress && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {group.line}{group.city ? `, ${group.city}` : ""}
                </p>
              )}
            </div>
            <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <div className="px-4 pb-4">
            {/* Services */}
            {group.services.length > 0 && (
              <div className="divide-y divide-border">
                {group.services.map(svc => (
                  <ServiceRow key={svc.id} service={svc} onAction={onServiceAction} />
                ))}
              </div>
            )}

            {/* Equipment */}
            {group.equipment.length > 0 && (
              <>
                <div className="mt-3 mb-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Équipements
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {group.equipment.map(eq => (
                    <EquipmentRow key={eq.id} eq={eq} onReport={onEquipmentReport} />
                  ))}
                </div>
              </>
            )}

            {group.services.length === 0 && group.equipment.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucun service à cette adresse</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ----- Main Export -----
export function ServicesByAddress({
  services,
  equipment,
  onServiceAction,
  onEquipmentReport,
}: {
  services: ServiceItem[];
  equipment: EquipmentItem[];
  onServiceAction?: (action: string, svc: any) => void;
  onEquipmentReport?: (eq: any) => void;
}) {
  const groups = groupByAddress(services, equipment);

  if (groups.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Aucun service actif</p>
          <Button variant="default" className="mt-4" asChild>
            <a href="/portal/new-order">Commander un service</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-emerald-500" />
        <span>
          {services.filter(s => s.status === "active").length} service{services.filter(s => s.status === "active").length !== 1 ? "s" : ""} actif{services.filter(s => s.status === "active").length !== 1 ? "s" : ""}
          {equipment.length > 0 && ` • ${equipment.length} équipement${equipment.length !== 1 ? "s" : ""}`}
          {` • ${groups.filter(g => !!g.line).length} adresse${groups.filter(g => !!g.line).length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {groups.map((group, i) => (
        <AddressSection
          key={group.address_id || `no-addr-${i}`}
          group={group}
          defaultOpen={i < 3}
          onServiceAction={onServiceAction}
          onEquipmentReport={onEquipmentReport}
        />
      ))}
    </div>
  );
}
