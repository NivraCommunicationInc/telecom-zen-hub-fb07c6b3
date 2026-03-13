/**
 * CoreActivationsPage — Activation Hub / Provisioning Console
 * Operational telecom activation queue for Nivra Core.
 * Interface-only: backend logic will be connected later.
 */
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/admin/ui/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Zap, Search, Filter, X, CheckCircle2, AlertTriangle, Clock,
  ShieldCheck, CreditCard, FileText, Package, Calendar, User,
  ExternalLink, RefreshCcw, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───── Types ───── */
type ActivationStatus = "ready" | "blocked" | "in_progress" | "activated" | "cancelled";
type BlockerType = "kyc" | "payment" | "equipment" | "technician" | "none";

interface ActivationRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  account_number: string;
  service_type: string;
  service_name: string;
  status: ActivationStatus;
  kyc_status: string;
  payment_status: string;
  invoice_status: string;
  equipment_status: string;
  appointment_status: string;
  activation_readiness: number; // 0-100
  blockers: BlockerType[];
  assigned_staff: string | null;
  created_at: string;
  customer_id: string;
  order_id: string;
  account_id: string;
}

/* ───── Status Badge Map ───── */
const STATUS_CONFIG: Record<ActivationStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  blocked: { label: "Blocked", className: "bg-red-500/20 text-red-400 border-red-500/30" },
  in_progress: { label: "In Progress", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  activated: { label: "Activated", className: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  cancelled: { label: "Cancelled", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const BLOCKER_LABELS: Record<BlockerType, string> = {
  kyc: "KYC",
  payment: "Payment",
  equipment: "Equipment",
  technician: "Technician",
  none: "—",
};

/* ───── KPI Card ───── */
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 px-4 py-3 min-w-[160px]">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", color)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ───── Readiness Bar ───── */
function ReadinessBar({ value }: { value: number }) {
  const color =
    value >= 100 ? "bg-emerald-500" :
    value >= 60 ? "bg-amber-500" :
    "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

/* ───── Sub-Status Badge ───── */
function SubBadge({ label, variant }: { label: string; variant: "ok" | "warn" | "error" | "neutral" }) {
  const cls = {
    ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    error: "bg-red-500/15 text-red-400 border-red-500/20",
    neutral: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  }[variant];
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border", cls)}>{label}</span>;
}

function getSubVariant(s: string): "ok" | "warn" | "error" | "neutral" {
  const lower = s.toLowerCase();
  if (["verified", "paid", "assigned", "ready", "confirmed", "completed", "approved"].some(k => lower.includes(k))) return "ok";
  if (["pending", "partial", "scheduled", "review"].some(k => lower.includes(k))) return "warn";
  if (["missing", "failed", "overdue", "rejected", "blocked", "unpaid"].some(k => lower.includes(k))) return "error";
  return "neutral";
}

/* ───── Empty placeholder data (will be replaced by real queries) ───── */
const EMPTY_DATA: ActivationRecord[] = [];

/* ───── Main Page ───── */
export default function CoreActivationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [blockerFilter, setBlockerFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<ActivationRecord | null>(null);

  // Data — currently empty, will be connected to real queries
  const data = EMPTY_DATA;

  // Compute KPIs
  const kpis = useMemo(() => ({
    ready: data.filter(r => r.status === "ready").length,
    blockedKyc: data.filter(r => r.blockers.includes("kyc")).length,
    blockedPayment: data.filter(r => r.blockers.includes("payment")).length,
    blockedEquipment: data.filter(r => r.blockers.includes("equipment")).length,
    waitingTech: data.filter(r => r.blockers.includes("technician")).length,
    activatedToday: data.filter(r => r.status === "activated").length,
  }), [data]);

  // Filtered data
  const filtered = useMemo(() => {
    let result = data;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.order_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.account_number.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter(r => r.status === statusFilter);
    if (serviceFilter !== "all") result = result.filter(r => r.service_type === serviceFilter);
    if (blockerFilter !== "all") result = result.filter(r => r.blockers.includes(blockerFilter as BlockerType));
    if (staffFilter !== "all") result = result.filter(r => r.assigned_staff === staffFilter);
    return result;
  }, [data, search, statusFilter, serviceFilter, blockerFilter, staffFilter]);

  // Unique values for filters
  const serviceTypes = [...new Set(data.map(r => r.service_type))];
  const staffList = [...new Set(data.map(r => r.assigned_staff).filter(Boolean))] as string[];

  const columns: Column<ActivationRecord>[] = [
    { key: "order_number", label: "Order #", className: "w-[100px]", render: (r) => <span className="font-mono text-xs text-foreground">{r.order_number}</span> },
    { key: "customer_name", label: "Customer", render: (r) => (
      <div>
        <p className="text-sm text-foreground">{r.customer_name}</p>
        <p className="text-xs text-muted-foreground">{r.customer_email}</p>
      </div>
    )},
    { key: "account_number", label: "Account #", className: "w-[100px]", render: (r) => <span className="font-mono text-xs">{r.account_number}</span> },
    { key: "service_type", label: "Service", className: "w-[120px]", render: (r) => (
      <div>
        <p className="text-xs text-foreground">{r.service_name}</p>
        <p className="text-[10px] text-muted-foreground">{r.service_type}</p>
      </div>
    )},
    { key: "status", label: "Status", className: "w-[110px]", render: (r) => {
      const cfg = STATUS_CONFIG[r.status];
      return <Badge className={cn("text-[10px] border", cfg.className)}>{cfg.label}</Badge>;
    }},
    { key: "kyc_status", label: "KYC", className: "w-[80px]", render: (r) => <SubBadge label={r.kyc_status} variant={getSubVariant(r.kyc_status)} /> },
    { key: "payment_status", label: "Payment", className: "w-[90px]", render: (r) => <SubBadge label={r.payment_status} variant={getSubVariant(r.payment_status)} /> },
    { key: "invoice_status", label: "Invoice", className: "w-[80px]", render: (r) => <SubBadge label={r.invoice_status} variant={getSubVariant(r.invoice_status)} /> },
    { key: "equipment_status", label: "Equipment", className: "w-[90px]", render: (r) => <SubBadge label={r.equipment_status} variant={getSubVariant(r.equipment_status)} /> },
    { key: "appointment_status", label: "Appt.", className: "w-[90px]", render: (r) => <SubBadge label={r.appointment_status} variant={getSubVariant(r.appointment_status)} /> },
    { key: "activation_readiness", label: "Readiness", className: "w-[130px]", render: (r) => <ReadinessBar value={r.activation_readiness} /> },
    { key: "blockers", label: "Blockers", className: "w-[120px]", render: (r) => (
      r.blockers.length === 0 || (r.blockers.length === 1 && r.blockers[0] === "none")
        ? <span className="text-xs text-muted-foreground">—</span>
        : <div className="flex flex-wrap gap-1">{r.blockers.filter(b => b !== "none").map(b => (
            <span key={b} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">{BLOCKER_LABELS[b]}</span>
          ))}</div>
    )},
    { key: "assigned_staff", label: "Staff", className: "w-[100px]", render: (r) => r.assigned_staff ? <span className="text-xs">{r.assigned_staff}</span> : <span className="text-xs text-muted-foreground">Unassigned</span> },
    { key: "created_at", label: "Created", className: "w-[90px]", render: (r) => <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleDateString("fr-CA") : "—"}</span> },
  ];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setServiceFilter("all");
    setBlockerFilter("all");
    setStaffFilter("all");
  };
  const hasFilters = search || statusFilter !== "all" || serviceFilter !== "all" || blockerFilter !== "all" || staffFilter !== "all";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
            <Zap className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Activation Hub</h1>
            <p className="text-xs text-muted-foreground">Provisioning & activation queue</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {}}>
          <RefreshCcw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Ready for activation" value={kpis.ready} icon={CheckCircle2} color="bg-emerald-500/20 text-emerald-400" />
        <KpiCard label="Blocked by KYC" value={kpis.blockedKyc} icon={ShieldCheck} color="bg-red-500/20 text-red-400" />
        <KpiCard label="Blocked by payment" value={kpis.blockedPayment} icon={CreditCard} color="bg-orange-500/20 text-orange-400" />
        <KpiCard label="Blocked by equipment" value={kpis.blockedEquipment} icon={Package} color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Waiting technician" value={kpis.waitingTech} icon={Clock} color="bg-blue-500/20 text-blue-400" />
        <KpiCard label="Activated today" value={kpis.activatedToday} icon={Zap} color="bg-sky-500/20 text-sky-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search order, customer, account…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/40 border-border/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/40 border-border/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="activated">Activated</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/40 border-border/50">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {serviceTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={blockerFilter} onValueChange={setBlockerFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/40 border-border/50">
            <SelectValue placeholder="Blocker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All blockers</SelectItem>
            <SelectItem value="kyc">KYC</SelectItem>
            <SelectItem value="payment">Payment</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
          </SelectContent>
        </Select>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/40 border-border/50">
            <SelectValue placeholder="Staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All staff</SelectItem>
            {staffList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={r => r.id}
        onRowClick={r => setSelectedRecord(r)}
        emptyMessage="No activations in queue"
        emptyIcon={<Zap className="h-10 w-10 text-muted-foreground/30 mb-2" />}
        compact
        pageSize={30}
      />

      {/* Activation File Drawer */}
      <Sheet open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto bg-background border-border">
          {selectedRecord && <ActivationFileDrawer record={selectedRecord} onNavigate={navigate} onClose={() => setSelectedRecord(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───── Activation File Drawer ───── */
function ActivationFileDrawer({ record, onNavigate, onClose }: { record: ActivationRecord; onNavigate: (path: string) => void; onClose: () => void }) {
  const statusCfg = STATUS_CONFIG[record.status];

  return (
    <div className="space-y-6">
      <SheetHeader className="pb-0">
        <SheetTitle className="flex items-center gap-3 text-foreground">
          <Zap className="h-5 w-5 text-emerald-400" />
          Activation File — {record.order_number}
          <Badge className={cn("ml-2 text-[10px] border", statusCfg.className)}>{statusCfg.label}</Badge>
        </SheetTitle>
      </SheetHeader>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left: Workflow & Blockers */}
        <div className="space-y-4">
          <SectionCard title="Activation Workflow" icon={Activity}>
            <div className="space-y-2">
              <InfoRow label="Status" value={statusCfg.label} />
              <InfoRow label="Readiness" value={`${record.activation_readiness}%`} />
              <ReadinessBar value={record.activation_readiness} />
            </div>
          </SectionCard>
          <SectionCard title="Blockers" icon={AlertTriangle}>
            {record.blockers.length === 0 || (record.blockers.length === 1 && record.blockers[0] === "none") ? (
              <p className="text-xs text-muted-foreground">No blockers</p>
            ) : (
              <div className="space-y-1">
                {record.blockers.filter(b => b !== "none").map(b => (
                  <div key={b} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="text-red-400 font-medium">{BLOCKER_LABELS[b]}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Center: Service Details & Quick Actions */}
        <div className="space-y-4">
          <SectionCard title="Service Details" icon={Zap}>
            <div className="space-y-2">
              <InfoRow label="Service" value={record.service_name} />
              <InfoRow label="Type" value={record.service_type} />
              <InfoRow label="Order" value={record.order_number} />
              <InfoRow label="Created" value={new Date(record.created_at).toLocaleDateString("fr-CA")} />
            </div>
          </SectionCard>
          <SectionCard title="Quick Actions" icon={Zap}>
            <div className="grid grid-cols-2 gap-2">
              <ActionBtn label="Review KYC" icon={ShieldCheck} onClick={() => onNavigate(`/core/kyc`)} />
              <ActionBtn label="Open Payment" icon={CreditCard} onClick={() => onNavigate(`/core/payments`)} />
              <ActionBtn label="Open Invoice" icon={FileText} onClick={() => onNavigate(`/core/invoices`)} />
              <ActionBtn label="Assign Equipment" icon={Package} onClick={() => {}} />
              <ActionBtn label="Schedule Tech" icon={Calendar} onClick={() => onNavigate(`/core/appointments`)} />
              <ActionBtn label="Activate Service" icon={Zap} variant="primary" onClick={() => {}} />
              <ActionBtn label="Open Account" icon={User} onClick={() => onNavigate(`/core/accounts/${record.account_id}`)} />
              <ActionBtn label="Open Order" icon={ExternalLink} onClick={() => onNavigate(`/core/orders/${record.order_id}`)} />
            </div>
          </SectionCard>
        </div>

        {/* Right: Summaries */}
        <div className="space-y-4">
          <SectionCard title="Customer" icon={User}>
            <div className="space-y-2">
              <InfoRow label="Name" value={record.customer_name} />
              <InfoRow label="Email" value={record.customer_email} />
              <InfoRow label="Account" value={record.account_number} />
            </div>
          </SectionCard>
          <SectionCard title="Status Summary" icon={Activity}>
            <div className="space-y-2">
              <StatusRow label="KYC" value={record.kyc_status} />
              <StatusRow label="Payment" value={record.payment_status} />
              <StatusRow label="Invoice" value={record.invoice_status} />
              <StatusRow label="Equipment" value={record.equipment_status} />
              <StatusRow label="Appointment" value={record.appointment_status} />
            </div>
          </SectionCard>
          <SectionCard title="Timeline" icon={Clock}>
            <p className="text-xs text-muted-foreground italic">Activation timeline will be populated from activity logs.</p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

/* ───── Shared Sub-Components ───── */
function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <SubBadge label={value} variant={getSubVariant(value)} />
    </div>
  );
}

function ActionBtn({ label, icon: Icon, onClick, variant }: { label: string; icon: any; onClick: () => void; variant?: "primary" }) {
  return (
    <Button
      variant={variant === "primary" ? "default" : "outline"}
      size="sm"
      className={cn(
        "h-8 text-[11px] gap-1.5 justify-start",
        variant === "primary" && "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
      )}
      onClick={onClick}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Button>
  );
}
