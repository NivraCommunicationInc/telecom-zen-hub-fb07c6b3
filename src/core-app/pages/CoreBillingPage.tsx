/**
 * CoreBillingPage — Transferred from AdminBillingV2.tsx
 * Billing system overview: customers, subscriptions, invoices
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Search, Users, FileText, RefreshCcw, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";

export default function CoreBillingPage() {
  const [search, setSearch] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["core-billing-customers"],
    queryFn: async () => {
      const { data } = await supabase.from("billing_customers").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["core-billing-subs-overview"],
    queryFn: async () => {
      const { data } = await supabase.from("billing_subscriptions").select("*, billing_customers(first_name, last_name, email)").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["core-billing-invoices-overview"],
    queryFn: async () => {
      const { data } = await supabase.from("billing_invoices").select("*, billing_customers(first_name, last_name, email)").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const filteredCustomers = customers.filter((c: any) =>
    !search || [c.first_name, c.last_name, c.email, c.phone].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Facturation</h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">Système de facturation Nivra</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-emerald-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Clients</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{customers.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><RefreshCcw className="w-4 h-4 text-sky-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Abonnements actifs</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{subs.filter((s: any) => s.status === "active").length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-amber-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Factures impayées</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{invoices.filter((i: any) => i.status === "issued" || i.status === "overdue").length}</p>
        </div>
      </div>

      <Tabs defaultValue="customers" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="customers" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Clients factu.</TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Abonnements</TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Factures</TabsTrigger>
        </TabsList>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>

        <TabsContent value="customers" className="space-y-2">
          {filteredCustomers.map((c: any) => (
            <div key={c.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{c.first_name} {c.last_name}</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">{c.email} · {c.phone}</p>
              </div>
              <Badge className={c.status === "active" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0"}>{c.status || "active"}</Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-2">
          {subs.map((s: any) => (
            <Link key={s.id} to={corePath(`/subscriptions/${s.id}`)} className="block p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] hover:border-emerald-600/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{s.plan_name}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{(s as any).billing_customers?.first_name} {(s as any).billing_customers?.last_name} · {s.plan_price?.toFixed(2)}$/mois</p>
                </div>
                <Badge className={s.status === "active" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}>{s.status}</Badge>
              </div>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-2">
          {invoices.map((inv: any) => (
            <Link key={inv.id} to={corePath(`/invoices/${inv.id}`)} className="block p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] hover:border-emerald-600/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{inv.invoice_number}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{(inv as any).billing_customers?.email} · {inv.total?.toFixed(2)}$</p>
                </div>
                <Badge className={
                  inv.status === "paid" ? "bg-emerald-600/15 text-emerald-400 border-0" :
                  inv.status === "overdue" ? "bg-red-500/15 text-red-400 border-0" :
                  "bg-amber-500/15 text-amber-400 border-0"
                }>{inv.status}</Badge>
              </div>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
