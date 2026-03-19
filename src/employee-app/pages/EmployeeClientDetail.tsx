/**
 * EmployeeClientDetail — 360° client profile view for employees.
 */
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2, User, ShoppingCart, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { employeePath } from "@/employee-app/lib/employeePaths";

function useClientDetail(clientId: string) {
  return useQuery({
    queryKey: ["employee-client-detail", clientId],
    queryFn: async () => {
      const [profileRes, accountRes, ordersRes, ticketsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", clientId).maybeSingle(),
        supabase.from("accounts").select("*").eq("client_id", clientId).maybeSingle(),
        supabase.from("orders").select("id, order_number, status, service_type, created_at, total_amount")
          .eq("user_id", clientId).eq("environment", "live").order("created_at", { ascending: false }).limit(10),
        supabase.from("support_tickets").select("id, ticket_number, subject, status, created_at")
          .eq("user_id", clientId).order("created_at", { ascending: false }).limit(10),
      ]);
      return {
        profile: profileRes.data,
        account: accountRes.data,
        orders: ordersRes.data ?? [],
        tickets: ticketsRes.data ?? [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function EmployeeClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();

  if (!clientId) {
    return (
      <div className="py-20 text-center">
        <User className="h-8 w-8 mx-auto mb-2 text-[hsl(220,10%,30%)]" />
        <p className="text-sm text-[hsl(220,10%,40%)]">Client introuvable</p>
      </div>
    );
  }

  return <ClientDetailContent clientId={clientId} />;
}

function ClientDetailContent({ clientId }: { clientId: string }) {
  const { data, isLoading } = useClientDetail(clientId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[hsl(220,10%,40%)]">Client introuvable.</p>
        <Link to={employeePath("/clients")} className="text-blue-400 text-xs mt-2 inline-block hover:underline">← Retour</Link>
      </div>
    );
  }

  const { profile, account, orders, tickets } = data;

  return (
    <div className="space-y-5">
      <Link to={employeePath("/clients")} className="inline-flex items-center gap-1.5 text-[11px] text-[hsl(220,10%,45%)] hover:text-white transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Clients
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-blue-600/15 flex items-center justify-center">
          <User className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold">{profile.full_name ?? "Client"}</h1>
          <p className="text-xs text-[hsl(220,10%,45%)]">{profile.email} · {account?.account_number ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Identity */}
        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <h3 className="text-sm font-semibold text-[hsl(220,10%,65%)] mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-[hsl(220,10%,40%)]" /> Identité
          </h3>
          <div className="space-y-1.5 text-xs">
            <Row label="Nom" value={profile.full_name ?? "—"} />
            <Row label="Email" value={profile.email ?? "—"} />
            <Row label="Téléphone" value={profile.phone ?? "—"} />
            <Row label="Compte" value={account?.account_number ?? "—"} />
            <Row label="Statut" value={account?.status ?? "—"} />
          </div>
        </div>

        {/* Orders */}
        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <h3 className="text-sm font-semibold text-[hsl(220,10%,65%)] mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[hsl(220,10%,40%)]" /> Commandes récentes
          </h3>
          {orders.length === 0 ? (
            <p className="text-xs text-[hsl(220,10%,35%)]">Aucune commande.</p>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <Link key={o.id} to={employeePath(`/orders/${o.id}`)} className="block text-xs hover:bg-[hsl(220,15%,12%)] rounded p-2 transition-colors">
                  <div className="flex justify-between">
                    <span className="text-white font-mono">{o.order_number ?? "—"}</span>
                    <span className="text-[hsl(220,10%,45%)]">{o.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tickets */}
        <div className="rounded-xl border border-[hsl(220,15%,13%)] bg-[hsl(220,20%,8%)] p-4">
          <h3 className="text-sm font-semibold text-[hsl(220,10%,65%)] mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[hsl(220,10%,40%)]" /> Tickets
          </h3>
          {tickets.length === 0 ? (
            <p className="text-xs text-[hsl(220,10%,35%)]">Aucun ticket.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="text-xs p-2 rounded bg-[hsl(220,15%,10%)]">
                  <div className="flex justify-between">
                    <span className="text-white">{t.subject ?? t.ticket_number}</span>
                    <span className="text-[hsl(220,10%,45%)]">{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-[hsl(220,15%,10%)]">
      <span className="text-[hsl(220,10%,45%)]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
