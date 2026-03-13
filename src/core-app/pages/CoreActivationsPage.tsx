/**
 * CoreActivationsPage — Activation Hub / Provisioning Command Center
 * High-density telecom activation operations console for Nivra Core.
 * UI-first: no fake backend logic, structure only.
 */
import { useState, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/admin/ui/DataTable";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Zap, Search, X, CheckCircle2, AlertTriangle, Clock, ShieldCheck,
  CreditCard, FileText, Package, Calendar, User, ExternalLink,
  RefreshCcw, Activity, ArrowUpRight, Timer, Ban, CircleDot,
  Loader2, Radio, ChevronRight, StickyNote, MapPin, Wifi, Tv, Phone,
  Shield, PlayCircle, PauseCircle, XCircle, MessageSquare, Hash,
  TrendingUp, AlertCircle, ArrowUp, ArrowRight, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */
type ActivationStatus =
  | "pending_review" | "waiting_kyc" | "waiting_payment" | "waiting_equipment"
  | "waiting_technician" | "ready" | "in_progress" | "activated" | "blocked" | "cancelled";

type BlockerType = "kyc" | "payment" | "invoice" | "equipment" | "technician" | "address" | "provisioning";
type Priority = "high" | "medium" | "low";

interface ActivationRecord {
  id: string;
  priority: Priority;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  account_number: string;
  service_type: string;
  service_plan: string;
  status: ActivationStatus;
  kyc_status: string;
  payment_status: string;
  invoice_status: string;
  equipment_status: string;
  appointment_status: string;
  activation_readiness: number;
  blockers: BlockerType[];
  assigned_staff: string | null;
  created_at: string;
  target_activation_date: string | null;
  hours_waiting: number;
  sla_hours: number;
  customer_id: string;
  order_id: string;
  account_id: string;
  internal_notes: string;
  provisioning_notes: string;
  customer_notes: string;
}

/* ═══════════════════════════════════════════════════
   STATUS CONFIG
   ═══════════════════════════════════════════════════ */
const STATUS_CONFIG: Record<ActivationStatus, { label: string; cls: string; icon: typeof Zap }> = {
  pending_review:     { label: "Pending Review",     cls: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",    icon: CircleDot },
  waiting_kyc:        { label: "Waiting KYC",        cls: "bg-violet-500/20 text-violet-400 border-violet-500/30", icon: ShieldCheck },
  waiting_payment:    { label: "Waiting Payment",    cls: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: CreditCard },
  waiting_equipment:  { label: "Waiting Equipment",  cls: "bg-amber-500/20 text-amber-400 border-amber-500/30",   icon: Package },
  waiting_technician: { label: "Waiting Technician", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",     icon: Calendar },
  ready:              { label: "Ready to Activate",  cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  in_progress:        { label: "Activating…",        cls: "bg-sky-500/20 text-sky-400 border-sky-500/30",        icon: Loader2 },
  activated:          { label: "Activated",           cls: "bg-emerald-600/25 text-emerald-300 border-emerald-500/40", icon: Zap },
  blocked:            { label: "Blocked",             cls: "bg-red-500/20 text-red-400 border-red-500/30",        icon: Ban },
  cancelled:          { label: "Cancelled",           cls: "bg-zinc-600/20 text-zinc-500 border-zinc-600/30",     icon: XCircle },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; cls: string; icon: typeof ArrowUp }> = {
  high:   { label: "High",   cls: "text-red-400",    icon: ArrowUp },
  medium: { label: "Medium", cls: "text-amber-400",  icon: ArrowRight },
  low:    { label: "Low",    cls: "text-zinc-400",   icon: ArrowDown },
};

const BLOCKER_CONFIG: Record<BlockerType, { label: string; icon: typeof AlertTriangle }> = {
  kyc:          { label: "KYC Pending",          icon: ShieldCheck },
  payment:      { label: "Payment Not Confirmed", icon: CreditCard },
  invoice:      { label: "Invoice Unpaid",        icon: FileText },
  equipment:    { label: "Equipment Not Assigned", icon: Package },
  technician:   { label: "Technician Not Scheduled", icon: Calendar },
  address:      { label: "Address Issue",          icon: MapPin },
  provisioning: { label: "Provisioning Pending",   icon: Radio },
};

const SERVICE_ICONS: Record<string, typeof Phone> = {
  Mobile: Phone, Internet: Wifi, TV: Tv, Security: Shield,
};

/* ═══════════════════════════════════════════════════
   WORKFLOW STEPS
   ═══════════════════════════════════════════════════ */
const WORKFLOW_STEPS = [
  { id: "order_received",     label: "Order Received" },
  { id: "kyc_verified",       label: "KYC Verified" },
  { id: "payment_confirmed",  label: "Payment Confirmed" },
  { id: "invoice_cleared",    label: "Invoice Cleared" },
  { id: "equipment_assigned", label: "Equipment Assigned" },
  { id: "tech_scheduled",     label: "Technician Scheduled" },
  { id: "service_provisioned",label: "Service Provisioned" },
  { id: "subscription_active",label: "Subscription Activated" },
] as const;

function getWorkflowProgress(record: ActivationRecord): number {
  const readiness = record.activation_readiness;
  if (record.status === "activated") return 8;
  if (record.status === "cancelled") return 0;
  return Math.min(Math.floor(readiness / 13), 7);
}

/* ═══════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════ */
function SubBadge({ label, variant }: { label: string; variant: "ok" | "warn" | "error" | "neutral" }) {
  const cls = {
    ok:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    warn:    "bg-amber-500/15 text-amber-400 border-amber-500/20",
    error:   "bg-red-500/15 text-red-400 border-red-500/20",
    neutral: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  }[variant];
  return <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border whitespace-nowrap", cls)}>{label}</span>;
}

function getSubVariant(s: string): "ok" | "warn" | "error" | "neutral" {
  const l = s.toLowerCase();
  if (["verified","paid","assigned","ready","confirmed","completed","approved","cleared","scheduled"].some(k => l.includes(k))) return "ok";
  if (["pending","partial","review","in_transit","processing"].some(k => l.includes(k))) return "warn";
  if (["missing","failed","overdue","rejected","blocked","unpaid","unassigned","issue"].some(k => l.includes(k))) return "error";
  return "neutral";
}

function ReadinessBar({ value }: { value: number }) {
  const color = value >= 100 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

function SlaIndicator({ hours, slaHours }: { hours: number; slaHours: number }) {
  const overdue = hours > slaHours;
  const pct = Math.min((hours / slaHours) * 100, 100);
  return (
    <div className="flex items-center gap-1.5">
      <Timer className={cn("h-3 w-3", overdue ? "text-red-400" : "text-muted-foreground")} />
      <span className={cn("text-[11px] font-mono tabular-nums", overdue ? "text-red-400 font-semibold" : "text-muted-foreground")}>
        {hours}h / {slaHours}h
      </span>
      {overdue && <span className="text-[9px] font-bold text-red-400 uppercase">Overdue</span>}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, accent }: { label: string; value: number; icon: any; color: string; accent?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-4 py-3 min-w-[155px]",
      accent ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/50 bg-secondary/30"
    )}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-md shrink-0", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, actions }: { title: string; icon: any; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-foreground font-medium text-right", mono && "font-mono")}>{value}</span>
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

function ActionBtn({ label, icon: Icon, onClick, variant }: { label: string; icon: any; onClick: () => void; variant?: "primary" | "danger" }) {
  return (
    <Button
      variant={variant === "primary" ? "default" : variant === "danger" ? "destructive" : "outline"}
      size="sm"
      className={cn(
        "h-8 text-[11px] gap-1.5 justify-start",
        variant === "primary" && "bg-emerald-600 hover:bg-emerald-700 text-white border-0"
      )}
      onClick={onClick}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </Button>
  );
}

/* ═══════════════════════════════════════════════════
   EMPTY DATA — will be replaced by real queries
   ═══════════════════════════════════════════════════ */
const EMPTY_DATA: ActivationRecord[] = [];

/* ═══════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════ */
function ActivationEmptyState({ onNavigate }: { onNavigate: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
        <Zap className="h-8 w-8 text-emerald-400/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">No Activations in Queue</h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        The activation queue is currently empty. New activations appear here automatically when orders are ready for provisioning.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "View Orders", icon: Package, path: "/core/orders" },
          { label: "KYC Queue", icon: ShieldCheck, path: "/core/kyc" },
          { label: "Payments", icon: CreditCard, path: "/core/payments" },
          { label: "Equipment", icon: Package, path: "/core/stock" },
        ].map(link => (
          <Button key={link.path} variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={() => onNavigate(link.path)}>
            <link.icon className="h-3.5 w-3.5" />
            {link.label}
          </Button>
        ))}
      </div>
      <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 max-w-lg w-full">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Suggested Actions</h4>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />Check the Work Queue for orders pending activation</li>
          <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />Review KYC submissions that may be blocking provisioning</li>
          <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />Confirm pending payments to unblock waiting activations</li>
          <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-emerald-400" />Assign available equipment to new service orders</li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════ */
export default function CoreActivationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [blockerFilter, setBlockerFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedRecord, setSelectedRecord] = useState<ActivationRecord | null>(null);

  const data = EMPTY_DATA;

  /* KPIs */
  const kpis = useMemo(() => ({
    ready: data.filter(r => r.status === "ready").length,
    blockedKyc: data.filter(r => r.blockers.includes("kyc")).length,
    blockedPayment: data.filter(r => r.blockers.includes("payment")).length,
    blockedEquipment: data.filter(r => r.blockers.includes("equipment")).length,
    waitingTech: data.filter(r => r.status === "waiting_technician").length,
    activatedToday: data.filter(r => r.status === "activated").length,
    overdue: data.filter(r => r.hours_waiting > r.sla_hours).length,
    inProgress: data.filter(r => r.status === "in_progress").length,
    pendingReview: data.filter(r => r.status === "pending_review").length,
  }), [data]);

  /* Filtered data */
  const filtered = useMemo(() => {
    let result = data;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.order_number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.account_number.toLowerCase().includes(q) ||
        r.customer_email.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") result = result.filter(r => r.status === statusFilter);
    if (serviceFilter !== "all") result = result.filter(r => r.service_type === serviceFilter);
    if (blockerFilter !== "all") result = result.filter(r => r.blockers.includes(blockerFilter as BlockerType));
    if (staffFilter !== "all") result = result.filter(r => r.assigned_staff === staffFilter);
    if (priorityFilter !== "all") result = result.filter(r => r.priority === priorityFilter);
    return result;
  }, [data, search, statusFilter, serviceFilter, blockerFilter, staffFilter, priorityFilter]);

  const serviceTypes = [...new Set(data.map(r => r.service_type))];
  const staffList = [...new Set(data.map(r => r.assigned_staff).filter(Boolean))] as string[];

  /* Table columns */
  const columns: Column<ActivationRecord>[] = [
    {
      key: "priority", label: "Pri", className: "w-[40px]",
      render: (r) => {
        const p = PRIORITY_CONFIG[r.priority];
        return <p.icon className={cn("h-3.5 w-3.5", p.cls)} />;
      },
    },
    {
      key: "status", label: "Status", className: "w-[140px]",
      render: (r) => {
        const c = STATUS_CONFIG[r.status];
        return (
          <Badge className={cn("text-[10px] border gap-1", c.cls)}>
            <c.icon className="h-3 w-3" />
            {c.label}
          </Badge>
        );
      },
    },
    {
      key: "order_number", label: "Order #", className: "w-[95px]",
      render: (r) => <span className="font-mono text-xs text-foreground">{r.order_number}</span>,
    },
    {
      key: "customer_name", label: "Customer",
      render: (r) => (
        <div>
          <p className="text-sm text-foreground leading-tight">{r.customer_name}</p>
          <p className="text-[11px] text-muted-foreground">{r.customer_email}</p>
        </div>
      ),
    },
    {
      key: "account_number", label: "Account #", className: "w-[95px]",
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.account_number}</span>,
    },
    {
      key: "service_type", label: "Service", className: "w-[120px]",
      render: (r) => {
        const SvcIcon = SERVICE_ICONS[r.service_type] || Zap;
        return (
          <div className="flex items-center gap-1.5">
            <SvcIcon className="h-3 w-3 text-muted-foreground" />
            <div>
              <p className="text-xs text-foreground leading-tight">{r.service_plan}</p>
              <p className="text-[10px] text-muted-foreground">{r.service_type}</p>
            </div>
          </div>
        );
      },
    },
    { key: "kyc_status", label: "KYC", className: "w-[80px]", render: (r) => <SubBadge label={r.kyc_status} variant={getSubVariant(r.kyc_status)} /> },
    { key: "payment_status", label: "Payment", className: "w-[85px]", render: (r) => <SubBadge label={r.payment_status} variant={getSubVariant(r.payment_status)} /> },
    { key: "invoice_status", label: "Invoice", className: "w-[75px]", render: (r) => <SubBadge label={r.invoice_status} variant={getSubVariant(r.invoice_status)} /> },
    { key: "equipment_status", label: "Equip.", className: "w-[80px]", render: (r) => <SubBadge label={r.equipment_status} variant={getSubVariant(r.equipment_status)} /> },
    { key: "appointment_status", label: "Appt.", className: "w-[80px]", render: (r) => <SubBadge label={r.appointment_status} variant={getSubVariant(r.appointment_status)} /> },
    { key: "activation_readiness", label: "Readiness", className: "w-[120px]", render: (r) => <ReadinessBar value={r.activation_readiness} /> },
    {
      key: "blockers", label: "Blockers", className: "w-[130px]",
      render: (r) => {
        const active = r.blockers.filter(b => b !== "provisioning");
        if (active.length === 0) return <span className="text-xs text-emerald-400">Clear</span>;
        return (
          <div className="flex flex-wrap gap-0.5">
            {active.slice(0, 3).map(b => (
              <span key={b} className="inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                {BLOCKER_CONFIG[b]?.label.split(" ")[0]}
              </span>
            ))}
            {active.length > 3 && <span className="text-[9px] text-muted-foreground">+{active.length - 3}</span>}
          </div>
        );
      },
    },
    {
      key: "hours_waiting", label: "SLA", className: "w-[110px]",
      render: (r) => <SlaIndicator hours={r.hours_waiting} slaHours={r.sla_hours} />,
    },
    {
      key: "assigned_staff", label: "Staff", className: "w-[90px]",
      render: (r) => r.assigned_staff
        ? <span className="text-xs text-foreground">{r.assigned_staff}</span>
        : <span className="text-xs text-red-400/70 italic">Unassigned</span>,
    },
    {
      key: "target_activation_date", label: "Target", className: "w-[85px]",
      render: (r) => <span className="text-xs text-muted-foreground">{r.target_activation_date ? new Date(r.target_activation_date).toLocaleDateString("fr-CA") : "—"}</span>,
    },
    {
      key: "created_at", label: "Created", className: "w-[85px]",
      render: (r) => <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-CA")}</span>,
    },
  ];

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setServiceFilter("all");
    setBlockerFilter("all"); setStaffFilter("all"); setPriorityFilter("all");
  };
  const hasFilters = search || statusFilter !== "all" || serviceFilter !== "all" || blockerFilter !== "all" || staffFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/20">
            <Zap className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Activation Hub</h1>
            <p className="text-xs text-muted-foreground">Provisioning command center — track, unblock & activate services</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => {}}>
            <RefreshCcw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* KPI Row 1 — Primary metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        <KpiCard label="Ready" value={kpis.ready} icon={CheckCircle2} color="bg-emerald-500/20 text-emerald-400" accent />
        <KpiCard label="In Progress" value={kpis.inProgress} icon={Loader2} color="bg-sky-500/20 text-sky-400" />
        <KpiCard label="Pending Review" value={kpis.pendingReview} icon={CircleDot} color="bg-zinc-500/20 text-zinc-400" />
        <KpiCard label="Blocked — KYC" value={kpis.blockedKyc} icon={ShieldCheck} color="bg-red-500/20 text-red-400" />
        <KpiCard label="Blocked — Payment" value={kpis.blockedPayment} icon={CreditCard} color="bg-orange-500/20 text-orange-400" />
        <KpiCard label="Blocked — Equip." value={kpis.blockedEquipment} icon={Package} color="bg-amber-500/20 text-amber-400" />
        <KpiCard label="Waiting Tech" value={kpis.waitingTech} icon={Calendar} color="bg-blue-500/20 text-blue-400" />
        <KpiCard label="Overdue" value={kpis.overdue} icon={AlertCircle} color="bg-red-600/20 text-red-500" />
        <KpiCard label="Activated Today" value={kpis.activatedToday} icon={Zap} color="bg-emerald-600/20 text-emerald-300" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-secondary/15 px-3 py-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search order, customer, account…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-secondary/40 border-border/50"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-[110px] text-xs bg-secondary/40 border-border/50"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[145px] text-xs bg-secondary/40 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs bg-secondary/40 border-border/50"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {serviceTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={blockerFilter} onValueChange={setBlockerFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs bg-secondary/40 border-border/50"><SelectValue placeholder="Blocker" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All blockers</SelectItem>
            {Object.entries(BLOCKER_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={staffFilter} onValueChange={setStaffFilter}>
          <SelectTrigger className="h-8 w-[120px] text-xs bg-secondary/40 border-border/50"><SelectValue placeholder="Staff" /></SelectTrigger>
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

      {/* Queue Table or Empty State */}
      {data.length === 0 ? (
        <ActivationEmptyState onNavigate={navigate} />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={r => r.id}
          onRowClick={r => setSelectedRecord(r)}
          emptyMessage="No activations match filters"
          emptyIcon={<Search className="h-8 w-8 text-muted-foreground/30 mb-2" />}
          compact
          pageSize={30}
        />
      )}

      {/* Activation File Drawer */}
      <Sheet open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto bg-background border-border p-0">
          {selectedRecord && (
            <ActivationFileDrawer
              record={selectedRecord}
              onNavigate={navigate}
              onClose={() => setSelectedRecord(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ACTIVATION FILE DRAWER
   ═══════════════════════════════════════════════════ */
function ActivationFileDrawer({ record, onNavigate, onClose }: {
  record: ActivationRecord;
  onNavigate: (path: string) => void;
  onClose: () => void;
}) {
  const statusCfg = STATUS_CONFIG[record.status];
  const priorityCfg = PRIORITY_CONFIG[record.priority];
  const workflowStep = getWorkflowProgress(record);
  const overdue = record.hours_waiting > record.sla_hours;

  return (
    <div className="flex flex-col h-full">
      {/* Drawer Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background px-5 py-4">
        <SheetHeader className="p-0">
          <SheetTitle className="flex items-center gap-3 text-foreground text-base">
            <Zap className="h-5 w-5 text-emerald-400" />
            <span>Activation File</span>
            <span className="font-mono text-sm text-muted-foreground">— {record.order_number}</span>
            <Badge className={cn("text-[10px] border gap-1 ml-2", statusCfg.cls)}>
              <statusCfg.icon className="h-3 w-3" />
              {statusCfg.label}
            </Badge>
            <div className={cn("flex items-center gap-1 ml-2", priorityCfg.cls)}>
              <priorityCfg.icon className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase">{priorityCfg.label}</span>
            </div>
            {overdue && (
              <Badge className="ml-2 text-[10px] bg-red-600/25 text-red-400 border-red-500/40 gap-1">
                <AlertCircle className="h-3 w-3" /> SLA Overdue
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-4 mt-2">
          <SlaIndicator hours={record.hours_waiting} slaHours={record.sla_hours} />
          <ReadinessBar value={record.activation_readiness} />
        </div>
      </div>

      {/* Three-column body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ─── LEFT COLUMN ─── */}
          <div className="space-y-4">
            {/* Workflow Stepper */}
            <SectionCard title="Activation Workflow" icon={Activity}>
              <div className="space-y-0">
                {WORKFLOW_STEPS.map((step, i) => {
                  const done = i < workflowStep;
                  const active = i === workflowStep;
                  return (
                    <div key={step.id} className="flex items-start gap-2.5 relative">
                      {i < WORKFLOW_STEPS.length - 1 && (
                        <div className={cn(
                          "absolute left-[7px] top-5 w-0.5 h-5",
                          done ? "bg-emerald-500/50" : "bg-border/40"
                        )} />
                      )}
                      <div className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full shrink-0 mt-0.5",
                        done ? "bg-emerald-500/30" : active ? "bg-sky-500/30 ring-1 ring-sky-400/50" : "bg-secondary"
                      )}>
                        {done ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        ) : active ? (
                          <Radio className="h-2.5 w-2.5 text-sky-400" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        )}
                      </div>
                      <span className={cn(
                        "text-xs pb-3",
                        done ? "text-emerald-400" : active ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Blockers */}
            <SectionCard title="Blockers" icon={AlertTriangle}>
              {record.blockers.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No blockers — ready for activation
                </div>
              ) : (
                <div className="space-y-2">
                  {record.blockers.map(b => {
                    const cfg = BLOCKER_CONFIG[b];
                    return (
                      <div key={b} className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
                        <cfg.icon className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <span className="text-xs text-red-400 font-medium">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Priority & Assignment */}
            <SectionCard title="Assignment" icon={User}>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Priority</span>
                  <div className={cn("flex items-center gap-1", priorityCfg.cls)}>
                    <priorityCfg.icon className="h-3 w-3" />
                    <span className="font-medium">{priorityCfg.label}</span>
                  </div>
                </div>
                <InfoRow label="Assigned to" value={record.assigned_staff || "Unassigned"} />
                <InfoRow label="Created" value={new Date(record.created_at).toLocaleDateString("fr-CA")} />
                <InfoRow label="Target date" value={record.target_activation_date ? new Date(record.target_activation_date).toLocaleDateString("fr-CA") : "—"} />
              </div>
            </SectionCard>
          </div>

          {/* ─── CENTER COLUMN ─── */}
          <div className="space-y-4">
            {/* Service Details */}
            <SectionCard title="Service Details" icon={Zap}>
              <div className="space-y-2">
                <InfoRow label="Service" value={record.service_plan} />
                <InfoRow label="Type" value={record.service_type} />
                <InfoRow label="Order #" value={record.order_number} mono />
                <InfoRow label="Account #" value={record.account_number} mono />
              </div>
            </SectionCard>

            {/* Order Details */}
            <SectionCard title="Order Details" icon={Package}>
              <div className="space-y-2">
                <InfoRow label="Order Number" value={record.order_number} mono />
                <InfoRow label="Created" value={new Date(record.created_at).toLocaleDateString("fr-CA")} />
                <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1 mt-1" onClick={() => onNavigate(`/core/orders/${record.order_id}`)}>
                  <ExternalLink className="h-3 w-3" /> Open Order
                </Button>
              </div>
            </SectionCard>

            {/* Notes */}
            <SectionCard title="Internal Notes" icon={StickyNote}>
              <p className="text-xs text-muted-foreground italic">
                {record.internal_notes || "No internal notes yet. Notes will be captured during processing."}
              </p>
            </SectionCard>

            <SectionCard title="Provisioning Notes" icon={Radio}>
              <p className="text-xs text-muted-foreground italic">
                {record.provisioning_notes || "No provisioning notes. Will be populated during activation."}
              </p>
            </SectionCard>

            {/* Quick Actions */}
            <SectionCard title="Quick Actions" icon={Zap}>
              <div className="grid grid-cols-2 gap-1.5">
                <ActionBtn label="Review KYC" icon={ShieldCheck} onClick={() => onNavigate("/core/kyc")} />
                <ActionBtn label="Open Payment" icon={CreditCard} onClick={() => onNavigate("/core/payments")} />
                <ActionBtn label="Open Invoice" icon={FileText} onClick={() => onNavigate("/core/invoices")} />
                <ActionBtn label="Assign Equipment" icon={Package} onClick={() => {}} />
                <ActionBtn label="Schedule Appt." icon={Calendar} onClick={() => onNavigate("/core/appointments")} />
                <ActionBtn label="Open Account" icon={User} onClick={() => onNavigate(`/core/accounts/${record.account_id}`)} />
                <ActionBtn label="Open Order" icon={ExternalLink} onClick={() => onNavigate(`/core/orders/${record.order_id}`)} />
                <ActionBtn label="Customer Profile" icon={User} onClick={() => onNavigate(`/core/clients/${record.customer_id}`)} />
                <ActionBtn label="Start Activation" icon={PlayCircle} onClick={() => {}} variant="primary" />
                <ActionBtn label="Mark Provisioned" icon={CheckCircle2} onClick={() => {}} variant="primary" />
                <ActionBtn label="Complete Activation" icon={Zap} onClick={() => {}} variant="primary" />
                <ActionBtn label="Block Activation" icon={PauseCircle} onClick={() => {}} variant="danger" />
                <ActionBtn label="Add Note" icon={MessageSquare} onClick={() => {}} />
              </div>
            </SectionCard>
          </div>

          {/* ─── RIGHT COLUMN ─── */}
          <div className="space-y-4">
            {/* Customer Summary */}
            <SectionCard title="Customer" icon={User}>
              <div className="space-y-2">
                <InfoRow label="Name" value={record.customer_name} />
                <InfoRow label="Email" value={record.customer_email} />
                <InfoRow label="Phone" value={record.customer_phone || "—"} />
                <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1 mt-1" onClick={() => onNavigate(`/core/clients/${record.customer_id}`)}>
                  <ExternalLink className="h-3 w-3" /> View Customer
                </Button>
              </div>
            </SectionCard>

            {/* Account */}
            <SectionCard title="Linked Account" icon={Hash}>
              <div className="space-y-2">
                <InfoRow label="Account #" value={record.account_number} mono />
                <Button variant="outline" size="sm" className="w-full h-7 text-[11px] gap-1 mt-1" onClick={() => onNavigate(`/core/accounts/${record.account_id}`)}>
                  <ExternalLink className="h-3 w-3" /> View Account
                </Button>
              </div>
            </SectionCard>

            {/* Status Summary Grid */}
            <SectionCard title="Subsystem Status" icon={Activity}>
              <div className="space-y-2">
                <StatusRow label="KYC" value={record.kyc_status} />
                <StatusRow label="Payment" value={record.payment_status} />
                <StatusRow label="Invoice" value={record.invoice_status} />
                <StatusRow label="Equipment" value={record.equipment_status} />
                <StatusRow label="Appointment" value={record.appointment_status} />
              </div>
            </SectionCard>

            {/* Billing Summary */}
            <SectionCard title="Billing / Payment" icon={CreditCard}>
              <p className="text-xs text-muted-foreground italic">Payment and invoice details will be populated from billing records.</p>
            </SectionCard>

            {/* Equipment */}
            <SectionCard title="Equipment" icon={Package}>
              <p className="text-xs text-muted-foreground italic">Equipment assignment details will appear here once linked.</p>
            </SectionCard>

            {/* Appointment */}
            <SectionCard title="Appointment" icon={Calendar}>
              <p className="text-xs text-muted-foreground italic">Technician appointment details will be shown once scheduled.</p>
            </SectionCard>

            {/* Timeline */}
            <SectionCard title="Activation Timeline" icon={Clock}>
              <p className="text-xs text-muted-foreground italic">Timeline events will be populated from activity logs as the activation progresses.</p>
            </SectionCard>
          </div>

        </div>
      </div>
    </div>
  );
}
