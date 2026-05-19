/**
 * ClientSummaryCard — fiche condensée du client sélectionné.
 * Toutes lectures non-bloquantes, agrégées en parallèle.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Mail, Wallet, Receipt, AlertTriangle, Wifi, Ticket } from "lucide-react";
import type { PickedClient } from "./ClientPicker";

const formatCAD = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

interface Props {
  client: PickedClient;
}

export default function ClientSummaryCard({ client }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-console-client-summary", client.id],
    queryFn: async () => {
      const [invoices, services, tickets] = await Promise.all([
        supabase.from("billing_invoices")
          .select("id, status, total, balance, due_date")
          .eq("customer_id", client.id).limit(200),
        supabase.from("billing_services" as any)
          .select("id, status, service_type")
          .eq("customer_id", client.id).limit(50),
        client.user_id
          ? supabase.from("tickets" as any)
              .select("id, status")
              .eq("user_id", client.user_id).limit(50)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const invs = (invoices.data ?? []) as any[];
      const overdue = invs.filter((i) => Number(i.balance ?? 0) > 0 && i.due_date && new Date(i.due_date) < new Date());
      const balance = invs.reduce((acc, i) => acc + Number(i.balance ?? 0), 0);
      const svcs = (services.data ?? []) as any[];
      const activeServices = svcs.filter((s) => ["active", "activated"].includes(String(s.status ?? "").toLowerCase()));
      const openTickets = ((tickets.data ?? []) as any[]).filter((t) => !["closed", "resolved"].includes(String(t.status ?? "").toLowerCase())).length;

      return {
        balance,
        overdueCount: overdue.length,
        invoiceCount: invs.length,
        activeServiceCount: activeServices.length,
        servicesByType: svcs.reduce<Record<string, number>>((acc, s) => {
          const t = String(s.service_type ?? "—");
          acc[t] = (acc[t] ?? 0) + 1;
          return acc;
        }, {}),
        openTickets,
      };
    },
  });

  const fullName = [client.first_name, client.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div className="p-4 rounded-xl border border-core-border bg-core-card space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-core-accent/15 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-core-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-core-text-primary truncate">{fullName}</h2>
          <p className="text-xs text-core-text-secondary truncate flex items-center gap-1">
            <Mail className="w-3 h-3" /> {client.email ?? "—"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-core-text-label">Chargement du résumé…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat icon={Wallet} label="Balance" value={formatCAD(data?.balance)} tone={Number(data?.balance ?? 0) > 0 ? "warn" : "ok"} />
          <Stat icon={AlertTriangle} label="En retard" value={String(data?.overdueCount ?? 0)} tone={Number(data?.overdueCount ?? 0) > 0 ? "danger" : "ok"} />
          <Stat icon={Receipt} label="Factures" value={String(data?.invoiceCount ?? 0)} />
          <Stat icon={Wifi} label="Services actifs" value={String(data?.activeServiceCount ?? 0)} />
          <Stat icon={Ticket} label="Tickets ouverts" value={String(data?.openTickets ?? 0)} tone={Number(data?.openTickets ?? 0) > 0 ? "warn" : "ok"} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "neutral" }: { icon: any; label: string; value: string; tone?: "ok" | "warn" | "danger" | "neutral" }) {
  const toneClass = {
    ok: "text-emerald-400",
    warn: "text-core-warning",
    danger: "text-core-danger",
    neutral: "text-core-text-primary",
  }[tone];
  return (
    <div className="p-2 rounded-lg bg-core-card-raised border border-core-border/50">
      <div className="flex items-center gap-1 text-[11px] text-core-text-label">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-sm font-semibold mt-0.5 ${toneClass}`}>{value}</div>
    </div>
  );
}
