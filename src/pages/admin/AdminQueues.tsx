/**
 * AdminQueues - Operational queue dashboard for carrier-grade processing
 */
import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Wifi, Truck, Calendar, CreditCard, AlertTriangle, ArrowRight, Loader2, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Link } from "react-router-dom";
import { format, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";

function QueueCard({ item, linkTo, subtitle, badge, badgeColor }: {
  item: any;
  linkTo: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700/50 hover:border-teal-500/30 transition-colors">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-mono truncate">{item.order_number || item.id?.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={badgeColor}>{badge}</Badge>
            <Link to={linkTo}>
              <Button size="sm" variant="ghost"><ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const AdminQueues = () => {
  // KYC Queue
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

  // Provisioning errors
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

  // Shipments pending
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

  // Appointments / Installations pending
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

  // Payment failures
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

  // SLA breached (orders older than 48h still not active/completed)
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

  const isLoading = kycLoading || provLoading || shipLoading || aptLoading || payLoading || slaLoading;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Queues opérationnelles</h1>
          <p className="text-sm text-muted-foreground">Travail quotidien — traitement par file d'attente</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "KYC", count: kycQueue.length, icon: Shield, color: "text-purple-400" },
            { label: "Provisioning", count: provQueue.length, icon: Wifi, color: "text-red-400" },
            { label: "Expéditions", count: shipQueue.length, icon: Truck, color: "text-cyan-400" },
            { label: "Installations", count: aptQueue.length, icon: Calendar, color: "text-blue-400" },
            { label: "Paiements", count: payQueue.length, icon: CreditCard, color: "text-amber-400" },
            { label: "SLA dépassé", count: slaQueue.length, icon: AlertTriangle, color: "text-red-400" },
          ].map(({ label, count, icon: Icon, color }) => (
            <Card key={label} className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="pt-4 pb-4 text-center">
                <Icon className={`h-5 w-5 mx-auto ${color}`} />
                <p className="text-2xl font-bold text-white mt-1">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Queue Tabs */}
        <Tabs defaultValue="kyc" className="w-full">
          <TabsList className="bg-slate-800/80 border border-slate-700/50 flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="kyc" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> KYC ({kycQueue.length})
            </TabsTrigger>
            <TabsTrigger value="provisioning" className="gap-1.5">
              <Wifi className="h-3.5 w-3.5" /> Provisioning ({provQueue.length})
            </TabsTrigger>
            <TabsTrigger value="shipments" className="gap-1.5">
              <Truck className="h-3.5 w-3.5" /> Expéditions ({shipQueue.length})
            </TabsTrigger>
            <TabsTrigger value="installations" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Installations ({aptQueue.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Paiements ({payQueue.length})
            </TabsTrigger>
            <TabsTrigger value="sla" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> SLA ({slaQueue.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kyc">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {kycQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {kycQueue.map((s: any) => (
                  <QueueCard
                    key={s.id}
                    item={s.orders}
                    linkTo={`/admin/orders/${s.orders?.id}`}
                    subtitle={`${s.case_number || "—"} — ${s.orders?.client_email || "—"}`}
                    badge={s.status}
                    badgeColor={s.ocr_match_status === "mismatch" ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400"}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="provisioning">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {provQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {provQueue.map((j: any) => (
                  <QueueCard
                    key={j.id}
                    item={j.orders}
                    linkTo={`/admin/orders/${j.orders?.id}`}
                    subtitle={`${j.job_type} — Tentatives: ${j.attempts || 0}`}
                    badge={j.status}
                    badgeColor="bg-red-500/20 text-red-400"
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="shipments">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {shipQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {shipQueue.map((s: any) => (
                  <QueueCard
                    key={s.id}
                    item={s.orders}
                    linkTo={`/admin/orders/${s.orders?.id}`}
                    subtitle={`${s.shipment_number || "—"} — ${s.carrier || "À assigner"}`}
                    badge={s.status}
                    badgeColor="bg-cyan-500/20 text-cyan-400"
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="installations">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {aptQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {aptQueue.map((a: any) => (
                  <QueueCard
                    key={a.id}
                    item={a}
                    linkTo={a.order_id ? `/admin/orders/${a.order_id}` : "/admin/appointments"}
                    subtitle={`${a.title} — ${format(new Date(a.scheduled_at), "dd/MM HH:mm", { locale: fr })}`}
                    badge={a.status || "scheduled"}
                    badgeColor="bg-blue-500/20 text-blue-400"
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="payments">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {payQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {payQueue.map((o: any) => (
                  <QueueCard
                    key={o.id}
                    item={o}
                    linkTo={`/admin/orders/${o.id}`}
                    subtitle={`${o.client_email || "—"} — ${Number(o.total_amount || 0).toFixed(2)} $`}
                    badge={o.payment_status}
                    badgeColor={o.payment_status === "failed" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sla">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {slaQueue.length === 0 && <p className="text-center text-muted-foreground py-8">File vide ✓</p>}
                {slaQueue.map((o: any) => {
                  const age = differenceInHours(new Date(), new Date(o.created_at));
                  return (
                    <QueueCard
                      key={o.id}
                      item={o}
                      linkTo={`/admin/orders/${o.id}`}
                      subtitle={`${o.service_type || "—"} — ${age}h en ${o.status}`}
                      badge={`${age}h`}
                      badgeColor="bg-red-500/20 text-red-400"
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminQueues;
