/**
 * CoreClientProfile — Full CRM client profile for Nivra Core.
 * Quick actions bar + data blocks: subscriptions, equipment, invoices, payments, tickets, notes, timeline.
 */
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CancellationDialog } from "@/core-app/components/account-actions/CancellationDialog";
import { AccountClosureDialog } from "@/core-app/components/account-actions/AccountClosureDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  UserCircle, Mail, Phone, MapPin, Shield, ExternalLink,
  ShoppingCart, FileText, Clock, StickyNote, ArrowLeft, Hash,
  CheckCircle, AlertTriangle, XCircle, CreditCard, Package,
  Tv, Wifi, Plus, PauseCircle, PlayCircle, Loader2, Send,
  Calendar, DollarSign, Wrench, TicketIcon, Download, FileSignature,
  FileX, UserX, Home,
} from "lucide-react";
import { AccountAddressesTab } from "@/components/admin/account-profile/AccountAddressesTab";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge, statusToVariant } from "@/core-app/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { ClientNotesPanel } from "@/core-app/components/notes/ClientNotesPanel";
import { ImpersonateButton } from "@/core-app/components/ImpersonateButton";
import { ClientSupplierAccountSection } from "@/core-app/components/supplier-accounts/ClientSupplierAccountSection";
import { ClientAdminNotesSection } from "@/core-app/components/admin-notes/ClientAdminNotesSection";
import { ClientFullHistory } from "@/core-app/components/client-history/ClientFullHistory";
import { ClientPaymentsHistory } from "@/shared-ops/components/ClientPaymentsHistory";
import { addClientAutoNote } from "@/core-app/lib/clientAutoNotes";
import { generateDeliverySlipPDF } from "@/lib/pdf/deliverySlipTemplate";
import { ClientLoyaltyReferralSection } from "@/core-app/components/loyalty/ClientLoyaltyReferralSection";
import { Account360QuickActions } from "@/core-app/components/account-360/Account360QuickActions";

// ── Section wrapper ──
const Section = ({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-emerald-400" />
      <h3 className="text-[13px] font-semibold text-white flex-1">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
    <span className="text-[11px] text-[hsl(220,10%,45%)]">{label}</span>
    <span className="text-[11px] text-white text-right max-w-[60%] truncate">{value || "—"}</span>
  </div>
);

const PAGE_SIZE = 5;

const Paginator = ({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-3 pt-2 border-t border-[hsl(220,15%,14%)]">
      {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`h-6 min-w-[24px] px-2 rounded text-[10px] font-medium transition-colors ${
            p === page
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "border border-[hsl(220,15%,20%)] text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/20"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
};

const openClientDocumentUrl = async (url: string | null | undefined) => {
  const value = String(url || "").trim();
  if (!value) return toast.error("PDF non disponible");
  if (/^https?:/i.test(value) || value.startsWith("blob:")) {
    window.open(value, "_blank", "noopener,noreferrer");
    return;
  }
  const knownBuckets = ["client-documents", "contracts", "invoices", "receipts", "order-documents"];
  const parts = value.split("/");
  const bucket = knownBuckets.includes(parts[0]) ? parts[0] : "client-documents";
  const key = knownBuckets.includes(parts[0]) ? parts.slice(1).join("/") : value;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, 300);
  if (error || !data?.signedUrl) {
    toast.error("Impossible d'ouvrir le PDF");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
};

const CoreClientProfile = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeAccountOpen, setCloseAccountOpen] = useState(false);
  const [mainTab, setMainTab] = useState("overview");
  const [overviewTab, setOverviewTab] = useState("profil");
  const [invPage, setInvPage] = useState(1);
  const [eqPage, setEqPage] = useState(1);
  const [ordPage, setOrdPage] = useState(1);
  const [ctPage, setCtPage] = useState(1);
  const [docPage, setDocPage] = useState(1);
  // Realtime invalidation across all client-related tables (FIX 3)
  useEffect(() => {
    if (!clientId) return;
    const tables = [
      "billing_subscriptions",
      "billing_invoices",
      "billing_payments",
      "orders",
      "equipment_inventory",
      "service_addresses",
      "appointments",
      "support_tickets",
      "service_incidents",
      "contracts",
      "client_auto_documents",
      "accounts",
    ];
    const channel = supabase.channel(`core-client-profile-${clientId}`);
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries({ queryKey: ["core-client-profile", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-account", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-orders", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-billing-customer", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-subscriptions", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-equipment", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-equipment-fallback", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-appointments", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-tickets", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-incidents", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-invoices", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-payments", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-contracts", clientId] });
        queryClient.invalidateQueries({ queryKey: ["core-client-auto-documents", clientId] });
      });
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, queryClient]);


  // ── Profile ──
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["core-client-profile", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", clientId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // ── Account ──
  const { data: account } = useQuery({
    queryKey: ["core-client-account", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // ── Orders ──
  const { data: orders = [] } = useQuery({
    queryKey: ["core-client-orders", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, order_number, status, created_at, service_type, total_amount, payment_status, client_first_name, client_last_name, client_email, client_phone, client_full_address, shipping_address, shipping_city, shipping_province, shipping_postal_code, service_address_id, carrier, tracking_number, shipped_at, equipment_details")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Billing Customer (resolved once, used by subscriptions/invoices/payments) ──
  const { data: billingCustomer } = useQuery({
    queryKey: ["core-client-billing-customer", clientId],
    queryFn: async () => {
      // Try by user_id first, then by email
      const { data: byUserId } = await supabase.from("billing_customers")
        .select("id").eq("user_id", clientId!).maybeSingle();
      if (byUserId) return byUserId;
      if (profile?.email) {
        const { data: byEmail } = await supabase.from("billing_customers")
          .select("id").eq("email", profile.email).maybeSingle();
        return byEmail;
      }
      return null;
    },
    enabled: !!clientId,
  });

  // ── Subscriptions ──
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["core-client-subscriptions", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_subscriptions")
        .select("id, plan_name, plan_price, status, cycle_start_date, cycle_end_date, next_renewal_at, service_category, service_address_id, address_id")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── Equipment (primary: equipment_inventory) ──
  const { data: equipmentInv = [] } = useQuery({
    queryKey: ["core-client-equipment", clientId],
    queryFn: async () => {
      if (!account) return [];
      const { data } = await supabase.from("equipment_inventory")
        .select("id, catalog_name, serial_number, status, price_client, assigned_at, service_address_id")
        .eq("account_id", account.id)
        .order("assigned_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!clientId && !!account,
    refetchInterval: 30_000,
  });

  // ── Equipment fallback: orders.equipment_details JSON when inventory empty ──
  const { data: equipmentFallback = [] } = useQuery({
    queryKey: ["core-client-equipment-fallback", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data: ords } = await supabase.from("orders")
        .select("id, equipment_details, service_address_id, service_activated_at, updated_at, status")
        .eq("user_id", clientId!)
        .in("status", ["activated", "delivered", "completed"]);
      const out: any[] = [];
      (ords || []).forEach((o: any) => {
        const arr = Array.isArray(o.equipment_details) ? o.equipment_details : [];
        arr.forEach((eq: any, idx: number) => {
          if (!eq) return;
          out.push({
            id: `${o.id}-${idx}`,
            catalog_name: eq.label || eq.type || "Équipement",
            serial_number: eq.serial_number || null,
            status: eq.status || "assigned",
            price_client: eq.type === "router" ? 60 : eq.type === "tv_box" ? 50 : eq.type === "sim" ? 30 : 0,
            assigned_at: o.service_activated_at || o.updated_at,
            service_address_id: o.service_address_id || null,
          });
        });
      });
      return out;
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  });

  const equipment = equipmentInv.length > 0 ? equipmentInv : equipmentFallback;

  // ── Address-linked operations ──
  const { data: appointments = [] } = useQuery({
    queryKey: ["core-client-appointments", clientId, profile?.email, (orders as any[]).map((o: any) => o.id).join(",")],
    queryFn: async () => {
      if (!clientId) return [];
      const orderIds = (orders as any[]).map((o: any) => o.id).filter(Boolean);
      const email = String(profile?.email || "").trim().toLowerCase();
      const queries = [
        supabase.from("appointments").select("*").eq("client_id", clientId!).limit(50),
      ];
      if (orderIds.length > 0) {
        queries.push(supabase.from("appointments").select("*").in("order_id", orderIds).limit(50));
      }
      if (email) {
        queries.push(supabase.from("appointments").select("*").ilike("client_email", email).limit(50));
      }
      const results = await Promise.all(queries);
      const firstError = results.find((res) => res.error)?.error;
      if (firstError) throw firstError;
      const seen = new Set<string>();
      return results
        .flatMap((res) => res.data || [])
        .filter((apt: any) => {
          if (!apt?.id || seen.has(apt.id)) return false;
          seen.add(apt.id);
          return true;
        })
        .sort((a: any, b: any) => new Date(b.scheduled_at || 0).getTime() - new Date(a.scheduled_at || 0).getTime())
        .slice(0, 50);
    },
    enabled: !!clientId,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["core-client-tickets", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase.from("support_tickets")
        .select("*")
        .or(`user_id.eq.${clientId},owner_user_id.eq.${clientId}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["core-client-incidents", clientId, account?.id],
    queryFn: async () => {
      if (!clientId && !account?.id) return [];
      const filters = [clientId ? `client_user_id.eq.${clientId}` : null, account?.id ? `client_account_id.eq.${account.id}` : null].filter(Boolean).join(",");
      const { data, error } = await supabase.from("service_incidents")
        .select("*")
        .or(filters)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId || !!account?.id,
  });

  // ── Contracts (FIX 2 — Section A) ──
  const { data: contracts = [] } = useQuery({
    queryKey: ["core-client-contracts", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await supabase.from("contracts")
        .select("id, contract_number, status, contract_pdf_url, created_at, signed_at, client_signed_at, admin_signed_at, signature_token, signature_token_expires_at")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  });

  // ── Auto-generated documents (FIX 2 — Section A) ──
  const { data: autoDocs = [] } = useQuery({
    queryKey: ["core-client-auto-documents", clientId],
    queryFn: async () => {
      const filters = [`client_id.eq.${clientId}`];
      if (account?.id) filters.push(`account_id.eq.${account.id}`);
      const { data } = await supabase.from("client_auto_documents")
        .select("id, doc_type, doc_number, storage_path, created_at, event_type, idempotency_key, metadata, email_sent")
        .or(filters.join(","))
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  });


  // ── Invoices ──
  const { data: invoices = [] } = useQuery({
    queryKey: ["core-client-invoices", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_invoices")
        .select("id, invoice_number, total, balance_due, status, due_date, created_at")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── Payments ──
  const { data: payments = [] } = useQuery({
    queryKey: ["core-client-payments", clientId, billingCustomer?.id],
    queryFn: async () => {
      if (!billingCustomer) return [];
      const { data } = await supabase.from("billing_payments")
        .select("id, payment_number, amount, method, status, created_at, reference")
        .eq("customer_id", billingCustomer.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!billingCustomer,
  });

  // ── KYC ──
  const { data: kyc = [] } = useQuery({
    queryKey: ["core-client-kyc", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("kyc_verifications").select("*").eq("user_id", clientId!)
        .order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!clientId,
  });

  // ── Activity ──
  const { data: activityLogs = [] } = useQuery({
    queryKey: ["core-client-activity", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs")
        .select("id, action, entity_type, created_at, details, changed_field, old_value, new_value")
        .eq("user_id", clientId!)
        .order("created_at", { ascending: false }).limit(30);
      return data || [];
    },
    enabled: !!clientId,
  });

  if (loadingProfile) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-16 text-[hsl(220,10%,40%)]">
        <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Client introuvable</p>
        <Link to={corePath("/clients")} className="text-emerald-400 text-xs hover:underline mt-2 inline-block">← Retour</Link>
      </div>
    );
  }

  const displayName = profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "—";
  const shippingSlipByOrder = new Map(
    autoDocs
      .filter((doc: any) => doc.doc_type === "order_shipping_slip")
      .map((doc: any) => [String(doc.idempotency_key || "").replace(/^order_/, "").replace(/_order_shipping_slip$/, ""), doc])
  );

  const openShippingSlip = async (orderRow: any) => {
    const persisted = shippingSlipByOrder.get(String(orderRow.order_number || ""));
    if (persisted?.storage_path) {
      await openClientDocumentUrl(persisted.storage_path);
      return;
    }

    const equipmentItems = Array.isArray(orderRow.equipment_details)
      ? orderRow.equipment_details.map((item: any) => ({
          description: item.label || item.name || item.type || "Équipement",
          serial_number: item.serial_number || undefined,
          quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
        }))
      : [];
    const result = generateDeliverySlipPDF({
      slip_number: `BL-${orderRow.order_number || orderRow.id?.slice(0, 8) || "commande"}`,
      issue_date: orderRow.shipped_at || orderRow.created_at || new Date().toISOString(),
      client_name: [orderRow.client_first_name, orderRow.client_last_name].filter(Boolean).join(" ") || displayName || "Client Nivra",
      client_email: orderRow.client_email || profile.email || "",
      client_phone: orderRow.client_phone || profile.phone || "",
      account_number: account?.account_number || "",
      delivery_address: orderRow.shipping_address || orderRow.client_full_address || account?.primary_service_address || "",
      delivery_city: orderRow.shipping_city || account?.primary_service_city || "",
      delivery_province: orderRow.shipping_province || account?.primary_service_province || "QC",
      delivery_postal: orderRow.shipping_postal_code || account?.primary_service_postal_code || "",
      order_number: String(orderRow.order_number || ""),
      carrier: orderRow.carrier || "En préparation",
      tracking_number: orderRow.tracking_number || "—",
      items: equipmentItems.length ? equipmentItems : [{ description: "Équipement à expédier", quantity: 1 }],
    });
    if (!result.success || !result.blob) {
      toast.error("Bordereau non disponible");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // Quick action button component
  const QAction = ({ icon: Icon, label, onClick, color = "emerald" }: { icon: any; label: string; onClick: () => void; color?: string }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-[10px] font-medium transition-colors min-w-[80px]",
        `border-${color}-500/20 text-${color}-400 hover:bg-${color}-500/10`
      )}
      style={{
        borderColor: `hsl(var(--${color === "emerald" ? "primary" : color === "blue" ? "accent" : color === "amber" ? "warning" : "destructive"}) / 0.2)`,
      }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={corePath("/clients")} className="h-8 w-8 rounded-md border border-[hsl(220,15%,18%)] flex items-center justify-center text-[hsl(220,10%,45%)] hover:text-white hover:border-emerald-500/30 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white tracking-tight">{displayName}</h1>
          <p className="text-[11px] text-[hsl(220,10%,45%)]">Dossier CRM · {profile.email}</p>
        </div>
        {account && (
          <Link to={corePath(`/accounts/${account.id}`)}>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20">
              <Hash className="h-3 w-3 mr-1" />Compte #{account.account_number}
            </Badge>
          </Link>
        )}
      </div>

      {/* ═══ QUICK ACTIONS BAR (unified with Account360QuickActions) ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-3">
        <Account360QuickActions
          accountId={account?.id}
          clientId={clientId}
          accountStatus={account?.status ?? null}
          customerId={undefined}
          clientName={displayName}
          clientEmail={profile?.email ?? null}
          monthlyRevenue={(account as any)?.monthly_amount || 0}
          subscriptions={[]}
          canonicalData={{ invoices: [], payments: [] }}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["core-client-profile"] })}
          onNavigateSection={(section) => {
            if (section === "orders") { navigate(corePath("/pos")); return; }
            if (section === "payments" || section === "invoices") {
              if (account) navigate(corePath(`/accounts/${account.id}`));
              else toast.error("Aucun compte lié");
              return;
            }
            if (section === "loyalty") { setMainTab("overview"); setOverviewTab("loyalty"); return; }
          }}
          onEditProfile={() => { setMainTab("overview"); setOverviewTab("profil"); }}
        />
      </div>

      {/* ═══ TABS ═══ */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="bg-[hsl(220,20%,11%)] border border-[hsl(220,15%,16%)] h-9">
          <TabsTrigger value="overview" className="text-[12px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="history" className="text-[12px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Historique complet</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Tabs value={overviewTab} onValueChange={setOverviewTab}>
            <TabsList className="bg-[hsl(220,20%,10%)] border border-[hsl(220,15%,15%)] h-8 mb-4">
              <TabsTrigger value="profil" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Profil</TabsTrigger>
              <TabsTrigger value="adresses" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Adresses & Services</TabsTrigger>
              <TabsTrigger value="facturation" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Facturation</TabsTrigger>
              <TabsTrigger value="equipement" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Équipement</TabsTrigger>
              <TabsTrigger value="notes" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Notes & Activité</TabsTrigger>
              <TabsTrigger value="loyalty" className="text-[11px] data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400">Fidélité & Références</TabsTrigger>
            </TabsList>

            {/* ── Profil ── */}
            <TabsContent value="profil" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section title="Identité" icon={UserCircle}>
                  <InfoRow label="Nom complet" value={displayName} />
                  <InfoRow label="Prénom" value={profile.first_name} />
                  <InfoRow label="Nom" value={profile.last_name} />
                  <InfoRow label="Langue" value={profile.language || "fr"} />
                  <InfoRow label="Inscrit le" value={profile.created_at ? format(new Date(profile.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"} />
                </Section>

                <Section title="Contact" icon={Mail}>
                  <InfoRow label="Courriel" value={profile.email} />
                  <InfoRow label="Téléphone" value={profile.phone} />
                  <InfoRow label="Adresse" value={profile.address} />
                  <InfoRow label="Ville" value={profile.city} />
                  <InfoRow label="Code postal" value={profile.postal_code} />
                  <InfoRow label="Province" value={profile.province} />
                </Section>

                <Section title="Compte lié" icon={Hash}>
                  {account ? (
                    <>
                      <InfoRow label="N° compte" value={<span className="font-mono">{account.account_number}</span>} />
                      <InfoRow label="Statut" value={<StatusBadge label={account.status || "active"} variant={statusToVariant(account.status || "active")} size="sm" />} />
                      <InfoRow label="Adresse de service" value={account.primary_service_address} />
                      <InfoRow label="Classe crédit" value={account.credit_class || "standard"} />
                      <div className="mt-2">
                        <Link to={corePath(`/accounts/${account.id}`)}>
                          <button className="w-full h-8 flex items-center justify-center gap-1.5 rounded-md border border-emerald-500/20 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" /> Console du compte
                          </button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400/40" />
                      <p className="text-[11px] text-[hsl(220,10%,40%)]">Aucun compte lié</p>
                    </div>
                  )}
                </Section>

                <Section title="Vérification KYC" icon={Shield}>
                  {kyc.length > 0 ? (
                    <div className="space-y-2">
                      {kyc.map((k: any) => (
                        <div key={k.id} className="flex items-center justify-between py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
                          <div className="flex items-center gap-2">
                            {k.status === "verified" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : k.status === "rejected" ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <Clock className="h-3.5 w-3.5 text-amber-400" />}
                            <span className="text-[11px] text-white">{k.verification_type || "Document"}</span>
                          </div>
                          <span className="text-[10px] text-[hsl(220,10%,40%)]">{k.created_at ? format(new Date(k.created_at), "d MMM yyyy", { locale: fr }) : ""}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune vérification</p>
                  )}
                </Section>
              </div>

              <Section title="Adresses de service & options multi-service" icon={Home}>
                {account?.id ? (
                  <AccountAddressesTab account={account} subscriptions={subscriptions as any[]} equipment={equipment as any[]} appointments={appointments as any[]} tickets={tickets as any[]} incidents={incidents as any[]} orders={orders as any[]} />
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">
                    Aucun compte lié à ce client — impossible d'afficher les adresses.
                  </p>
                )}
              </Section>

              <Section title="Abonnements actifs" icon={Wifi}>
                {subscriptions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                        {["Forfait", "Catégorie", "Prix", "Cycle", "Statut", ""].map(h => (
                          <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {subscriptions.map((s: any) => (
                          <tr key={s.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                            <td className="px-2 py-2 text-white font-medium">{s.plan_name}</td>
                            <td className="px-2 py-2 text-[#A1A1AA]">{s.service_category || "—"}</td>
                            <td className="px-2 py-2 text-emerald-400 font-medium">{Number(s.plan_price).toFixed(2)} $/mois</td>
                            <td className="px-2 py-2 text-[#A1A1AA]">{s.cycle_start_date ? format(new Date(s.cycle_start_date), "d MMM", { locale: fr }) : ""} → {s.cycle_end_date ? format(new Date(s.cycle_end_date), "d MMM", { locale: fr }) : ""}</td>
                            <td className="px-2 py-2"><StatusBadge label={s.status || "active"} variant={statusToVariant(s.status || "active")} size="sm" /></td>
                            <td className="px-2 py-2">
                              <Link to={corePath(`/subscriptions/${s.id}`)}>
                                <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/40">Ouvrir</button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun abonnement actif</p>
                )}
              </Section>
            </TabsContent>

            {/* ── Facturation ── */}
            <TabsContent value="facturation" className="space-y-4">
              <Section title={`Factures${invoices.length > 0 ? ` (${invoices.length})` : ""}`} icon={FileText}>
                {invoices.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                          {["N° Facture", "Total", "Solde dû", "Statut", "Date", ""].map(h => (
                            <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {invoices.slice((invPage - 1) * PAGE_SIZE, invPage * PAGE_SIZE).map((inv: any) => (
                            <tr key={inv.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                              <td className="px-2 py-2 font-mono text-white">{inv.invoice_number}</td>
                              <td className="px-2 py-2 text-white">{Number(inv.total).toFixed(2)} $</td>
                              <td className="px-2 py-2 text-amber-400">{Number(inv.balance_due || 0).toFixed(2)} $</td>
                              <td className="px-2 py-2"><StatusBadge label={inv.status || "unpaid"} variant={statusToVariant(inv.status || "unpaid")} size="sm" /></td>
                              <td className="px-2 py-2 text-[#A1A1AA]">{inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                              <td className="px-2 py-2">
                                <Link to={corePath(`/invoices/${inv.id}`)}>
                                  <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white">Ouvrir</button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Paginator page={invPage} total={invoices.length} pageSize={PAGE_SIZE} onPage={setInvPage} />
                  </>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune facture</p>
                )}
              </Section>

              <ClientPaymentsHistory
                billingCustomerId={billingCustomer?.id}
                userId={clientId}
                invoiceHref={(invoiceId) => corePath(`/invoices/${invoiceId}`)}
                fallbackEmail={profile.email}
              />
            </TabsContent>

            {/* ── Adresses & Services ── */}
            <TabsContent value="adresses" className="space-y-4">
              <Section title="Adresses de service & services actifs" icon={Home}>
                {account?.id ? (
                  <AccountAddressesTab account={account} subscriptions={subscriptions as any[]} equipment={equipment as any[]} appointments={appointments as any[]} tickets={tickets as any[]} incidents={incidents as any[]} orders={orders as any[]} />
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">
                    Aucun compte lié à ce client — impossible d'afficher les adresses.
                  </p>
                )}
              </Section>
            </TabsContent>

            {/* ── Équipement ── */}
            <TabsContent value="equipement" className="space-y-4">
              <Section title={`Équipements${equipment.length > 0 ? ` (${equipment.length})` : ""}`} icon={Package} action={
                <Link to={corePath("/equipment")}><button className="text-[10px] text-emerald-400 hover:underline">Gérer →</button></Link>
              }>
                {equipment.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {equipment.slice((eqPage - 1) * PAGE_SIZE, eqPage * PAGE_SIZE).map((e: any) => {
                        const assignedDate = e.assigned_at ? new Date(e.assigned_at) : null;
                        const warrantyEnd = assignedDate ? new Date(assignedDate.getTime() + 365 * 24 * 60 * 60 * 1000) : null;
                        const underWarranty = warrantyEnd ? warrantyEnd > new Date() : false;
                        return (
                          <div key={e.id} className="flex items-center gap-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)]">
                            <Package className="h-4 w-4 text-cyan-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-white truncate">{e.catalog_name}</p>
                              <p className="text-[10px] text-[#A1A1AA]">
                                S/N: {e.serial_number || "—"}
                                {assignedDate && <> · Attribué le {format(assignedDate, "d MMM yyyy", { locale: fr })}</>}
                              </p>
                            </div>
                            {underWarranty ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">Sous garantie</Badge>
                            ) : warrantyEnd ? (
                              <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-[9px]">Garantie expirée</Badge>
                            ) : null}
                            <span className="text-[10px] text-emerald-400 font-medium">{Number(e.price_client).toFixed(2)} $</span>
                            <StatusBadge label={e.status} variant={statusToVariant(e.status === "assigned" ? "active" : e.status)} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                    <Paginator page={eqPage} total={equipment.length} pageSize={PAGE_SIZE} onPage={setEqPage} />
                  </>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun équipement attribué</p>
                )}
              </Section>

              <Section title={`Commandes${orders.length > 0 ? ` (${orders.length})` : ""}`} icon={ShoppingCart}>
                {orders.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="border-b border-[hsl(220,15%,14%)]">
                          {["N° commande", "Type", "Total", "Paiement", "Statut", "Date", ""].map(h => (
                            <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)]">{h}</th>
                          ))}
                        </tr></thead>
                        <tbody>
                          {orders.slice((ordPage - 1) * PAGE_SIZE, ordPage * PAGE_SIZE).map((o: any) => (
                            <tr key={o.id} className="border-b border-[hsl(220,15%,14%)] last:border-0 hover:bg-[hsl(220,20%,13%)]">
                              <td className="px-2 py-2 font-mono text-white">{o.order_number}</td>
                              <td className="px-2 py-2 text-[#A1A1AA]">{o.service_type || "—"}</td>
                              <td className="px-2 py-2 text-white">{o.total_amount ? `${Number(o.total_amount).toFixed(2)} $` : "—"}</td>
                              <td className="px-2 py-2"><StatusBadge label={o.payment_status || "pending"} variant={statusToVariant(o.payment_status || "pending")} size="sm" /></td>
                              <td className="px-2 py-2"><StatusBadge label={o.status} variant={statusToVariant(o.status)} size="sm" /></td>
                              <td className="px-2 py-2 text-[#A1A1AA]">{o.created_at ? format(new Date(o.created_at), "d MMM yyyy", { locale: fr }) : "—"}</td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => openShippingSlip(o)}
                                  className="h-6 px-2 mr-1 rounded border border-blue-500/30 text-[10px] text-blue-400 hover:bg-blue-500/10"
                                >
                                  Bordereau
                                </button>
                                <Link to={corePath(`/orders/${o.id}`)}>
                                  <button className="h-6 px-2 rounded border border-[hsl(220,15%,20%)] text-[10px] text-[hsl(220,10%,50%)] hover:text-white">Ouvrir</button>
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Paginator page={ordPage} total={orders.length} pageSize={PAGE_SIZE} onPage={setOrdPage} />
                  </>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune commande</p>
                )}
              </Section>

              <Section title={`Contrats${contracts.length > 0 ? ` (${contracts.length})` : ""}`} icon={FileSignature}>
                {contracts.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {contracts.slice((ctPage - 1) * PAGE_SIZE, ctPage * PAGE_SIZE).map((c: any) => {
                        const status = String(c.status || "").toLowerCase();
                        const expired = c.signature_token_expires_at && new Date(c.signature_token_expires_at) < new Date() && !c.client_signed_at;
                        const isFullySigned = status === "signed" || status === "completed" || !!c.client_signed_at;
                        const awaitingClient = status === "signed_by_admin" || (!!c.admin_signed_at && !c.client_signed_at && !expired);
                        const isDraft = status === "draft" || (!c.admin_signed_at && !c.client_signed_at && !expired);

                        let badge: JSX.Element;
                        if (isFullySigned) {
                          badge = <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[9px]">✓ Signé</Badge>;
                        } else if (expired) {
                          badge = <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px]">Expiré</Badge>;
                        } else if (awaitingClient) {
                          badge = <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px]">En attente de la signature client</Badge>;
                        } else if (isDraft) {
                          badge = <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-[9px]">Brouillon</Badge>;
                        } else {
                          badge = <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-[9px]">{c.status || "—"}</Badge>;
                        }

                        return (
                          <div key={c.id} className="flex flex-wrap items-center gap-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)]">
                            <FileSignature className="h-4 w-4 text-purple-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-white truncate font-mono">{c.contract_number || c.id.slice(0, 8)}</p>
                              <p className="text-[10px] text-[#A1A1AA]">
                                Créé le {c.created_at ? format(new Date(c.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                                {" · "}Nivra: {c.admin_signed_at ? format(new Date(c.admin_signed_at), "d MMM yyyy", { locale: fr }) : "—"}
                                {" · "}Client: {c.client_signed_at ? format(new Date(c.client_signed_at), "d MMM yyyy", { locale: fr }) : "En attente"}
                              </p>
                            </div>
                            {badge}
                            {awaitingClient && c.signature_token && (
                              <a href={`/signer/${c.signature_token}`} target="_blank" rel="noreferrer">
                                <button className="h-6 px-2 rounded border border-amber-500/30 text-[10px] text-amber-400 hover:bg-amber-500/10 flex items-center gap-1">
                                  Signer maintenant →
                                </button>
                              </a>
                            )}
                            {c.contract_pdf_url ? (
                              <button
                                onClick={() => openClientDocumentUrl(c.contract_pdf_url)}
                                className="h-6 px-2 rounded border border-emerald-500/30 text-[10px] text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-1"
                              >
                                <Download className="h-3 w-3" /> Télécharger
                              </button>
                            ) : (
                              <span className="text-[10px] text-[hsl(220,10%,40%)] italic">PDF non disponible</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Paginator page={ctPage} total={contracts.length} pageSize={PAGE_SIZE} onPage={setCtPage} />
                  </>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun contrat</p>
                )}
                {orders.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[hsl(220,15%,14%)]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,38%)] mb-2">Bordereaux de livraison</p>
                    <div className="space-y-2">
                      {orders.slice(0, 5).map((o: any) => (
                        <div key={`slip-${o.id}`} className="flex flex-wrap items-center gap-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)]">
                          <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-white truncate font-mono">Bon de livraison — {o.order_number}</p>
                            <p className="text-[10px] text-[#A1A1AA]">{shippingSlipByOrder.has(String(o.order_number || "")) ? "PDF enregistré" : "Disponible en génération instantanée"}</p>
                          </div>
                          <button
                            onClick={() => openShippingSlip(o)}
                            className="h-6 px-2 rounded border border-blue-500/30 text-[10px] text-blue-400 hover:bg-blue-500/10 flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" /> Ouvrir
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title={`Documents générés${autoDocs.length > 0 ? ` (${autoDocs.length})` : ""}`} icon={FileText}>
                {autoDocs.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {autoDocs.slice((docPage - 1) * PAGE_SIZE, docPage * PAGE_SIZE).map((d: any) => (
                        <div key={d.id} className="flex items-center gap-3 p-2 rounded bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,14%)]">
                          <FileText className="h-4 w-4 text-blue-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-white truncate">
                              <span className="font-mono">{d.doc_number || d.id.slice(0, 8)}</span>
                              <span className="text-[#A1A1AA]"> · {d.doc_type}</span>
                            </p>
                            <p className="text-[10px] text-[#A1A1AA]">
                              {d.event_type} · {d.created_at ? format(new Date(d.created_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                            </p>
                          </div>
                          {d.storage_path && (
                            <button
                              onClick={async () => {
                                const { data, error } = await supabase.storage
                                  .from("client-documents")
                                  .createSignedUrl(d.storage_path, 60);
                                if (error || !data?.signedUrl) {
                                  toast.error("Impossible d'ouvrir le document");
                                  return;
                                }
                                window.open(data.signedUrl, "_blank");
                              }}
                              className="h-6 px-2 rounded border border-blue-500/30 text-[10px] text-blue-400 hover:bg-blue-500/10 flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" /> Ouvrir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Paginator page={docPage} total={autoDocs.length} pageSize={PAGE_SIZE} onPage={setDocPage} />
                  </>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucun document</p>
                )}
              </Section>
            </TabsContent>

            {/* ── Notes & Activité ── */}
            <TabsContent value="notes" className="space-y-4">
              <Section title="Notes internes" icon={StickyNote}>
                <ClientNotesPanel clientId={clientId} />
              </Section>

              <Section title="Chronologie d'activité" icon={Clock}>
                {activityLogs.length > 0 ? (
                  <div className="space-y-1">
                    {activityLogs.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-[hsl(220,15%,14%)] last:border-0">
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white truncate">
                            <span className="text-emerald-400">{log.action}</span>
                            {log.entity_type && <span className="text-[hsl(220,10%,45%)]"> · {log.entity_type}</span>}
                          </p>
                          {log.changed_field && (
                            <p className="text-[10px] text-[hsl(220,10%,35%)]">{log.changed_field}: {log.old_value} → {log.new_value}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-[hsl(220,10%,30%)] shrink-0">
                          {log.created_at ? format(new Date(log.created_at), "d MMM HH:mm", { locale: fr }) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[hsl(220,10%,35%)] text-center py-4">Aucune activité enregistrée</p>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="loyalty" className="space-y-4">
              <ClientLoyaltyReferralSection clientId={clientId!} accountId={account?.id} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ClientFullHistory
            clientId={clientId!}
            email={profile.email}
            billingCustomerId={billingCustomer?.id}
          />
        </TabsContent>
      </Tabs>

      {/* ═══ COMPTE FOURNISSEUR (admin only) ═══ */}
      <ClientSupplierAccountSection clientId={clientId} />

      {/* ═══ NOTES PRIVÉES (admin only) ═══ */}
      <ClientAdminNotesSection clientId={clientId} />

      {/* ═══ DIALOGS (résiliation / fermeture) ═══ */}
      <CancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        clientUserId={clientId!}
        accountId={account?.id ?? null}
        subscriptions={(subscriptions as any[]).filter((s: any) => s.status === "active")}
      />
      <AccountClosureDialog
        open={closeAccountOpen}
        onOpenChange={setCloseAccountOpen}
        clientUserId={clientId!}
        clientEmail={profile.email ?? null}
        clientName={displayName}
        accountId={account?.id ?? null}
        subscriptions={(subscriptions as any[]).filter((s: any) => s.status === "active")}
      />
    </div>
  );
};

export default CoreClientProfile;
