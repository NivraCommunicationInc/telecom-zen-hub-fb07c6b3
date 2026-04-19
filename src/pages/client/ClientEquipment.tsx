/**
 * ClientEquipment — Client-facing inventory of equipment assigned to their account.
 * Shows: assigned/deployed routers, TV terminals, SIMs with serial/IMEI/MAC, status,
 * deployment date, and a quick link to request a replacement.
 *
 * Read-only. RLS allows clients to SELECT equipment_inventory rows where
 * account_id IN their own accounts.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { useClientAuth } from "@/hooks/useClientAuth";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  Wifi,
  Tv,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  in_stock: { label: "En stock", cls: "bg-slate-100 text-slate-700", icon: Package },
  reserved: { label: "Réservé", cls: "bg-blue-100 text-blue-700", icon: Clock },
  assigned: { label: "Assigné", cls: "bg-amber-100 text-amber-700", icon: Clock },
  deployed: { label: "Actif", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  returned: { label: "Retourné", cls: "bg-slate-100 text-slate-700", icon: RefreshCw },
  retired: { label: "Retiré", cls: "bg-slate-100 text-slate-500", icon: AlertTriangle },
  defective: { label: "Défectueux", cls: "bg-red-100 text-red-700", icon: AlertTriangle },
};

function iconForCategory(category: string | null) {
  const c = (category || "").toLowerCase();
  if (c.includes("sim") || c.includes("esim") || c.includes("mobile")) return Smartphone;
  if (c.includes("tv") || c.includes("terminal") || c.includes("décodeur") || c.includes("decodeur")) return Tv;
  if (c.includes("borne") || c.includes("router") || c.includes("modem") || c.includes("wifi") || c.includes("internet")) return Wifi;
  return Package;
}

const ClientEquipment = () => {
  const { user } = useClientAuth();

  const { data: equipment, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["client-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Resolve client's account ids first
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", user.id);
      const accountIds = (accounts || []).map((a: any) => a.id);
      if (accountIds.length === 0) return [];

      const { data, error } = await supabase
        .from("equipment_inventory")
        .select(
          "id, catalog_name, category, sku, serial_number, imei, mac_address, status, condition, account_id, assigned_at, deployed_at, retired_at, firmware_version",
        )
        .in("account_id", accountIds)
        .order("deployed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const grouped = useMemo(() => {
    const list = equipment || [];
    return {
      active: list.filter((e: any) => e.status === "deployed" || e.status === "assigned"),
      historical: list.filter((e: any) =>
        ["returned", "retired", "defective", "in_stock", "reserved"].includes(e.status),
      ),
    };
  }, [equipment]);

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground flex items-center gap-1.5">
          <span>MonNivra</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Mon équipement</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Mon équipement</h1>
            <p className="text-muted-foreground mt-1">
              Tous les appareils Nivra associés à votre compte.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button asChild size="sm" className="bg-[#6b21e8] hover:bg-[#5a1cc7] text-white">
              <Link to="/portal/replacement">
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Demander un remplacement
              </Link>
            </Button>
          </div>
        </div>

        {/* Active equipment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Équipement actif ({grouped.active.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : grouped.active.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Aucun équipement actif</p>
                <p className="text-sm mt-1">
                  Vos appareils apparaîtront ici dès leur activation par notre équipe.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.active.map((eq: any) => (
                  <EquipmentRow key={eq.id} equipment={eq} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historical / past equipment */}
        {grouped.historical.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-500" />
                Historique ({grouped.historical.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {grouped.historical.map((eq: any) => (
                  <EquipmentRow key={eq.id} equipment={eq} muted />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Helper card */}
        <Card className="bg-[#ede9fe]/40 border-[#6b21e8]/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#6b21e8] flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-slate-900">
                  Un problème avec un appareil ?
                </p>
                <p className="text-muted-foreground mt-1">
                  Vous pouvez demander un remplacement directement depuis votre portail.
                  Notre équipe traitera votre demande sous 24-48 h ouvrables.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

function EquipmentRow({ equipment, muted = false }: { equipment: any; muted?: boolean }) {
  const Icon = iconForCategory(equipment.category);
  const cfg = STATUS_CONFIG[equipment.status] || {
    label: equipment.status,
    cls: "bg-slate-100 text-slate-700",
    icon: Package,
  };

  return (
    <div
      className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center gap-3 ${
        muted ? "border-border bg-muted/30" : "border-border bg-card"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
          muted ? "bg-slate-100" : "bg-[#ede9fe]"
        }`}
      >
        <Icon className={`w-6 h-6 ${muted ? "text-slate-500" : "text-[#6b21e8]"}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900 truncate">{equipment.catalog_name}</p>
          <Badge className={`${cfg.cls} border-0`}>{cfg.label}</Badge>
          {equipment.condition && equipment.condition !== "new" && (
            <Badge variant="outline" className="text-xs">
              {equipment.condition}
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {equipment.category && <span>{equipment.category}</span>}
          {equipment.serial_number && (
            <span className="font-mono">S/N : {equipment.serial_number}</span>
          )}
          {equipment.imei && <span className="font-mono">IMEI : {equipment.imei}</span>}
          {equipment.mac_address && (
            <span className="font-mono">MAC : {equipment.mac_address}</span>
          )}
          {equipment.firmware_version && <span>FW {equipment.firmware_version}</span>}
        </div>
        {(equipment.deployed_at || equipment.assigned_at || equipment.retired_at) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {equipment.deployed_at && (
              <>Activé le {format(parseISO(equipment.deployed_at), "d MMM yyyy", { locale: fr })}</>
            )}
            {!equipment.deployed_at && equipment.assigned_at && (
              <>Assigné le {format(parseISO(equipment.assigned_at), "d MMM yyyy", { locale: fr })}</>
            )}
            {equipment.retired_at && (
              <> · Retiré le {format(parseISO(equipment.retired_at), "d MMM yyyy", { locale: fr })}</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default ClientEquipment;
