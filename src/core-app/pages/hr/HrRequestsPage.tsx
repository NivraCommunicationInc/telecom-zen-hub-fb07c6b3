/**
 * HrRequestsPage — Full HR requests management hub.
 *
 * Sections:
 *  1. Queue (counters + pending requests table with approve/refuse)
 *  2. Detail side panel (employee info, status history, internal notes, documents)
 *  3. Filters & search
 *  4. Absence calendar (color-coded approved leaves)
 *  5. Statistics (vacation/sick days, top absentee, attendance rate)
 *
 * Backed by:
 *  - public.hr_requests (canonical queue)
 *  - public.hr_request_notes (admin-only internal notes)
 *  - public.hr_audit_log (audit trail)
 *  - public.employee_notifications (notify employee on decision)
 *  - storage bucket "hr-documents" path: requests/{request_id}/{filename}
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, CheckCircle, XCircle, Plane, Stethoscope, User as UserIcon,
  HelpCircle, Search, Calendar as CalendarIcon, Upload, Download, FileText,
  MessageSquare, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  startOfDay, parseISO, differenceInCalendarDays,
} from "date-fns";
import { fr } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  vacation: "Vacances",
  sick_leave: "Maladie",
  personal_leave: "Congé personnel",
  part_time: "Temps partiel",
  other: "Autre",
};

const TYPE_ICON: Record<string, typeof Plane> = {
  vacation: Plane,
  sick_leave: Stethoscope,
  personal_leave: UserIcon,
  part_time: UserIcon,
  other: HelpCircle,
};

// Calendar color (HSL — semantic-friendly fallbacks)
const TYPE_COLOR: Record<string, string> = {
  vacation: "bg-blue-500",
  sick_leave: "bg-red-500",
  personal_leave: "bg-orange-500",
  part_time: "bg-purple-500",
  other: "bg-purple-500",
};

const TYPE_COLOR_SOFT: Record<string, string> = {
  vacation: "bg-blue-100 text-blue-800 border-blue-200",
  sick_leave: "bg-red-100 text-red-800 border-red-200",
  personal_leave: "bg-orange-100 text-orange-800 border-orange-200",
  part_time: "bg-purple-100 text-purple-800 border-purple-200",
  other: "bg-muted text-foreground border-border",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  declined: { label: "Refusé", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "secondary" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function businessDays(start: string | null, end: string | null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date(start);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "??";
}

type Emp = {
  user_id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  job_title: string | null;
  department: string | null;
};

type Req = {
  id: string;
  employee_id: string;
  request_type: string;
  start_date: string;
  end_date: string | null;
  hours_requested: number | null;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  _emp?: Emp;
  _reviewer?: { first_name: string; last_name: string } | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HrRequestsPage() {
  const qc = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"created_desc" | "created_asc" | "type" | "status">("created_desc");

  // Dialogs
  const [refuseDialog, setRefuseDialog] = useState<Req | null>(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [infoDialog, setInfoDialog] = useState<Req | null>(null);
  const [infoMessage, setInfoMessage] = useState("");

  // Side panel
  const [panelReq, setPanelReq] = useState<Req | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  // Calendar month
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(new Date()));

  // ─── Data: requests + employees ─────────────────────────────────────────────
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["hr-requests-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const empIds = [...new Set(data.map((r: any) => r.employee_id))];
      const reviewerIds = [...new Set(data.map((r: any) => r.reviewed_by).filter(Boolean))];
      const allIds = [...new Set([...empIds, ...reviewerIds])];

      const empMap: Record<string, Emp> = {};
      if (allIds.length) {
        const { data: recs } = await supabase
          .from("employee_records")
          .select("user_id, first_name, last_name, employee_number, job_title, department")
          .in("user_id", allIds);
        for (const r of recs ?? []) {
          if (r.user_id) empMap[r.user_id] = r as Emp;
        }
      }

      return (data as any[]).map((r) => ({
        ...r,
        _emp: empMap[r.employee_id],
        _reviewer: r.reviewed_by ? empMap[r.reviewed_by] ?? null : null,
      })) as Req[];
    },
  });

  // Employee directory for filter dropdown
  const employeeOptions = useMemo(() => {
    const seen = new Map<string, Emp>();
    for (const r of requests) {
      if (r._emp && !seen.has(r._emp.user_id)) seen.set(r._emp.user_id, r._emp);
    }
    return [...seen.values()].sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
    );
  }, [requests]);

  // ─── Notes for panel ────────────────────────────────────────────────────────
  const { data: panelNotes = [] } = useQuery({
    queryKey: ["hr-request-notes", panelReq?.id],
    queryFn: async () => {
      if (!panelReq) return [];
      const { data, error } = await supabase
        .from("hr_request_notes")
        .select("*")
        .eq("request_id", panelReq.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!panelReq,
  });

  // ─── Documents for panel ────────────────────────────────────────────────────
  const { data: panelDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["hr-request-docs", panelReq?.id],
    queryFn: async () => {
      if (!panelReq) return [];
      const { data, error } = await supabase.storage
        .from("hr-documents")
        .list(`requests/${panelReq.id}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) {
        if ((error as any).statusCode === "404" || /not.*found/i.test(error.message)) return [];
        throw error;
      }
      return (data ?? []).filter((f) => f.name && !f.name.startsWith("."));
    },
    enabled: !!panelReq,
  });

  // ─── Status history (audit log) ─────────────────────────────────────────────
  const { data: panelHistory = [] } = useQuery({
    queryKey: ["hr-request-history", panelReq?.id],
    queryFn: async () => {
      if (!panelReq) return [];
      const { data } = await supabase
        .from("hr_audit_log")
        .select("*")
        .eq("entity_type", "hr_request")
        .eq("entity_id", panelReq.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!panelReq,
  });

  // ─── Mutation: decision (approve/decline) ───────────────────────────────────
  const decideMut = useMutation({
    mutationFn: async (vars: { req: Req; decision: "approved" | "declined"; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const update: any = {
        status: vars.decision,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };
      if (vars.decision === "declined" && vars.reason) update.review_note = vars.reason;

      const { error } = await supabase.from("hr_requests").update(update).eq("id", vars.req.id);
      if (error) throw error;

      // Audit log
      await supabase.from("hr_audit_log").insert({
        actor_user_id: user.id,
        action: vars.decision === "approved" ? "request_approved" : "request_declined",
        entity_type: "hr_request",
        entity_id: vars.req.id,
        old_value: vars.req.status,
        new_value: vars.decision,
        details: {
          request_type: vars.req.request_type,
          employee_id: vars.req.employee_id,
          start_date: vars.req.start_date,
          end_date: vars.req.end_date,
          reason: vars.reason ?? null,
        },
      });

      // Mark schedule days as absence (best-effort) when approved
      if (vars.decision === "approved" && vars.req.start_date) {
        const end = vars.req.end_date ?? vars.req.start_date;
        const days = eachDayOfInterval({ start: parseISO(vars.req.start_date), end: parseISO(end) });
        for (const d of days) {
          await supabase
            .from("employee_shifts")
            .update({ shift_type: "leave", notes: `Absence: ${TYPE_LABEL[vars.req.request_type] ?? vars.req.request_type}` })
            .eq("user_id", vars.req.employee_id)
            .eq("shift_date", format(d, "yyyy-MM-dd"));
        }
      }

      // Notify employee
      const typeLabel = TYPE_LABEL[vars.req.request_type] ?? vars.req.request_type;
      const dateRange = vars.req.start_date
        ? vars.req.end_date && vars.req.end_date !== vars.req.start_date
          ? `du ${format(parseISO(vars.req.start_date), "d MMM yyyy", { locale: fr })} au ${format(parseISO(vars.req.end_date), "d MMM yyyy", { locale: fr })}`
          : `le ${format(parseISO(vars.req.start_date), "d MMM yyyy", { locale: fr })}`
        : "";
      const title = vars.decision === "approved" ? "Demande approuvée" : "Demande refusée";
      const message = vars.decision === "approved"
        ? `Votre demande de ${typeLabel} ${dateRange} a été approuvée.`
        : `Votre demande de ${typeLabel} ${dateRange} a été refusée.${vars.reason ? ` Raison : ${vars.reason}` : ""}`;
      await supabase.from("employee_notifications").insert({
        user_id: vars.req.employee_id,
        notification_type: "system",
        title,
        message,
      });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      qc.invalidateQueries({ queryKey: ["hr-requests-all"] });
      qc.invalidateQueries({ queryKey: ["hr-request-history"] });
      setRefuseDialog(null);
      setRefuseReason("");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Mutation: add internal note ────────────────────────────────────────────
  const noteMut = useMutation({
    mutationFn: async (vars: { request_id: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { data: rec } = await supabase
        .from("employee_records").select("first_name, last_name").eq("user_id", user.id).maybeSingle();
      const created_by_name = rec ? `${rec.first_name} ${rec.last_name}` : (user.email ?? null);
      const { error } = await supabase.from("hr_request_notes").insert({
        request_id: vars.request_id,
        note: vars.note,
        created_by: user.id,
        created_by_name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteDraft("");
      qc.invalidateQueries({ queryKey: ["hr-request-notes"] });
      toast.success("Note ajoutée");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Mutation: send "more info" message ─────────────────────────────────────
  const moreInfoMut = useMutation({
    mutationFn: async (vars: { req: Req; message: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      await supabase.from("employee_notifications").insert({
        user_id: vars.req.employee_id,
        notification_type: "system",
        title: "Demande d'information — RH",
        message: vars.message,
      });
      await supabase.from("hr_audit_log").insert({
        actor_user_id: user.id,
        action: "request_info_requested",
        entity_type: "hr_request",
        entity_id: vars.req.id,
        details: { message: vars.message },
      });
    },
    onSuccess: () => {
      setInfoDialog(null);
      setInfoMessage("");
      qc.invalidateQueries({ queryKey: ["hr-request-history"] });
      toast.success("Message envoyé à l'employé");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Upload handler ─────────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!panelReq) return;
    setUploadingFile(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `requests/${panelReq.id}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from("hr-documents").upload(path, file);
      if (error) throw error;
      toast.success("Document téléchargé");
      refetchDocs();
    } catch (e: any) {
      toast.error("Échec du téléchargement", { description: e.message });
    } finally {
      setUploadingFile(false);
    }
  };

  const downloadDoc = async (filename: string) => {
    if (!panelReq) return;
    const path = `requests/${panelReq.id}/${filename}`;
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Impossible de télécharger");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  // ─── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...requests];
    if (filterStatus !== "all") list = list.filter((r) => r.status === filterStatus);
    if (filterType !== "all") list = list.filter((r) => r.request_type === filterType);
    if (filterEmployee !== "all") list = list.filter((r) => r.employee_id === filterEmployee);
    if (filterFrom) list = list.filter((r) => r.start_date >= filterFrom);
    if (filterTo) list = list.filter((r) => (r.end_date ?? r.start_date) <= filterTo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => {
        const name = r._emp ? `${r._emp.first_name} ${r._emp.last_name}`.toLowerCase() : "";
        return name.includes(q) || (r._emp?.employee_number ?? "").toLowerCase().includes(q);
      });
    }
    if (sortBy === "created_asc") list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sortBy === "type") list.sort((a, b) => a.request_type.localeCompare(b.request_type));
    else if (sortBy === "status") list.sort((a, b) => a.status.localeCompare(b.status));
    else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [requests, filterStatus, filterType, filterEmployee, filterFrom, filterTo, search, sortBy]);

  // ─── Section 1 counters (pending only) ──────────────────────────────────────
  const pendingByType = useMemo(() => {
    const counts: Record<string, number> = { vacation: 0, sick_leave: 0, personal_leave: 0, other: 0 };
    for (const r of requests) {
      if (r.status !== "pending") continue;
      if (counts[r.request_type] !== undefined) counts[r.request_type]++;
      else counts.other++;
    }
    return counts;
  }, [requests]);

  // ─── Section 4: Calendar month days ─────────────────────────────────────────
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) }),
    [calMonth],
  );

  const approvedByDay = useMemo(() => {
    const map: Record<string, Req[]> = {};
    for (const r of requests) {
      if (r.status !== "approved") continue;
      const start = parseISO(r.start_date);
      const end = r.end_date ? parseISO(r.end_date) : start;
      const days = eachDayOfInterval({ start, end });
      for (const d of days) {
        const key = format(d, "yyyy-MM-dd");
        (map[key] ??= []).push(r);
      }
    }
    return map;
  }, [requests]);

  // ─── Section 5: Statistics (current month) ──────────────────────────────────
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    let vacation = 0, sick = 0;
    const perEmp: Record<string, { name: string; days: number }> = {};

    for (const r of requests) {
      if (r.status !== "approved") continue;
      const start = parseISO(r.start_date);
      const end = r.end_date ? parseISO(r.end_date) : start;
      const overlapStart = start < monthStart ? monthStart : start;
      const overlapEnd = end > monthEnd ? monthEnd : end;
      if (overlapEnd < overlapStart) continue;
      const days = businessDays(format(overlapStart, "yyyy-MM-dd"), format(overlapEnd, "yyyy-MM-dd"));
      if (r.request_type === "vacation") vacation += days;
      if (r.request_type === "sick_leave") sick += days;
      const name = r._emp ? `${r._emp.first_name} ${r._emp.last_name}` : "—";
      perEmp[r.employee_id] ??= { name, days: 0 };
      perEmp[r.employee_id].days += days;
    }

    let topAbs: { name: string; days: number } | null = null;
    for (const v of Object.values(perEmp)) {
      if (!topAbs || v.days > topAbs.days) topAbs = v;
    }

    // Attendance rate: business days in month vs total absence-days across all employees
    const totalEmployees = employeeOptions.length || 1;
    const businessDaysInMonth = monthDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6).length;
    const totalCapacity = totalEmployees * businessDaysInMonth;
    const totalAbsences = Object.values(perEmp).reduce((s, e) => s + e.days, 0);
    const attendance = totalCapacity > 0 ? Math.max(0, 100 - (totalAbsences / totalCapacity) * 100) : 100;

    return { vacation, sick, topAbs, attendance };
  }, [requests, employeeOptions, monthDays]);

  // Reset note draft when panel changes
  useEffect(() => { setNoteDraft(""); }, [panelReq?.id]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Demandes RH</h1>
        <p className="text-sm text-muted-foreground">File d'attente et gestion complète des demandes employés</p>
      </div>

      {/* ─── SECTION 1 — Counter badges ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: "vacation", label: "Vacances", icon: Plane },
          { key: "sick_leave", label: "Maladie", icon: Stethoscope },
          { key: "personal_leave", label: "Personnel", icon: UserIcon },
          { key: "other", label: "Autre", icon: HelpCircle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Card key={key} className="cursor-pointer hover:bg-accent/40" onClick={() => { setFilterStatus("pending"); setFilterType(key); }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-md ${TYPE_COLOR_SOFT[key]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{pendingByType[key] ?? 0}</div>
                <div className="text-xs text-muted-foreground">{label} en attente</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── SECTION 3 — Filters & search ────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom employé / # employé" className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="declined">Refusé</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Employé</Label>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {employeeOptions.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tri</Label>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Plus récent</SelectItem>
                <SelectItem value="created_asc">Plus ancien</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button variant="outline" size="sm" onClick={() => {
              setFilterStatus("all"); setFilterType("all"); setFilterEmployee("all");
              setFilterFrom(""); setFilterTo(""); setSearch(""); setSortBy("created_desc");
            }}>Réinitialiser</Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 1 (continued) — Queue table ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">File d'attente — {filtered.length} demande{filtered.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Jours ouvr.</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead>Soumis</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
                ) : filtered.map((r) => {
                  const Icon = TYPE_ICON[r.request_type] ?? HelpCircle;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setPanelReq(r)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{initials(r._emp?.first_name, r._emp?.last_name)}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-medium text-sm">{r._emp ? `${r._emp.first_name} ${r._emp.last_name}` : "—"}</div>
                            <div className="text-xs text-muted-foreground">{r._emp?.job_title ?? r._emp?.employee_number ?? ""}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Icon className="h-3.5 w-3.5" /> {TYPE_LABEL[r.request_type] ?? r.request_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(parseISO(r.start_date), "d MMM", { locale: fr })}
                        {r.end_date && r.end_date !== r.start_date && ` → ${format(parseISO(r.end_date), "d MMM yyyy", { locale: fr })}`}
                        {(!r.end_date || r.end_date === r.start_date) && ` ${format(parseISO(r.start_date), "yyyy", { locale: fr })}`}
                      </TableCell>
                      <TableCell className="text-right text-sm">{businessDays(r.start_date, r.end_date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.reason ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(parseISO(r.created_at), "d MMM, HH:mm", { locale: fr })}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[r.status]?.variant ?? "outline"}>{STATUS_BADGE[r.status]?.label ?? r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="default" disabled={decideMut.isPending}
                              onClick={() => decideMut.mutate({ req: r, decision: "approved" })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approuver
                            </Button>
                            <Button size="sm" variant="destructive" disabled={decideMut.isPending}
                              onClick={() => setRefuseDialog(r)}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setPanelReq(r)}>Voir</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 4 — Absence calendar ────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" /> Calendrier des absences — {format(calMonth, "MMMM yyyy", { locale: fr })}
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCalMonth(startOfMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1)))}>← Précédent</Button>
            <Button size="sm" variant="outline" onClick={() => setCalMonth(startOfMonth(new Date()))}>Aujourd'hui</Button>
            <Button size="sm" variant="outline" onClick={() => setCalMonth(startOfMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1)))}>Suivant →</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-3 text-xs">
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-blue-500" /> Vacances</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500" /> Maladie</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-500" /> Personnel</span>
            <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-purple-500" /> Autre</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
            {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i} className="p-1 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (monthDays[0].getDay() + 6) % 7 }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayReqs = approvedByDay[key] ?? [];
              const isToday = isSameDay(d, new Date());
              return (
                <div key={key} className={`min-h-[60px] border rounded p-1 text-xs ${isToday ? "ring-1 ring-primary" : ""}`}>
                  <div className="font-semibold">{format(d, "d")}</div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayReqs.slice(0, 3).map((r) => (
                      <div key={r.id} className={`${TYPE_COLOR[r.request_type] ?? "bg-muted"} text-white rounded px-1 truncate cursor-pointer`} title={`${r._emp?.first_name} ${r._emp?.last_name} — ${TYPE_LABEL[r.request_type]}`} onClick={() => setPanelReq(r)}>
                        {r._emp?.first_name?.[0]}. {r._emp?.last_name}
                      </div>
                    ))}
                    {dayReqs.length > 3 && <div className="text-muted-foreground">+{dayReqs.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 5 — Statistics ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Plane className="h-4 w-4" /> Vacances ce mois</div>
          <div className="text-3xl font-bold mt-1">{stats.vacation}</div>
          <div className="text-xs text-muted-foreground">jours ouvrables</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Stethoscope className="h-4 w-4" /> Maladie ce mois</div>
          <div className="text-3xl font-bold mt-1">{stats.sick}</div>
          <div className="text-xs text-muted-foreground">jours ouvrables</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-4 w-4" /> Plus d'absences</div>
          <div className="text-lg font-bold mt-1 truncate">{stats.topAbs?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{stats.topAbs ? `${stats.topAbs.days} jours` : "Aucune absence"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-4 w-4" /> Taux de présence</div>
          <div className="text-3xl font-bold mt-1">{stats.attendance.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">ce mois</div>
        </CardContent></Card>
      </div>

      {/* ─── Refuse dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!refuseDialog} onOpenChange={(open) => { if (!open) { setRefuseDialog(null); setRefuseReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
            <DialogDescription>
              {refuseDialog?._emp ? `${refuseDialog._emp.first_name} ${refuseDialog._emp.last_name} — ` : ""}
              {refuseDialog ? TYPE_LABEL[refuseDialog.request_type] : ""}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="refuse-reason">Raison du refus *</Label>
            <Textarea id="refuse-reason" value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Expliquez pourquoi cette demande est refusée…" rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRefuseDialog(null); setRefuseReason(""); }}>Annuler</Button>
            <Button variant="destructive" disabled={!refuseReason.trim() || decideMut.isPending}
              onClick={() => refuseDialog && decideMut.mutate({ req: refuseDialog, decision: "declined", reason: refuseReason.trim() })}>
              {decideMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── More info dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!infoDialog} onOpenChange={(open) => { if (!open) { setInfoDialog(null); setInfoMessage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander plus d'information</DialogTitle>
            <DialogDescription>L'employé recevra une notification</DialogDescription>
          </DialogHeader>
          <Textarea value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)}
            placeholder="Quelle information vous manque-t-il ?" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInfoDialog(null); setInfoMessage(""); }}>Annuler</Button>
            <Button disabled={!infoMessage.trim() || moreInfoMut.isPending}
              onClick={() => infoDialog && moreInfoMut.mutate({ req: infoDialog, message: infoMessage.trim() })}>
              {moreInfoMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── SECTION 2 — Detail side panel ───────────────────────────────────── */}
      <Sheet open={!!panelReq} onOpenChange={(open) => { if (!open) setPanelReq(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {panelReq && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Avatar className="h-10 w-10"><AvatarFallback>{initials(panelReq._emp?.first_name, panelReq._emp?.last_name)}</AvatarFallback></Avatar>
                  <div>
                    <div>{panelReq._emp ? `${panelReq._emp.first_name} ${panelReq._emp.last_name}` : "—"}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {panelReq._emp?.job_title ?? "—"}{panelReq._emp?.department ? ` · ${panelReq._emp.department}` : ""}
                    </div>
                  </div>
                </SheetTitle>
                <SheetDescription>Demande #{panelReq.id.slice(0, 8)}</SheetDescription>
              </SheetHeader>

              <ScrollArea className="mt-4">
                {/* Request details */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-medium">{TYPE_LABEL[panelReq.request_type] ?? panelReq.request_type}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Statut</div>
                      <Badge variant={STATUS_BADGE[panelReq.status]?.variant ?? "outline"}>{STATUS_BADGE[panelReq.status]?.label}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Du</div>
                      <div className="font-medium">{format(parseISO(panelReq.start_date), "d MMM yyyy", { locale: fr })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Au</div>
                      <div className="font-medium">{panelReq.end_date ? format(parseISO(panelReq.end_date), "d MMM yyyy", { locale: fr }) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Jours ouvrables</div>
                      <div className="font-medium">{businessDays(panelReq.start_date, panelReq.end_date)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Soumis le</div>
                      <div className="font-medium">{format(parseISO(panelReq.created_at), "d MMM yyyy, HH:mm", { locale: fr })}</div>
                    </div>
                  </div>
                  {panelReq.reason && (
                    <div className="bg-muted rounded p-2 text-sm">
                      <div className="text-xs text-muted-foreground mb-0.5">Raison de l'employé</div>
                      <div>{panelReq.reason}</div>
                    </div>
                  )}
                  {panelReq.review_note && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-sm">
                      <div className="text-xs text-muted-foreground mb-0.5">Note d'examen</div>
                      <div>{panelReq.review_note}</div>
                    </div>
                  )}
                </div>

                {/* Status history */}
                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2">Historique</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1.5" />
                      <div>
                        <div>Soumise par {panelReq._emp ? `${panelReq._emp.first_name} ${panelReq._emp.last_name}` : "l'employé"}</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(panelReq.created_at), "d MMM yyyy, HH:mm", { locale: fr })}</div>
                      </div>
                    </div>
                    {panelReq.reviewed_at && (
                      <div className="flex items-start gap-2">
                        <div className={`h-2 w-2 rounded-full mt-1.5 ${panelReq.status === "approved" ? "bg-green-500" : "bg-red-500"}`} />
                        <div>
                          <div>{STATUS_BADGE[panelReq.status]?.label} par {panelReq._reviewer ? `${panelReq._reviewer.first_name} ${panelReq._reviewer.last_name}` : "—"}</div>
                          <div className="text-xs text-muted-foreground">{format(parseISO(panelReq.reviewed_at), "d MMM yyyy, HH:mm", { locale: fr })}</div>
                        </div>
                      </div>
                    )}
                    {(panelHistory as any[]).map((h) => (
                      <div key={h.id} className="flex items-start gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                        <div>
                          <div>{h.action === "request_info_requested" ? "Info supplémentaire demandée" : h.action}</div>
                          <div className="text-xs text-muted-foreground">{format(parseISO(h.created_at), "d MMM yyyy, HH:mm", { locale: fr })}</div>
                          {h.details?.message && <div className="text-xs italic">"{h.details.message}"</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Internal notes */}
                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" /> Notes internes (admin uniquement)
                  </div>
                  <div className="space-y-2">
                    <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Ajouter une note interne…" rows={2} />
                    <Button size="sm" disabled={!noteDraft.trim() || noteMut.isPending}
                      onClick={() => noteMut.mutate({ request_id: panelReq.id, note: noteDraft.trim() })}>
                      {noteMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Ajouter la note
                    </Button>
                  </div>
                  <div className="space-y-2 mt-3">
                    {panelNotes.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Aucune note</div>
                    ) : panelNotes.map((n: any) => (
                      <div key={n.id} className="bg-muted rounded p-2 text-sm">
                        <div className="text-xs text-muted-foreground">
                          {n.created_by_name ?? "Admin"} · {format(parseISO(n.created_at), "d MMM, HH:mm", { locale: fr })}
                        </div>
                        <div>{n.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents */}
                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4" /> Documents
                  </div>
                  <div>
                    <input id="hr-doc-upload" type="file" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ""; }} />
                    <Button size="sm" variant="outline" disabled={uploadingFile}
                      onClick={() => document.getElementById("hr-doc-upload")?.click()}>
                      {uploadingFile ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Téléverser
                    </Button>
                  </div>
                  <div className="space-y-1 mt-2">
                    {panelDocs.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Aucun document</div>
                    ) : panelDocs.map((d: any) => (
                      <div key={d.name} className="flex items-center justify-between bg-muted rounded p-2 text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="truncate">{d.name.replace(/^\d+_/, "")}</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => downloadDoc(d.name)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {panelReq.status === "pending" && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button disabled={decideMut.isPending} onClick={() => decideMut.mutate({ req: panelReq, decision: "approved" })}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approuver
                    </Button>
                    <Button variant="destructive" disabled={decideMut.isPending} onClick={() => setRefuseDialog(panelReq)}>
                      <XCircle className="h-4 w-4 mr-1" /> Refuser
                    </Button>
                    <Button variant="outline" onClick={() => setInfoDialog(panelReq)}>
                      <MessageSquare className="h-4 w-4 mr-1" /> Demander plus d'info
                    </Button>
                  </div>
                )}
                <div className="h-12" />
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
