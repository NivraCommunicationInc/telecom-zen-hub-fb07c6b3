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
      <div className="space-y-6">
        <PageHeader
          title="Queues opérationnelles"
          subtitle="Travail quotidien — traitement par file d'attente"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Queues opérationnelles" },
          ]}
        />

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {queueTabs.map(({ label, icon, data }) => (
            <StatCard key={label} label={label} value={data.length} icon={icon} />
          ))}
        </div>

        {/* Queue Tabs */}
        <Tabs defaultValue="kyc" className="w-full">
          <TabsList className="bg-card border border-border p-1 h-auto flex-wrap gap-1">
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
          <TabsContent value="kyc" className="mt-4">
            <SectionCard title="Sessions KYC à traiter" icon={Shield} noPadding>
              <ScrollArea className="max-h-[520px]">
                {kycQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {kycQueue.map((s: any) => (
                  <QueueRow
                    key={s.id}
                    item={s.orders}
                    linkTo={`/admin/orders/${s.orders?.id}`}
                    subtitle={`${s.case_number || "—"} — ${s.orders?.client_email || "—"}`}
                    status={s.status}
                  />
                ))}
              </ScrollArea>
            </SectionCard>
          </TabsContent>

          {/* Provisioning */}
          <TabsContent value="provisioning" className="mt-4">
            <SectionCard title="Jobs provisioning en erreur" icon={Wifi} noPadding>
              <ScrollArea className="max-h-[520px]">
                {provQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {provQueue.map((j: any) => (
                  <QueueRow
                    key={j.id}
                    item={j.orders}
                    linkTo={`/admin/orders/${j.orders?.id}`}
                    subtitle={`${j.job_type} — Tentatives: ${j.attempts || 0}`}
                    status={j.status}
                  />
                ))}
              </ScrollArea>
            </SectionCard>
          </TabsContent>

          {/* Shipments */}
          <TabsContent value="shipments" className="mt-4">
            <SectionCard title="Expéditions à traiter" icon={Truck} noPadding>
              <ScrollArea className="max-h-[520px]">
                {shipQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {shipQueue.map((s: any) => (
                  <QueueRow
                    key={s.id}
                    item={s.orders}
                    linkTo={`/admin/orders/${s.orders?.id}`}
                    subtitle={`${s.shipment_number || "—"} — ${s.carrier || "À assigner"}`}
                    status={s.status}
                  />
                ))}
              </ScrollArea>
            </SectionCard>
          </TabsContent>

          {/* Installations */}
          <TabsContent value="installations" className="mt-4">
            <SectionCard title="Installations à planifier" icon={Calendar} noPadding>
              <ScrollArea className="max-h-[520px]">
                {aptQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {aptQueue.map((a: any) => (
                  <QueueRow
                    key={a.id}
                    item={a}
                    linkTo={a.order_id ? `/admin/orders/${a.order_id}` : "/admin/appointments"}
                    subtitle={`${a.title} — ${format(new Date(a.scheduled_at), "dd/MM HH:mm", { locale: fr })}`}
                    status={a.status || "scheduled"}
                  />
                ))}
              </ScrollArea>
            </SectionCard>
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="mt-4">
            <SectionCard title="Paiements en attente" icon={CreditCard} noPadding>
              <ScrollArea className="max-h-[520px]">
                {payQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {payQueue.map((o: any) => (
                  <QueueRow
                    key={o.id}
                    item={o}
                    linkTo={`/admin/orders/${o.id}`}
                    subtitle={`${o.client_email || "—"} — ${Number(o.total_amount || 0).toFixed(2)} $`}
                    status={o.payment_status}
                  />
                ))}
              </ScrollArea>
            </SectionCard>
          </TabsContent>

          {/* SLA */}
          <TabsContent value="sla" className="mt-4">
            <SectionCard title="SLA dépassé (> 48h)" icon={AlertTriangle} noPadding>
              <ScrollArea className="max-h-[520px]">
                {slaQueue.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">File vide ✓</p>}
                {slaQueue.map((o: any) => {
                  const age = differenceInHours(new Date(), new Date(o.created_at));
                  return (
                    <QueueRow
                      key={o.id}
                      item={o}
                      linkTo={`/admin/orders/${o.id}`}
                      subtitle={`${o.service_type || "—"} — ${age}h en ${o.status}`}
                      status={`${age}h`}
                    />
                  );
                })}
              </ScrollArea>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminQueues;
