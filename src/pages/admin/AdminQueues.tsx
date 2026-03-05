/**
 * AdminQueues - Operational queue dashboard — TELUS-grade design
 */
import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Wifi, Truck, Calendar, CreditCard, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Link } from "react-router-dom";
import { format, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatCard } from "@/components/admin/ui/StatCard";
import { StatusBadge, statusToVariant } from "@/components/admin/ui/StatusBadge";
import { SectionCard } from "@/components/admin/ui/SectionCard";

function QueueRow({ item, linkTo, subtitle, status }: {
  item: any;
  linkTo: string;
  subtitle: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-primary/5 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono font-medium text-foreground truncate">
          {item?.order_number || item?.id?.slice(0, 8) || "—"}
        </p>
        <p className="text-[13px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge label={status} variant={statusToVariant(status)} size="sm" />
        <Link to={linkTo}>
          <Button size="sm" variant="outline" className="h-8 w-8 p-0">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

const AdminQueues = () => {
  const { data: kycQueue = [], isLoading: kycLoading } = useQuery({
    queryKey: ["queue-kyc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("identity_verification_sessions")
        .select("*, orders!inner(id, order_number, client_email)")
        .in("status", ["submitted", "in_review"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: provQueue = [], isLoading: provLoading } = useQuery({
    queryKey: ["queue-provisioning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provisioning_jobs")
        .select("*, orders!inner(id, order_number, client_email)")
        .in("status", ["failed", "blocked"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: shipQueue = [], isLoading: shipLoading } = useQuery({
    queryKey: ["queue-shipments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, orders!inner(id, order_number, client_email)")
        .in("status", ["pending", "label_created"])
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: aptQueue = [], isLoading: aptLoading } = useQuery({
    queryKey: ["queue-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .in("status", ["scheduled", "pending", "confirmed"])
        .order("scheduled_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: payQueue = [], isLoading: payLoading } = useQuery({
    queryKey: ["queue-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_email, payment_status, created_at, total_amount")
        .in("payment_status", ["pending", "failed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: slaQueue = [], isLoading: slaLoading } = useQuery({
    queryKey: ["queue-sla"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, client_email, status, payment_status, created_at, service_type")
        .lt("created_at", cutoff)
        .not("status", "in", '("active","completed","cancelled","failed")')
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const queueTabs = [
    { value: "kyc", label: "KYC", icon: Shield, data: kycQueue },
    { value: "provisioning", label: "Provisioning", icon: Wifi, data: provQueue },
    { value: "shipments", label: "Expéditions", icon: Truck, data: shipQueue },
    { value: "installations", label: "Installations", icon: Calendar, data: aptQueue },
    { value: "payments", label: "Paiements", icon: CreditCard, data: payQueue },
    { value: "sla", label: "SLA", icon: AlertTriangle, data: slaQueue },
  ];

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Page Header — flat */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Queues opérationnelles</h1>
            <p className="text-sm text-muted-foreground">Travail quotidien — traitement par file d'attente</p>
          </div>
        </div>

        {/* Summary KPIs — small inline strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {queueTabs.map(({ label, icon, data }) => (
            <StatCard key={label} label={label} value={data.length} icon={icon} />
          ))}
        </div>

        {/* Queue Tabs */}
        <Tabs defaultValue="kyc" className="w-full">
          <TabsList className="bg-secondary border border-border p-1 h-auto flex-wrap gap-1">
            {queueTabs.map(({ value, label, icon: Icon, data }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 text-sm px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
                <span className="text-xs opacity-70">({data.length})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* KYC */}
          <TabsContent value="kyc" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Sessions KYC à traiter
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Dossier</th>
                    <th>Client</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kycQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : kycQueue.map((s: any) => (
                    <tr key={s.id}>
                      <td className="font-mono">{s.orders?.order_number || s.orders?.id?.slice(0, 8) || "—"}</td>
                      <td className="font-mono text-muted-foreground">{s.case_number || "—"}</td>
                      <td>{s.orders?.client_email || "—"}</td>
                      <td><StatusBadge label={s.status} variant={statusToVariant(s.status)} size="sm" /></td>
                      <td>
                        <Link to={`/admin/orders/${s.orders?.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Provisioning */}
          <TabsContent value="provisioning" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Wifi className="h-4 w-4" /> Jobs provisioning en erreur
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Type</th>
                    <th>Tentatives</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {provQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : provQueue.map((j: any) => (
                    <tr key={j.id}>
                      <td className="font-mono">{j.orders?.order_number || "—"}</td>
                      <td>{j.job_type}</td>
                      <td>{j.attempts || 0}</td>
                      <td><StatusBadge label={j.status} variant={statusToVariant(j.status)} size="sm" /></td>
                      <td>
                        <Link to={`/admin/orders/${j.orders?.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Shipments */}
          <TabsContent value="shipments" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Truck className="h-4 w-4" /> Expéditions à traiter
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Expédition</th>
                    <th>Transporteur</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shipQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : shipQueue.map((s: any) => (
                    <tr key={s.id}>
                      <td className="font-mono">{s.orders?.order_number || "—"}</td>
                      <td className="font-mono text-muted-foreground">{s.shipment_number || "—"}</td>
                      <td>{s.carrier || "À assigner"}</td>
                      <td><StatusBadge label={s.status} variant={statusToVariant(s.status)} size="sm" /></td>
                      <td>
                        <Link to={`/admin/orders/${s.orders?.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Installations */}
          <TabsContent value="installations" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Installations à planifier
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Titre</th>
                    <th>Date prévue</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {aptQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : aptQueue.map((a: any) => (
                    <tr key={a.id}>
                      <td className="font-mono">{a.order_id ? a.order_id.slice(0, 8) : "—"}</td>
                      <td>{a.title}</td>
                      <td className="whitespace-nowrap">{format(new Date(a.scheduled_at), "dd/MM HH:mm", { locale: fr })}</td>
                      <td><StatusBadge label={a.status || "scheduled"} variant={statusToVariant(a.status || "scheduled")} size="sm" /></td>
                      <td>
                        <Link to={a.order_id ? `/admin/orders/${a.order_id}` : "/admin/appointments"}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Paiements en attente
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Client</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : payQueue.map((o: any) => (
                    <tr key={o.id}>
                      <td className="font-mono">{o.order_number || o.id.slice(0, 8)}</td>
                      <td>{o.client_email || "—"}</td>
                      <td className="tabular-nums">{Number(o.total_amount || 0).toFixed(2)} $</td>
                      <td><StatusBadge label={o.payment_status} variant={statusToVariant(o.payment_status)} size="sm" /></td>
                      <td>
                        <Link to={`/admin/orders/${o.id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* SLA */}
          <TabsContent value="sla" className="mt-3">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> SLA dépassé (&gt; 48h)
            </div>
            <div className="overflow-x-auto -mx-4 lg:-mx-6">
              <table className="w-full text-sm table-pro">
                <thead>
                  <tr>
                    <th>Commande</th>
                    <th>Service</th>
                    <th>Statut</th>
                    <th>Âge</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {slaQueue.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">File vide ✓</td></tr>
                  ) : slaQueue.map((o: any) => {
                    const age = differenceInHours(new Date(), new Date(o.created_at));
                    return (
                      <tr key={o.id}>
                        <td className="font-mono">{o.order_number || o.id.slice(0, 8)}</td>
                        <td>{o.service_type || "—"}</td>
                        <td><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                        <td className="text-amber-400 font-medium">{age}h</td>
                        <td>
                          <Link to={`/admin/orders/${o.id}`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs">Ouvrir</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminQueues;
